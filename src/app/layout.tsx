import type { Metadata } from "next";
import { Geist_Mono, Sora } from "next/font/google";
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
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${sora.variable} ${geistMono.variable} antialiased`}
      >
        <OpeningSplash />
        <Navbar />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
