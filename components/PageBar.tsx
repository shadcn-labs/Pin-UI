"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BlocksLink from "@/components/BlocksLink";
import ThemeMark from "./ThemeMark";
import SponsorNavLink from "@/sponsor/SponsorNavLink";
import MobileMenu from "./MobileMenu";
import ThemeHint from "./ThemeHint";
import { LINKS } from "@/lib/links";

/**
 * The bar over the site's own pages — the testimonials and the sponsor page —
 * in the library page's dress, so they all read as the same kind of place. The
 * mark is the theme switch, as it is everywhere else; the bar firms up once
 * the page has scrolled.
 *
 * `hideOver` names a section (a CSS selector) the bar steps out of the way
 * for: once that section has scrolled up into the top of the window, the bar
 * slides up out of sight, and it slides back as soon as the page is scrolled
 * back above it.
 */
export default function PageBar({ hideOver }: { hideOver?: string } = {}) {
  const [scrolled, setScrolled] = useState(false);
  const [away, setAway] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const target = hideOver ? document.querySelector(hideOver) : null;
    if (!target || typeof IntersectionObserver === "undefined") return;
    /* "in the top of the window": the section reaches into its upper 40% */
    const io = new IntersectionObserver(([e]) => setAway(e.isIntersecting), { rootMargin: "0px 0px -60% 0px" });
    io.observe(target);
    return () => {
      io.disconnect();
      setAway(false);
    };
  }, [hideOver]);

  return (
        <header className="lib__bar" data-scrolled={scrolled} data-away={away || undefined}>
          <div className="lib__brand">
            <ThemeMark buttonClassName="lib__markButton" markClassName="lib__mark" tap={0.88} />
            <Link className="lib__word" href="/">
              Pin UI
            </Link>
            <ThemeHint mark=".lib__markButton" word=".lib__word" />
          </div>
          <nav className="lib__links" aria-label="Site">
            <Link className="lib__link" href="/">
              Home
            </Link>
            <Link className="lib__link" href="/components">
              Components
            </Link>
            <BlocksLink className="lib__link" />
            <Link className="lib__link" href="/#testimonials">
              Testimonials
            </Link>
            <SponsorNavLink className="lib__link" />
            <a className="lib__link lib__link--icon" href={LINKS.github} target="_blank" rel="noopener noreferrer" aria-label="Pin UI on GitHub">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"
                />
              </svg>
            </a>
          </nav>
          <MobileMenu />
        </header>
  );
}
