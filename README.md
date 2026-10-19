# Nenufero · tienda local

Propuesta de tienda y experiencia de compra para revisión en localhost. No publica cambios en la web de Nenufero.

Desde el enlace **Personalizar la propuesta** del pie de página puedes cambiar el logotipo, el nombre, los textos principales, las dos imágenes destacadas y las cuatro actividades de la portada. Esos cambios se guardan solo en el navegador actual; el editor sirve para preparar y presentar una variante local, no sustituye a un CMS ni publica cambios en internet.

## Arranque

Requiere Node.js 20 o superior. Ejecuta `npm start` desde la carpeta del proyecto y abre http://127.0.0.1:8765. El carrito, los pedidos de prueba, las solicitudes y las subidas se guardan localmente en `data/` (excluido de Git).

El modo inicial es simulado: los precios de muestra son inventados para probar el flujo, no representan tarifas comerciales y no realizan cargos. Completa el carrito y los datos de contacto para crear un pedido `NEN-…` de demostración. Formularios de proyecto y visita también se guardan localmente y no se envían a Nenufero.

## Stripe, para una fase posterior

Stripe queda desactivado por defecto. Antes de procesar pagos reales, Nenufero debe aprobar las tarifas de cada SKU, los portes y las condiciones de venta. Las tarifas de demostración nunca se usan con Stripe. Después, configura `.env` a partir de `.env.example` con `PAYMENT_MODE=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PUBLIC_BASE_URL`, `STRIPE_LIVE_RATES_EUR_CENTS` (JSON de SKU a céntimos) y, si se ofrece envío, `STRIPE_SHIPPING_EUR_CENTS`.

Configura los webhooks de Stripe para `/api/stripe/webhook` y los eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` y `checkout.session.expired`. El servidor valida los importes, la moneda, la sesión y la firma del webhook. No almacena datos de tarjeta. No añadas claves al repositorio; `.env` está excluido de Git.

`nenufero-prototipo-presentacion.zip` es el paquete de la propuesta local. El tema WordPress existente es una maqueta visual independiente y no procesa compras ni pagos.
