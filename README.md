# Passport Photo Maker

A modern Next.js + Tailwind web app that turns uploaded images into print-ready passport/visa photo sheets.

## Features

- Drag-and-drop JPG/PNG upload with live preview
- Automatic background removal:
	- Primary: remove.bg API (via secure server route)
	- Fallback: in-browser AI segmentation (`@imgly/background-removal`)
- Background replacement: white, light blue, or custom color
- Passport photo generation:
	- Passport (35 x 45 mm)
	- Visa (50 x 50 mm)
	- Custom dimensions (mm)
	- Country presets (Generic, USA, India, Schengen, UAE)
	- Default region preset: India - West Bengal
- Layout generator:
	- Adjustable rows, columns, and copies
	- A4 and 4 x 6 paper support
- Live print-sheet preview
- High-resolution export at 300 DPI:
	- Download PDF
	- Download PNG
	- Print from browser
- Extra controls:
	- Optional face-aware horizontal centering (when browser supports `FaceDetector`)
	- Brightness/contrast adjustment
	- Optional watermark toggle

## Tech Stack

- Next.js (App Router) + React + TypeScript
- Tailwind CSS (with custom global theme styles)
- Canvas-based image composition and layout rendering
- jsPDF for PDF generation

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. (Optional but recommended) Configure remove.bg API key:

```bash
cp .env.example .env.local
```

Set:

```bash
REMOVE_BG_API_KEY=your_remove_bg_api_key
```

If the key is not set, the app automatically uses local AI segmentation fallback.

3. Start dev server:

```bash
npm run dev
```

4. Open `http://localhost:3000`

## Build and Lint

```bash
npm run lint
npm run build
```

## Important Files

- `src/app/page.tsx`: Main multi-step workflow UI and client-side generation pipeline
- `src/app/api/remove-bg/route.ts`: Server-side remove.bg proxy endpoint
- `src/app/globals.css`: Theme and reusable UI utility classes
