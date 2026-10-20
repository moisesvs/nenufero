# Nenufero · tienda local

Propuesta de tienda y experiencia de compra para revisión en localhost. No publica cambios en la web de Nenufero.

Desde el enlace **Personalizar la propuesta** del pie de página puedes cambiar el logotipo, el nombre, los textos principales, las cuatro imágenes de la galería de servicios y las cuatro actividades de la portada. Esos cambios se guardan solo en el navegador actual; el editor sirve para preparar y presentar una variante local, no sustituye a un CMS ni publica cambios en internet.

Las preguntas frecuentes tienen una página propia en `faq.html` y aparecen en el menú principal.

## Arranque

Requiere Node.js 20 o superior. Ejecuta `npm start` desde la carpeta del proyecto y abre http://127.0.0.1:8765. El carrito, los pedidos de prueba, las solicitudes y las subidas se guardan localmente en `data/` (excluido de Git).

El modo inicial es simulado: los precios de muestra son inventados para probar el flujo, no representan tarifas comerciales y no realizan cargos. Completa el carrito y los datos de contacto para crear un pedido `NEN-…` de demostración. Formularios de proyecto y visita también se guardan localmente y no se envían a Nenufero.

## Panel de administración

Abre `/admin/` con el servidor iniciado. En `.env` configura `ADMIN_PASSWORD` con al menos 12 caracteres y `ADMIN_SESSION_SECRET` con un secreto aleatorio. La sesión va firmada en una cookie `HttpOnly` y `SameSite=Strict`.

Para leer y editar el catálogo real, crea una aplicación Shopify con los scopes `read_products`, `write_products`, `read_orders`, `write_orders`, `write_inventory` y `write_assigned_fulfillment_orders`; configura `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ADMIN_ACCESS_TOKEN` y, opcionalmente, `SHOPIFY_API_VERSION` en el entorno del servidor. `write_inventory` permite aplicar ajustes de existencias por ubicación; `write_assigned_fulfillment_orders` permite preparar pedidos de ubicaciones gestionadas por la tienda. Shopify también exige que el usuario tenga permisos para cambiar inventario y preparar pedidos. Nunca incluyas el token en el navegador ni en GitHub. La aplicación debe contar también con la autorización de Shopify para mostrar los datos protegidos de clientes, como nombre, email, teléfono y dirección.

La conexión Shopify pagina los pedidos, el catálogo completo y las variantes de cada producto. Permite modificar título, descripción, marca, tipo, etiquetas, publicación, precios, SKU y códigos de barras; añadir variantes con sus opciones y retirar variantes sobrantes con confirmación; también ajustar el stock disponible de cada variante y ubicación con un movimiento de inventario auditable en Shopify. Los productos se archivan para retirarlos del catálogo sin borrar permanentemente su historial. En pedidos permite revisar los datos que Shopify autoriza, cambiar el estado interno de preparación, guardar notas internas, marcar artículos como preparados en Shopify y cancelar un pedido reembolsando al medio original y reponiendo existencias. La cancelación requiere confirmación explícita y no notifica al cliente. El estado interno de producción no cambia el estado de fulfillment de Shopify.

Por defecto, Shopify limita pedidos a los últimos 60 días. Para gestionar el historial completo, solicita a Shopify el scope `read_all_orders` además de `read_orders` o `write_orders`; Shopify debe aprobarlo. La documentación oficial: [scopes de Shopify](https://shopify.dev/docs/api/usage/access-scopes).

Sin credenciales Shopify, el panel local continúa en modo de demostración y permite revisar pedidos de prueba y editar los 13 SKU del prototipo. En Netlify, la función protegida gestiona datos reales Shopify; configura en Netlify las variables `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ADMIN_ACCESS_TOKEN` y `SHOPIFY_API_VERSION`. La contraseña debe tener al menos 12 caracteres y el secreto de sesión 32. No reutilices la contraseña local ni publiques el token. El despliegue remoto requiere que se concedan los scopes y el acceso de datos protegidos descritos arriba.

El catálogo local se guarda en `data/catalog-overrides.json`, excluido de Git. El servidor local escribe pedidos y archivos en `data/`; esa información local no se sincroniza con Netlify ni con Shopify.

## Stripe, para una fase posterior

Stripe queda desactivado por defecto. Antes de procesar pagos reales, Nenufero debe aprobar las tarifas de cada SKU, los portes y las condiciones de venta. Las tarifas de demostración nunca se usan con Stripe. Después, configura `.env` a partir de `.env.example` con `PAYMENT_MODE=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PUBLIC_BASE_URL`, `STRIPE_LIVE_RATES_EUR_CENTS` (JSON de SKU a céntimos) y, si se ofrece envío, `STRIPE_SHIPPING_EUR_CENTS`.

Configura los webhooks de Stripe para `/api/stripe/webhook` y los eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` y `checkout.session.expired`. El servidor valida los importes, la moneda, la sesión y la firma del webhook. No almacena datos de tarjeta. No añadas claves al repositorio; `.env` está excluido de Git.

`nenufero-prototipo-presentacion.zip` es el paquete de la propuesta local. El tema WordPress existente es una maqueta visual independiente y no procesa compras ni pagos.
