<?php
/**
 * "How we calculated this" disclosure.
 *
 * The in-tool methodology note, carried over verbatim from the live demo's
 * <details class="method"> block. This copy is the tool's own disclosure and is
 * the single most load-bearing piece of text on the page: it is where the
 * reader learns that only county tax is counted, that the value is held
 * constant, and where the "percent lower" comes from. Do not trim it without
 * the methodology owner agreeing.
 *
 * The long-form Methodology Notes document is a separate template,
 * methodology.php, rendered by the [ptx_methodology] shortcode.
 *
 * @var array $atts
 */

defined('ABSPATH') || exit;
?>
    <details class="ptx-method">
      <summary>How we calculated this</summary>
      <div class="ptx-method-body">
        <dl>
          <dt>What "levy limit" means</dt>
          <dd>A cap on how much the county's total property tax levy may grow each year.</dd>
          <dt>The assumed annual limit</dt>
          <dd>Inflation (U.S. South urban CPI) plus the county's population growth.</dd>
          <dt>When the policy begins</dt>
          <dd>The 2019 base year; the limit compounds forward from there.</dd>
          <dt>What this receipt compares</dt>
          <dd>A single fiscal year, FY2025-26: the county property tax actually paid versus what it would have been under the limit.</dd>
          <dt>The "percent lower" figure</dt>
          <dd>The county's 5-year savings rate published in Data(tax).csv (the last column before grade); the bill assumes that rate extends to the property, so what you could have paid = what you paid &times; (1 &minus; rate).</dd>
          <dt>Why one year, not the five-year sum</dt>
          <dd>A parcel's assessment can shift relative to the county tax base over time, so summing years would assume a fixed share. FY2025-26 is compared on the current assessment.</dd>
          <dt>Taxes included</dt>
          <dd>County-wide property tax only, not the full bill.</dd>
          <dt>Property value</dt>
          <dd>The parcel's current assessed value from NC OneMap; reassessment timing is not modeled.</dd>
          <dt>Formula</dt>
          <dd>FY2025-26 bill = assessed value &times; (actual levy / assessed valuation base). Under-limit bill = that bill &times; (1 &minus; savings rate), so the amount saved always matches the published savings rate.</dd>
        </dl>
        <p class="ptx-sources">Sources: county levy data (Data(tax).csv), NCDOR LG04 FY2025-26 assessed valuation, NC OneMap parcels, OSBM certified county population estimates, and BLS South urban CPI.</p>
        <p>This is an estimate based on historical tax and property data and a hypothetical policy scenario. It is not an official tax assessment.</p>
      </div>
    </details>
