# Brand: logo and icons

**The mark:** a shop awning over a "V": a shop on VirtualBiz. It is drawn in navy `#141A2B` on a
yellow `#F5B800` tile (the `--accent` token), with a 15/64 corner radius. The wordmark is
Virtual**Biz**, with "Biz" in `--accent-ink`.

| File | Use |
| --- | --- |
| `frontend/public/brand/logo-mark.svg` | the mark (vector master) |
| `frontend/public/brand/logo.png`, `logo-dark.png` | mark + wordmark for light / dark backgrounds |
| `frontend/src/app/icon.svg`, `favicon.ico` | browser tab |
| `frontend/src/app/apple-icon.png` | iPhone home screen (180 px, square: iOS rounds it) |
| `frontend/public/brand/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | installed web app (`src/app/manifest.ts`), push notifications |

In the app, use `<Logo />` (mark + wordmark) or `<LogoGlyph />` inside an existing tile
(`src/components/ui/Logo.tsx`). The glyph takes `currentColor`, so the admin console's purple
tile shows it in white.

**Don't:** stretch or rotate the mark, put the navy glyph on a dark background without its yellow
tile, or recolour the tile (apart from the admin console).

To redraw the PNGs after changing the SVG, render it at each size with a headless browser (for
example Playwright's `page.screenshot({ omitBackground: true })`). `favicon.ico` holds 16, 32 and
48 px PNGs.
