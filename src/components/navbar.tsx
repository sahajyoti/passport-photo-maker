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
        <Link href="/" className="brand-mark">
          <Image
            src="/logo.png"
            alt="SnapPassport logo"
            width={62}
            height={62}
            className="brand-logo"
            priority
          />
          <span>SnapPassport</span>
        </Link>

        <div className="nav-controls">
          <ThemeToggle />
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

        <nav
          id="primary-mobile-nav"
          className={isMobileMenuOpen ? "nav-links nav-links-open" : "nav-links"}
          aria-label="Primary"
        >
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
      </div>
    </header>
  );
}
