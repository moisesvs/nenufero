# Nenufero — propuesta local y tema Shopify

El proyecto conserva una portada corporativa y presenta la tienda como experiencias separadas por tipo de compra. La portada no muestra catálogo, configuradores ni formulario de pedido.

La imagen principal de la portada funciona como galería: usa las flechas, los números o el gesto de deslizar en móvil para cambiar de foto.

La tienda se destaca en el botón fijo de la cabecera, en el CTA azul de portada, en el acceso después de los servicios y en el pie. Cada experiencia de compra conserva su catálogo o formulario en su propia página.

## Revisar en local

- Abre [http://127.0.0.1:8765/](http://127.0.0.1:8765/) mientras el servidor local esté activo.
- La tienda local está en `tienda/index.html`. Cada categoría tiene una página propia dentro de `tienda/` y comparte `experience.js` y `experience.css`.
- Para compartir la propuesta, usa `nenufero-prototipo-presentacion.zip`; incluye la web y las páginas de compra.
- Los pedidos y referencias del prototipo son demostrativos. El sitio local no guarda archivos en un servidor de negocio ni procesa pagos. Las visitas se solicitan y quedan pendientes de confirmación.

## Experiencias incluidas

- Personalizados: camisetas, tazas y objetos.
- Rótulos luminosos y retroiluminados.
- Impresión de gran formato, vinilo impreso y lonas.
- Vinilo por metros.
- PVC y metacrilato cortados o fresados.
- Corte láser.
- Proyecto a medida con archivo de referencia y solicitud de visita.

## Preparar Shopify

El tema `shopify-theme/` usa productos, variantes, inventario y precios de Shopify. Cada compra se realiza desde la ficha del producto y el checkout de la tienda. Las medidas y acabados con precio fijo se deben definir como variantes; los trabajos con precio variable pasan por presupuesto antes de pagar. Los archivos de referencia del producto se asocian al artículo del carrito.

En Shopify Admin:

1. Crea las páginas `tienda-online`, `personalizados`, `rotulos-luminosos`, `gran-formato`, `vinilo-por-metros`, `pvc-metacrilato`, `corte-laser` y `proyecto-a-medida`.
2. Asigna a cada página su plantilla `page.*.json` correspondiente.
3. Crea colecciones con sus productos y variantes. Asigna cada colección a la sección de la página correspondiente desde el editor del tema.
4. Añade “Tienda online” y “Tu proyecto” al menú principal, y configura el teléfono y el email de la tienda.
5. Activa Shopify Payments o el proveedor de pago elegido en **Configuración → Pagos** y verifica el checkout desde Shopify.

El prototipo local no cambia ni publica la tienda activa. Los ZIP están disponibles en `nenufero-prototipo-presentacion.zip` y `nenufero-shopify-theme.zip`.
