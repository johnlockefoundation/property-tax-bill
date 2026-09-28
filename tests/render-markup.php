<?php
/**
 * Emits rendered shortcode markup on stdout for the node/jsdom test to load.
 *
 * Usage: php tests/render-markup.php [ptx_bill|ptx_methodology] [--key=value ...]
 *
 * Attributes are passed as --key=value and handed to the shortcode, so tests can
 * exercise the same argument surface the editor would use. Booleans are given
 * as true/false, which render_bill normalises the same way it normalises
 * yes/no.
 */

require __DIR__ . '/wp-stubs.php';
require dirname(__DIR__) . '/nc-property-tax-bill.php';

$which = $argv[1] ?? 'ptx_bill';
$atts  = array();

foreach (array_slice($argv, 2) as $arg) {
    if (strpos($arg, '--') !== 0) {
        continue;
    }
    $pair = substr($arg, 2);
    $eq   = strpos($pair, '=');
    if ($eq === false) {
        $atts[$pair] = 'yes';
        continue;
    }
    $key         = substr($pair, 0, $eq);
    $value       = substr($pair, $eq + 1);
    $atts[$key]  = ( 'true' === $value || 'false' === $value ) ? ( 'true' === $value ) : $value;
}

if ('ptx_bill' === $which) {
    echo NC_Property_Tax_Bill::render_bill($atts);
} elseif ('ptx_methodology' === $which) {
    echo NC_Property_Tax_Bill::render_methodology();
} else {
    fwrite(STDERR, "unknown shortcode: $which\n");
    exit(1);
}
