import type { Metadata } from "next";
import { Geist_Mono, Sora } from "next/font/google";
import Script from "next/script";
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
  const isAdsterra = adProvider === "adsterra";
  const enableAdsterraPopunder =
    process.env.NEXT_PUBLIC_ADSTERRA_ENABLE_POPUNDER === "true";
  const enableAdsterraSocialBar =
    process.env.NEXT_PUBLIC_ADSTERRA_ENABLE_SOCIAL_BAR === "true";
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
        {isAdsterra && enableAdsterraPopunder ? (
          <>
            <Script
              id="adsterra-popunder"
              strategy="afterInteractive"
              src="https://pl28943084.profitablecpmratenetwork.com/37/27/41/3727410cc90fd7952a332e882cab21de.js"
            />
          </>
        ) : null}
        {isAdsterra && enableAdsterraSocialBar ? (
          <>
            <Script
              id="adsterra-social-bar"
              strategy="afterInteractive"
              src="https://pl28943139.profitablecpmratenetwork.com/8f/04/f1/8f04f1d27c03f6d8124ff1c6435104d4.js"
            />
          </>
        ) : null}
        <OpeningSplash />
        <Navbar />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
