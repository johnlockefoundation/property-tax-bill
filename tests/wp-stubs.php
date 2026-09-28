<?php
/**
 * Minimal WordPress stubs, so the plugin's templates can be rendered and
 * asserted outside a WordPress install. Used by render-markup.php (which the
 * node test shells out to) and render-smoke.php.
 */

if (!defined('ABSPATH')) {
    define('ABSPATH', dirname(__DIR__) . '/');
}

$GLOBALS['ptx_filters'] = array();
$GLOBALS['ptx_enqueued'] = array();
$GLOBALS['ptx_shortcodes'] = array();

function add_action($hook, $cb, $priority = 10, $args = 1) { return true; }
function add_shortcode($tag, $cb) { $GLOBALS['ptx_shortcodes'][$tag] = $cb; }
function add_filter($tag, $cb, $priority = 10, $args = 1) { return true; }

function apply_filters($tag, $value) {
    if (isset($GLOBALS['ptx_filters'][$tag]) && is_callable($GLOBALS['ptx_filters'][$tag])) {
        return call_user_func($GLOBALS['ptx_filters'][$tag], $value);
    }
    return $value;
}

function esc_url($u) { return htmlspecialchars((string) $u, ENT_QUOTES, 'UTF-8'); }
function esc_attr($s) { return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8'); }
function esc_html($s) { return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8'); }
function esc_attr__($s) { return esc_attr($s); }
function __($s, $d = null) { return $s; }
function _e($s, $d = null) { echo $s; }
function plugins_url($path = '', $file = '') {
    return 'https://example.org/wp-content/plugins/nc-property-tax-bill/' . ltrim($path, '/');
}
function plugin_dir_path($file) { return rtrim(dirname($file), '/') . '/'; }
function wp_kses_post($s) { return $s; }
function wp_unique_id($p = '') { static $i = 0; return $p . (++$i); }

function shortcode_atts($pairs, $atts, $tag = '') {
    $atts = (array) $atts;
    $out = array();
    foreach ($pairs as $name => $default) {
        $out[$name] = array_key_exists($name, $atts) ? $atts[$name] : $default;
    }
    return $out;
}

function has_shortcode($content, $tag) { return false; }
function has_block($block, $post = null) { return false; }
function is_singular($t = '') { return false; }
function get_post($p = null) { return null; }
function register_block_type($name, $args = array()) { return true; }
function wp_enqueue_style(...$a) { $GLOBALS['ptx_enqueued'][] = array('style', $a[0]); }
function wp_enqueue_script(...$a) { $GLOBALS['ptx_enqueued'][] = array('script', $a[0], $a[3] ?? array()); }
