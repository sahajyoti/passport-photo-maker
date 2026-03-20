"use client";

import Link from "next/link";

const legalLinks = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Cookie Policy", href: "/cookie-policy" },
  { label: "Contact", href: "/contact" },
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-slate-950/70 text-slate-300 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 md:flex-row md:items-center md:justify-between md:px-8">
        <div>
          <p className="text-base font-semibold tracking-wide text-white">SnapPassport</p>
          <p className="mt-1 text-sm text-slate-400">Create passport sheets with AI precision.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {legalLinks.map((item) => (
            <Link key={item.label} href={item.href} className="transition hover:text-cyan-300">
              {item.label}
            </Link>
          ))}
        </div>
        <p className="text-sm text-slate-400">© 2026 SnapPassport. All rights reserved.</p>
      </div>
    </footer>
  );
}
