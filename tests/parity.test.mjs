import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN = path.join(HERE, "..");
const DEMO = path.join(PLUGIN, "..", "property-tax-demo");

const read = (...p) => readFileSync(path.join(...p), "utf8");
const pluginCalc = read(PLUGIN, "assets", "js", "ptx-calc.js");
const pluginCss = read(PLUGIN, "assets", "css", "ptx.css");
const pluginApp = read(PLUGIN, "assets", "js", "ptx-app.js");
const billTpl = read(PLUGIN, "templates", "bill.php");
const methodTpl = read(PLUGIN, "templates", "method-disclosure.php");

const hasDemo = existsSync(path.join(DEMO, "index.html"));

// calc.js is UMD, so it imports as CJS and lands on .default.
const PT = (await import(path.join(PLUGIN, "assets", "js", "ptx-calc.js"))).default;

/* ---------------------------------------------------------------------------
 * 1. The calculation contract is copied, not rewritten.
 *    ptx-calc.js is the demo's calc.js verbatim. If this fails, someone edited
 *    the plugin's copy of the shared math instead of changing it upstream.
 * ------------------------------------------------------------------------ */

test("ptx-calc.js is byte-identical to the demo's calc.js", { skip: !hasDemo && "demo repo not present" }, () => {
  assert.equal(pluginCalc, read(DEMO, "calc.js"));
});

test("bundled benchmarks.json is byte-identical to the demo's build output", { skip: !hasDemo && "demo repo not present" }, () => {
  assert.equal(read(PLUGIN, "data", "benchmarks.json"), read(DEMO, "data", "benchmarks.json"));
});

test("the receipt contract still computes as documented", () => {
  const county = { x: 27_010_853_334, act: 133_091_439, hyp: 135_442_505, savings_rate: 0.0437, below_benchmark: false };

  const r = PT.computeReceipt(500_000, county);
  assert.equal(r.ok, true);
  assert.ok(Math.abs(r.paid - (500_000 * county.act) / county.x) < 1e-9, "paid = V * act / x");
  assert.ok(Math.abs(r.could_have - r.paid * (1 - county.savings_rate)) < 1e-9, "could_have = paid * (1 - rate)");
  assert.ok(Math.abs(r.saved - r.paid * county.savings_rate) < 1e-9, "saved = paid * rate");
  assert.ok(Math.abs(r.saved - (r.paid - r.could_have)) < 1e-9, "saved reconciles with paid - could_have");
});

/* ---------------------------------------------------------------------------
 * 2. CSS is scoped.
 *    The demo styled bare elements (body, h1, *, .hidden). Inside a theme those
 *    either lose to the theme or override it. Every selector must be rooted at
 *    .ptx, so the tool renders the same on any theme and never styles the site.
 * ------------------------------------------------------------------------ */

function selectors(css) {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  // Walk rule by rule so nested @media blocks are flattened into the same list.
  for (const m of stripped.matchAll(/([^{}]+)\{/g)) {
    const prelude = m[1].trim();
    if (!prelude || prelude.startsWith("@")) continue;
    for (const part of prelude.split(",")) {
      const sel = part.trim();
      if (sel) out.push(sel);
    }
  }
  return out;
}

test("every CSS selector is rooted at a .ptx class", () => {
  const sels = selectors(pluginCss);
  assert.ok(sels.length > 40, `expected a ported stylesheet, found ${sels.length} selectors`);
  const leaks = sels.filter((s) => !/^\.ptx[\w-]*$/.test(rootToken(s)));
  assert.deepEqual(leaks, [], `unrooted selectors would leak into the theme: ${leaks.join(" | ")}`);
});

test("no selector uses an id, and any universal selector is a descendant of .ptx", () => {
  for (const sel of selectors(pluginCss)) {
    assert.ok(!/#[\w-]/.test(sel), `"${sel}" uses an id selector; ids are global, classes are not`);
    for (const compound of sel.split(/[\s>+~]+/)) {
      if (compound === "*") {
        assert.notEqual(rootToken(sel), "*", `"${sel}" uses a root-level universal selector`);
      }
    }
  }
});

test("the demo's palette and typefaces are carried over", () => {
  for (const token of ["#00467f", "#00325c", "#c41230", "#04843d", "#f3f4e7", "#fffdf6", "#e7f5ec", "Public Sans", "Courier Prime"]) {
    assert.ok(pluginCss.includes(token), `missing ${token}`);
  }
});

test("the receipt's torn-edge and barcode treatments survive", () => {
  assert.ok(pluginCss.includes(".ptx-receipt::before"), "top torn edge");
  assert.ok(pluginCss.includes(".ptx-receipt::after"), "bottom torn edge");
  assert.ok(pluginCss.includes("repeating-linear-gradient"), "barcode gradient");
  assert.ok(pluginCss.includes("drop-shadow(0 7px 16px"), "receipt drop shadow");
});

test("every declaration value is carried over from the demo's stylesheet", { skip: !hasDemo && "demo repo not present" }, () => {
  const demo = read(DEMO, "index.html");
  const style = demo.slice(demo.indexOf("<style>") + 7, demo.indexOf("</style>"));
  const values = (css) => {
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const map = new Map();
    // Values may wrap across lines (the barcode gradient does), so flatten
    // whitespace and drop it around brackets before comparing.
    for (const m of stripped.matchAll(/([a-z-]+)\s*:\s*([^;{}]+)[;}]/gi)) {
      const prop = m[1].toLowerCase();
      const value = norm(m[2]);
      if (!value) continue;
      if (!map.has(prop)) map.set(prop, new Set());
      map.get(prop).add(value);
    }
    return map;
  };

  const from = values(style);
  const to = values(pluginCss);
  const missing = [];
  for (const [prop, vs] of from) {
    for (const v of vs) {
      if (![...(to.get(prop) || [])].includes(v)) missing.push(`${prop}: ${v}`);
    }
  }
  assert.deepEqual(missing, [], "declarations dropped or altered in the port");
  assert.ok([...from.values()].reduce((n, s) => n + s.size, 0) > 150, "the demo stylesheet was found");
});

/* ---------------------------------------------------------------------------
 * 3. PHP markup and JS agree on class names.
 *    The demo addressed its DOM by id. The plugin had to move to classes, and
 *    the two sides are separate files that nothing type-checks. If a class is
 *    renamed in the template but not in the app, the tool renders and then
 *    silently does nothing — so pin the contract.
 * ------------------------------------------------------------------------ */

test("every class the app looks up exists in the template", () => {
  const looked = new Set([...pluginApp.matchAll(/querySelector\(\s*"\.([a-z0-9-]+)"/g)].map((m) => m[1]));
  assert.ok(looked.size > 15, `expected to extract the app's selectors, got ${looked.size}`);
  const missing = [...looked].filter((c) => !new RegExp(`class="[^"]*\\b${c}\\b`).test(billTpl));
  assert.deepEqual(missing, [], `app.js queries classes absent from bill.php: ${missing.join(", ")}`);
});

test("the classes the app writes to are present in the template", () => {
  const written = ["ptx-val", "ptx-pid"];
  const missing = written.filter((c) => !new RegExp(`class="[^"]*\\b${c}\\b`).test(billTpl) && !pluginApp.includes(c));
  assert.deepEqual(missing, []);
});

test("the visibility class is the plugin's own, not a global .hidden", () => {
  assert.ok(billTpl.includes("ptx-hidden"), "template must use ptx-hidden");
  assert.ok(pluginApp.includes("ptx-hidden"), "app must toggle ptx-hidden");
  assert.ok(!/(^|[^\w-])\.hidden\s*\{/.test(pluginCss), "a global .hidden rule would hide theme elements");
});

/* ---------------------------------------------------------------------------
 * 4. Methodology is retained verbatim.
 *    The disclosure and the long-form document are the tool's core editorial
 *    content. Compare them against the demo rather than eyeballing.
 * ------------------------------------------------------------------------ */

const pairs = (html) =>
  [...html.matchAll(/<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g)].map((m) => [m[1].trim(), m[2].trim()]);

test("the in-tool disclosure is verbatim from the demo", { skip: !hasDemo && "demo repo not present" }, () => {
  const demo = pairs(read(DEMO, "index.html"));
  const port = pairs(methodTpl);
  assert.equal(port.length, demo.length, "disclosure item count changed");
  assert.deepEqual(port, demo, "disclosure wording changed");
});

test("the long-form methodology retains every section heading", { skip: !hasDemo && "demo repo not present" }, () => {
  const headings = [...read(DEMO, "docs", "methodology.html").matchAll(/<h2>([\s\S]*?)<\/h2>/g)]
    .map((m) => text(m[1]))
    .filter(Boolean);
  const port = [...read(PLUGIN, "templates", "methodology.php").matchAll(/<h2>([\s\S]*?)<\/h2>/g)].map((m) => text(m[1]));
  assert.deepEqual(port, headings, "methodology sections changed");
});

test("the receipt's printed labels and framing are unchanged", () => {
  for (const label of [
    "See what you could have saved",
    "What you paid",
    "What you could have paid",
    "You could have saved",
    "*** THANK YOU ***",
    "Property Tax Receipt",
    "--Select a County--",
    "Partial addresses are OK. Click or tap your address when it appears.",
  ]) {
    assert.ok(billTpl.includes(label) || pluginApp.includes(label), `missing receipt copy: ${label}`);
  }
});

test("status and empty-state strings are unchanged", () => {
  for (const s of [
    "Searching…",
    "No residential matches found. Try a street name or house number, or choose your county above.",
    "Search failed (source unavailable). Please try again.",
    "No residential properties matched. Check the spelling or try a nearby street name.",
    "The per-property comparison is unavailable for this county yet.",
    "The per-property comparison is unavailable for this parcel.",
    "was below the maximum allowed under a levy limit, so this property would not have saved anything.",
  ]) {
    assert.ok(billTpl.includes(s) || pluginApp.includes(s), `missing string: ${s}`);
  }
});

test("the search contract and candidate cap are preserved", () => {
  assert.ok(pluginApp.includes("services.nconemap.gov/secure/rest/services/NC1Map_Parcels/MapServer/0/query"), "OneMap endpoint");
  assert.ok(pluginApp.includes("parno,siteadd,parval,parvaltype,parusecode,parusedesc,improvval,stcntyfips,cntyfips"), "outFields");
  assert.ok(pluginApp.includes("stcntyfips LIKE '37%'"), "statewide fallback filter");
  assert.ok(/var MAX_CANDIDATES = 8;/.test(pluginApp), "candidate cap of 8");
  assert.ok(/var RESULT_LIMIT = 40;/.test(pluginApp), "resultRecordCount of 40");
  assert.ok(pluginApp.includes("PT.isUsableResidential"), "residential filter");
  assert.ok(pluginApp.includes("Number(a.improvval) > 0"), "no-land-use-data fallback");
  assert.ok(pluginApp.includes('Math.round(100 * receipt.rate) + "% lower"'), "percent is the published rate");
});

test("the layout responds to its own column, not just the viewport", () => {
  assert.ok(/container-type:\s*inline-size/.test(pluginCss), ".ptx must be a query container");
  assert.ok(/container-name:\s*ptx/.test(pluginCss), "the container must be named");
  assert.ok(/@container\s+ptx\s*\(max-width:\s*760px\)/.test(pluginCss), "narrow-column breakpoint");
  // The demo's viewport breakpoints stay as a fallback for older browsers.
  assert.ok(/@media\s*\(max-width:\s*900px\)/.test(pluginCss), "viewport fallback kept");
  assert.ok(/@media\s*\(max-width:\s*620px\)/.test(pluginCss));
});

test("compact layout is single-column and only reachable via the class", () => {
  const compact = /(^|[\s,}])\.ptx-layout-compact\s+[\.ptx][^{]*\{/gm;
  assert.ok(compact.test(pluginCss), "compact rules exist");
  const rules = pluginCss.slice(pluginCss.indexOf(".ptx-layout-compact"));
  assert.match(rules, /\.ptx-layout-compact \.ptx-cols\s*\{\s*flex-direction: column;/);
  assert.match(rules, /\.ptx-layout-compact \.ptx-search-row\s*\{\s*flex-direction: column;/);
  assert.match(rules, /\.ptx-layout-compact \.ptx-results\s*\{[^}]*width: 100%;/);
  // Compact must not touch the receipt's own metrics — those are the demo's.
  assert.ok(!/\.ptx-layout-compact \.ptx-receipt\s*\{[^}]*(font-size|width:\s*3)/.test(rules),
    "compact must not restyle the receipt itself");
});

test("the tool survives its own containment context", () => {
  // container-type applies containment, which would break a fixed-position child.
  assert.ok(!/position:\s*fixed/.test(pluginCss), "no fixed positioning inside a containment context");
  assert.ok(/\.ptx-receipt\s*\{[^}]*position: relative;/.test(pluginCss), "the receipt anchors relatively");
});

/* ---------------------------------------------------------------------------
 * 5. Multi-instance safety.
 *    The demo had one implicit instance. The plugin must tolerate two.
 * ------------------------------------------------------------------------ */

test("the app holds no module-level selection state", () => {
  for (const forbidden of [/^let BENCHMARKS/m, /^let SELECTED/m, /^let COUNTY/m]) {
    assert.ok(!forbidden.test(pluginApp), "state must live on the instance");
  }
  assert.ok(pluginApp.includes("this.benchmarks"), "per-instance benchmarks");
  assert.ok(pluginApp.includes("this.county"), "per-instance selected county");
});

test("the app scopes its DOM lookups to its own root", () => {
  assert.ok(!/document\.getElementById/.test(pluginApp), "must not use document.getElementById");
  assert.ok(pluginApp.includes("rootEl.querySelector"), "lookups go through the instance root");
  assert.ok(pluginApp.includes('querySelectorAll("[data-ptx]")'), "boot scans for instances");
  assert.ok(pluginApp.includes('data-ptx-ready'), "an instance is only bound once");
});

test("the app guards against double execution", () => {
  assert.ok(pluginApp.includes("root.__PTX_BILL__"), "idempotent on re-enqueue");
});

/* ------------------------------------------------------------------------- */

/** The leftmost compound of a selector, minus any pseudo-class or attribute. */
function rootToken(sel) {
  return sel.split(/[\s>+~]+/)[0].split(/[:[]/)[0];
}

/** A CSS value, comparable across formatting: 0.5 == .5, and no space around brackets. */
function norm(value) {
  return String(value)
    .toLowerCase()
    .replace(/0\.(\d)/g, ".$1")
    .replace(/\s*([(,)])\s*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Markup to comparable text: tags out, HTML entities decoded, whitespace collapsed. */
function text(html) {
  return decode(
    String(html)
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(d))
    .replace(/&mdash;/g, "—")
    .replace(/&middot;/g, "·")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

/* -------------------------------------------------------------------------
 * 6. Placement semantics.
 *    The tool ships in an article as well as on a page, so its heading has to
 *    be settable — two h1s on one page is a real defect, not a nitpick.
 * ---------------------------------------------------------------------- */

test("the heading tag is configurable and validated", () => {
  // Collapse whitespace so the assertions do not depend on alignment padding.
  const flat = billTpl.replace(/\s+/g, " ");
  assert.ok(flat.includes("preg_match( '/^h[1-6]$/i'"), "the level is validated against h1-h6");
  assert.ok(flat.includes("$ptx_head = preg_match"), "the tag is chosen in the template");
  assert.ok(flat.includes("esc_html($ptx_head); ?> class=\"ptx-title\""), "the chosen tag opens the heading");
  assert.ok(flat.includes("</<?php echo esc_html($ptx_head); ?>"), "the chosen tag closes it");
  assert.ok(!billTpl.includes('<h1 class="ptx-title"'), "the heading tag is not hardcoded");
});
