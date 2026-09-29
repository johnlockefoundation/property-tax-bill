<?php
/**
 * Plugin Name:       NC Property Tax Bill
 * Plugin URI:        https://www.johnlocke.org/
 * Description:       Embeds the NC property-tax bill tool — address search against NC OneMap and an HB 1089 levy-limit receipt — with the demo's "How we calculated this" methodology disclosure. Use the [ptx_bill] shortcode or the "NC Property Tax Bill" block.
 * Version:           1.2.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * License:           GPL-2.0-or-later
 * Text Domain:       ptx
 *
 * Port of the GitHub Pages site at property-tax-demo/ onto WordPress. The
 * calculation contract is unchanged: assets/js/ptx-calc.js is a byte-identical
 * copy of that repo's calc.js, and data/benchmarks.json a byte-identical copy
 * of its generated output. See README.md for the full mapping and install
 * notes.
 */

defined('ABSPATH') || exit;

final class NC_Property_Tax_Bill {

	const VERSION = '1.2.0';
	const FILE    = __FILE__;

	const SHORT_BILL        = 'ptx_bill';
	const SHORT_METHODOLOGY = 'ptx_methodology';
	const BLOCK             = 'ptx/bill';

	/**
	 * Default headlines. Filters let the corporate site reword without forking
	 * the template: ptx_default_heading, ptx_default_lede, ptx_default_brand.
	 */
	const DEFAULT_HEADING = 'How much could a property tax levy limit save you?';
	const DEFAULT_LEDE    = 'Enter your address to see how much lower your county property tax bill could have been this year if a levy limit had been enacted five years ago.';
	const DEFAULT_BRAND   = 'NC Property Tax Savings Calculator';

	public static function init() {
		add_action( 'init', array( __CLASS__, 'register_block' ) );
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ) );

		add_shortcode( self::SHORT_BILL, array( __CLASS__, 'render_bill' ) );
		add_shortcode( self::SHORT_METHODOLOGY, array( __CLASS__, 'render_methodology' ) );
	}

	/* ---------------------------------------------------------------------
	 * Assets
	 * ------------------------------------------------------------------ */

	/**
	 * Load the tool's CSS/JS, but only on a view that actually contains it.
	 * Detection covers the shortcode in post_content and the block; a site
	 * that renders the tool somewhere unusual (a widget, a template, an
	 * AJAX-injected panel) can force it on with the ptx_force_enqueue filter.
	 */
	public static function enqueue_assets() {
		if ( ! self::view_uses_tool() ) {
			return;
		}

		$base = plugins_url( '', self::FILE );

		// The receipt is set in Courier Prime and the interface in Public Sans.
		// Both are the demo's faces, so they are requested by default; a site
		// that self-hosts them can switch this off with ptx_load_fonts => false.
		if ( apply_filters( 'ptx_load_fonts', true ) ) {
			wp_enqueue_style(
				'ptx-fonts',
				'https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;600;700;800;900&family=Courier+Prime:wght@400;700&display=swap',
				array(),
				null // external URL, no version
			);
		}

		wp_enqueue_style(
			'ptx',
			$base . 'assets/css/ptx.css',
			array(),
			self::asset_version( 'assets/css/ptx.css' )
		);

		// ptx-calc.js carries the shared calculation contract and must be
		// evaluated first; declaring it as a dependency is how the browser is
		// told so, which the demo got for free from a <script> in <head>.
		wp_enqueue_script(
			'ptx-calc',
			$base . 'assets/js/ptx-calc.js',
			array(),
			self::asset_version( 'assets/js/ptx-calc.js' ),
			true
		);

		wp_enqueue_script(
			'ptx-app',
			$base . 'assets/js/ptx-app.js',
			array( 'ptx-calc' ),
			self::asset_version( 'assets/js/ptx-app.js' ),
			true
		);
	}

	private static function view_uses_tool() {
		$found = false;

		if ( is_singular() ) {
			$post = get_post();
			if ( $post && isset( $post->post_content ) ) {
				$found = has_shortcode( $post->post_content, self::SHORT_BILL )
					|| has_shortcode( $post->post_content, self::SHORT_METHODOLOGY )
					|| has_block( self::BLOCK, $post );
			}
		}

		/**
		 * Filter whether the tool's assets load on the current view.
		 *
		 * @param bool $found Whether the current view was detected as using the tool.
		 */
		return (bool) apply_filters( 'ptx_force_enqueue', $found );
	}

	/**
	 * Cache-bust on file mtime so an updated plugin invalidates CDN and page
	 * caches without a version bump. The demo leaned on GitHub Pages'
	 * max-age=600; a corporate site is usually cached much harder.
	 */
	private static function asset_version( $relative ) {
		$path = plugin_dir_path( self::FILE ) . $relative;
		return file_exists( $path ) ? (string) filemtime( $path ) : self::VERSION;
	}

	public static function benchmarks_url() {
		$url = plugins_url( 'data/benchmarks.json', self::FILE );

		/**
		 * Filter the county benchmark data URL.
		 *
		 * Point this at a CDN or a custom path if the data is not served from
		 * the plugin directory. The file must stay reachable by the browser
		 * without authentication; the tool fetches it directly.
		 *
		 * @param string $url Absolute URL to benchmarks.json.
		 */
		return apply_filters( 'ptx_benchmarks_url', $url );
	}

	/* ---------------------------------------------------------------------
	 * Block
	 * ------------------------------------------------------------------ */

	public static function register_block() {
		if ( ! function_exists( 'register_block_type' ) ) {
			return;
		}

		register_block_type(
			self::BLOCK,
			array(
				'api_version'     => 2,
				'title'           => __( 'NC Property Tax Bill', 'ptx' ),
				'category'        => 'widgets',
				'icon'            => 'calculator',
				'description'     => __( 'Address search and an HB 1089 levy-limit receipt for all 100 North Carolina counties, with the methodology disclosure.', 'ptx' ),
				'attributes'      => array(
					'showHeader' => array(
						'type'    => 'boolean',
						'default' => true,
					),
					'showMethod' => array(
						'type'    => 'boolean',
						'default' => true,
					),
					'layout'     => array(
						'type'    => 'string',
						'default' => 'full',
						'enum'    => array( 'full', 'compact' ),
					),
					'headingLevel' => array(
						'type'    => 'string',
						'default' => 'h1',
						'enum'    => array( 'h1', 'h2', 'h3', 'h4', 'h5', 'h6' ),
					),
					'heading'    => array(
						'type'    => 'string',
						'default' => '',
					),
					'lede'       => array(
						'type'    => 'string',
						'default' => '',
					),
				),
				'supports'        => array( 'html' => false ),
				'render_callback' => array( __CLASS__, 'render_block' ),
			)
		);
	}

	public static function render_block( $attributes ) {
		$attributes = is_array( $attributes ) ? $attributes : array();

		return self::render_bill(
			array(
				'show_header' => ! empty( $attributes['showHeader'] ),
				'show_method' => ! empty( $attributes['showMethod'] ),
				'layout'      => isset( $attributes['layout'] ) ? $attributes['layout'] : 'full',
				'heading_level' => isset( $attributes['headingLevel'] ) ? $attributes['headingLevel'] : 'h1',
				'heading'     => isset( $attributes['heading'] ) ? $attributes['heading'] : '',
				'lede'        => isset( $attributes['lede'] ) ? $attributes['lede'] : '',
			)
		);
	}

	/* ---------------------------------------------------------------------
	 * Shortcodes
	 * ------------------------------------------------------------------ */

	/**
	 * [ptx_bill]
	 *
	 * Optional attributes, all with the demo's defaults:
	 *   heading     h1 text
	 *   lede        intro paragraph
	 *   brand       text in the blue brand bar
	 *   logo        logo image URL (defaults to the bundled PNG)
	 *   show_header yes|no  render the blue brand bar
	 *   show_method yes|no  render the "How we calculated this" disclosure
	 *   layout      full|compact  full is the demo's page layout; compact is the
	 *                        single-column layout for an article column
	 *   heading_level  h1..h6   tag used for the heading; use h2 when the tool
	 *                        sits inside an article that already has an h1
	 *   src         benchmarks.json URL
	 */
	public static function render_bill( $atts = array(), $content = '' ) {
		$atts = shortcode_atts(
			array(
				'heading'     => apply_filters( 'ptx_default_heading', self::DEFAULT_HEADING ),
				'lede'        => apply_filters( 'ptx_default_lede', self::DEFAULT_LEDE ),
				'brand'       => apply_filters( 'ptx_default_brand', self::DEFAULT_BRAND ),
				'logo'        => plugins_url( 'assets/images/logo.png', self::FILE ),
				'show_header' => 'yes',
				'show_method' => 'yes',
				'layout'      => 'full',
				'heading_level' => 'h1',
				'src'         => self::benchmarks_url(),
			),
			(array) $atts,
			self::SHORT_BILL
		);

		$atts['layout'] = ( 'compact' === strtolower( (string) $atts['layout'] ) ) ? 'compact' : 'full';
		$atts['show_header'] = self::to_bool( $atts['show_header'] );
		$atts['show_method'] = self::to_bool( $atts['show_method'] );

		// The block editor hands empty strings to mean "use the default".
		if ( $atts['heading'] === '' ) {
			$atts['heading'] = apply_filters( 'ptx_default_heading', self::DEFAULT_HEADING );
		}
		if ( $atts['lede'] === '' ) {
			$atts['lede'] = apply_filters( 'ptx_default_lede', self::DEFAULT_LEDE );
		}

		ob_start();
		include self::template_path( 'bill.php' );

		return ob_get_clean();
	}

	/**
	 * [ptx_methodology]
	 *
	 * Renders the long-form Methodology Notes as page content, for readers who
	 * want the sources and the benchmark construction rather than the short
	 * in-tool disclosure.
	 */
	public static function render_methodology( $atts = array(), $content = '' ) {
		$atts = shortcode_atts( array(), (array) $atts, self::SHORT_METHODOLOGY );

		ob_start();
		include self::template_path( 'methodology.php' );

		return ob_get_clean();
	}

	/* ---------------------------------------------------------------------
	 * Helpers
	 * ------------------------------------------------------------------ */

	public static function template_path( $template ) {
		return plugin_dir_path( self::FILE ) . 'templates/' . $template;
	}

	/** Accepts booleans from the block and "yes"/"no"/"1"/"0" from a shortcode. */
	private static function to_bool( $value ) {
		if ( is_bool( $value ) ) {
			return $value;
		}
		return in_array( strtolower( (string) $value ), array( 'yes', 'true', '1', 'on' ), true );
	}
}

NC_Property_Tax_Bill::init();
