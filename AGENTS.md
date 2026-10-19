# Nenufero project rules

## Project structure

- The local Spanish storefront is served by `server.mjs`; the homepage is `index.html` and category journeys live in `tienda/*.html`.
- Shared purchase UI lives in `tienda/cart.js`, `tienda/experience-store.js`, `tienda/commerce.js` and `tienda/commerce.css`.
- Keep each purchase category on a dedicated URL. Use the homepage to make the online store easy to find.
- Reuse the shared experience shell, field components, cart drawer, and design tokens. Do not fork near-identical CSS or JavaScript per category.

## Commerce and data

- Clearly identify the current prices as illustrative demo prices. Never present invented prices, stock, delivery promises or product specifications as commercial facts.
- The server validates catalogue items and calculates every order. Stripe remains disabled unless approved price rates and owner-provided keys are configured in `.env`.
- Product artwork uploads are held locally for the prototype. Keep file limits visible and never expose customer data from the public API.
- A meeting date is a request until the business confirms it. Do not imply a confirmed appointment.
- Simulated checkout never charges money or sends an order to Nenufero. Project and visit requests are saved locally and are not appointments until confirmed by the business.

## Visual system

- Styling uses plain CSS. Shared colors and motion tokens for the local site are defined in `styles.css`.
- Preserve the warm paper `#f6f4ef`, ink `#181916`, cobalt `#1747db`, and fine neutral dividers. Use the existing Manrope typeface and responsive spacing patterns.
- Keep product journeys editorial, calm, and conversion-focused: one clear task per page, concise product-specific guidance, visible price/variant information, a prominent next action, and a clear route to help.
- Use semantic HTML, labeled inputs, keyboard-visible focus, descriptive image alt text, responsive layouts, and reduced-motion support.
- Keep source copy in Spanish. Use real Nenufero products and assets; never add generic placeholder brands or fake testimonials.

## Figma workflow

- If the Figma MCP server is available, fetch `get_design_context` and `get_screenshot` for the exact referenced frame before implementing a Figma design, then validate the result against that frame.
- The `create_design_system_rules` Figma MCP tool was not available in the workspace when these project rules were generated. Do not claim that these rules were derived from a Figma file. Revisit them after a Figma connection becomes available.
