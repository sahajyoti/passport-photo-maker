"use client";

import { jsPDF } from "jspdf";
import NextImage from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import AdSlot from "@/components/ad-slot";

type SizeMode = "passport" | "visa" | "custom";
type PageMode = "A4" | "4x6";
type BgMode = "white" | "lightBlue" | "custom";
type LayoutAlign = "top" | "center";

type CountryPreset = {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
  bgMode: BgMode;
};

const PHOTO_PRESETS = {
  passport: { widthMm: 35, heightMm: 45, label: "Passport (35 x 45 mm)" },
  visa: { widthMm: 50, heightMm: 50, label: "Visa (50 x 50 mm)" },
} as const;

const PAGE_PRESETS = {
  A4: { widthMm: 210, heightMm: 297, label: "A4" },
  "4x6": { widthMm: 101.6, heightMm: 152.4, label: "4 x 6 in" },
} as const;

const COUNTRY_PRESETS: CountryPreset[] = [
  {
    id: "india-west-bengal",
    label: "India - West Bengal (35 x 45 mm)",
    widthMm: 35,
    heightMm: 45,
    bgMode: "white",
  },
  {
    id: "generic",
    label: "Generic International (35 x 45 mm)",
    widthMm: 35,
    heightMm: 45,
    bgMode: "white",
  },
  {
    id: "usa",
    label: "United States (51 x 51 mm)",
    widthMm: 51,
    heightMm: 51,
    bgMode: "white",
  },
  {
    id: "india",
    label: "India (35 x 45 mm)",
    widthMm: 35,
    heightMm: 45,
    bgMode: "white",
  },
  {
    id: "schengen",
    label: "Schengen Visa (35 x 45 mm)",
    widthMm: 35,
    heightMm: 45,
    bgMode: "white",
  },
  {
    id: "uae",
    label: "UAE Visa (40 x 60 mm)",
    widthMm: 40,
    heightMm: 60,
    bgMode: "white",
  },
];

const PREVIEW_DPI = 130;
const PRINT_DPI = 300;
const GRID_GAP_MM = 4;
const DEFAULT_TOP_MARGIN_MM = 10;
const FIXED_COLS = 6;

type PageSizeMm = {
  widthMm: number;
  heightMm: number;
};

type LayoutPlan = {
  pageWidthMm: number;
  pageHeightMm: number;
  photoWidthMm: number;
  photoHeightMm: number;
  maxRows: number;
  maxCopies: number;
  scale: number;
};

function mmToPx(mm: number, dpi: number) {
  return Math.round((mm / 25.4) * dpi);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getMaxRowsThatFit(pageHeightMm: number, photoHeightMm: number) {
  return Math.max(1, Math.floor((pageHeightMm + GRID_GAP_MM) / (photoHeightMm + GRID_GAP_MM)));
}

function buildLayoutPlan(pageSize: PageSizeMm, photoSize: PageSizeMm): LayoutPlan {
  const orientations: PageSizeMm[] = [
    { widthMm: pageSize.widthMm, heightMm: pageSize.heightMm },
    { widthMm: pageSize.heightMm, heightMm: pageSize.widthMm },
  ];

  let bestPlan: LayoutPlan | null = null;

  for (const orientation of orientations) {
    const availableWidth = Math.max(1, orientation.widthMm - (FIXED_COLS - 1) * GRID_GAP_MM);
    const scale = Math.min(1, availableWidth / (FIXED_COLS * photoSize.widthMm));
    const scaledWidthMm = photoSize.widthMm * scale;
    const scaledHeightMm = photoSize.heightMm * scale;
    const maxRows = getMaxRowsThatFit(orientation.heightMm, scaledHeightMm);
    const maxCopies = maxRows * FIXED_COLS;

    const plan: LayoutPlan = {
      pageWidthMm: orientation.widthMm,
      pageHeightMm: orientation.heightMm,
      photoWidthMm: scaledWidthMm,
      photoHeightMm: scaledHeightMm,
      maxRows,
      maxCopies,
      scale,
    };

    if (!bestPlan) {
      bestPlan = plan;
      continue;
    }

    if (
      plan.maxCopies > bestPlan.maxCopies ||
      (plan.maxCopies === bestPlan.maxCopies && plan.scale > bestPlan.scale)
    ) {
      bestPlan = plan;
    }
  }

  return bestPlan || {
    pageWidthMm: pageSize.widthMm,
    pageHeightMm: pageSize.heightMm,
    photoWidthMm: photoSize.widthMm,
    photoHeightMm: photoSize.heightMm,
    maxRows: 1,
    maxCopies: FIXED_COLS,
    scale: 1,
  };
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image failed to load."));
    image.src = src;
  });
}

async function detectFaceCenterXRatio(image: HTMLImageElement): Promise<number | null> {
  if (typeof window === "undefined" || !("FaceDetector" in window)) {
    return null;
  }

  try {
    const detector = new (window as Window & {
      FaceDetector: new (init?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
        detect: (
          source: CanvasImageSource,
        ) => Promise<Array<{ boundingBox: { x: number; width: number } }>>;
      };
    }).FaceDetector({ fastMode: true, maxDetectedFaces: 1 });

    const faces = await detector.detect(image);
    if (!faces[0]) {
      return null;
    }

    const { x, width } = faces[0].boundingBox;
    return clamp((x + width / 2) / image.width, 0.1, 0.9);
  } catch {
    return null;
  }
}

async function removeImageBackground(file: File): Promise<Blob> {
  try {
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch("/api/remove-bg", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      return await response.blob();
    }
  } catch {
    // Fallback AI segmentation is handled below.
  }

  const { removeBackground } = await import("@imgly/background-removal");
  return await removeBackground(file);
}

async function buildSinglePhotoCanvas(options: {
  foregroundSrc: string;
  widthMm: number;
  heightMm: number;
  dpi: number;
  backgroundColor: string;
  faceCenterXRatio: number | null;
  brightness: number;
  contrast: number;
  watermark: boolean;
}) {
  const photoW = mmToPx(options.widthMm, options.dpi);
  const photoH = mmToPx(options.heightMm, options.dpi);
  const fg = await loadImage(options.foregroundSrc);

  const canvas = document.createElement("canvas");
  canvas.width = photoW;
  canvas.height = photoH;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create photo canvas context.");
  }

  ctx.fillStyle = options.backgroundColor;
  ctx.fillRect(0, 0, photoW, photoH);

  const scale = Math.max(photoW / fg.width, photoH / fg.height);
  const drawW = fg.width * scale;
  const drawH = fg.height * scale;
  const centerRatio = options.faceCenterXRatio ?? 0.5;

  let dx = photoW / 2 - centerRatio * drawW;
  dx = clamp(dx, photoW - drawW, 0);
  const dy = (photoH - drawH) / 2;

  ctx.filter = `brightness(${options.brightness}%) contrast(${options.contrast}%)`;
  ctx.drawImage(fg, dx, dy, drawW, drawH);
  ctx.filter = "none";

  if (options.watermark) {
    const fontSize = Math.max(18, Math.round(photoW * 0.08));
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.font = `${fontSize}px var(--font-ui), sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("PREVIEW", photoW / 2, photoH - fontSize * 0.5);
  }

  return canvas;
}

async function buildSheetCanvas(options: {
  pageWidthMm: number;
  pageHeightMm: number;
  rows: number;
  cols: number;
  copies: number;
  dpi: number;
  photoCanvas: HTMLCanvasElement;
  layoutAlign: LayoutAlign;
  topMarginMm: number;
  addBorder: boolean;
  borderColor: string;
  borderThicknessMm: number;
}) {
  const sheetW = mmToPx(options.pageWidthMm, options.dpi);
  const sheetH = mmToPx(options.pageHeightMm, options.dpi);
  const gapPx = mmToPx(GRID_GAP_MM, options.dpi);

  const canvas = document.createElement("canvas");
  canvas.width = sheetW;
  canvas.height = sheetH;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create sheet canvas context.");
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, sheetW, sheetH);

  const gridW = options.cols * options.photoCanvas.width + (options.cols - 1) * gapPx;
  const gridH = options.rows * options.photoCanvas.height + (options.rows - 1) * gapPx;

  const startX = (sheetW - gridW) / 2;
  const maxStartY = Math.max(0, sheetH - gridH);
  const startY =
    options.layoutAlign === "top"
      ? clamp(mmToPx(clamp(options.topMarginMm, 0, 50), options.dpi), 0, maxStartY)
      : (sheetH - gridH) / 2;

  if (startX < 0 || startY < 0 || gridW > sheetW || gridH > sheetH) {
    throw new Error("Selected grid does not fit on the selected page size.");
  }

  const maxSlots = options.rows * options.cols;
  const copiesToDraw = clamp(options.copies, 1, maxSlots);

  for (let index = 0; index < copiesToDraw; index += 1) {
    const row = Math.floor(index / options.cols);
    const col = index % options.cols;
    const x = Math.round(startX + col * (options.photoCanvas.width + gapPx));
    const y = Math.round(startY + row * (options.photoCanvas.height + gapPx));
    ctx.drawImage(options.photoCanvas, x, y);

    if (options.addBorder) {
      const borderPx = Math.max(1, mmToPx(options.borderThicknessMm, options.dpi));
      ctx.strokeStyle = options.borderColor;
      ctx.lineWidth = borderPx;
      ctx.strokeRect(
        x + borderPx * 0.5,
        y + borderPx * 0.5,
        options.photoCanvas.width - borderPx,
        options.photoCanvas.height - borderPx,
      );
    }
  }

  return canvas;
}

export default function Home() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [sourcePreview, setSourcePreview] = useState<string | null>(null);
  const [processedPreview, setProcessedPreview] = useState<string | null>(null);
  const [sheetPreview, setSheetPreview] = useState<string | null>(null);

  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [sizeMode, setSizeMode] = useState<SizeMode>("passport");
  const [countryPresetId, setCountryPresetId] = useState("india-west-bengal");
  const [customWidthMm, setCustomWidthMm] = useState(35);
  const [customHeightMm, setCustomHeightMm] = useState(45);

  const [pageMode, setPageMode] = useState<PageMode>("A4");
  const [copies, setCopies] = useState(FIXED_COLS);
  const [layoutAlign, setLayoutAlign] = useState<LayoutAlign>("top");
  const [topMarginMm, setTopMarginMm] = useState(DEFAULT_TOP_MARGIN_MM);
  const [addBorder, setAddBorder] = useState(false);
  const [borderColor, setBorderColor] = useState("#111827");
  const [borderThicknessMm, setBorderThicknessMm] = useState(0.7);

  const [bgMode, setBgMode] = useState<BgMode>("white");
  const [customBgColor, setCustomBgColor] = useState("#d6ebff");
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [watermark, setWatermark] = useState(false);

  const [faceCenterXRatio, setFaceCenterXRatio] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedPhotoSize = useMemo(() => {
    if (sizeMode === "custom") {
      return {
        widthMm: clamp(customWidthMm || 35, 10, 70),
        heightMm: clamp(customHeightMm || 45, 10, 90),
      };
    }
    return PHOTO_PRESETS[sizeMode];
  }, [sizeMode, customWidthMm, customHeightMm]);

  const selectedPageSize = PAGE_PRESETS[pageMode];
  const layoutPlan = useMemo(
    () =>
      buildLayoutPlan(
        selectedPageSize,
        {
          widthMm: clamp(selectedPhotoSize.widthMm || 35, 10, 70),
          heightMm: clamp(selectedPhotoSize.heightMm || 45, 10, 90),
        },
      ),
    [selectedPageSize, selectedPhotoSize.heightMm, selectedPhotoSize.widthMm],
  );
  const effectiveCopies = clamp(copies, 1, layoutPlan.maxCopies);
  const effectiveRows = Math.max(1, Math.ceil(effectiveCopies / FIXED_COLS));

  const backgroundColor =
    bgMode === "white" ? "#ffffff" : bgMode === "lightBlue" ? "#d6ebff" : customBgColor;

  useEffect(() => {
    const preset = COUNTRY_PRESETS.find((item) => item.id === countryPresetId);
    if (!preset) {
      return;
    }

    const isPassport = preset.widthMm === 35 && preset.heightMm === 45;
    const isVisa = preset.widthMm === 50 && preset.heightMm === 50;

    if (isPassport) {
      setSizeMode("passport");
    } else if (isVisa) {
      setSizeMode("visa");
    } else {
      setSizeMode("custom");
      setCustomWidthMm(preset.widthMm);
      setCustomHeightMm(preset.heightMm);
    }

    setBgMode(preset.bgMode);
  }, [countryPresetId]);

  useEffect(() => {
    setCopies((prev) => clamp(prev, 1, layoutPlan.maxCopies));
  }, [layoutPlan.maxCopies]);

  useEffect(() => {
    if (!uploadedFile) {
      return;
    }

    let didCancel = false;
    const sourceUrl = URL.createObjectURL(uploadedFile);
    setSourcePreview(sourceUrl);
    setFaceCenterXRatio(null);

    loadImage(sourceUrl)
      .then((image) => detectFaceCenterXRatio(image))
      .then((ratio) => {
        if (!didCancel && typeof ratio === "number") {
          setFaceCenterXRatio(ratio);
        }
      })
      .catch(() => {
        // No-op: face detection is optional.
      });

    return () => {
      didCancel = true;
      URL.revokeObjectURL(sourceUrl);
    };
  }, [uploadedFile]);

  useEffect(() => {
    if (!uploadedFile) {
      return;
    }

    let didCancel = false;

    const run = async () => {
      setErrorMessage(null);
      setIsRemovingBg(true);

      try {
        const outputBlob = await removeImageBackground(uploadedFile);
        if (didCancel) {
          return;
        }

        const outputUrl = URL.createObjectURL(outputBlob);
        setProcessedPreview((prev) => {
          if (prev) {
            URL.revokeObjectURL(prev);
          }
          return outputUrl;
        });
      } catch (error) {
        if (didCancel) {
          return;
        }

        const message = error instanceof Error ? error.message : "Background removal failed.";
        setErrorMessage(message);
      } finally {
        if (!didCancel) {
          setIsRemovingBg(false);
        }
      }
    };

    void run();

    return () => {
      didCancel = true;
    };
  }, [uploadedFile]);

  useEffect(() => {
    if (!processedPreview) {
      setSheetPreview(null);
      return;
    }

    let didCancel = false;

    const render = async () => {
      setErrorMessage(null);
      setIsRenderingPreview(true);

      try {
        const singlePhoto = await buildSinglePhotoCanvas({
          foregroundSrc: processedPreview,
          widthMm: layoutPlan.photoWidthMm,
          heightMm: layoutPlan.photoHeightMm,
          dpi: PREVIEW_DPI,
          backgroundColor,
          faceCenterXRatio,
          brightness,
          contrast,
          watermark,
        });

        const sheet = await buildSheetCanvas({
          pageWidthMm: layoutPlan.pageWidthMm,
          pageHeightMm: layoutPlan.pageHeightMm,
          rows: effectiveRows,
          cols: FIXED_COLS,
          copies: effectiveCopies,
          dpi: PREVIEW_DPI,
          photoCanvas: singlePhoto,
          layoutAlign,
          topMarginMm,
          addBorder,
          borderColor,
          borderThicknessMm,
        });

        if (didCancel) {
          return;
        }

        setSheetPreview(sheet.toDataURL("image/png", 1));
      } catch (error) {
        if (didCancel) {
          return;
        }

        const message = error instanceof Error ? error.message : "Preview generation failed.";
        setErrorMessage(message);
        setSheetPreview(null);
      } finally {
        if (!didCancel) {
          setIsRenderingPreview(false);
        }
      }
    };

    void render();

    return () => {
      didCancel = true;
    };
  }, [
    backgroundColor,
    brightness,
    contrast,
    effectiveCopies,
    effectiveRows,
    faceCenterXRatio,
    borderColor,
    borderThicknessMm,
    addBorder,
    pageMode,
    layoutAlign,
    layoutPlan.pageHeightMm,
    layoutPlan.pageWidthMm,
    layoutPlan.photoHeightMm,
    layoutPlan.photoWidthMm,
    processedPreview,
    topMarginMm,
    sizeMode,
    watermark,
  ]);

  const processSelectedFile = (file: File) => {
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setErrorMessage("Please upload a JPG or PNG image.");
      return;
    }

    setUploadedFile(file);
    setProcessedPreview((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });
    setSheetPreview(null);
    setErrorMessage(null);
  };

  const onDownloadPdf = async () => {
    if (!processedPreview) {
      return;
    }

    try {
      const singlePhoto = await buildSinglePhotoCanvas({
        foregroundSrc: processedPreview,
        widthMm: layoutPlan.photoWidthMm,
        heightMm: layoutPlan.photoHeightMm,
        dpi: PRINT_DPI,
        backgroundColor,
        faceCenterXRatio,
        brightness,
        contrast,
        watermark,
      });

      const sheet = await buildSheetCanvas({
        pageWidthMm: layoutPlan.pageWidthMm,
        pageHeightMm: layoutPlan.pageHeightMm,
        rows: effectiveRows,
        cols: FIXED_COLS,
        copies: effectiveCopies,
        dpi: PRINT_DPI,
        photoCanvas: singlePhoto,
        layoutAlign,
        topMarginMm,
        addBorder,
        borderColor,
        borderThicknessMm,
      });

      const orientation =
        layoutPlan.pageWidthMm > layoutPlan.pageHeightMm ? "landscape" : "portrait";

      const doc = new jsPDF({
        orientation,
        unit: "mm",
        format: [layoutPlan.pageWidthMm, layoutPlan.pageHeightMm],
      });

      doc.addImage(
        sheet.toDataURL("image/jpeg", 1),
        "JPEG",
        0,
        0,
        layoutPlan.pageWidthMm,
        layoutPlan.pageHeightMm,
      );
      doc.save("passport-photo-sheet.pdf");
    } catch (error) {
      const message = error instanceof Error ? error.message : "PDF generation failed.";
      setErrorMessage(message);
    }
  };

  const onDownloadPng = async () => {
    if (!processedPreview) {
      return;
    }

    try {
      const singlePhoto = await buildSinglePhotoCanvas({
        foregroundSrc: processedPreview,
        widthMm: layoutPlan.photoWidthMm,
        heightMm: layoutPlan.photoHeightMm,
        dpi: PRINT_DPI,
        backgroundColor,
        faceCenterXRatio,
        brightness,
        contrast,
        watermark,
      });

      const sheet = await buildSheetCanvas({
        pageWidthMm: layoutPlan.pageWidthMm,
        pageHeightMm: layoutPlan.pageHeightMm,
        rows: effectiveRows,
        cols: FIXED_COLS,
        copies: effectiveCopies,
        dpi: PRINT_DPI,
        photoCanvas: singlePhoto,
        layoutAlign,
        topMarginMm,
        addBorder,
        borderColor,
        borderThicknessMm,
      });

      const anchor = document.createElement("a");
      anchor.href = sheet.toDataURL("image/png", 1);
      anchor.download = "passport-photo-sheet.png";
      anchor.click();
    } catch (error) {
      const message = error instanceof Error ? error.message : "PNG generation failed.";
      setErrorMessage(message);
    }
  };

  const onPrint = async () => {
    if (!processedPreview) {
      return;
    }

    try {
      const singlePhoto = await buildSinglePhotoCanvas({
        foregroundSrc: processedPreview,
        widthMm: layoutPlan.photoWidthMm,
        heightMm: layoutPlan.photoHeightMm,
        dpi: PRINT_DPI,
        backgroundColor,
        faceCenterXRatio,
        brightness,
        contrast,
        watermark,
      });

      const sheet = await buildSheetCanvas({
        pageWidthMm: layoutPlan.pageWidthMm,
        pageHeightMm: layoutPlan.pageHeightMm,
        rows: effectiveRows,
        cols: FIXED_COLS,
        copies: effectiveCopies,
        dpi: PRINT_DPI,
        photoCanvas: singlePhoto,
        layoutAlign,
        topMarginMm,
        addBorder,
        borderColor,
        borderThicknessMm,
      });

      const printWindow = window.open("", "_blank", "noopener,noreferrer");
      if (!printWindow) {
        setErrorMessage("Unable to open print window. Please allow popups.");
        return;
      }

      const imgData = sheet.toDataURL("image/png", 1);
      printWindow.document.write(`
        <html>
          <head>
            <title>Passport Sheet Print</title>
            <style>
              body { margin: 0; display: flex; justify-content: center; align-items: center; background: #fff; }
              img { width: 100%; height: auto; max-width: 100vw; }
              @page { size: auto; margin: 0; }
            </style>
          </head>
          <body>
            <img src="${imgData}" alt="Passport sheet" />
            <script>
              window.onload = () => {
                window.print();
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Print preview failed.";
      setErrorMessage(message);
    }
  };

  return (
    <main className="home-shell min-h-screen px-4 py-8 md:px-8 md:py-10">
      <section className="mx-auto max-w-7xl">
        <header className="glow-card home-hero mb-8 rounded-3xl border p-6 backdrop-blur md:p-8">
          <p className="hero-badge text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
            SnapPassport.com
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 md:text-5xl">
            Create beautiful, print-ready passport sheets in one smooth flow.
          </h1>
          <p className="mt-3 max-w-3xl text-slate-600">
            AI background removal, face-aware centering, top-aligned paper layout, border controls, and high-resolution PDF/PNG export.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="workflow-chip">Upload</span>
            <span className="workflow-chip">Remove Background</span>
            <span className="workflow-chip">Size & Layout</span>
            <span className="workflow-chip">Preview & Print</span>
          </div>
        </header>

        <AdSlot
          slot={
            process.env.NEXT_PUBLIC_AD_SLOT_TOP ||
            process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_TOP ||
            ""
          }
          label="Top Banner Ad"
          className="mb-6"
          style={{ minHeight: "90px" }}
          width={728}
          height={90}
        />

        <div className="home-grid grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="space-y-5">
            <article className="panel">
              <h2 className="step-title">1. Upload Photo</h2>
              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const file = event.dataTransfer.files?.[0];
                  if (file) {
                    processSelectedFile(file);
                  }
                }}
                className="upload-dropzone mt-3 rounded-2xl border-2 border-dashed border-sky-200 bg-sky-50/70 p-6 text-center"
              >
                <p className="text-slate-700">Drag and drop JPG/PNG here, or</p>
                <button
                  type="button"
                  className="mt-3 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-600"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Browse Files
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      processSelectedFile(file);
                    }
                  }}
                />
              </div>
              {sourcePreview ? (
                <NextImage
                  src={sourcePreview}
                  alt="Uploaded preview"
                  width={1200}
                  height={900}
                  unoptimized
                  className="mt-4 max-h-72 w-full rounded-2xl border border-slate-200 object-contain"
                />
              ) : null}
            </article>

            <article className="panel">
              <h2 className="step-title">2. Remove Background</h2>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                  {isRemovingBg ? "Processing with AI..." : processedPreview ? "Background removed" : "Waiting for upload"}
                </span>
                <button
                  type="button"
                  disabled={!uploadedFile || isRemovingBg}
                  onClick={() => uploadedFile && processSelectedFile(uploadedFile)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Re-run Removal
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  className={`pill ${bgMode === "white" ? "pill-active" : ""}`}
                  onClick={() => setBgMode("white")}
                >
                  White
                </button>
                <button
                  type="button"
                  className={`pill ${bgMode === "lightBlue" ? "pill-active" : ""}`}
                  onClick={() => setBgMode("lightBlue")}
                >
                  Light Blue
                </button>
                <button
                  type="button"
                  className={`pill ${bgMode === "custom" ? "pill-active" : ""}`}
                  onClick={() => setBgMode("custom")}
                >
                  Custom
                </button>
              </div>

              {bgMode === "custom" ? (
                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="color"
                    value={customBgColor}
                    onChange={(event) => setCustomBgColor(event.target.value)}
                    className="h-10 w-14 rounded-md border border-slate-200"
                  />
                  <span className="text-sm text-slate-600">Pick a custom background color.</span>
                </div>
              ) : null}

              {processedPreview ? (
                <NextImage
                  src={processedPreview}
                  alt="Background removed preview"
                  width={1200}
                  height={900}
                  unoptimized
                  className="mt-4 max-h-72 w-full rounded-2xl border border-slate-200 object-contain"
                />
              ) : null}
            </article>

            <article className="panel">
              <h2 className="step-title">3. Choose Passport Size</h2>
              <div className="mt-4">
                <label className="field">
                  Country preset
                  <select
                    className="input"
                    value={countryPresetId}
                    onChange={(event) => setCountryPresetId(event.target.value)}
                  >
                    {COUNTRY_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="mt-2 text-xs text-slate-500">
                  Presets auto-fill photo dimensions and recommended background. You can still fine-tune settings manually.
                </p>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  className={`pill ${sizeMode === "passport" ? "pill-active" : ""}`}
                  onClick={() => setSizeMode("passport")}
                >
                  {PHOTO_PRESETS.passport.label}
                </button>
                <button
                  type="button"
                  className={`pill ${sizeMode === "visa" ? "pill-active" : ""}`}
                  onClick={() => setSizeMode("visa")}
                >
                  {PHOTO_PRESETS.visa.label}
                </button>
                <button
                  type="button"
                  className={`pill ${sizeMode === "custom" ? "pill-active" : ""}`}
                  onClick={() => setSizeMode("custom")}
                >
                  Custom Size
                </button>
              </div>

              {sizeMode === "custom" ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="field">
                    Width (mm)
                    <input
                      type="number"
                      min={10}
                      max={70}
                      value={customWidthMm}
                      onChange={(event) => setCustomWidthMm(Number(event.target.value))}
                      className="input"
                    />
                  </label>
                  <label className="field">
                    Height (mm)
                    <input
                      type="number"
                      min={10}
                      max={90}
                      value={customHeightMm}
                      onChange={(event) => setCustomHeightMm(Number(event.target.value))}
                      className="input"
                    />
                  </label>
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="field slider-field">
                  <span className="slider-head">
                    <span>Brightness</span>
                    <span className="slider-value">{brightness}%</span>
                  </span>
                  <input
                    className="pro-slider slider-brightness"
                    type="range"
                    min={60}
                    max={140}
                    value={brightness}
                    onChange={(event) => setBrightness(Number(event.target.value))}
                  />
                </label>
                <label className="field slider-field">
                  <span className="slider-head">
                    <span>Contrast</span>
                    <span className="slider-value">{contrast}%</span>
                  </span>
                  <input
                    className="pro-slider slider-contrast"
                    type="range"
                    min={60}
                    max={140}
                    value={contrast}
                    onChange={(event) => setContrast(Number(event.target.value))}
                  />
                </label>
              </div>
            </article>

            <article className="panel">
              <h2 className="step-title">4. Copies and Layout</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="field">
                  Layout
                  <input className="input" value="6 photos per row (fixed)" readOnly />
                </label>
                <label className="field slider-field">
                  <span className="slider-head">
                    <span>Number of photos</span>
                    <span className="slider-value">{effectiveCopies}</span>
                  </span>
                  <input
                    className="pro-slider"
                    type="range"
                    min={1}
                    max={layoutPlan.maxCopies}
                    step={1}
                    value={effectiveCopies}
                    onChange={(event) =>
                      setCopies(clamp(Number(event.target.value) || 1, 1, layoutPlan.maxCopies))
                    }
                  />
                  <select
                    className="input mt-3"
                    value={effectiveCopies}
                    onChange={(event) =>
                      setCopies(clamp(Number(event.target.value) || 1, 1, layoutPlan.maxCopies))
                    }
                  >
                    {Array.from({ length: layoutPlan.maxCopies }, (_, index) => index + 1).map(
                      (count) => (
                        <option key={count} value={count}>
                          {count} image{count > 1 ? "s" : ""}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label className="field">
                  Page size
                  <select
                    className="input"
                    value={pageMode}
                    onChange={(event) => setPageMode(event.target.value as PageMode)}
                  >
                    <option value="A4">A4</option>
                    <option value="4x6">4 x 6 in</option>
                  </select>
                </label>
                <label className="field">
                  Vertical placement
                  <select
                    className="input"
                    value={layoutAlign}
                    onChange={(event) => setLayoutAlign(event.target.value as LayoutAlign)}
                  >
                    <option value="top">Top (recommended)</option>
                    <option value="center">Center</option>
                  </select>
                </label>
                <label className="field">
                  Top margin (mm)
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={40}
                    value={topMarginMm}
                    disabled={layoutAlign !== "top"}
                    onChange={(event) =>
                      setTopMarginMm(clamp(Number(event.target.value) || 0, 0, 40))
                    }
                  />
                </label>
              </div>
            </article>

            <article className="panel">
              <h2 className="step-title">5. Preview and Export</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="field">
                  <span className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={addBorder}
                      onChange={(event) => setAddBorder(event.target.checked)}
                    />
                    Add border around each photo
                  </span>
                </label>
                <label className="field">
                  Border thickness (mm)
                  <input
                    className="input"
                    type="number"
                    min={0.2}
                    max={3}
                    step={0.1}
                    disabled={!addBorder}
                    value={borderThicknessMm}
                    onChange={(event) =>
                      setBorderThicknessMm(clamp(Number(event.target.value) || 0.2, 0.2, 3))
                    }
                  />
                </label>
                <label className="field sm:col-span-2">
                  Border color
                  <input
                    type="color"
                    className="h-10 w-16 rounded-md border border-slate-200"
                    disabled={!addBorder}
                    value={borderColor}
                    onChange={(event) => setBorderColor(event.target.value)}
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={onDownloadPdf}
                  disabled={!sheetPreview}
                  className="primary-btn"
                >
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={onDownloadPng}
                  disabled={!sheetPreview}
                  className="secondary-btn"
                >
                  Download PNG
                </button>
                <button
                  type="button"
                  onClick={onPrint}
                  disabled={!sheetPreview}
                  className="secondary-btn"
                >
                  Print
                </button>
              </div>

              <label className="mt-4 inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={watermark}
                  onChange={(event) => setWatermark(event.target.checked)}
                />
                Add preview watermark (optional)
              </label>

              <p className="mt-3 text-sm text-slate-500">
                High-resolution exports are rendered at 300 DPI for print quality.
              </p>
            </article>

            <AdSlot
              slot={
                process.env.NEXT_PUBLIC_AD_SLOT_MID ||
                process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_MID ||
                "ab0b8aa12878af29140c2a38dc9f12dd"
              }
              label="In-Content Ad"
              style={{ minHeight: "120px" }}
              width={728}
              height={120}
            />
          </section>

          <aside className="panel h-fit lg:sticky lg:top-8">
            <h2 className="step-title">Live Print Sheet Preview</h2>
            <p className="mt-2 text-sm text-slate-600">
              {layoutPlan.photoWidthMm.toFixed(1)} x {layoutPlan.photoHeightMm.toFixed(1)} mm • {effectiveRows} x {FIXED_COLS} grid • {PAGE_PRESETS[pageMode].label}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Max copies on this page: {layoutPlan.maxCopies}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Layout: {layoutAlign === "top" ? `Top aligned (${topMarginMm} mm margin)` : "Centered"}
              {addBorder ? ` • Border ${borderThicknessMm} mm` : ""}
            </p>

            <div className="preview-surface mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
              {sheetPreview ? (
                <NextImage
                  src={sheetPreview}
                  alt="Print sheet preview"
                  width={1200}
                  height={1600}
                  unoptimized
                  className="w-full object-contain"
                />
              ) : (
                <div className="flex min-h-[420px] items-center justify-center p-6 text-center text-sm text-slate-500">
                  Upload an image and complete background removal to see the preview.
                </div>
              )}
            </div>

            {(isRemovingBg || isRenderingPreview) && (
              <p className="mt-3 text-sm font-medium text-sky-600">
                {isRemovingBg
                  ? "AI is removing background..."
                  : "Refreshing print layout preview..."}
              </p>
            )}
            {errorMessage ? (
              <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {errorMessage}
              </p>
            ) : null}

            <AdSlot
              slot={
                process.env.NEXT_PUBLIC_AD_SLOT_SIDEBAR ||
                process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_SIDEBAR ||
                ""
              }
              label="Sidebar Ad"
              className="mt-4"
              style={{ minHeight: "280px" }}
              width={300}
              height={280}
            />
          </aside>
        </div>
      </section>
    </main>
  );
}
