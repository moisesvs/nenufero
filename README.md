# Nenufero · tienda local

Propuesta de tienda y experiencia de compra para revisión en localhost. No publica cambios en la web de Nenufero.

Desde el enlace **Personalizar la propuesta** del pie de página puedes cambiar el logotipo, el nombre, los textos principales, las cuatro imágenes de la galería de servicios y las cuatro actividades de la portada. Esos cambios se guardan solo en el navegador actual; el editor sirve para preparar y presentar una variante local, no sustituye a un CMS ni publica cambios en internet.

Las preguntas frecuentes tienen una página propia en `faq.html` y aparecen en el menú principal.

## Arranque

Requiere Node.js 20 o superior. Ejecuta `npm start` desde la carpeta del proyecto y abre http://127.0.0.1:8765. El carrito, los pedidos de prueba, las solicitudes y las subidas se guardan localmente en `data/` (excluido de Git).

El modo inicial es simulado: los precios de muestra son inventados para probar el flujo, no representan tarifas comerciales y no realizan cargos. Completa el carrito y los datos de contacto para crear un pedido `NEN-…` de demostración. Formularios de proyecto y visita también se guardan localmente y no se envían a Nenufero.

## Panel de administración local

Abre `/admin/` con el servidor local iniciado. En `.env` configura `ADMIN_PASSWORD` con al menos 12 caracteres y `ADMIN_SESSION_SECRET` con un secreto aleatorio; reinicia `npm start` después de cambiarlo. El panel usa una sesión firmada en cookie `HttpOnly`, `SameSite=Strict`, permite revisar todos los pedidos locales, actualizar su estado de preparación y notas internas, y editar el nombre, categoría, disponibilidad y tarifas de los 13 SKU actuales. Los cambios de catálogo se guardan en `data/catalog-overrides.json`, excluido de Git.

Este almacenamiento es local al prototipo. La vista previa estática de Netlify no ejecuta `server.mjs` ni comparte estos pedidos o cambios; para administración remota y pedidos de la tienda real se necesita conectar el panel a Shopify o desplegar una API y almacenamiento persistente protegidos.

## Stripe, para una fase posterior

Stripe queda desactivado por defecto. Antes de procesar pagos reales, Nenufero debe aprobar las tarifas de cada SKU, los portes y las condiciones de venta. Las tarifas de demostración nunca se usan con Stripe. Después, configura `.env` a partir de `.env.example` con `PAYMENT_MODE=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PUBLIC_BASE_URL`, `STRIPE_LIVE_RATES_EUR_CENTS` (JSON de SKU a céntimos) y, si se ofrece envío, `STRIPE_SHIPPING_EUR_CENTS`.

Configura los webhooks de Stripe para `/api/stripe/webhook` y los eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` y `checkout.session.expired`. El servidor valida los importes, la moneda, la sesión y la firma del webhook. No almacena datos de tarjeta. No añadas claves al repositorio; `.env` está excluido de Git.

`nenufero-prototipo-presentacion.zip` es el paquete de la propuesta local. El tema WordPress existente es una maqueta visual independiente y no procesa compras ni pagos.
