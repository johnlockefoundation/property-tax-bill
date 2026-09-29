#!/usr/bin/env bash
#
# Builds the distributable zips from the working tree and then verifies the
# artifacts that actually ship.
#
# This exists because a relative path in an earlier build step wrote the zip
# somewhere other than where it was supposed to land, leaving a stale 1.0.0
# package in place while the source moved to 1.1.0. Everything here uses absolute
# paths, and the checks at the bottom run against the extracted zip rather than
# the source tree, so that class of mistake cannot pass silently again.
#
# Usage: bash tools/build.sh

set -euo pipefail

PLUGIN="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$PLUGIN/dist"
SRC="$PLUGIN"
STAGE="${TMPDIR:-/tmp}/ptx-build-$$"
VERIFY="${TMPDIR:-/tmp}/ptx-verify-$$"
PLUGIN_SLUG="nc-property-tax-bill"
trap 'rm -rf "$STAGE" "$VERIFY"' EXIT

VERSION="$(grep -m1 ' \* Version:' "$SRC/nc-property-tax-bill.php" | awk '{print $3}')"
echo "building $PLUGIN_SLUG $VERSION"

# --- stage -----------------------------------------------------------------
mkdir -p "$STAGE/$PLUGIN_SLUG"
rsync -a \
  --exclude .git \
  --exclude node_modules \
  --exclude tests \
  --exclude package.json \
  --exclude package-lock.json \
  --exclude .gitignore \
  --exclude .DS_Store \
  --exclude mu-plugin \
  --exclude '*-source.png' \
  --exclude tools \
  --exclude dist \
  --exclude '*.zip' \
  "$SRC/" "$STAGE/$PLUGIN_SLUG/"
cp "$SRC/mu-plugin/ptx-loader.php" "$STAGE/"

# --- versions agree ----------------------------------------------------------
# The plugin header, the mu-plugin loader and the npm package are three places
# the version is written down, and the loader's header is the one WordPress
# shows in the admin when the tool is installed as a must-use plugin. They drifted
# once already, so the build refuses to package a build where they disagree.
for v in "$SRC/mu-plugin/ptx-loader.php" "$SRC/package.json"; do
  got="$(grep -m1 -oE '(Version:[[:space:]]+|"version":[[:space:]]*")1\.[0-9]+\.[0-9]+' "$v" | grep -oE '1\.[0-9]+\.[0-9]+')"
  if [ "$got" != "$VERSION" ]; then
    echo "  FAIL: $(basename "$v") says $got, the plugin is $VERSION" >&2
    exit 1
  fi
done
echo "  loader and package.json agree with the plugin ($VERSION)"

# --- syntax ----------------------------------------------------------------
for f in "$STAGE/$PLUGIN_SLUG"/*.php "$STAGE/$PLUGIN_SLUG"/templates/*.php "$STAGE/ptx-loader.php"; do
  php -l "$f" > /dev/null
done
echo "  php syntax ok"

node --check "$STAGE/$PLUGIN_SLUG/assets/js/ptx-app.js"
node --check "$STAGE/$PLUGIN_SLUG/assets/js/ptx-calc.js"
echo "  js syntax ok"

# --- the shared calculation must be the demo's, byte for byte -------------
DEMO="$PLUGIN/../property-tax-demo"
if [ -f "$DEMO/calc.js" ]; then
  cmp "$STAGE/$PLUGIN_SLUG/assets/js/ptx-calc.js" "$DEMO/calc.js"
  cmp "$STAGE/$PLUGIN_SLUG/data/benchmarks.json" "$DEMO/data/benchmarks.json"
  echo "  calc.js and benchmarks.json byte-identical to the demo"
else
  echo "  WARNING: $DEMO not found; skipped the byte-identity check"
fi

# --- zip -------------------------------------------------------------------
mkdir -p "$DIST"
rm -f "$DIST/nc-property-tax-bill.zip" "$DIST/nc-property-tax-bill-mu.zip"
( cd "$STAGE" && zip -qr "$DIST/nc-property-tax-bill.zip" "$PLUGIN_SLUG" )
( cd "$STAGE" && zip -qr "$DIST/nc-property-tax-bill-mu.zip" ptx-loader.php "$PLUGIN_SLUG" )
echo "  wrote nc-property-tax-bill.zip and nc-property-tax-bill-mu.zip"

# --- verify the ARTIFACT, not the source ----------------------------------
mkdir -p "$VERIFY"
( cd "$VERIFY" && unzip -q "$DIST/nc-property-tax-bill.zip" )
cp "$SRC/tests/wp-stubs.php" "$VERIFY/"

shipped_version="$(grep -m1 ' \* Version:' "$VERIFY/$PLUGIN_SLUG/nc-property-tax-bill.php" | awk '{print $3}')"
if [ "$shipped_version" != "$VERSION" ]; then
  echo "  FAIL: zip contains $shipped_version, source is $VERSION" >&2
  exit 1
fi
echo "  zip version matches source ($shipped_version)"

# Nothing but the plugin's own files and docs may ship.
allowed='\.php$|\.md$|\.css$|\.js$|\.json$|\.png$'
if unzip -Z1 "$DIST/nc-property-tax-bill.zip" | grep -v '/$' | grep -vE "$allowed"; then
  echo "  FAIL: unexpected file type in the zip" >&2
  exit 1
fi
echo "  nothing unexpected shipped"

# The full-resolution original logo is kept in the repo, not shipped.
if unzip -Z1 "$DIST/nc-property-tax-bill.zip" | grep -q -- '-source\.png'; then
  echo "  FAIL: the unoptimised logo original is in the zip" >&2
  exit 1
fi
echo "  logo original excluded"

# Every file the plugin loads at runtime must be present in the zip.
for required in \
  nc-property-tax-bill.php \
  assets/css/ptx.css \
  assets/js/ptx-app.js \
  assets/js/ptx-calc.js \
  assets/images/logo.png \
  data/benchmarks.json \
  templates/bill.php \
  templates/method-disclosure.php \
  templates/methodology.php
do
  if [ ! -f "$VERIFY/$PLUGIN_SLUG/$required" ]; then
    echo "  FAIL: $required missing from the zip" >&2
    exit 1
  fi
done
echo "  all runtime files present"

# And the placeholders that used to leak dev tooling must not be.
if unzip -l "$DIST/nc-property-tax-bill.zip" | grep -qE "node_modules|/tests/|package.json"; then
  echo "  FAIL: dev files leaked into the zip" >&2
  exit 1
fi
echo "  no dev files in the zip"

# Render both shortcodes from the extracted zip and check the placements work.
cat > "$VERIFY/check.php" <<'PHP'
<?php
require 'wp-stubs.php';
require 'nc-property-tax-bill/nc-property-tax-bill.php';

$cases = array(
    'standalone'  => array(),
    'article'     => array('layout' => 'compact', 'heading_level' => 'h2', 'show_header' => 'no'),
    'site has h1' => array('heading_level' => 'h2'),
);
$bad = 0;
foreach ($cases as $label => $atts) {
    $h = NC_Property_Tax_Bill::render_bill($atts);
    preg_match('/class="(ptx[^"]*)" data-ptx/', $h, $m);
    preg_match('/<(h\d) class="ptx-title"/', $h, $t);
    $disclosure = str_contains($h, 'How we calculated this');
    $want_compact = ($label === 'article');
    $got_compact = str_contains($m[1], 'ptx-layout-compact');
    $want_h2 = ($label !== 'standalone');
    $got_h2 = ($t[1] === 'h2');
    $ok = ($got_compact === $want_compact) && ($got_h2 === $want_h2) && $disclosure;
    if (!$ok) { $bad++; }
    printf("  %s %-12s root=[%s] <%s> disclosure=%s\n",
        $ok ? 'ok  ' : 'FAIL', $label, $m[1], $t[1], $disclosure ? 'kept' : 'MISSING');
}
$doc = NC_Property_Tax_Bill::render_methodology();
$sections = substr_count($doc, '<h2>');
if ($sections !== 7) { $bad++; printf("  FAIL [ptx_methodology] %d sections, want 7\n", $sections); }
else { printf("  ok   methodology  %d sections\n", $sections); }
exit($bad === 0 ? 0 : 1);
PHP
php "$VERIFY/check.php"

echo
echo "built and verified $PLUGIN_SLUG $VERSION"
ls -lh "$DIST/nc-property-tax-bill.zip" "$DIST/nc-property-tax-bill-mu.zip" | awk '{print "  " $5, $9}'
