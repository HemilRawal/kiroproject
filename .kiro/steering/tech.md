# Tech Stack

## Frontend
- **Pure HTML/CSS/JavaScript** — no build system, no framework, no bundler
- All pages are standalone `.html` files with inline `<style>` and `<script>` tags
- No npm, no package.json, no node_modules

## Fonts
- **Outfit** (primary UI font) — loaded from Google Fonts
- **Melete** (brand/logo font) — embedded as a base64 `@font-face` data URI in every page
- **Rajdhani** — used in dashboard/portal pages for headings
- **DM Sans** — used in onboarding and some portal pages

## CSS Approach
- CSS custom properties (variables) defined in `:root` on every page
- Standard color palette across pages:
  - `--orange: #ff6b00` or `#e85c0d` (slight variation between pages — use the value already present in the file being edited)
  - `--green: #00a859` or `#2e7d32`
  - `--black: #050505` or `#0a0a0a`
  - `--white: #ffffff`
- No CSS preprocessors (no Sass/Less)
- No utility frameworks (no Tailwind)
- Glassmorphism nav pattern used on every page: `backdrop-filter: blur(20px)`, dark semi-transparent background

## JavaScript
- Vanilla JS only, inline in `<script>` tags at the bottom of each HTML file
- No external JS libraries except:
  - `jspdf` (CDN) used in `onboarding2.html` for PDF generation
- UI patterns: modal/popup toggling via class manipulation (`.active`), tab/view switching via `display` style, canvas-based signature pad in onboarding

## Backend / Infrastructure (from `env.example`)
- **Database**: Supabase (PostgreSQL)
- **Auth**: JWT + Google OAuth
- **Email**: Resend API
- **SMS**: MSG91 (optional)
- **File storage**: Cloudinary
- **Runtime**: Node.js (port 4000)
- Backend code is not present in this repository — only frontend HTML files exist

## Common Commands
There is no build system. Open HTML files directly in a browser or serve with any static file server:

```bash
# Simple static server (Python)
python -m http.server 8080

# Or with Node
npx serve .
```

No compile, test, or lint commands are configured.
