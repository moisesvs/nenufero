# Prototipo local de Nenufero

Esta carpeta contiene un rediseño navegable para revisar y presentar. No publica cambios en la web actual.

## Abrir la propuesta

- En tu equipo, abre `index.html` en Chrome, Safari u otro navegador. Si el doble clic no lo abre, arrastra el archivo a una ventana del navegador o usa **Archivo → Abrir**.
- Para compartirla, envía `nenufero-prototipo-presentacion.zip`; al extraerlo, abre el `index.html` incluido.
- Para editar el diseño, modifica `index.html`, `styles.css`, `brand.css` y `app.js`. Las imágenes están en `public/assets/`, incluido el logotipo oficial suministrado por la empresa.

La portada y sus imágenes usan rutas relativas para funcionar en local. El prototipo permite configurar vinilo por metros, PVC y metacrilato a medida, y corte láser; preparar un pedido; seleccionar un archivo de referencia; pedir presupuesto por WhatsApp; y proponer fecha para visitar el taller. En dispositivos compatibles, la hoja de compartir permite enviar el archivo junto con la consulta. Las solicitudes de cita quedan pendientes de confirmación.

El prototipo local no procesa pagos. Los precios, el stock, los formatos disponibles y las condiciones deben cargarse en el catálogo de Shopify antes de cobrar. El tema Shopify muestra variantes, precios e inventario reales, añade archivos de referencia a cada producto del pedido y dirige al checkout de la tienda. Para configurar pagos, activa Shopify Payments o el proveedor que use la empresa en **Configuración → Pagos**. Define medidas y grosores cobrables como variantes de producto con su precio real; los trabajos con precio variable deben confirmarse primero por presupuesto.

En el editor de Shopify, asigna las colecciones de vinilo por metros, PVC y metacrilato, y corte láser a la sección “Categorías de materiales”. Añade “Materiales” al menú principal. Configura el email y el teléfono de atención de la tienda en sus ajustes.

Las dos imágenes principales son propuestas visuales generadas para el prototipo. Se pueden reemplazar por fotografías y producto reales conservando las mismas rutas.

## Temas de plataforma opcionales

- `wordpress-theme/` y `nenufero-wordpress-theme.zip`: tema para la web corporativa WordPress.
- `shopify-theme/` y `nenufero-shopify-theme.zip`: tema Shopify que lee el catálogo real de la tienda.

Estos temas son entregables aparte; el prototipo local no depende de ellos.
