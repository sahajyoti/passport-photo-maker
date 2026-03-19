"use client";

import Image from "next/image";
import Link from "next/link";
import AdSlot from "@/components/ad-slot";

const quickLinks = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact" },
];

const toolLinks = [
  { label: "Passport Photo Maker", href: "/" },
  { label: "Background Remover", href: "/#background-remover" },
  { label: "Photo Layout Generator", href: "/#layout-generator" },
  { label: "Download Printable Photos", href: "/#download-printable" },
  { label: "Print Passport Photos", href: "/#print-passport" },
];

const supportLinks = [
  { label: "Help Center", href: "/contact" },
  { label: "Support", href: "/contact" },
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms & Conditions", href: "/terms" },
  { label: "Report Issue", href: "/contact" },
];

const legalLinks = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Cookie Policy", href: "/cookie-policy" },
];

const socials = [
  {
    label: "Facebook",
    href: "https://facebook.com",
    icon: (
      <path d="M22 12.07C22 6.5 17.52 2 12 2S2 6.5 2 12.07c0 5.03 3.66 9.2 8.44 9.93v-7.03H7.9V12.1h2.54V9.9c0-2.52 1.48-3.92 3.76-3.92 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.25 0-1.64.78-1.64 1.58v1.9h2.8l-.45 2.87h-2.35V22c4.78-.73 8.44-4.9 8.44-9.93Z" />
    ),
  },
  {
    label: "Instagram",
    href: "https://instagram.com",
    icon: (
      <path d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4h-9Zm9.75 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
    ),
  },
  {
    label: "Twitter",
    href: "https://x.com",
    icon: (
      <path d="M3 3h4.5l4 5.57L16.25 3H21l-7.18 8.21L21.5 21h-4.58l-4.42-6.15L7.13 21H2.4l7.61-8.7L3 3Zm2.9 1.8 11.12 14.4h1.5L7.4 4.8H5.9Z" />
    ),
  },
  {
    label: "LinkedIn",
    href: "https://linkedin.com",
    icon: (
      <path d="M6.5 8.5A2.5 2.5 0 1 1 6.5 3.5a2.5 2.5 0 0 1 0 5ZM4 10h5v11H4V10Zm8 0h4.8v1.6h.07c.67-1.2 2.3-2.3 4.74-2.3 5.07 0 6 3.34 6 7.68V21h-5v-3.83c0-1.83-.03-4.18-2.55-4.18-2.56 0-2.95 2-2.95 4.05V21h-5V10Z" />
    ),
  },
];

function FooterList({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; href: string }>;
}) {
  return (
    <div>
      <h3 className="text-base font-semibold tracking-wide text-white">{title}</h3>
      <ul className="mt-4 space-y-2 text-sm text-slate-300">
        {items.map((item) => (
          <li key={item.label}>
            <Link href={item.href} className="transition hover:text-sky-300">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SiteFooter() {
  return (
    <footer className="mt-10 bg-[#0f172a] text-white">
      <div className="mx-auto max-w-7xl px-5 py-12 md:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="SnapPassport logo"
                width={44}
                height={44}
                className="rounded-lg"
              />
              <div>
                <p className="text-lg font-bold tracking-tight">SnapPassport</p>
                <p className="text-xs font-medium text-sky-300">Create Passport Photos Instantly.</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              SnapPassport is an online tool that allows users to easily create passport and ID photos.
              Upload your photo, automatically remove the background, generate passport-size photos,
              and download printable sheets within seconds.
            </p>

            <div className="mt-5 flex items-center gap-2">
              {socials.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={social.label}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-700 text-slate-200 transition hover:border-sky-400 hover:text-sky-300"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
                    {social.icon}
                  </svg>
                </a>
              ))}
            </div>
          </div>

          <FooterList title="Quick Links" items={quickLinks} />
          <FooterList title="Tools / Features" items={toolLinks} />

          <div>
            <FooterList title="Support" items={supportLinks} />
            <p className="mt-4 text-sm text-slate-300">
              Email: {" "}
              <a href="mailto:debojyoti.bme@gmail.com" className="font-semibold text-sky-300 hover:underline">
                debojyoti.bme@gmail.com
              </a>
            </p>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-700 pt-5">
          <AdSlot
            slot={
              process.env.NEXT_PUBLIC_AD_SLOT_FOOTER ||
              process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_FOOTER ||
              "0000000003"
            }
            label="Footer Ad"
            className="mb-5 border-slate-700 bg-slate-900 text-slate-300"
            style={{ minHeight: "100px" }}
            width={728}
            height={100}
          />

          <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-slate-300">
            <p>© 2026 SnapPassport. All rights reserved.</p>
            <div className="flex flex-wrap items-center gap-4">
              {legalLinks.map((item) => (
                <Link key={item.label} href={item.href} className="transition hover:text-sky-300">
                  {item.label}
                </Link>
              ))}
            </div>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-200 transition hover:border-sky-400 hover:text-sky-300"
            >
              Back to top
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
