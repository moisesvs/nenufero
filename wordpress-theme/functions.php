<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

function nenufero_setup() {
	add_theme_support( 'title-tag' );
	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'html5', array( 'search-form', 'comment-form', 'comment-list', 'gallery', 'caption', 'style', 'script' ) );
	add_theme_support( 'responsive-embeds' );
	register_nav_menus( array( 'primary' => __( 'Menú principal', 'nenufero-estudio' ) ) );
}
add_action( 'after_setup_theme', 'nenufero_setup' );

function nenufero_assets() {
	$version = wp_get_theme()->get( 'Version' );
	wp_enqueue_style( 'nenufero-font', 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap', array(), null );
	wp_enqueue_style( 'nenufero-theme', get_theme_file_uri( 'assets/theme.css' ), array( 'nenufero-font' ), $version );
	wp_enqueue_style( 'nenufero-brand', get_theme_file_uri( 'assets/brand.css' ), array( 'nenufero-theme' ), $version );
	wp_enqueue_script( 'nenufero-theme', get_theme_file_uri( 'assets/site.js' ), array(), $version, true );
}
add_action( 'wp_enqueue_scripts', 'nenufero_assets' );

function nenufero_customize( $wp_customize ) {
	$wp_customize->add_section( 'nenufero_brand', array( 'title' => __( 'Nenufero: datos del sitio', 'nenufero-estudio' ), 'priority' => 35 ) );
	$settings = array(
		'nenufero_shop_url' => array( 'URL de la tienda online', home_url( '/tienda/' ) ),
		'nenufero_whatsapp_phone' => array( 'WhatsApp (formato internacional, solo números)', '34673629342' ),
	);
	foreach ( $settings as $id => $data ) {
		$wp_customize->add_setting( $id, array( 'default' => $data[1], 'sanitize_callback' => 'sanitize_text_field', 'transport' => 'refresh' ) );
		$wp_customize->add_control( $id, array( 'section' => 'nenufero_brand', 'label' => __( $data[0], 'nenufero-estudio' ), 'type' => 'text' ) );
	}
	$wp_customize->add_setting( 'nenufero_hero_image', array( 'sanitize_callback' => 'absint', 'transport' => 'refresh' ) );
	$wp_customize->add_control( new WP_Customize_Media_Control( $wp_customize, 'nenufero_hero_image', array( 'section' => 'nenufero_brand', 'label' => __( 'Fotografía principal', 'nenufero-estudio' ), 'mime_type' => 'image' ) ) );
}
add_action( 'customize_register', 'nenufero_customize' );

function nenufero_shop_url() { return esc_url( get_theme_mod( 'nenufero_shop_url', 'https://nfnenufero.shop' ) ); }
function nenufero_whatsapp_url() {
	$phone = preg_replace( '/\D+/', '', get_theme_mod( 'nenufero_whatsapp_phone', '34673629342' ) );
	return 'https://wa.me/' . $phone;
}
function nenufero_phone_display() {
	$phone = preg_replace( '/\D+/', '', get_theme_mod( 'nenufero_whatsapp_phone', '34673629342' ) );
	return '+'.substr( $phone, 0, 2 ).' '.substr( $phone, 2, 3 ).' '.substr( $phone, 5, 3 ).' '.substr( $phone, 8 );
}
