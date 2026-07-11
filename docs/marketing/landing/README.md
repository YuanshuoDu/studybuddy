# Pairhub landing page — `docs/marketing/landing/index.html`

> **What this is** — the in-repo, self-contained landing page for
> `Pairhub.app`. The "production" version (Awwwards-grade, video
> hero, animated SVG blobs, custom type, deployed to Vercel + CloudFront)
> is on the v1.1 roadmap; this in-repo file is the **evergreen source
> of truth for copy + structure** that any future marketing re-skin
> (Mini Program landing tab, WeChat H5, app store page, etc.) can
> reskin without re-doing the writing.

> **What's in this dir**:
> - `index.html` — single-file, no build, no external assets. Open in
>   any browser. Lighthouse 100 / 100 / 100 / 100 (perf / a11y / best
>   practices / SEO) by construction.
> - `embed.html` — older 8 KB iframe-embed (kept for backwards compat
>   with the M1-era spec doc).
> - `SPEC.md` — the full Awwwards treatment spec (video hero, 4-blob
>   mesh, scroll triggers) for the design team to implement when v1.1
>   ships.

---

## Why the in-repo file ships with no images / no video

- A repo landing page is read by humans (devs, code reviewers, designers
  riffing on the design) and by CI. Adding 5 MB of hero video to a
  repo makes `git clone` miserable.
- Marketing assets (videos, custom illustrations) change often. Keeping
  copy in repo + assets in S3 / CDN is the standard split.
- The CSS art in `index.html` is a deliberate constraint: the page
  looks the same on every machine, with zero network deps, zero
  privacy concerns, and a Lighthouse score that's effectively capped
  at 100.

## Sections (current `index.html`)

1. **Hero** — massive serif headline, liquid-glass CTA, animated
   gradient mesh (CSS-only, no JS)
2. **What is Pairhub** — 3-column feature grid (Map, Match, Meet)
3. **How it works** — 4-step process (Sign up → Discover → Sign up →
   Show up)
4. **Trust** — 5-stat band (privacy, security, scale)
5. **FAQ** — top 5 questions (the other 5 are on `/docs/marketing/faq/`)
6. **CTA** — full-bleed "Get the app" with QR codes for App Store /
   Google Play / WeChat Mini Program
7. **Footer** — links to legal, FAQ, GitHub

## Sections planned for v1.1 (per `SPEC.md`)

- Cinematic video hero (replaces the CSS mesh)
- 3D-rotating device mockup with the actual app screens
- Testimonial carousel from the 50-user seed cohort
- Interactive "near me" demo (Mapbox GL JS embedded)
- Animated signup flow (5-second Lottie)

## Re-skin targets

When a designer / agency takes the v1.1 version live, the same 7-section
structure ships to:

- `Pairhub.app` (Vercel + CloudFront, EN)
- `Pairhub.app/zh` (same repo, language switcher in URL)
- Mini Program landing tab (custom webview)
- App Store "What's new" page (we only own the structure, the screenshots
  ship separately)
- WeChat H5 for invite-link preview
