"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import ThemeToggle from "@/components/theme-toggle";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/contact", label: "Contact Us" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="site-nav-wrap">
      <div className="site-nav">
        <Link href="/" className="brand-mark" onClick={() => setIsMobileMenuOpen(false)}>
          <Image
            src="/logo.png"
            alt="SnapPassport logo"
            width={44}
            height={44}
            className="brand-logo"
            priority
          />
          <div className="brand-copy">
            <span className="brand-title">SnapPassport</span>
            <span className="brand-subtitle">Passport Photo Maker</span>
          </div>
        </Link>

        <nav id="primary-mobile-nav" className={isMobileMenuOpen ? "nav-links nav-links-open" : "nav-links"} aria-label="Primary">
          {LINKS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={isActive ? "nav-link nav-link-active" : "nav-link"}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="nav-controls">
          <ThemeToggle />
          <Link href="/#studio" className="nav-cta" onClick={() => setIsMobileMenuOpen(false)}>
            Start Now
          </Link>
          <button
            type="button"
            className="nav-menu-btn"
            aria-expanded={isMobileMenuOpen}
            aria-controls="primary-mobile-nav"
            aria-label="Toggle navigation menu"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          >
            <span className="nav-menu-line" />
            <span className="nav-menu-line" />
            <span className="nav-menu-line" />
          </button>
        </div>
      </div>
    </header>
  );
}
