# Austin Makasare — Full-Stack Software Engineer Portfolio

<div align="center">

### Full-Stack Software Engineer building production systems — queues, locks, and distributed infrastructure

Software engineer with 1.5 years of full-time production experience building
async job pipelines, distributed systems, and cloud infrastructure. Ships real systems solo,
end-to-end — from architecture to deployment. Open to **SDE-2 / Software Engineer** roles.

**[austinmakasare.site](https://austinmakasare.site)** ·
[GitHub](https://github.com/AUSTIN0022/) ·
[LinkedIn](https://www.linkedin.com/in/austin-makasare/) ·
[Resume](https://austinmakasare.site/austin-makasare-resume.pdf) ·
austinmakasare00@gmail.com

`Node.js` `TypeScript` `Distributed Systems` `System Design` `BullMQ` `Redis` `PostgreSQL` ·
`Prisma` `Socket.IO` `Express` `AWS` `Terraform` `Docker` `Next.js` `React`

</div>

---

## 🚀 Overview

This repo is the source for my personal portfolio site — built with Next.js 16 (App Router),
React 19, GSAP, and Three.js. It's not just a static resume page: it's a small production system
in its own right, with a custom 3D hero scene, physics-driven backgrounds, and scroll-choreographed
case studies for the projects below.

- 🖼️ **Generated hero illustration** composited with a live 3D background
- 🌌 **Interactive 3D galaxy** background (`@react-three/fiber` + `@react-three/drei`) with physics
- 📜 **Scroll-driven, multi-stage animation** sections (GSAP + custom scroll hooks)
- 🧩 **Mermaid-rendered architecture diagrams** for case studies
- 🌗 **Light/dark theme** with no flash-of-wrong-theme on load
- 🤖 **AI/LLM-crawlable SEO layer** — structured JSON-LD, `/llms.txt`, `/llms-full.txt`

### Featured case studies

- **[QuizBuzz](https://austinmakasare.site/work/quizbuzz)** — real-time multiplayer quiz app
- **[SmartFormFlow](https://austinmakasare.site/work/smartformflow)** — form automation pipeline

## 🛠️ Development

### Prerequisites

- Node.js 20+
- npm 9+ or yarn

### Installation

```bash
npm install
```

### Running the Development Server

```bash
npm run dev
```

### Building for Production

```bash
npm run build
```

### Starting Production Server

```bash
npm run start
```

## 📁 Project Structure

```
src/
├── app/                     # Next.js 16 App Router
│   ├── page.tsx             # Homepage
│   ├── work/                # Case studies (quizbuzz, smartformflow)
│   ├── now/                 # "Now" page
│   ├── lab/                 # Lab/playground section
│   └── layout.tsx           # Root layout, fonts, theme init, JSON-LD
├── components/
│   ├── ui/                  # Reusable UI components
│   ├── nav/                 # Navigation
│   ├── sections/            # Page-specific sections (Hero, etc.)
│   ├── work/                # Case-study components
│   ├── shoot/                # Easter-egg interaction mode
│   └── seo/                 # JSON-LD structured data components
├── lib/
│   ├── seo/                 # Single source of truth for SEO/AISEO metadata
│   ├── utils/                # Utility functions
│   ├── techIcons.tsx         # Tech stack icons
│   └── themeStore.ts         # Theme state
├── hooks/                    # useScrollAnimation, useStore
├── content/                  # Typed content (projects.ts, now.ts)
└── types/                    # Shared TypeScript types

public/                       # Static assets (images, fonts, resume, 3D models)
```

## 🎨 Design System

### Typography

The type system is built on **Suisse Int'l** (a commercial, licensed typeface). The font files
aren't checked into this repo (they can't be redistributed), so the site currently renders on
close-match Google Fonts fallbacks wired up in [`src/app/layout.tsx`](src/app/layout.tsx):

| Role | Fallback (active) | Intended (licensed) |
|------|--------------------|----------------------|
| Hero display | Geist (black weight) | — |
| Headlines | Barlow Condensed | SuisseIntlCond |
| Body | Inter | SuisseIntl |
| Labels/mono | JetBrains Mono | SuisseIntlMono |

See [`public/fonts/README.md`](public/fonts/README.md) for how to drop in the real Suisse files.

### Theme

Black/white base palette with a single loud accent, switchable at runtime (persisted, defaults
to system preference):

| Token | Light | Dark |
|-------|-------|------|
| `--color-bg` | `#ffffff` | `#000000` |
| `--color-fg` | `#000000` | `#ffffff` |
| Accent | Electric yellow `#fff100` | Electric yellow `#fff100` |

## 🧪 Testing

Type checking:
```bash
npx tsc --noEmit
```

## 📝 License

Private project — All rights reserved.
