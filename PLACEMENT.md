# Placement — the two spots, ready to paste

Once the plugin is active, these are the two placements. Both are copy-and-paste; no
developer needed.

Shortcodes go in a **Custom HTML** block. If your editor strips shortcodes pasted into a
normal paragraph, Custom HTML is the reliable home for them.

Summary of what goes where:

| Placement | Permalink | Shortcode |
| --- | --- | --- |
| Standalone page | `/property-tax-savings-calculator` | `[ptx_bill heading_level="h2"]` |
| Article | within the existing post | `[ptx_bill layout="compact" heading_level="h2" show_header="no"]` |
| Methodology page | your choice | `[ptx_methodology]` |

---

## A. Standalone page

**Permalink:** `/property-tax-savings-calculator`
**Page title:** `NC Property Tax Savings Calculator`

In WordPress: **Pages → Add New**, put that in the title, and set the permalink slug to
`property-tax-savings-calculator` (not the auto-generated one). Then add a **Custom HTML**
block containing:

```
[ptx_bill heading_level="h2"]
```

### Why `heading_level="h2"` here

Most themes output the page title as the page's `<h1>`. The tool renders its own heading, and
by default that heading is also an `<h1>` — which would leave the page with two. Setting it
to `h2` makes the outline: page title as the `h1`, the tool's headline
(*"How much could a property tax levy limit save you?"*) as the `h2` beneath it.

**Check this against your theme before publishing.** View source and search for `<h1`:

- **Exactly one**, and it's your page title → use `heading_level="h2"` as above. This is the
  expected case.
- **Two** → drop the attribute entirely; your theme is not rendering the page title, and the
  tool's own `h1` is doing the job.
- **Zero** → the theme isn't rendering the title at all, and the page needs an `h1` from
  somewhere. Use the default (`h1`), and check the page doesn't look headline-less.

The other attributes are left at their defaults, which is the demo's look: the blue bar with
the logo, and the methodology disclosure. On a dedicated tool page that bar is the right call
— it is the tool's own header, not a duplicate of the site header.

**Optional:** a second page, **NC Property Tax Methodology**, containing:

```
[ptx_methodology]
```

That is the long-form version — data sources, how the benchmark levy is built, the
calculation contract, and the caveats. Worth linking from the tool's own disclosure and from
the article below.

**Also worth setting on this page:** a meta description, for search results. Something like:

> Enter your address to see how much lower your county property tax bill could have been this year if levy
> growth had been limited to inflation plus population growth over the past five years.

---

## B. Embedded in an article

Use the compact layout. It is the same tool in a single column, sized to sit inside an
article rather than look like a standalone site.

Paste into a Custom HTML block:

```
[ptx_bill layout="compact" heading_level="h2" show_header="no"]
```

**What each part is doing, and why it matters:**

| Attribute | Why |
| --- | --- |
| `layout="compact"` | One column instead of two. In an article column the two-column version would squeeze the search box and push the receipt below the fold. |
| `heading_level="h2"` | The tool defaults to an `<h1>`. Your article already has one, and a page should only have one. This makes the tool's heading an `<h2>` so the outline stays correct for screen readers and for Google. |
| `show_header="no"` | Drops the blue bar and logo. The article already sits under your site header, and a second blue bar with the logo reads as two competing brands. |

**Note what is *not* being turned off:** the "How we calculated this" disclosure. Leave it
on. It is the thing that tells a skeptical reader this is a modelled estimate on county tax
only, holding assessed value constant — without it the receipt looks like a tax bill. The
compact layout deliberately does not touch the receipt's own type, size, or colours.

### Where it goes in the article

After the paragraph that first explains the levy-limit idea, and before the section that
discusses the data or the criticism. That way the reader has the concept, sees their own
address, and then evaluates the argument.

### Lead-in copy

Optional paragraph immediately **above** the shortcode, so the tool doesn't arrive out of
nowhere:

> Curious what a levy limit would have meant for your own property tax bill? Look up your
> address below.

### If the article is long

Nothing changes; the tool doesn't paginate or remember state, so it is safe to place once.
Do not add it twice in the same article — the second copy is technically independent, but two
receipts in one article is confusing.

---

## Checking both before you publish

| Check | Standalone | Article |
| --- | --- | --- |
| County dropdown fills with 100 counties | yes | yes |
| A $500,000 Mecklenburg parcel shows $2,462.91 paid / $2,240.27 could have paid / $222.65 saved / OR 9% LOWER | yes | yes |
| An address search returns matches | yes | yes |
| A receipt prints with a percent | yes | yes |
| The tool fits the column with no horizontal scroll | full width | important |
| Only one `<h1>` on the page | yes | **must be** |
| Disclosure opens and reads correctly | yes | yes |

The last two are the ones that go wrong. On the article, view source and search for
`<h1` — you should find only the article's own.

---

## One thing to decide before go-live

The tool currently requests its two typefaces (Public Sans, Courier Prime) from Google
Fonts. If your site blocks Google Fonts, the interface falls back to a system sans and the
receipt to a generic monospace. It still works and the layout holds, but the receipt loses
some of its character. Tell us and we'll ship a self-hosted font variant instead.

That, plus two Content-Security-Policy lines if your host sets one, are the only known
server-side requirements. Both are covered in `INSTALL.md`.
