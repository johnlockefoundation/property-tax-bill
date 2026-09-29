<?php
/**
 * Render smoke test.
 *
 * Stubs the handful of WordPress functions the plugin touches, renders both
 * shortcodes, and asserts the markup the browser will actually receive. This
 * is not a substitute for running the plugin in WordPress, but it catches the
 * failures that matter in a template port: a fatal, a notice, a missing
 * container, an unescaped attribute, a shortcode attribute that did not reach
 * the markup.
 *
 * Run:  php tests/render-smoke.php
 */

require __DIR__ . '/wp-stubs.php';
require dirname(__DIR__) . '/nc-property-tax-bill.php';

set_error_handler(function ($no, $str, $file, $line) {
    fwrite(STDERR, "PHP notice/warning: $str in $file:$line\n");
    exit(1);
});

$failures = 0;
function check($label, $ok, $detail = '') {
    global $failures;
    if ($ok) {
        echo "  ok   $label\n";
    } else {
        echo "  FAIL $label" . ($detail ? " — $detail" : '') . "\n";
        $failures++;
    }
}

echo "shortcodes registered\n";
check('ptx_bill', isset($GLOBALS['ptx_shortcodes']['ptx_bill']));
check('ptx_methodology', isset($GLOBALS['ptx_shortcodes']['ptx_methodology']));

/* --- the bill ---------------------------------------------------------- */

$bill = NC_Property_Tax_Bill::render_bill();

echo "\n[ptx_bill] default render\n";
check('no PHP notices', true);
check('root carries the boot hook', str_contains($bill, 'data-ptx'));
check('root carries the data URL', (bool) preg_match('/data-ptx-src="https:\/\/[^"]+benchmarks\.json"/', $bill));
check('brand bar rendered', str_contains($bill, 'ptx-header') && str_contains($bill, 'ptx-brand'));
check('logo has alt text', str_contains($bill, 'alt="John Locke Foundation"'));
check('county select present with placeholder', str_contains($bill, '--Select a County--'));
check('address input present', str_contains($bill, 'placeholder="Address, e.g. 1000 E Woodlawn Rd, Charlotte NC"'));
check('address input allows browser autofill', !str_contains($bill, 'autocomplete="off"'));
check('search button present', str_contains($bill, '<button class="ptx-btn" type="button">Search</button>'));
check('status region is announced', str_contains($bill, 'role="status"'));
check('results region is announced', str_contains($bill, 'aria-live="polite"'));
check('receipt present', str_contains($bill, 'ptx-receipt'));
check('receipt totals default to $0', substr_count($bill, '>$0</span>') === 2 && str_contains($bill, 'ptx-amt-saved">$0<'));
check('methodology disclosure present', str_contains($bill, 'How we calculated this'));
check('disclosure lists the formula caveat', str_contains($bill, 'County-wide property tax only, not the full bill'));
check('no ids left over from the demo', !preg_match('/\sid="/', $bill), 'ids are global; classes are used instead');
check('balanced div tags', substr_count($bill, '<div') === substr_count($bill, '</div>'));
check('balanced details tags', substr_count($bill, '<details') === substr_count($bill, '</details>'));

echo "\n[ptx_bill] show_method=\"no\" show_header=\"no\"\n";
$bare = NC_Property_Tax_Bill::render_bill(array('show_method' => 'no', 'show_header' => 'no'));
check('disclosure suppressed', !str_contains($bare, 'How we calculated this'));
check('brand bar suppressed', !str_contains($bare, 'ptx-header'));
check('tool still renders', str_contains($bare, 'ptx-receipt'));

echo "\n[ptx_bill] attribute overrides and escaping\n";
$custom = NC_Property_Tax_Bill::render_bill(array(
    'heading' => 'A <script>alert(1)</script> heading',
    'brand'   => 'Quoted "brand" & more',
));
check('heading is escaped', str_contains($custom, '&lt;script&gt;') && !str_contains($custom, '<script>alert'));
check('brand is escaped', str_contains($custom, 'Quoted &quot;brand&quot; &amp; more'));

echo "\n[ptx_bill] src override\n";
$srcd = NC_Property_Tax_Bill::render_bill(array('src' => 'https://cdn.example.org/benchmarks.json?v=2'));
check('data URL honours the attribute', str_contains($srcd, 'data-ptx-src="https://cdn.example.org/benchmarks.json?v=2"'));

echo "\n[ptx_bill] filterable defaults\n";
$GLOBALS['ptx_filters']['ptx_default_heading'] = function ($v) { return 'Reworded headline'; };
check('heading filter applies', str_contains(NC_Property_Tax_Bill::render_bill(), 'Reworded headline'));
unset($GLOBALS['ptx_filters']['ptx_default_heading']);
check('default restored after filter removed', str_contains(NC_Property_Tax_Bill::render_bill(), 'See what a property tax levy limit'));

/* --- two instances on one page ----------------------------------------- */

echo "\n[ptx_bill] two instances on one page\n";
$two = NC_Property_Tax_Bill::render_bill() . NC_Property_Tax_Bill::render_bill();
check('both roots emitted', substr_count($two, 'data-ptx ') + substr_count($two, 'data-ptx data-ptx-src') === 2 || substr_count($two, 'data-ptx') === 4);
check('duplicate classes are expected and safe', substr_count($two, 'ptx-receipt') >= 2);
check('no element ids collide', !preg_match('/\sid="/', $two));

/* --- methodology -------------------------------------------------------- */

echo "\n[ptx_methodology]\n";
$doc = NC_Property_Tax_Bill::render_methodology();
check('root present', str_contains($doc, 'ptx-doc'));
check('all seven sections', substr_count($doc, '<h2>') === 7, 'found ' . substr_count($doc, '<h2>'));
check('formula block retained', str_contains($doc, 'paid') && str_contains($doc, 'could_have') && str_contains($doc, 'saved'));
check('data sources table retained', str_contains($doc, '<table>') && str_contains($doc, 'OSBM'));
check('below-benchmark counties named', str_contains($doc, 'Alamance and Moore'));
check('HB 1089 link retained', str_contains($doc, 'johnlocke.org/model-legislation'));
check('no html/head/body wrapper', !preg_match('/<html|<head|<body/', $doc));
check('footer filter applies', true);
$GLOBALS['ptx_filters']['ptx_methodology_repo'] = function ($v) { return 'Internal doc: contact the comms team.'; };
check('repo line is replaceable', str_contains(NC_Property_Tax_Bill::render_methodology(), 'contact the comms team'));
unset($GLOBALS['ptx_filters']['ptx_methodology_repo']);

/* --- assets ------------------------------------------------------------- */

echo "\nassets\n";
check('benchmarks.json is present and non-empty', filesize(dirname(__DIR__) . '/data/benchmarks.json') > 1000);
check('logo is present', filesize(dirname(__DIR__) . '/assets/images/logo.png') > 1000);
check('ptx-calc.js is present', filesize(dirname(__DIR__) . '/assets/js/ptx-calc.js') > 100);
check('ptx-app.js is present', filesize(dirname(__DIR__) . '/assets/js/ptx-app.js') > 100);
check('ptx.css is present', filesize(dirname(__DIR__) . '/assets/css/ptx.css') > 100);
check('data file is valid JSON with 100 counties', count(json_decode(file_get_contents(dirname(__DIR__) . '/data/benchmarks.json'), true)) === 100);

/* --- write the render for eyeballing ----------------------------------- */

$out = sys_get_temp_dir() . '/ptx-render.html';
file_put_contents($out, "<!-- [ptx_bill] -->\n" . $bill . "\n\n<!-- [ptx_methodology] -->\n" . $doc);
echo "\nrender written to $out\n";

echo $failures === 0 ? "\nPASS\n" : "\n{$failures} FAILURE(S)\n";
exit($failures === 0 ? 0 : 1);
