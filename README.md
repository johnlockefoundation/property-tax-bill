# NC Property Tax Bill — WordPress plugin

The `property-tax-demo` tool (currently on GitHub Pages) as a WordPress plugin, with the
in-tool **"How we calculated this"** methodology disclosure and the long-form
**Methodology Notes** both carried across.

Nothing about the calculation, the data, or the receipt changes. The plugin is the same
tool, re-hosted.

- **Shortcode:** `[ptx_bill]`
- **Block:** "NC Property Tax Bill" (Gutenberg)
- **Methodology page:** `[ptx_methodology]`

Placed two ways, with different settings — see `PLACEMENT.md` for the copy-and-paste version:

| Placement | Permalink | Shortcode |
| --- | --- | --- |
| Standalone page | `/property-tax-savings-calculator` | `[ptx_bill heading_level="h2"]` |
| Article | inside the post | `[ptx_bill layout="compact" heading_level="h2" show_header="no"]` |

---

## Install

Requires WordPress 6.0+ and PHP 7.4+. No build step, no runtime dependencies.

```
wp-content/plugins/nc-property-tax-bill/   <- this directory
```

Zip it, or `wp plugin install` from a checkout, or copy it in over SSH and activate
**NC Property Tax Bill** in Plugins. The bundled logo and county data go with it.

Then put `[ptx_bill]` on a page, or insert the block. Assets load only on views that
actually contain the tool, and are cache-busted on file `mtime` so a plugin update
invalidates CDN and page caches without a version bump.

`npm install` is only needed to run the tests. `node_modules` is not used at runtime.

---

## What is on the page

Enter your address, pick the matching residential parcel, and the tool prints
a receipt for **FY2025-26**: what you paid, what you could have paid, and what you could
have saved, as dollars and as a percent.

It covers all 100 counties. County-wide property tax only — municipal, school and special
district taxes are out of scope, and the receipt says so.

Two counties (Alamance, Moore) are at or below the benchmark and get an explanation
instead of a receipt.

### Where a receipt is not possible

For 96 of the 100 counties the reader gets a receipt for their parcel. Four do not, and
the tool says so rather than reporting a failed search:

| Situation | Counties | What the reader gets |
| --- | --- | --- |
| No parcel address is published anywhere the tool can reach | Franklin, Hoke, Perquimans, Richmond | The county's savings rate, and why there is no receipt |
| Published, but only in a form the tool cannot rely on | — | — |
| Apartment blocks rather than an ordinary residence | any county, by parcel | No match |

The four are decided by FIPS in `calc.js`, so a county moving between lists is a one-line
change. The reader's address is never stored; see the note under the search box.

## Methodology

Two pieces, both preserved verbatim from the demo:

| Where | What it is |
| --- | --- |
| The **"How we calculated this"** disclosure under the tool | The short, in-context note. Rendered by `templates/method-disclosure.php`. Suppress with `show_method="no"`. |
| The `[ptx_methodology]` page | The long-form notes: sources, benchmark construction, the calculation contract, caveats. Rendered by `templates/methodology.php`. |

The calculation contract is unchanged:

```
paid       = V * act / x
could_have = paid * (1 - savings_rate)
saved      = paid * savings_rate      # paid - could_have
percent    = 100 * savings_rate       # the "NN% lower" figure
```

`assets/js/ptx-calc.js` is a **byte-identical copy** of the demo's `calc.js` and
`data/benchmarks.json` a byte-identical copy of its build output. A test enforces both, so
if either is edited here instead of upstream, the suite fails.

---

## Migration map

| Demo | Plugin |
| --- | --- |
| `index.html` `<style>` | `assets/css/ptx.css`, every selector scoped under `.ptx` |
| `index.html` `<script>` | `assets/js/ptx-app.js` |
| `index.html` body markup | `templates/bill.php` |
| `index.html` `<details class="method">` | `templates/method-disclosure.php` |
| `docs/methodology.html` | `templates/methodology.php` + `.ptx-doc` styles |
| `calc.js` | `assets/js/ptx-calc.js` (byte-identical) |
| `data/benchmarks.json` | `data/benchmarks.json` (byte-identical) |
| `Locke-revised-logo-white.png` | `assets/images/logo.png` |
| `archive/property-tax-widget/county-tax-widget.php` | the shortcode/enqueue pattern this follows |

### One asset was optimised

The bundled logo was a 14,177 x 4,096 px PNG — about 345 megapixels, fetched in order to be
displayed 30px tall. It is now 415 x 120 px (11KB rather than 422KB), which is still 4x the
density it renders at, so it is visually identical. The original is kept alongside it as
`logo-source.png` and is not shipped. This was inherited from the demo; if the corporate site
already serves a logo asset, pass it to `logo="..."` and drop ours.

### The two changes that were unavoidable

**1. IDs became classes.** The demo was a whole page, so it addressed its DOM with
`#countySelect`, `#bPaid` and friends. A WordPress page can carry the shortcode more than
once and the theme owns everything around it, so ids would collide with the theme and
between instances. Markup and script both moved to `.ptx-` classes; `ptx-app.js` scopes
every lookup to its own root element. `.hidden` became `.ptx-hidden` — a global
`display: none !important` would hide theme elements.

**2. The layout follows its container, and the heading is settable.** The demo's layout is
two columns and collapsed only on *viewport* width. That is fine for a page and wrong for an
article: an article column can be 700px wide on a 1400px screen, so the viewport query never
fires and you get a squeezed search box beside a receipt that has fallen below the fold. The
tool is now a CSS query container and collapses on the width it is actually given, with the
original media queries kept as a fallback. Separately, the tool's heading defaults to an
`h1`; embedded in an article that would be a second `h1` on the page, so `heading_level` is
settable and validated against `h1`–`h6`.

**3. CSS is scoped.** The demo styled `body`, `h1`, `*` and `.card`. Inside a theme those
either lose to the theme or override it. Every selector is now rooted at `.ptx`, and the
demo's values are unchanged, so the receipt renders as before on any theme. Where the demo
leaned on a user-agent default (an `h1`'s weight, a `p`'s margin) the value is now stated
explicitly. Custom properties moved from `:root` to `.ptx` so two instances cannot
redefine each other's palette.

A test fails the build if an unscoped selector, an id selector, or a global `.hidden` rule
reappears.

---

## Shortcode attributes

All optional; the defaults are the demo's copy.

| Attribute | Default | Notes |
| --- | --- | --- |
| `heading` | How much could a property tax levy limit save you? | The `h1` |
| `lede` | Enter your address to see how much lower your county property tax bill… if levy growth had been limited… | Intro paragraph |
| `brand` | NC Property Tax Savings Calculator | Text in the blue bar |
| `logo` | bundled `assets/images/logo.png` | |
| `show_header` | `yes` | The blue brand bar. `no` to sit inside the theme's own header |
| `show_method` | `yes` | The "How we calculated this" disclosure |
| `layout` | `full` | `compact` is the single-column layout for an article column |
| `heading_level` | `h1` | `h2` where the page or article already has an `h1` |
| `src` | the bundled `data/benchmarks.json` | Point at a CDN if preferred |

```
[ptx_bill]
[ptx_bill heading_level="h2"]
[ptx_bill show_header="no"]
[ptx_bill layout="compact" heading_level="h2" show_header="no"]
[ptx_bill heading="What a levy limit would have saved Mecklenburg homeowners"]
[ptx_bill src="https://cdn.example.org/benchmarks.json"]
```

## Filters

| Filter | Purpose |
| --- | --- |
| `ptx_default_heading` / `ptx_default_lede` / `ptx_default_brand` | Reword the defaults site-wide, without forking the template |
| `ptx_benchmarks_url` | Serve the county data from a CDN or custom path |
| `ptx_load_fonts` | `false` to self-host Public Sans and Courier Prime instead of requesting them from Google |
| `ptx_force_enqueue` | `true` to load assets on views the detector cannot see (a widget area, a custom template, an AJAX-injected panel) |
| `ptx_methodology_repo` | Replace the methodology page's repo footer, which otherwise points at the GitHub Pages project |

## Accessibility and theme notes

- The search status uses `role="status"`, the receipt region `aria-live="polite"`; both
  survive the port.
- Form controls reset `font-family` so the theme cannot restyle the receipt's type.
- The theme controls page width. The tool is a `max-width: 1020px` column and collapses to
  one column below 900px and 620px, as the demo did. If the theme's content column is
  narrower than ~760px, give the page a wider content template.
- `show_header="no"` is the option if the site already has a John Locke or Locke-brand
  header and the blue bar would be a second one.

## Before this goes live

1. **Content-Security-Policy.** The receipt's torn top and bottom edges are inline
   `data:` SVG backgrounds. A strict `img-src` without `data:` will leave the receipt
   square-cornered. Add `img-src 'data: https://services.nconemap.gov` or replace the two
   `data:` URIs with a real SVG file.
2. **Google Fonts.** The demo loads Public Sans and Courier Prime from
   `fonts.googleapis.com`. Corporate environments often block that or proxy it. Either
   allow it, or self-host the two families and return `false` from `ptx_load_fonts`.
3. **The parcel and address calls are cross-origin POSTs.** Every county needs
   `connect-src` for `https://services.nconemap.gov`, and five counties need their own
   service allowed as well, because the statewide parcel layer publishes no address for
   them and the tool asks the county instead:

   | County | Host to allow |
   | --- | --- |
   | Orange | `https://gis.orangecountync.gov` |
   | Bladen | `https://gis.bladenco.org` |
   | Cabarrus | `https://location.cabarruscounty.us` |
   | Guilford | `https://gcgis.guilfordcountync.gov` |
   | Avery | `https://services1.arcgis.com` |

   These work from a plain page today, but confirm them behind the site's policy. A
   blocked host surfaces as the generic "Search failed (source unavailable)" rather than
   naming the county, so test one address in each of the five above and not only a
   Mecklenburg address, or a policy gap will look like an ordinary failed search.
   The Assessed value on every receipt still comes from `services.nconemap.gov`.
4. **The methodology page links to johnlocke.org** for the HB 1089 model legislation. Keep
   or drop depending on how the corporate site handles outbound editorial links.
5. **The methodology footer** names the GitHub repo. Replace via `ptx_methodology_repo`.

## Tests

```
npm install          # once; jsdom, dev-only
npm test             # parity + jsdom end-to-end + PHP render smoke
npm run build        # build the distributable zips, then verify the artifacts
```

`npm run build` is the only supported way to produce a zip. It stages the files, checks PHP
and JS syntax, asserts `calc.js` and `benchmarks.json` are still byte-identical to the demo,
zips, and then **verifies the extracted zip** — version, required files, absence of dev
files, and that both placements render. It exists because an earlier hand-rolled build once
left a stale package in place while the source moved on.

| Suite | What it covers |
| --- | --- |
| `tests/parity.test.mjs` | `ptx-calc.js` and `benchmarks.json` are byte-identical to the demo; CSS is fully scoped; every class the app queries exists in the template; the methodology disclosure, receipt labels, status strings, OneMap contract, candidate caps and the 8-candidate limit are unchanged; no module-level state |
| `tests/render.test.mjs` | Renders the real shortcode through PHP, boots it in jsdom, and drives the whole flow against the real county data: county inference, candidate rendering, receipt arithmetic, both below-benchmark counties, the no-land-use-data fallback, commercial filtering, service errors, two instances on one page, and the methodology page |
| `tests/render-smoke.php` | Renders both shortcodes and asserts the markup: escaping, no leftover ids, balanced tags, attribute overrides, filters, asset presence |

The parity suite's byte-identity checks skip if the `property-tax-demo` repo is not
present, so the plugin is testable on its own. Everything else runs anywhere.

The demo's own suite still applies to the shared math:

```
node --test ../property-tax-demo/test/calc.test.mjs
```

## Still to decide

- Whether the page ships with `show_header="yes"` (self-contained, faithful) or `no`
  (sits under the corporate header). Both are supported; the default is the faithful one.
- Whether `[ptx_methodology]` becomes a WP page, and who owns keeping it in step with the
  disclosure. The demo's convention was that a change to the numbers touches
  `calc.js`, the tests, the methodology doc and the in-page text together; that coupling
  now spans two repositories.
- Whether `data/benchmarks.json` is refreshed by copying from the demo's build step, or by
  moving `tools/build_benchmarks.mjs` and `data/source/` into the plugin. Copying is what
  the plugin does today, and the parity test enforces it.
