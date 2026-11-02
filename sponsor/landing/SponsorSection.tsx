import type React from "react";
import Link from "next/link";
import { TalvessMark, VercelMark } from "./SponsorLogos";
import diamond from "@/sponsor/assets/diamond.webp";
import gold from "@/sponsor/assets/gold.webp";
import cherry from "@/sponsor/assets/cherry.webp";
import "./sponsor-section.css";

/**
 * Sponsor Pin UI — Figma 566:1344 (at rest) and 566:1494 (pointed at).
 *
 * Three hand-drawn boxes, one per tier. Point at one, or tab to it, and a row
 * of pixel art rises out of its floor — diamonds, gold bars, a choir of
 * popcats — one sprite after another. Pure CSS: nothing here needs to hydrate.
 *
 * Each sprite sits at the design's own offset from the box's left edge, so a
 * narrower box on a phone simply shows fewer of them; the edge clips the rest.
 * Each box opens its plan on /sponsor.
 */

type Tier = {
  key: string;
  label: string;
  src: string;
  count: number;
  /* the design's px: first sprite's left, the step between, size, and how far it sinks below the floor */
  x0: number;
  step: number;
  w: number;
  h: number;
  sink: number;
};

const TIERS: Tier[] = [
  { key: "diamond", label: "Become a diamond sponsor", src: diamond.src, count: 12, x0: -27, step: 45, w: 89, h: 73, sink: 25 },
  { key: "gold", label: "Become a Gold sponsor", src: gold.src, count: 10, x0: -9, step: 50, w: 80, h: 80, sink: 24 },
  { key: "supporter", label: "Become a Supporter", src: cherry.src, count: 15, x0: -26, step: 34, w: 80, h: 80, sink: 26 },
];

/* who keeps Pin UI running — Figma 568:1598 at rest, 568:1681 pointed at */
const PLATFORM = [
  { key: "vercel", name: "Vercel", role: "Hosting Sponsor", href: "https://vercel.com", Mark: VercelMark },
  { key: "talvess", name: "Talvess", role: "Analytics Sponsor", href: "https://talvess.vercel.app", Mark: TalvessMark },
];

const em = (px: number) => `${px / 16}em`;

export default function SponsorSection() {
  return (
    <section className="spn" id="sponsor" aria-labelledby="spn-title">
      {/* the rough pen line every box is drawn with */}
      <svg className="spn__defs" aria-hidden="true" focusable="false">
        <filter id="spn-rough" x="-5%" y="-20%" width="110%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.8" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>

      <header className="spn__head">
        <h2 className="spn__title" id="spn-title">
          Sponsor Pin UI
        </h2>
        <p className="spn__lead">
          Help us build more components, resources, and creative experiences for developers.
        </p>
      </header>

      <ul className="spn__tiers">
        {TIERS.map((t) => (
          <li key={t.key}>
            <Link className={`spn__tier spn__tier--${t.key}`} href={`/sponsor#${t.key}`}>
              <span className="spn__edge" aria-hidden="true" />
              <span className="spn__window">
                <span className="spn__label">{t.label}</span>
                {Array.from({ length: t.count }, (_, i) => (
                  <img
                    key={i}
                    className="spn__sprite"
                    src={t.src}
                    alt=""
                    width={t.w}
                    height={t.h}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    style={
                      {
                        "--i": i,
                        left: em(t.x0 + i * t.step),
                        bottom: em(-t.sink),
                        width: em(t.w),
                        height: em(t.h),
                      } as React.CSSProperties
                    }
                  />
                ))}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="spn__plat">
        <h3 className="spn__platTitle">Platform Sponsors</h3>
        <ul className="spn__platRow">
          {PLATFORM.map(({ key, name, role, href, Mark }) => (
            <li key={key}>
              <a
                className={`spn__platCard spn__platCard--${key}`}
                href={href}
                target="_blank"
                rel="noopener noreferrer sponsored"
                aria-label={`${name}, ${role}`}
              >
                <span className="spn__edge" aria-hidden="true" />
                <span className="spn__window">
                  <Mark className="spn__logo" />
                  <span className="spn__platRole">{role}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
