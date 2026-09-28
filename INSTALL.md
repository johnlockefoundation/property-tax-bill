# NC Property Tax Bill — install

For whoever administers this WordPress install. Nothing here needs a build step, a
database, or a server configuration change.

## 1. Install

**Plugins → Add New → Upload Plugin**, choose `nc-property-tax-bill.zip`, **Install Now**,
**Activate**.

It will appear as **NC Property Tax Bill**. Requires WordPress 6.0+ and PHP 7.4+, and is
untested-up-to WordPress 6.9 (it declares 6.0 because that is what it was built against).

Uninstalling is just deactivating and deleting the plugin. There is nothing stored in the
database, no options screen, and no scheduled work.

## 2. Put it on a page

Create a page titled **NC Property Tax Savings Calculator** with the slug
`property-tax-savings-calculator`, and add a **Custom HTML** block containing:

```
[ptx_bill heading_level="h2"]
```

`heading_level="h2"` is there because your theme almost certainly renders the page title as
the page's `<h1>`, and the tool has a heading of its own. Without it the page would have two.
The full set of options, and what each one is for, is in `PLACEMENT.md` in the plugin folder.

Or insert the **NC Property Tax Bill** block from the block inserter. Both produce the same
tool; the block just exposes a few options in the sidebar.

The tool's CSS and JavaScript load only on pages that actually contain it, so adding it does
not slow down the rest of the site.

## 3. What to check

Open the page and confirm:

- the county dropdown fills with **100 counties** — this is the signal that the bundled data
  file loaded, and the first thing to look at if the page is empty
- searching an address returns property matches
- choosing a property prints a receipt
- the page has exactly one `<h1>` (view source, search `<h1`) — the page title, not two

If a search fails with "Search failed (source unavailable)", the page is being blocked from
reaching NC OneMap — see below.

## 4. If the site has a Content-Security-Policy

The tool makes a cross-origin request to
`services.nconemap.gov` and draws the receipt's torn edges with inline `data:` images. If
your `Content-Security-Policy` header is strict, add:

```
connect-src 'self' https://services.nconemap.gov
img-src     'self' data:
```

Without those, searching fails silently and the receipt renders with square corners instead
of the torn paper edge. Both are cosmetic or functional, never errors.

## 5. Fonts

The receipt is set in Courier Prime and the interface in Public Sans, loaded from Google
Fonts. If your policy blocks Google Fonts, ask us to switch it to a self-hosted copy — it is
a one-line change on our side, not a server change.

## 6. If you also serve the data from a CDN

Not required. The tool reads its county data from the plugin folder by default. If you would
rather it come from a CDN, that is a `ptx_benchmarks_url` filter and we can set it in a
small must-use plugin.

## Questions

The full technical reference is in `README.md` inside the plugin folder. For anything about
the numbers, the methodology, or the wording on the receipt, that is a question for the
research team rather than a change to be made here — please don't edit the plugin files
directly, as a test suite checks the calculation and the on-page methodology against the
published figures.
