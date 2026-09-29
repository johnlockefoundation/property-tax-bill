<?php
/**
 * Bill tool markup.
 *
 * Ported from the live demo's <body> (property-tax-demo/index.html). Class
 * names carry the ptx- prefix and every id became a class so that two
 * shortcodes on one page, or a theme with its own #header, cannot collide.
 * Copy, order and data attributes are the demo's.
 *
 * @var array $atts  Resolved shortcode attributes.
 */

defined('ABSPATH') || exit;

$ptx_brand    = $atts['brand'];
$ptx_heading  = $atts['heading'];
$ptx_lede     = $atts['lede'];
$ptx_logo     = $atts['logo'];
$ptx_src      = $atts['src'];
$ptx_methods  = $atts['show_method'];
$ptx_headers  = $atts['show_header'];
$ptx_layout   = $atts['layout'] === 'compact' ? ' ptx-layout-compact' : '';
// Inside an article the page already has an h1, so the heading level is
// settable rather than fixed. Anything unrecognised falls back to h1, which is
// the demo's markup.
$ptx_head     = preg_match( '/^h[1-6]$/i', (string) $atts['heading_level'] ) ? strtolower( $atts['heading_level'] ) : 'h1';
?>
<div class="ptx<?php echo esc_attr($ptx_layout); ?>" data-ptx data-ptx-src="<?php echo esc_url($ptx_src); ?>">
<?php if ($ptx_headers) : ?>
  <div class="ptx-header">
    <div class="ptx-brand"><?php echo esc_html($ptx_brand); ?></div>
    <div class="ptx-hdr-right">
      <img class="ptx-logo" src="<?php echo esc_url($ptx_logo); ?>" alt="John Locke Foundation" />
    </div>
  </div>
<?php endif; ?>

  <div class="ptx-wrap">
    <<?php echo esc_html($ptx_head); ?> class="ptx-title"><?php echo esc_html($ptx_heading); ?></<?php echo esc_html($ptx_head); ?>>
    <p class="ptx-lede"><?php echo esc_html($ptx_lede); ?></p>

    <div class="ptx-cols">
      <div class="ptx-card">
        <div class="ptx-county-bar">
          <select class="ptx-select" aria-label="Select county">
            <option value="" selected>--Select a County--</option>
          </select>
        </div>
        <div class="ptx-search-row">
          <input class="ptx-input" type="text" placeholder="Address, e.g. 1000 E Woodlawn Rd, Charlotte NC" aria-label="Property address" />
          <button class="ptx-btn" type="button">Search</button>
        </div>
        <p class="ptx-hint">Partial addresses are OK. Click or tap your address when it appears.</p>
        <p class="ptx-privacy">We do not collect, store or remember your address. Your search is sent straight to NC OneMap, the state's official parcel mapping service.</p>
        <div class="ptx-status" role="status"></div>
        <ul class="ptx-cands"></ul>
        <div class="ptx-nores ptx-hidden">
          <p>No residential properties matched. Check the spelling or try a nearby street name.</p>
        </div>
      </div>

      <div class="ptx-results" aria-live="polite">
        <p class="ptx-below ptx-hidden"></p>

        <div class="ptx-receipt">
          <div class="ptx-receipt-brand ptx-hidden"></div>
          <div class="ptx-receipt-instruction">See what you could have saved</div>
          <div class="ptx-address-body ptx-hidden">
            <div class="ptx-receipt-rule"></div>
            <div class="ptx-receipt-addr"></div>
            <div class="ptx-receipt-meta"></div>
            <div class="ptx-receipt-rule"></div>
            <div class="ptx-receipt-line"><span>What you paid</span><span class="ptx-leader"></span><span class="ptx-amt ptx-amt-paid">$0</span></div>
            <div class="ptx-receipt-line"><span>What you could have paid</span><span class="ptx-leader"></span><span class="ptx-amt ptx-amt-could">$0</span></div>
            <div class="ptx-receipt-rule"></div>
            <div class="ptx-receipt-total">
              <div class="ptx-receipt-total-label">You could have saved</div>
              <div class="ptx-receipt-total-amt ptx-amt-saved">$0</div>
              <div class="ptx-receipt-total-pct"></div>
            </div>
            <div class="ptx-receipt-rule"></div>
            <div class="ptx-receipt-barcode" aria-hidden="true"></div>
            <div class="ptx-receipt-thanks">*** THANK YOU ***</div>
          </div>
        </div>
      </div>
    </div>
<?php
if ($ptx_methods) {
    include NC_Property_Tax_Bill::template_path('method-disclosure.php');
}
?>
  </div>
</div>
