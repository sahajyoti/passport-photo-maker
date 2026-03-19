# Passport Photo Maker

A modern Next.js + Tailwind web app that turns uploaded images into print-ready passport/visa photo sheets.

## Features

- Drag-and-drop JPG/PNG upload with live preview
- Automatic background removal:
	- Primary: local Python `rembg` API route (AI background removal)
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
- Ad-ready layout:
	- Top banner ad slot
	- In-content ad slot
	- Sidebar ad slot
	- Footer ad slot

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

2. Install Python background-removal dependency:

```bash
pip install rembg[cli] rembg[cpu]
```

If your environment does not expose `python3`, set a custom Python binary:

```bash
cp .env.example .env.local
```

Set:

```bash
REMBG_PYTHON_BIN=python3
```

If Python/rembg is unavailable, the app automatically uses local AI segmentation fallback.

3. (Optional) Enable ad slots (Adsterra or Google):

Set in `.env.local`:

```bash
NEXT_PUBLIC_AD_PROVIDER=adsterra
NEXT_PUBLIC_ADSTERRA_NATIVE_BASE_URL=https://pl28943141.profitablecpmratenetwork.com
NEXT_PUBLIC_AD_SLOT_TOP=your_top_slot_key
NEXT_PUBLIC_AD_SLOT_MID=your_mid_slot_key
NEXT_PUBLIC_AD_SLOT_SIDEBAR=your_sidebar_slot_key
NEXT_PUBLIC_AD_SLOT_FOOTER=your_footer_slot_key
# Optional (default false):
NEXT_PUBLIC_ADSTERRA_ENABLE_POPUNDER=false
NEXT_PUBLIC_ADSTERRA_ENABLE_SOCIAL_BAR=false
```

The app can inject these Adsterra scripts globally when enabled:

- Popunder: `https://pl28943084.profitablecpmratenetwork.com/37/27/41/3727410cc90fd7952a332e882cab21de.js`
- Social Bar: `https://pl28943139.profitablecpmratenetwork.com/8f/04/f1/8f04f1d27c03f6d8124ff1c6435104d4.js`

Native Banner slots render with:

- Script: `${NEXT_PUBLIC_ADSTERRA_NATIVE_BASE_URL}/{slot}/invoke.js`
- Container id: `container-{slot}`

For Google AdSense instead:

```bash
NEXT_PUBLIC_AD_PROVIDER=google
NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT=ca-pub-xxxxxxxxxxxxxxxx
NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_TOP=xxxxxxxxxx
NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_MID=xxxxxxxxxx
NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_SIDEBAR=xxxxxxxxxx
NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_FOOTER=xxxxxxxxxx
```

4. Start dev server:

```bash
npm run dev
```

5. Open `http://localhost:3000`

## Build and Lint

```bash
npm run lint
npm run build
```

## Important Files

- `src/app/page.tsx`: Main multi-step workflow UI and client-side generation pipeline
- `src/app/api/remove-bg/route.ts`: Server-side `rembg` endpoint (runs Python script)
- `scripts/remove_bg.py`: Python helper script using Pillow + rembg
- `src/components/ad-slot.tsx`: Reusable ad slot component with Adsterra and Google support
- `src/app/globals.css`: Theme and reusable UI utility classes
