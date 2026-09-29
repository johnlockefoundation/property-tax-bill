<?php
/**
 * Plugin Name: NC Property Tax Bill (loader)
 * Description: Auto-loads the NC Property Tax Bill tool. Files in wp-content/mu-plugins/ are
 *              loaded by WordPress without needing activation, which is useful when the account
 *              you have cannot see the Plugins screen. Delete this file to disable the tool.
 * Version:     1.2.0
 *
 * Installation: this file and the nc-property-tax-bill/ folder must sit side by side, both
 * directly inside wp-content/mu-plugins/.
 */

if (!defined('ABSPATH')) {
    exit;
}

$ptx_main = WPMU_PLUGIN_DIR . '/nc-property-tax-bill/nc-property-tax-bill.php';

if (is_readable($ptx_main)) {
    require_once $ptx_main;
} else {
    add_action(
        'admin_notices',
        function () {
            echo '<div class="notice notice-error"><p>';
            echo '<strong>NC Property Tax Bill:</strong> could not find ';
            echo '<code>wp-content/mu-plugins/nc-property-tax-bill/nc-property-tax-bill.php</code>. ';
            echo 'The <code>nc-property-tax-bill/</code> folder must sit next to this loader file.';
            echo '</p></div>';
        }
    );
}
