"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CullerLogo } from "./culler-logo";
import { OfficialXLink } from "./official-x-link";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/scan", label: "Scan" },
  { href: "/watch", label: "Watch" },
  { href: "/rewards", label: "Rewards" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/token", label: "$CULLER" },
];

export function NavCapsule() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [pill, setPill] = useState({ left: 0, width: 0, ready: false });

  const activeIndex = LINKS.findIndex((link) => link.href === pathname);

  function measure(el: HTMLAnchorElement | null) {
    if (!el || !trackRef.current) return;
    const trackRect = trackRef.current.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    setPill({ left: rect.left - trackRect.left, width: rect.width, ready: true });
  }

  function resetToActive() {
    measure(linkRefs.current[activeIndex] ?? null);
  }

  useEffect(() => {
    resetToActive();
    window.addEventListener("resize", resetToActive);
    return () => window.removeEventListener("resize", resetToActive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <header className="nav-dock">
      <div className="nav-capsule">
        <Link href="/" className="nav-brand" aria-label="CULLER home" onClick={() => setOpen(false)}>
          <CullerLogo />
        </Link>

        <nav className="nav-links" aria-label="Primary" ref={trackRef} onMouseLeave={resetToActive}>
          <span className="nav-pill" style={{ left: pill.left, width: pill.width, opacity: pill.ready ? 1 : 0 }} aria-hidden="true" />
          {LINKS.map((link, index) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                ref={(el) => {
                  linkRefs.current[index] = el;
                }}
                className={`nav-link ${active ? "is-active" : ""}`}
                onMouseEnter={(event) => measure(event.currentTarget)}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <OfficialXLink className="nav-official-x" />

        <button
          className={`nav-burger ${open ? "is-open" : ""}`}
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle navigation"
          aria-controls="mobile-navigation"
          aria-expanded={open}
        >
          <span />
          <span />
        </button>
      </div>

      {open && (
        <nav id="mobile-navigation" className="nav-sheet" aria-label="Primary mobile">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={pathname === link.href ? "is-active" : ""} onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
