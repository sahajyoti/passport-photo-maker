"use client";

import Script from "next/script";
import { useEffect, useMemo } from "react";

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
  const adsterraContainerId = `container-${slot}`;
  const adsterraInvokeSrc = `${adsterraNativeBaseUrl.replace(/\/$/, "")}/${slot}/invoke.js`;

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
        <Script
          id={`adsterra-native-${slot}`}
          strategy="afterInteractive"
          src={adsterraInvokeSrc}
          async
          data-cfasync="false"
        />
        <div
          id={adsterraContainerId}
          className="mx-auto"
          style={{ minHeight: `${height}px`, ...style }}
        />
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <p className="mb-2 font-semibold uppercase tracking-wide">{label}</p>
      <ins
        className="adsbygoogle block"
        style={{ display: "block", ...style }}
        data-ad-client={googleClient}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
