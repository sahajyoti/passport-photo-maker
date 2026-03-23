"use client";

import { useEffect } from "react";

type AdSlotProps = {
  slot: string;
  style?: React.CSSProperties;
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
  style,
  width = 728,
  height = 90,
}: AdSlotProps) {
  const googleClient =
    process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT || "ca-pub-8168976143164442";

  useEffect(() => {
    if (!googleClient || !slot) {
      return;
    }

    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch {
      // Ignore ad runtime errors to avoid breaking app flow.
    }
  }, [googleClient, slot]);

  if (!googleClient || !slot) {
    return null;
  }

  return (
    <ins
      className="adsbygoogle block"
      style={{ display: "block", width: "100%", maxWidth: `${width}px`, minHeight: `${height}px`, ...style }}
      data-ad-client={googleClient}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
