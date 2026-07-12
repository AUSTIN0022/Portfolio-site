# Fonts

The design system is built on **Suisse Int'l** (Swiss Typefaces) — a
**commercial, licensed** typeface. The font files are **not** included in this
repo because they can't be redistributed. Until they're added here, the site
renders with the Google-Fonts fallbacks wired up in `src/app/layout.tsx`
(Barlow Condensed → display, Inter → body, JetBrains Mono → labels), which are
a close visual match.

## To install the real Suisse fonts

If you've licensed Suisse Int'l from https://www.swisstypefaces.com, export
`.woff2` files and drop them into **this folder** (`public/fonts/`) with these
exact names — `src/app/globals.css` already references them via `@font-face`:

| File                             | Family          | Weight | Role                          |
| -------------------------------- | --------------- | ------ | ----------------------------- |
| `SuisseIntl-Regular.woff2`       | SuisseIntl      | 400    | Body copy                     |
| `SuisseIntl-Medium.woff2`        | SuisseIntl      | 500    | UI, buttons, nav              |
| `SuisseIntlCond-Bold.woff2`      | SuisseIntlCond  | 700    | Display headlines             |
| `SuisseIntlMono-Regular.woff2`   | SuisseIntlMono  | 400    | Kickers, tags, labels         |

No code change is needed — once the files exist at these paths, the `@font-face`
rules resolve, the per-load 404s stop, and the real Suisse identity renders.
The Google fallbacks stay as the graceful degradation if a file is missing.
