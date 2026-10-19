# Nenufero project rules

## Project structure

- The local presentation is a static Spanish website. Its homepage lives in `index.html`; category-specific shopping journeys live in `tienda/*.html` and share `tienda/experience.js` and `tienda/experience.css`.
- The Shopify Online Store 2.0 theme lives in `shopify-theme/`. Liquid sections are in `sections/`, reusable product UI is in `snippets/`, and JSON page templates are in `templates/`.
- Keep each purchase category as a dedicated URL and Shopify page template. The homepage introduces the brand and services; it does not contain product grids, material configurators, or order forms.
- Reuse the shared experience shell, field components, cart drawer, and design tokens. Do not fork near-identical CSS or JavaScript per category.

## Commerce and data

- IMPORTANT: Never invent or hardcode prices, stock, delivery promises, payment methods, or product specifications. On Shopify, read prices, variants, and availability from Shopify products.
- Use product variants for quantities, sizes, finishes, and dimensions that have an approved price. Route variable-price or nonstandard fabrication work to a quote request before checkout.
- Use Shopify's product form and cart for purchasable items. Keep the Shopify checkout as the payment step; payment methods must come from the merchant's Shopify payment settings.
- Product artwork uploads belong to Shopify product forms as line-item properties so they accompany the selected item. Keep any size/type restrictions clear beside the upload control.
- A meeting date is a request until the business confirms it. Do not imply a confirmed appointment.
- The static local prototype cannot process payments or persist uploaded files to a business system. Label demo behavior honestly and do not present WhatsApp quote requests as completed purchases.

## Visual system

- Styling uses plain CSS. Shared colors and motion tokens are defined in `styles.css` for the local site and `shopify-theme/assets/theme.css` for Shopify.
- Preserve the warm paper `#f6f4ef`, ink `#181916`, cobalt `#1747db`, and fine neutral dividers. Use the existing Manrope typeface and responsive spacing patterns.
- Keep product journeys editorial, calm, and conversion-focused: one clear task per page, concise product-specific guidance, visible price/variant information, a prominent next action, and a clear route to help.
- Use semantic HTML, labeled inputs, keyboard-visible focus, descriptive image alt text, responsive layouts, and reduced-motion support.
- Keep source copy in Spanish. Use real Nenufero products and assets; never add generic placeholder brands or fake testimonials.

## Figma workflow

- If the Figma MCP server is available, fetch `get_design_context` and `get_screenshot` for the exact referenced frame before implementing a Figma design, then validate the result against that frame.
- The `create_design_system_rules` Figma MCP tool was not available in the workspace when these project rules were generated. Do not claim that these rules were derived from a Figma file. Revisit them after a Figma connection becomes available.
