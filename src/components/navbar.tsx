"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/theme-toggle";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/contact", label: "Contact Us" },
];

export default function Navbar() {
  const pathname = usePathname();

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

        <nav className="nav-links" aria-label="Primary">
          {LINKS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={isActive ? "nav-link nav-link-active" : "nav-link"}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <ThemeToggle />
      </div>
    </header>
  );
}
