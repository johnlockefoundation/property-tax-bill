import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { JSDOM } from "jsdom";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN = path.join(HERE, "..");
const read = (...p) => readFileSync(path.join(...p), "utf8");

const CALC = read(PLUGIN, "assets", "js", "ptx-calc.js");
const APP = read(PLUGIN, "assets", "js", "ptx-app.js");
const BENCHMARKS = JSON.parse(read(PLUGIN, "data", "benchmarks.json"));

const money = (n) =>
  "$" +
  Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Render a shortcode through the plugin's real PHP templates. */
function render(which = "ptx_bill", atts = []) {
  const php = path.join(HERE, "render-markup.php");
  const res = spawnSync("php", [php, which, ...atts], { encoding: "utf8" });
  if (res.status !== 0) throw new Error(`php failed: ${res.stderr}`);
  return res.stdout;
}

/** An NC OneMap query response carrying one Mecklenburg residential parcel. */
function oneMap(parcel) {
  return JSON.stringify({
    features: [
      {
        attributes: {
          parno: "0170110",
          siteadd: "1000 E WOODLAWN RD",
          parval: parcel.value,
          parvaltype: "0",
          parusecode: "R",
          parusedesc: "SINGLE FAMILY",
          improvval: 250000,
          stcntyfips: parcel.stcntyfips,
          cntyfips: parcel.cntyfips,
        },
      },
    ],
  });
}

const VALUE = 500000;
const MECK = { value: VALUE, stcntyfips: "37119", cntyfips: "119" };

/** URLSearchParams bodies are form-encoded; assertions read the decoded form. */
const form = (body) => decodeURIComponent(String(body).replace(/\+/g, " "));

/**
 * Boot the rendered markup in jsdom with a stubbed network, and hand back the
 * window plus a helper for letting the app's promise chains settle.
 */
function boot({ billHtml, parcels = oneMap(MECK), label = "" } = {}) {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${billHtml ?? render()}</body></html>`, {
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  const calls = [];

  window.fetch = (url, opts) => {
    calls.push({ url: String(url), body: opts && opts.body });
    const u = String(url);
    if (u.includes("benchmarks.json")) {
      return Promise.resolve({ json: () => Promise.resolve(BENCHMARKS) });
    }
    if (u.includes("MapServer")) {
      const body = typeof parcels === "function" ? parcels() : parcels;
      return Promise.resolve({ text: () => Promise.resolve(body) });
    }
    return Promise.reject(new Error("unexpected fetch: " + u));
  };

  window.eval(CALC);
  window.eval(APP);

  // The app chains several .then layers; each macrotask turn drains the
  // microtask queue in between, so a handful of turns settles it completely.
  const settle = async (rounds = 6) => {
    for (let i = 0; i < rounds; i++) await new Promise((r) => setTimeout(r, 0));
  };

  return { window, doc: window.document, settle, calls, label };
}

const root = (doc, i = 0) => doc.querySelectorAll("[data-ptx]")[i];
const $ = (el, sel) => el.querySelector(sel);

/* ---------------------------------------------------------------------------
 * Boot
 * ------------------------------------------------------------------------ */

test("the app boots, mounts an instance, and populates the county list", async () => {
  const { doc, settle } = boot();
  await settle();

  const r = root(doc);
  assert.equal(r.getAttribute("data-ptx-ready"), "1", "instance bound");
  assert.ok(r.classList.contains("ptx"), "root present");

  const options = $(r, ".ptx-select").querySelectorAll("option");
  assert.equal(options.length, 101, "placeholder plus 100 counties");

  const labels = [...options].map((o) => o.textContent);
  assert.equal(labels[0], "--Select a County--");
  assert.deepEqual(labels.slice(1, 4), ["Alamance County", "Alexander County", "Alleghany County"], "sorted by label");
  assert.ok(labels.includes("Moore County"));
  assert.ok(labels.includes("Mecklenburg County"));
});

/* ---------------------------------------------------------------------------
 * The happy path, with the real county numbers
 * ------------------------------------------------------------------------ */

test("searching an address lists candidates and renders a correct receipt", async () => {
  const { doc, settle, calls } = boot();
  await settle();
  const r = root(doc);

  $(r, ".ptx-input").value = "1000 E Woodlawn Rd";
  $(r, ".ptx-btn").click();
  await settle();

  const cands = $(r, ".ptx-cands").querySelectorAll("li");
  assert.equal(cands.length, 1, "one candidate");
  assert.match(cands[0].textContent, /1000 E WOODLAWN RD/);
  assert.match(cands[0].textContent, /\$500,000 · SINGLE FAMILY/);
  assert.match(cands[0].textContent, /Parcel 0170110/);

  // The receipt should be still hidden until a parcel is chosen.
  assert.ok($(r, ".ptx-address-body").classList.contains("ptx-hidden"));

  cands[0].click();

  const meck = BENCHMARKS.mecklenburg;
  const value = 500000;
  const paid = (value * meck.act) / meck.x;
  const rate = meck.savings_rate;

  assert.equal($(r, ".ptx-receipt-addr").textContent, "1000 E WOODLAWN RD");
  assert.match($(r, ".ptx-receipt-meta").textContent, /Parcel 0170110/);
  assert.match($(r, ".ptx-receipt-meta").textContent, /Assessed value \$500,000/);

  assert.equal($(r, ".ptx-receipt-brand").innerHTML, "2026 Mecklenburg County<br>Property Tax Receipt");
  assert.equal($(r, ".ptx-amt-paid").textContent, money(paid));
  assert.equal($(r, ".ptx-amt-could").textContent, money(paid * (1 - rate)));
  assert.equal($(r, ".ptx-amt-saved").textContent, money(paid * rate));
  assert.equal($(r, ".ptx-receipt-total-pct").textContent, `OR ${Math.round(100 * rate)}% lower`);

  // The published percentage and the dollars must agree, per the contract.
  const printed = Number($(r, ".ptx-receipt-total-pct").textContent.match(/(\d+)%/)[1]);
  assert.ok(Math.abs(printed - 100 * rate) <= 0.5, "printed percent is the published rate, rounded");
  assert.ok(Math.abs(paid * rate - (paid - paid * (1 - rate))) < 1e-6, "saved reconciles with paid - could_have");

  // The county was inferred from the parcel and selected for the reader.
  assert.equal($(r, ".ptx-select").value, "mecklenburg");
  assert.ok(!(r.querySelector(".ptx-address-body").classList.contains("ptx-hidden")), "receipt body shown");
  assert.ok($(r, ".ptx-below").classList.contains("ptx-hidden"), "no below-benchmark note");

  const onemap = calls.filter((c) => c.url.includes("MapServer"));
  assert.equal(onemap.length, 2, "one statewide probe to infer the county, one scoped query");
  assert.match(form(onemap[0].body), /stcntyfips LIKE '37%'/);
  assert.match(form(onemap[1].body), /stcntyfips = '37119'/);
  assert.match(form(onemap[1].body), /resultRecordCount=40/);
});

test("an explicit county selection skips the statewide probe", async () => {
  const { doc, settle, calls } = boot();
  await settle();
  const r = root(doc);

  $(r, ".ptx-select").value = "mecklenburg";
  $(r, ".ptx-select").dispatchEvent(new r.ownerDocument.defaultView.Event("change"));
  $(r, ".ptx-input").value = "1000 E Woodlawn Rd";
  $(r, ".ptx-btn").click();
  await settle();

  const onemap = calls.filter((c) => c.url.includes("MapServer"));
  assert.equal(onemap.length, 1);
  assert.match(form(onemap[0].body), /stcntyfips = '37119'/);
  assert.equal($(r, ".ptx-cands").querySelectorAll("li").length, 1);
});

/* ---------------------------------------------------------------------------
 * Below-benchmark counties render the sentence, not a receipt
 * ------------------------------------------------------------------------ */

for (const slug of ["alamance", "moore"]) {
  test(`${BENCHMARKS[slug].label} (below benchmark) shows the no-savings sentence`, async () => {
    const c = BENCHMARKS[slug];
    const { doc, settle } = boot({
      parcels: oneMap({ value: VALUE, stcntyfips: c.fips, cntyfips: c.fips.slice(2) }),
    });
    await settle();
    const r = root(doc);

    $(r, ".ptx-input").value = "1 Main St";
    $(r, ".ptx-btn").click();
    await settle();
    $(r, ".ptx-cands").querySelector("li").click();

    const name = c.label.replace(/ County$/, "");
    assert.equal(
      $(r, ".ptx-below").textContent,
      `Property tax rate growth in ${name} County was below the maximum allowed under a levy limit, so this property would not have saved anything.`
    );
    assert.ok(!$(r, ".ptx-below").classList.contains("ptx-hidden"), "sentence shown");
    assert.ok($(r, ".ptx-receipt").classList.contains("ptx-hidden"), "receipt suppressed");
    assert.ok($(r, ".ptx-address-body").classList.contains("ptx-hidden"), "totals never shown");
  });
}

/* ---------------------------------------------------------------------------
 * Non-residential and empty results
 * ------------------------------------------------------------------------ */

test("commercial parcels are filtered out and the empty state appears", async () => {
  const { doc, settle, window } = boot({
    parcels: JSON.stringify({
      features: [
        { attributes: { parno: "1", siteadd: "100 COMMERCIAL ST", parval: 900000, parusecode: "C", parusedesc: "COMMERCIAL", improvval: 500000, stcntyfips: "37119" } },
      ],
    }),
  });
  await settle();
  const r = root(doc);

  $(r, ".ptx-select").value = "mecklenburg";
  $(r, ".ptx-select").dispatchEvent(new window.Event("change"));
  $(r, ".ptx-input").value = "100 Commercial St";
  $(r, ".ptx-btn").click();
  await settle();

  assert.equal($(r, ".ptx-cands").querySelectorAll("li").length, 0);
  assert.ok(!$(r, ".ptx-nores").classList.contains("ptx-hidden"), "no-results note shown");
});

test("counties that ship no land-use data still match on improvement value", async () => {
  const macon = BENCHMARKS.macon;
  const { doc, settle } = boot({
    parcels: JSON.stringify({
      features: [
        { attributes: { parno: "1", siteadd: "1 WAY HOME RD", parval: 250000, parusecode: "", parusedesc: "", improvval: 90000, stcntyfips: macon.fips } },
        { attributes: { parno: "2", siteadd: "2 VACANT RD", parval: 40000, parusecode: "", parusedesc: "", improvval: 0, stcntyfips: macon.fips } },
      ],
    }),
  });
  await settle();
  const r = root(doc);

  $(r, ".ptx-input").value = "Home Rd";
  $(r, ".ptx-btn").click();
  await settle();

  const cands = $(r, ".ptx-cands").querySelectorAll("li");
  assert.equal(cands.length, 1, "only the improved parcel survives");
  assert.match(cands[0].textContent, /1 WAY HOME RD/);
});

test("a service error surfaces the demo's failure copy", async () => {
  const { doc, settle } = boot({ parcels: JSON.stringify({ error: { message: "bad query" } }) });
  await settle();
  const r = root(doc);

  $(r, ".ptx-select").value = "mecklenburg";
  $(r, ".ptx-select").dispatchEvent(new r.ownerDocument.defaultView.Event("change"));
  $(r, ".ptx-input").value = "1000 E Woodlawn Rd";
  $(r, ".ptx-btn").click();
  await settle();

  assert.equal($(r, ".ptx-status").textContent, "Search failed (source unavailable). Please try again.");
  assert.equal($(r, ".ptx-btn").disabled, false, "the button is re-enabled");
});

test("match counts read the way the demo reads them", async () => {
  const many = JSON.stringify({
    features: Array.from({ length: 12 }, (_, i) => ({
      attributes: {
        parno: `P${i}`,
        siteadd: `${100 + i} MAIN ST`,
        parval: 300000 + i,
        parusecode: "R",
        parusedesc: "SINGLE FAMILY",
        improvval: 100000,
        stcntyfips: "37119",
      },
    })),
  });
  const { doc, settle } = boot({ parcels: many });
  await settle();
  const r = root(doc);

  $(r, ".ptx-select").value = "mecklenburg";
  $(r, ".ptx-select").dispatchEvent(new r.ownerDocument.defaultView.Event("change"));
  $(r, ".ptx-input").value = "Main St";
  $(r, ".ptx-btn").click();
  await settle();

  assert.equal($(r, ".ptx-cands").querySelectorAll("li").length, 8, "capped at eight");
  assert.equal($(r, ".ptx-status").textContent, "12 residential matches (showing first 8).");
});

/* ---------------------------------------------------------------------------
 * Multiple instances, and a11y affordances that must survive
 * ------------------------------------------------------------------------ */

test("two shortcodes on one page stay independent", async () => {
  const html = render() + render();
  const { doc, settle } = boot({ billHtml: html });
  await settle();

  const [a, b] = [...doc.querySelectorAll("[data-ptx]")];
  assert.ok(a && b, "two roots");
  assert.notEqual(a, b);

  const selA = $(a, ".ptx-select");
  const selB = $(b, ".ptx-select");
  assert.equal(selA.querySelectorAll("option").length, 101);
  assert.equal(selB.querySelectorAll("option").length, 101, "each instance fills its own list");

  selA.value = "mecklenburg";
  selA.dispatchEvent(new a.ownerDocument.defaultView.Event("change"));
  $(a, ".ptx-input").value = "1000 E Woodlawn Rd";
  $(a, ".ptx-btn").click();
  await settle();

  assert.equal($(a, ".ptx-cands").querySelectorAll("li").length, 1, "A searched");
  assert.equal($(b, ".ptx-cands").querySelectorAll("li").length, 0, "B untouched");
  assert.equal($(b, ".ptx-select").value, "", "B's county selection unaffected");
});

test("the benchmark data is fetched once even with two instances", async () => {
  const html = render() + render();
  const { settle, calls } = boot({ billHtml: html });
  await settle();
  assert.equal(calls.filter((c) => c.url.includes("benchmarks.json")).length, 1, "shared fetch cache");
});

test("search state resets when the county changes", async () => {
  const { doc, settle, window } = boot();
  await settle();
  const r = root(doc);

  $(r, ".ptx-input").value = "1000 E Woodlawn Rd";
  $(r, ".ptx-btn").click();
  await settle();
  $(r, ".ptx-cands").querySelector("li").click();
  assert.ok(!$(r, ".ptx-address-body").classList.contains("ptx-hidden"), "receipt visible");

  $(r, ".ptx-select").value = "durham";
  $(r, ".ptx-select").dispatchEvent(new window.Event("change"));

  assert.equal($(r, ".ptx-input").value, "", "address cleared");
  assert.equal($(r, ".ptx-cands").querySelectorAll("li").length, 0, "candidates cleared");
  assert.ok($(r, ".ptx-address-body").classList.contains("ptx-hidden"), "receipt reset");
  assert.ok(!$(r, ".ptx-receipt-instruction").classList.contains("ptx-hidden"), "instruction returns");
  assert.equal($(r, ".ptx-status").textContent, "");
});

test("empty input does not call the service", async () => {
  const { doc, settle, calls } = boot();
  await settle();
  const r = root(doc);

  $(r, ".ptx-input").value = "   ";
  $(r, ".ptx-btn").click();
  await settle();

  assert.equal(calls.filter((c) => c.url.includes("MapServer")).length, 0);
  assert.equal($(r, ".ptx-status").textContent, "");
});

/* ---------------------------------------------------------------------------
 * The methodology page renders as content
 * ------------------------------------------------------------------------ */

test("layout=compact renders a single-column frame and still works", async () => {
  const { doc, settle } = boot({ billHtml: render("ptx_bill", ["--layout=compact"]) });
  await settle();
  const r = root(doc);

  assert.ok(r.classList.contains("ptx"), "root still scoped");
  assert.ok(r.classList.contains("ptx-layout-compact"), "compact modifier present");
  assert.equal($(r, ".ptx-cols").classList.contains("ptx-cols"), true, "the frame the CSS targets exists");
  assert.equal($(r, ".ptx-receipt").className, "ptx-receipt", "the receipt keeps its own class");

  // The tool must still work in the compact frame.
  $(r, ".ptx-input").value = "1000 E Woodlawn Rd";
  $(r, ".ptx-btn").click();
  await settle();
  $(r, ".ptx-cands").querySelector("li").click();
  assert.notEqual($(r, ".ptx-amt-saved").textContent, "$0.00", "receipt still computes");
});

test("layout defaults to full, and only the exact value 'compact' opts in", async () => {
  const { doc } = boot();
  assert.equal(root(doc).className.trim(), "ptx", "default carries no modifier");

  for (const bogus of ["--layout=full", "--layout=COMPACT", "--layout=nonsense"]) {
    const { doc: d } = boot({ billHtml: render("ptx_bill", [bogus]) });
    const cls = root(d).className;
    if (bogus === "--layout=COMPACT") {
      // Lowercased before comparison, so the value is honoured case-insensitively.
      assert.ok(cls.includes("ptx-layout-compact"), `${bogus} should map to compact`);
    } else {
      assert.equal(cls.trim(), "ptx", `${bogus} should stay full`);
    }
  }
});

test("[ptx_methodology] renders the notes inside the theme's page", () => {
  const html = render("ptx_methodology");
  assert.ok(!/<html|<head|<body/i.test(html), "the doc is a fragment, not a document");

  const { doc } = boot({ billHtml: html });
  const d = doc.querySelector(".ptx-doc");

  assert.ok(d, "doc root");
  assert.equal(d.querySelectorAll("h2").length, 7);
  assert.match(d.querySelector("h1").textContent, /Methodology Notes/);
  assert.match(d.textContent, /savings_rate = \(Σ actual − Σ hypothetical\) \/ Σ actual/);
  assert.match(d.textContent, /Alamance and Moore/);
  assert.match(d.textContent, /not an official tax assessment/);
});

test("heading_level sets the tag, and a bad value falls back to h1", () => {
  for (const lvl of ["h1", "h2", "h3"]) {
    const { doc } = boot({ billHtml: render("ptx_bill", [`--heading_level=${lvl}`]) });
    assert.equal(root(doc).querySelector(`.ptx-title`).tagName, lvl.toUpperCase());
  }
  for (const bogus of ["h7", "div", "script", "h1 onmouseover=x"]) {
    const { doc } = boot({ billHtml: render("ptx_bill", [`--heading_level=${bogus}`]) });
    const el = root(doc).querySelector(".ptx-title");
    assert.equal(el.tagName, "H1", `${bogus} must not be emitted`);
  }
});

test("the article placement does not introduce a second h1", async () => {
  const html =
    "<h1>Article title</h1><p>Body copy.</p>" +
    render("ptx_bill", ["--layout=compact", "--heading_level=h2", "--show_header=no"]);
  const { doc, settle } = boot({ billHtml: html });
  await settle();
  assert.equal(doc.querySelectorAll("h1").length, 1, "only the article's own h1");
  assert.equal(doc.querySelectorAll("h2").length, 1, "the tool's heading is an h2");
  assert.equal(doc.querySelector(".ptx-header"), null, "no brand bar in the article");
});
