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
exact names:

| File                             | Family          | Weight | Role                          |
| -------------------------------- | --------------- | ------ | ----------------------------- |
| `SuisseIntl-Regular.woff2`       | SuisseIntl      | 400    | Body copy                     |
| `SuisseIntl-Medium.woff2`        | SuisseIntl      | 500    | UI, buttons, nav              |
| `SuisseIntlCond-Bold.woff2`      | SuisseIntlCond  | 700    | Display headlines             |
| `SuisseIntlMono-Regular.woff2`   | SuisseIntlMono  | 400    | Kickers, tags, labels         |

There are currently no `@font-face` rules in `src/app/globals.css` for these —
they were removed because, with no files present, every page load fired 4
guaranteed-404 requests (8 with the dev double-fetch) for fonts that could
never resolve. Once the files above actually exist in this folder, paste this
block back into `src/app/globals.css` (right above the `html { scroll-behavior: smooth; }`
rule, where the comment explaining their absence lives) to wire them back up:

```css
@font-face {
  font-family: 'SuisseIntl';
  src: local('SuisseIntl'), url('/fonts/SuisseIntl-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'SuisseIntl';
  src: local('SuisseIntl'), url('/fonts/SuisseIntl-Medium.woff2') format('woff2');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'SuisseIntlCond';
  src: local('SuisseIntlCond'), url('/fonts/SuisseIntlCond-Bold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'SuisseIntlMono';
  src: local('SuisseIntlMono'), url('/fonts/SuisseIntlMono-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
```

No other code change is needed — the `--font-suisseintl*` custom properties
in `globals.css` already list `'SuisseIntl'`/`'SuisseIntlCond'`/`'SuisseIntlMono'`
as the first family, so adding the `@font-face` rules back is enough for the
real Suisse identity to take over from the Google-Fonts fallback everywhere.
