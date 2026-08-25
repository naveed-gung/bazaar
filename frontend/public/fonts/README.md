# Self-hosted webfonts

Served locally so the site makes **zero third-party font requests** (the helmet CSP
in `backend/src/app.ts` already permits `font-src 'self' data:`).

| File                              | Family          | Axes                       | Size    | Source                                            |
| --------------------------------- | --------------- | -------------------------- | ------- | ------------------------------------------------- |
| `archivo-latin-var.woff2`         | Archivo         | wght 100–900 + wdth 62–125 | 88.0 KB | https://fonts.google.com/specimen/Archivo         |
| `instrument-sans-latin-var.woff2` | Instrument Sans | wght 400–700               | 29.4 KB | https://fonts.google.com/specimen/Instrument+Sans |

Total payload: **117 KB** (budget: < 200 KB). Latin subset only. Fetched from the
Google Fonts css2 API (`family=Archivo:ital,wdth,wght@0,62..125,100..900` /
`family=Instrument+Sans:ital,wght@0,400..700`) with a modern browser User-Agent so
the served file is the variable woff2.

Both families are licensed under the **SIL Open Font License 1.1**
(https://openfontlicense.org/) — free to use, embed and redistribute.

Referenced by `@font-face` rules in `frontend/src/styles.css` with
`font-display: swap` and metric-matched fallback faces (`Archivo Fallback`,
`Instrument Sans Fallback`, size-adjust + ascent/descent overrides against Arial)
so the swap produces no layout shift. Archivo's `@font-face` declares
`font-stretch: 62% 125%`, which maps the wdth axis — `.headline` uses
`font-stretch: 125%` for the expanded-black display setting.

Preloaded in `frontend/src/routes/__root.tsx`. Superseded files
(`rubik-latin-var.woff2`, `nunito-sans-latin-var.woff2`) were removed when the
SWISS SIGNAL reset landed (SSR-02, docs/agent/10-swiss-signal.md).
