"use client";

import { useEffect, useId, useMemo, useRef } from "react";

type AdSlotProps = {
  slot: string;
  className?: string;
  style?: React.CSSProperties;
  label?: string;
  width?: number;
  height?: number;
};

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export default function AdSlot({
  slot,
  className,
  style,
  label = "Advertisement",
  width = 728,
  height = 90,
}: AdSlotProps) {
  const provider = (process.env.NEXT_PUBLIC_AD_PROVIDER || "adsterra").toLowerCase();
  const googleClient = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT;
  const adsterraNativeBaseUrl =
    process.env.NEXT_PUBLIC_ADSTERRA_NATIVE_BASE_URL ||
    "https://pl28943141.profitablecpmratenetwork.com";
  const stableId = useId().replace(/[:]/g, "");
  const adsterraRootRef = useRef<HTMLDivElement | null>(null);
  const adsterraInstanceId = useMemo(() => `inst-${stableId}`, [stableId]);
  const adsterraContainerId = useMemo(
    () => `container-${slot}-${adsterraInstanceId}`,
    [adsterraInstanceId, slot],
  );

  const containerClass = useMemo(() => {
    const base =
      "rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-500";
    return className ? `${base} ${className}` : base;
  }, [className]);

  useEffect(() => {
    if (provider !== "google" || !googleClient || !slot) {
      return;
    }

    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch {
      // Ignore ad runtime errors to avoid breaking app flow.
    }
  }, [googleClient, provider, slot]);

  useEffect(() => {
    if (provider !== "adsterra" || !slot || !adsterraRootRef.current) {
      return;
    }

    const invokeSrc = `${adsterraNativeBaseUrl.replace(/\/$/, "")}/${slot}/invoke.js`;
    const root = adsterraRootRef.current;
    root.innerHTML = "";

    const container = document.createElement("div");
    container.id = adsterraContainerId;
    root.appendChild(container);

    const script = document.createElement("script");
    script.async = true;
    script.setAttribute("data-cfasync", "false");
    script.src = `${invokeSrc}?v=${adsterraInstanceId}`;
    script.onerror = () => {
      // Helps diagnose blocked network/script errors in production browsers.
      console.error("Adsterra invoke script failed to load", { slot, invokeSrc });
    };

    root.appendChild(script);

    return () => {
      root.innerHTML = "";
    };
  }, [adsterraContainerId, adsterraInstanceId, adsterraNativeBaseUrl, provider, slot]);

  if (provider === "google" && !googleClient) {
    return (
      <div className={containerClass}>
        <p className="mb-2 font-semibold uppercase tracking-wide">{label}</p>
        <div className="flex min-h-[110px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white">
          Ad space reserved. Set NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT to enable Google Ads.
        </div>
      </div>
    );
  }

  if (provider === "adsterra" && !slot) {
    return (
      <div className={containerClass}>
        <p className="mb-2 font-semibold uppercase tracking-wide">{label}</p>
        <div className="flex min-h-[110px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white">
          Ad space reserved. Set NEXT_PUBLIC_AD_SLOT_* values to enable Adsterra ads.
        </div>
      </div>
    );
  }

  if (provider === "adsterra") {
    return (
      <div className={containerClass}>
        <p className="mb-2 font-semibold uppercase tracking-wide">{label}</p>
        <div
          ref={adsterraRootRef}
          className="mx-auto"
          style={{ minHeight: `${height}px`, width: `${width}px`, maxWidth: "100%", ...style }}
        />
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <p className="mb-2 font-semibold uppercase tracking-wide">{label}</p>
      <ins
        className="adsbygoogle block"
        style={{ display: "block", width: "100%", maxWidth: `${width}px`, minHeight: `${height}px`, ...style }}
        data-ad-client={googleClient}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
