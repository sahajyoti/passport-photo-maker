"use client";

import { jsPDF } from "jspdf";
import { removeBackground as removeBackgroundInBrowser } from "@imgly/background-removal";
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

async function detectSubjectCenterXRatioFromAlpha(image: HTMLImageElement): Promise<number | null> {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return null;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0);

  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let minX = width;
  let maxX = -1;

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 20) {
        if (x < minX) {
          minX = x;
        }
        if (x > maxX) {
          maxX = x;
        }
      }
    }
  }

  if (maxX < minX) {
    return null;
  }

  const centerX = (minX + maxX) / 2;
  return clamp(centerX / width, 0.1, 0.9);
}

async function removeImageBackground(file: File): Promise<Blob> {
  let apiErrorMessage = "";

  try {
    const formData = new FormData();
    formData.append("image", file);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch("/api/remove-bg", {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      apiErrorMessage = "API failed.";
      try {
        const payload = (await response.json()) as { error?: string };
        apiErrorMessage = payload.error || apiErrorMessage;
      } catch {}

      throw new Error(apiErrorMessage);
    }

    const apiBlob = await response.blob();
    if (apiBlob.size === 0) {
      throw new Error("API returned empty image.");
    }

    return apiBlob;
  } catch (apiError) {
    apiErrorMessage = apiError instanceof Error ? apiError.message : "API engine failed.";
  }

  try {
    return await removeBackgroundInBrowser(file, {
      model: "isnet_quint8",
      output: {
        format: "image/png",
      },
    });
  } catch (browserError) {
    const browserErrorMessage = browserError instanceof Error ? browserError.message : "Browser engine failed.";
    const combined = `Background removal failed. API: ${apiErrorMessage || "unknown"}. Browser: ${browserErrorMessage}`;
    throw new Error(combined);
  }
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
  const featureCards = [
    {
      title: "AI Background Removal",
      description: "Studio-grade cutout engine removes messy backgrounds in seconds.",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="18" cy="17" r="2" fill="currentColor" />
        </svg>
      ),
    },
    {
      title: "Face Auto Centering",
      description: "Subject-aware positioning keeps your face naturally centered for compliance.",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
          <path d="M12 4a5 5 0 0 1 5 5v2a5 5 0 0 1-10 0V9a5 5 0 0 1 5-5Z" stroke="currentColor" strokeWidth="1.7" />
          <path d="M4.5 20a7.5 7.5 0 0 1 15 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      title: "Print-ready Layout",
      description: "Exact spacing and alignment for A4 and 4x6 sheets with live preview.",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
          <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.7" />
          <path d="M9 9h6v6H9z" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      ),
    },
    {
      title: "High-Quality Export",
      description: "Download crisp 300 DPI PDF or PNG files for instant printing.",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
          <path d="M12 4v10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="m8.5 10.5 3.5 3.5 3.5-3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 19h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  const workflowSteps = [
    "Upload Photo",
    "Remove Background",
    "Adjust Size & Layout",
    "Download",
  ];

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

    const sourceUrl = URL.createObjectURL(uploadedFile);
    setSourcePreview(sourceUrl);
    setFaceCenterXRatio(null);

    return () => {
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
        const processedImage = await loadImage(outputUrl);
        let centerRatio = await detectFaceCenterXRatio(processedImage);
        if (centerRatio === null) {
          centerRatio = await detectSubjectCenterXRatioFromAlpha(processedImage);
        }

        if (!didCancel) {
          setFaceCenterXRatio(centerRatio);
        }

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

  const [sliderPosition, setSliderPosition] = useState(50);

  const previewImage = sheetPreview || processedPreview || sourcePreview;

  return (
    <main className="saas-home min-h-screen px-4 pb-16 pt-8 md:px-8 md:pt-10">
      <section className="mx-auto max-w-7xl space-y-16 md:space-y-20">
        <header className="hero-shell reveal-up grid gap-8 rounded-[20px] border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-cyan-900/20 backdrop-blur xl:grid-cols-[1.05fr_0.95fr] xl:p-10">
          <div className="space-y-6">
            <span className="hero-kicker-pill">Passport Photo Studio</span>
            <h1 className="hero-title max-w-2xl text-5xl font-bold leading-[1.02] tracking-tight text-white md:text-6xl">
              Generate flawless passport sheets in under a minute.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-slate-300 md:text-lg">
              SnapPassport combines AI background cleanup, auto-centering, and print-accurate layouts into one polished workflow designed for fast approvals.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="#studio" className="cta-primary">
                Generate Passport Sheet
              </a>
              <a href="#workflow" className="cta-secondary">
                Try Demo
              </a>
            </div>
            <div className="flex flex-wrap gap-3 pt-1 text-sm">
              <span className="trust-chip">Used by 10,000+ users</span>
              <span className="trust-chip">4.9/5 average rating</span>
              <span className="trust-chip">300 DPI export quality</span>
            </div>
          </div>

          <div className="hero-preview reveal-up-delayed rounded-[18px] border border-cyan-300/20 bg-slate-900/70 p-4 shadow-xl shadow-cyan-900/20">
            <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-cyan-200/80">
              <span>Passport Sheet Preview</span>
              <span>35 x 45 mm</span>
            </div>
            <div className="sheet-mockup rounded-2xl border border-white/10 bg-white p-3">
              {previewImage ? (
                <NextImage
                  src={previewImage}
                  alt="Passport sheet mockup"
                  width={900}
                  height={1200}
                  unoptimized
                  className="h-[360px] w-full rounded-xl object-cover"
                />
              ) : (
                <div className="mock-grid h-[360px] rounded-xl">
                  {Array.from({ length: 9 }).map((_, index) => (
                    <span key={index} className="mock-photo" />
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        <section className="reveal-up space-y-4" aria-label="Features">
          <div className="space-y-2">
            <p className="section-label">Core Features</p>
            <h2 className="section-title">Everything needed for compliant, premium passport photos</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {featureCards.map((feature) => (
              <article key={feature.title} className="feature-card">
                <span className="feature-icon">{feature.icon}</span>
                <h3 className="mt-4 text-lg font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="workflow" className="reveal-up space-y-4" aria-label="Workflow">
          <div className="space-y-2">
            <p className="section-label">How It Works</p>
            <h2 className="section-title">Four steps from upload to print-ready download</h2>
          </div>
          <div className="workflow-row">
            {workflowSteps.map((step, index) => (
              <article key={step} className="workflow-card">
                <span className="workflow-index">0{index + 1}</span>
                <h3 className="mt-3 text-base font-semibold text-white">{step}</h3>
                {index < workflowSteps.length - 1 ? <span className="workflow-arrow" aria-hidden>→</span> : null}
              </article>
            ))}
          </div>
        </section>

        <section className="reveal-up rounded-2xl border border-white/10 bg-slate-950/55 p-4 shadow-lg shadow-slate-900/50 md:p-5">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Sponsored</p>
          <AdSlot
            slot={
              process.env.NEXT_PUBLIC_AD_SLOT_TOP ||
              process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_TOP ||
              "ab0b8aa12878af29140c2a38dc9f12dd"
            }
            label="Sponsored"
            className="ad-muted"
            style={{ minHeight: "90px" }}
            width={728}
            height={90}
          />
        </section>

        <div id="studio" className="home-grid grid gap-6 grid-cols-1 lg:grid-cols-[1.15fr_0.85fr]">
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
                  className="upload-cta mt-3"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <svg viewBox="0 0 24 24" aria-hidden className="upload-cta-icon">
                    <path
                      d="M12 16V6m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>Upload Image</span>
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
                  {isRemovingBg
                    ? "Processing with AI..."
                    : processedPreview
                      ? "Background removed"
                      : "Waiting for upload"}
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
              label="Sponsored"
              className="ad-muted"
              style={{ minHeight: "120px" }}
              width={728}
              height={120}
            />
          </section>

          <aside className="panel h-fit lg:sticky lg:top-8">
            <h2 className="step-title">Photo Transformation</h2>
            <p className="mt-2 text-sm text-slate-600">
              Before & After Comparison
            </p>

            {sourcePreview || processedPreview ? (
              <div className="before-after-slider mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                <div className="relative w-full" style={{ paddingBottom: "100%" }}>
                  {sourcePreview && (
                    <NextImage
                      src={sourcePreview}
                      alt="Original photo"
                      width={400}
                      height={400}
                      unoptimized
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                  {processedPreview && (
                    <div
                      className="absolute inset-0 h-full w-full overflow-hidden"
                      style={{ width: `${sliderPosition}%` }}
                    >
                      <NextImage
                        src={processedPreview}
                        alt="Background removed"
                        width={400}
                        height={400}
                        unoptimized
                        className="h-full w-full object-cover"
                        style={{ width: `${(100 / sliderPosition) * 100}%` }}
                      />
                    </div>
                  )}
                  <div
                    className="slider-handle absolute inset-y-0 w-1 cursor-col-resize bg-white shadow-lg"
                    style={{ left: `${sliderPosition}%`, transform: "translateX(-50%)" }}
                    onMouseDown={(e) => {
                      const slider = e.currentTarget.parentElement;
                      const startX = e.clientX;
                      const startPos = sliderPosition;

                      const handleMouseMove = (moveEvent: MouseEvent) => {
                        if (!slider) return;
                        const rect = slider.getBoundingClientRect();
                        const newPos = ((moveEvent.clientX - rect.left) / rect.width) * 100;
                        setSliderPosition(Math.max(0, Math.min(100, newPos)));
                      };

                      const handleMouseUp = () => {
                        document.removeEventListener("mousemove", handleMouseMove);
                        document.removeEventListener("mouseup", handleMouseUp);
                      };

                      document.addEventListener("mousemove", handleMouseMove);
                      document.addEventListener("mouseup", handleMouseUp);
                    }}
                  >
                    <div className="slider-chevron absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-white/90 p-1 text-xs text-slate-700">
                      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
                        <path d="M8 5v14M16 5v14" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="preview-surface mt-4 flex min-h-[280px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 p-6 text-center text-sm text-slate-500">
                Upload an image to see before & after transformation.
              </div>
            )}

            {sheetPreview && (
              <div className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Print Sheet Preview</p>
                <p className="text-xs text-slate-500">
                  {layoutPlan.photoWidthMm.toFixed(1)} x {layoutPlan.photoHeightMm.toFixed(1)} mm • {effectiveRows} x {FIXED_COLS} grid • {PAGE_PRESETS[pageMode].label}
                </p>
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <NextImage
                    src={sheetPreview}
                    alt="Print sheet preview"
                    width={600}
                    height={800}
                    unoptimized
                    className="w-full object-contain"
                  />
                </div>
              </div>
            )}

            <p className="mt-2 text-xs text-slate-500">
              {layoutPlan.photoWidthMm.toFixed(1)} x {layoutPlan.photoHeightMm.toFixed(1)} mm • {effectiveRows} x {FIXED_COLS} grid • {PAGE_PRESETS[pageMode].label}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Max copies on this page: {layoutPlan.maxCopies}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Layout: {layoutAlign === "top" ? `Top aligned (${topMarginMm} mm margin)` : "Centered"}
              {addBorder ? ` • Border ${borderThicknessMm} mm` : ""}
            </p>

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
                "ab0b8aa12878af29140c2a38dc9f12dd"
              }
              label="Sponsored"
              className="mt-4 ad-muted"
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
