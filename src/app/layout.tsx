import type { Metadata } from "next";
import { Geist_Mono, Sora } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import Navbar from "@/components/navbar";
import OpeningSplash from "@/components/opening-splash";
import SiteFooter from "@/components/site-footer";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SnapPassport.com",
  description:
    "SnapPassport.com helps you create print-ready passport and visa photo sheets with AI background removal and high-resolution exports.",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const adProvider = (process.env.NEXT_PUBLIC_AD_PROVIDER || "adsterra").toLowerCase();
  const adsenseClient = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT;
  const shouldLoadGoogleAdsense = adProvider === "google" && Boolean(adsenseClient);

  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${sora.variable} ${geistMono.variable} antialiased`}
      >
        {shouldLoadGoogleAdsense ? (
          <Script
            id="google-adsense"
            async
            strategy="afterInteractive"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
            crossOrigin="anonymous"
          />
        ) : null}
        <OpeningSplash />
        <Navbar />
        {children}
        <SiteFooter />
        <Analytics />
      </body>
    </html>
  );
}
