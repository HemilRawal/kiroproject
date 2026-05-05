# Project Structure

## Root Layout
```
/
├── index.html                    # Homepage (marketing)
├── catalogue.html                # Product catalogue + PDP
├── contact_us.html               # Contact page
├── customer_dashboard_3.html     # Buyer dashboard
├── login-page.html               # Login / register
├── manufacturer_portal.html      # Manufacturer dashboard
├── oem_register_landingpage.html # Manufacturer acquisition page
├── onboarding2.html              # Manufacturer onboarding flow
├── rfq_cart.html                 # RFQ cart
├── logo.jpeg                     # Brand logo image
├── env.example                   # Backend environment variable template
└── .kiro/
    └── steering/                 # AI steering documents
```

## File Architecture Pattern
Every HTML file is self-contained:
- `<head>` includes Google Fonts link, Melete font as base64 `@font-face`, and all page CSS in `<style>` tags
- `<body>` contains the full page markup
- `<script>` tags at the bottom contain all page JavaScript

There are no shared CSS files, no shared JS modules, and no templating system. Each page duplicates the nav, font declarations, and common CSS.

## Navigation Component
Every page uses the same floating nav pattern:
- Fixed position, `top: 16px`, `left/right: 24px`
- Dark glassmorphism background (`rgba(10,10,10,0.92)` + `backdrop-filter: blur(20px)`)
- `border-radius: 14px`, `height: 60px`
- Logo uses the "Melete" font with `letter-spacing: 0.18em`
- Nav links: uppercase, `13–13.5px`, `letter-spacing: 0.04em`
- Inline search bar that slides in on `.search-mode` class toggle
- Hamburger menu for mobile (hidden on desktop)

## Page-Level View Switching
Several pages implement multi-view UIs without routing:
- Views are `<div>` elements toggled via `display: none / block`
- Active view controlled by JS functions (e.g., `showView('orders')`)
- Examples: `catalogue.html` (catalogue ↔ PDP), `customer_dashboard_3.html` (dashboard ↔ orders ↔ order detail ↔ RFQs ↔ wishlist), `manufacturer_portal.html` (sidebar nav tabs)

## Naming Conventions
- HTML files use `snake_case`
- CSS classes use `kebab-case`
- JS variables/functions use `camelCase`
- CSS custom properties: `--kebab-case`
- BEM-like class naming in some components (e.g., `.product-card`, `.product-card-body`, `.product-card-name`)

## Responsive Design
- Mobile breakpoints at `768px` and `480px` using `@media` queries
- Nav collapses to hamburger on mobile
- Grids switch to single column on small screens
- `clamp()` used for fluid typography on hero sections
