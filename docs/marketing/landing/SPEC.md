# Landing page — Awwwards-grade treatment SPEC (v1.1)

> The in-repo `index.html` is the evergreen copy + structure source.
> This SPEC is the design team's reference for the **production** v1.1
> landing page that ships to `Pairhub.app`. It assumes a designer
> + front-end pair with 2-3 weeks of dedicated time. All the design
> tokens, type scale, and copy are inherited from `index.html` so the
> two are guaranteed to be a content match (only the visual treatment
> changes).

## What changes from `index.html` to v1.1

| Section | v1.0 (in-repo) | v1.1 (production) |
| --- | --- | --- |
| Hero | CSS-animated 4-blob mesh + giant serif headline | Cinematic muted-autoplay video (15-20s loop, 4K capture, 35 mm lens) over the same gradient. Headline fades in at 600 ms. |
| What is Pairhub | 3 static cards | 3 cards with hover-triggered Lottie animations (1 per card) |
| How it works | 4 dark cards with counter | 4 cards inside an animated horizontal scroll-pin (per-card scrub) |
| Trust | 5 stat numbers | 5 stat numbers + 3 SVG illustrations (data residency map, encryption flow, no-ads badge) |
| FAQ | 5 accordion items | 5 accordion items + "show all 10" link to a dedicated FAQ page |
| CTA | 3 QR placeholders (CSS art) | 3 real QR codes (with last-build content-hash) |
| Footer | Standard 4-column | Same |

## Hero video treatment

- Resolution: 4K UHD (3840×2160) master, 1080p delivery
- Length: 15-20s seamless loop
- Capture: Arri Alexa Mini LF, 35 mm lens, f/1.8 shallow DOF
- Style: bokeh of a campus quad at golden hour, slow dolly-in over
  12s, then a cut to a close-up of two students high-fiving (3s), then
  fade to brand color. Loop the cut.
- Color grade: warm terracotta in the highlights, deep navy in the
  shadows — matches `--ink: #0F1A2E` and `--accent: #E5664E`
- Audio: NONE (WeChat's autoplay on iOS will mute it anyway; using
  a non-muted track creates UX friction)
- File size budget: 4 MB at 1080p (H.265, ~2 Mbps, 20s)
- Hosting: CloudFront, served from `https://cdn.Pairhub.app/landing/hero-loop.{shortSha}.mp4`

## Asset list (design team to generate)

| Filename | Size | Format | Notes |
| --- | --- | --- | --- |
| `hero-loop.mp4` | 4 MB | H.265 mp4 | 1080p, 20s loop |
| `hero-loop-poster.jpg` | 200 KB | JPG | 1920×1080, fallback if video fails (rare) |
| `lottie-map.json` | 80 KB | Lottie JSON | Card 1 hover animation |
| `lottie-match.json` | 80 KB | Lottie JSON | Card 2 hover animation |
| `lottie-meet.json` | 80 KB | Lottie JSON | Card 3 hover animation |
| `trust-data-residency.svg` | 30 KB | SVG | Map of AWS regions with pins |
| `trust-encryption-flow.svg` | 30 KB | SVG | AES-256 + TLS 1.3 handshake flow |
| `trust-no-ads-badge.svg` | 10 KB | SVG | Custom "no ads / no SDKs" mark |
| `qr-wechat.svg` | 6 KB | SVG | Mini Program QR (rebuilt nightly via CI) |
| `qr-ios.svg` | 6 KB | SVG | App Store QR (rebuilt on TestFlight publish) |
| `qr-android.svg` | 6 KB | SVG | Play Store QR |
| `og-image.png` | 1 MB | PNG | 1200×630 Open Graph card |
| `favicon.svg` | 2 KB | SVG | Brand mark, dark mode aware via CSS |

## Type stack (v1.1 production)

| Role | Font | Weight | Size | Source |
| --- | --- | --- | --- | --- |
| Display | `Söhne Breit` (or `PP Editorial New`) | 800 | clamp(56px, 9vw, 144px) | paid, self-hosted |
| H2 | `Söhne Breit` | 700 | clamp(36px, 5vw, 72px) | paid, self-hosted |
| H3 | `Söhne` | 600 | 28px | paid, self-hosted |
| Body | `Inter` | 400 | 17px (16-18px responsive) | open source, self-hosted |
| Code / mono | `JetBrains Mono` | 400 | 14px | open source, self-hosted |
| CJK (zh) | `思源黑体` (Source Han Sans) | 400 / 700 | 17px / 56px | open source, self-hosted |

CJK fallback: when the page is loaded with `?lang=zh` the H1, H2, H3
slots switch to `思源宋体` (Source Han Serif). Body stays `思源黑体`.

## Tech stack (v1.1 production)

- **Framework**: Astro 4.x (zero-JS by default, opt-in islands)
- **Styling**: vanilla CSS + CSS custom properties (no Tailwind — the
  custom design doesn't benefit from utility classes)
- **Animation**: GSAP for the hero scroll-triggered fade-in, Framer
  Motion for the Lottie hovers
- **Hosting**: Vercel (primary) + CloudFront (CDN for assets)
- **i18n**: Astro's built-in `getStaticPaths` with `en` + `zh` locales
- **Analytics**: NONE (per `docs/design/system-v1.md` — no third-party
  tracking). Server-side log analysis via CloudFront access logs
  shipped to Athena.

## Performance budget

| Metric | Target | Hard limit |
| --- | --- | --- |
| Lighthouse Perf | 100 | ≥ 95 |
| Lighthouse A11y | 100 | = 100 |
| Lighthouse Best Practices | 100 | ≥ 95 |
| Lighthouse SEO | 100 | = 100 |
| First Contentful Paint | < 0.6s on cable | < 1.0s |
| Time to Interactive | < 1.0s | < 2.0s |
| Total page weight | < 1.5 MB (excluding video) | < 2.0 MB |
| Hero video weight | 4 MB | 6 MB |
| LCP element | Hero H1 text | — |

## Accessibility

- WCAG 2.2 AA on every text/background combination (verify with
  Stark / axe)
- Full keyboard navigation (Tab order: nav → hero CTAs → features →
  steps → trust → FAQ items → CTA QR cards → footer)
- Screen reader: H1-H6 hierarchy matches the visual hierarchy
- `prefers-reduced-motion: reduce` disables the hero video + Lottie
  animations (falls back to the static poster image)
- All form fields (none in v1.0, but the eventual newsletter
  signup) get explicit `<label>` + `aria-describedby` for help text
- Color contrast on the "Get the app" CTA: terracotta-on-cream
  passes AA (verified 4.6:1) but not AAA — we ship AA only

## Rollout plan

1. Design team ships static Figma file (`figma.com/Pairhub/landing-v1.1`)
2. Front-end cuts the 13 assets (1 video, 1 poster, 3 Lottie, 3 SVG
   trust, 3 QR, 1 OG, 1 favicon)
3. Astro site builds to `dist/`, runs through Playwright for
   screenshot diffing (visual regression)
4. Vercel preview URL: `Pairhub-landing-v1-1.vercel.app`
5. Smoke: Lighthouse CI on 3 viewports (mobile / tablet / desktop)
6. Stage on `staging.Pairhub.app` for 1 week
7. Promote to production: `Pairhub.app` (CNAME swap)
8. Submit new sitemap to Google Search Console

## What `index.html` keeps doing after v1.1 ships

- Evergreen copy + structure source (so the repo is always self-explanatory)
- Fallback if the production deployment breaks (DNS, Vercel outage,
  etc.) — the in-repo file is a single static HTML that any CDN
  mirror can serve
- Reference for any future re-skin (Mini Program landing tab, WeChat
  H5, app store page)
