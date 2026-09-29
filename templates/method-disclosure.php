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
        <h3>Data:</h3>
                <table class="ptx-method-table">
                  <thead>
                    <tr><th>Category</th><th>Dataset</th><th>Source</th><th>Years</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Property tax levy</td>
                      <td>Total Property Tax Levied by All Local Jurisdictions (LG04)</td>
                      <td>N.C. Department of Revenue</td>
                      <td>FY21&ndash;FY26</td>
                    </tr>
                    <tr>
                      <td>Population</td>
                      <td>Certified County Population Estimates</td>
                      <td>N.C. Office of State Budget and Management</td>
                      <td>2019&ndash;2024</td>
                    </tr>
                    <tr>
                      <td>Inflation</td>
                      <td>Consumer Price Index for All Urban Consumers: All Items in the South (CUUR0300SA0)</td>
                      <td>Federal Reserve Bank of St. Louis</td>
                      <td>2019&ndash;2024</td>
                    </tr>
                  </tbody>
                </table>
        
                <h3>Method:</h3>
                <h4>Inputs:</h4>
                <ul>
                  <li><b>Isolate county property tax levy:</b> We included only countywide property tax levies, excluding county special district levies and all municipal levies.</li>
                  <li><b>Calculate population growth:</b> For each county, we calculated the year-over-year percentage change in population for each year from 2020 through 2024, using 2019 as the starting year.</li>
                  <li><b>Calculate inflation:</b> We calculated the year-over-year percentage change in the South CPI for each year from 2020 through 2024, using 2019 as the starting year.</li>
                </ul>
                <h4>Outputs:</h4>
                <ul>
                  <li><b>Calculate hypothetical property tax levy:</b> We estimated the amount each county could have levied under a population-plus-inflation levy limit. Beginning with the FY2020&ndash;21 actual levy, each subsequent year's hypothetical levy equals the previous year's hypothetical levy multiplied by one plus that year's population growth rate and inflation rate:</li>
                </ul>
                <p class="ptx-method-formula">(hypothetical levy = previous hypothetical levy &times; (1 + population growth + inflation))</p>
                <p>Because each year's calculation uses the previous year's hypothetical levy rather than the actual levy, the limit compounds over the five-year period.</p>
                <ul>
                  <li><b>Compare actual and hypothetical levies:</b> For FY2021&ndash;22 through FY2025&ndash;26, we calculated the cumulative actual levy and cumulative hypothetical levy. We then calculated the dollar difference, percentage difference, and savings rate between the two totals.</li>
                  <li><b>Estimate address-level savings:</b> We multiplied each property's FY2025&ndash;26 county property tax bill by its county's five-year savings rate to estimate how much lower the bill would be if the county's levy had been limited to population growth plus inflation over the previous five years.</li>
                </ul>
                <p class="ptx-sources">Sources: county levy data (Data(tax).csv), NCDOR LG04 FY2025-26 assessed valuation, NC OneMap parcels, OSBM certified county population estimates, and BLS South urban CPI.</p>
                <p>This is an estimate based on historical tax
        <p class="ptx-sources">Sources: county levy data (Data(tax).csv), NCDOR LG04 FY2025-26 assessed valuation, NC OneMap parcels, OSBM certified county population estimates, and BLS South urban CPI.</p>
        <p>This is an estimate based on historical tax and property data and a hypothetical policy scenario. It is not an official tax assessment.</p>
      </div>
    </details>
