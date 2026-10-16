<!doctype html>
<html <?php language_attributes(); ?>>
<head><meta charset="<?php bloginfo( 'charset' ); ?>"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#f6f4ef"><link rel="icon" type="image/png" href="<?php echo esc_url( get_theme_file_uri( 'assets/nenufero-logo.png' ) ); ?>"><?php wp_head(); ?></head>
<body <?php body_class(); ?> data-whatsapp="<?php echo esc_attr( preg_replace( '/\D+/', '', get_theme_mod( 'nenufero_whatsapp_phone', '34673629342' ) ) ); ?>">
<?php wp_body_open(); ?>
<a class="skip-link" href="#contenido">Saltar al contenido</a>
<div class="topline"><span>Estudio de impresión y rotulación en Madrid</span><a href="<?php echo esc_url( nenufero_whatsapp_url() ); ?>" target="_blank" rel="noopener noreferrer">Hablemos de tu proyecto <span aria-hidden="true">↗</span></a></div>
<header class="site-header">
<a class="wordmark brand-lockup" href="<?php echo esc_url( home_url( '/' ) ); ?>" aria-label="Nenufero, inicio"><img class="brand-symbol" src="<?php echo esc_url( get_theme_file_uri( 'assets/nenufero-logo.png' ) ); ?>" alt=""><span class="wordmark-name">NENUFERO</span></a>
<button class="menu-toggle" type="button" aria-label="Abrir menú" aria-expanded="false"><span></span><span></span></button>
<nav class="main-nav" aria-label="Navegación principal"><?php wp_nav_menu( array( 'theme_location' => 'primary', 'container' => false, 'fallback_cb' => false, 'items_wrap' => '%3$s' ) ); ?>
<?php if ( ! has_nav_menu( 'primary' ) ) : ?><a href="#servicios">Servicios</a><a href="#tienda">Tienda</a><a href="#proceso">Cómo trabajamos</a><a href="#contacto">Contacto</a><?php endif; ?></nav>
<a class="bag-button" href="<?php echo nenufero_shop_url(); ?>" aria-label="Visitar la tienda"><span>Ir a la tienda</span><span class="bag-count" aria-hidden="true">↗</span></a>
</header>
