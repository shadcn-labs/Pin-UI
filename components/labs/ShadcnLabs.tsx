"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import PageBar from "@/components/PageBar";
import PinMark from "@/components/PinMark";
import { usePinTheme } from "@/lib/theme";
import DitherBanner from "./DitherBanner";
import LabsIntro from "./LabsIntro";
import { ArrowIcon, GitHubIcon, LabsIcon, XIcon } from "./LabsIcons";
import "@/components/library/library.css";
import "./shadcn-labs.css";

/*
 * The shard field is WebGPU: it only ever runs in the browser, so it is not
 * rendered on the server at all, and its code is a chunk of its own that the
 * page never waits for. The smooth scroll likewise renders nothing.
 */
const AeroShards = dynamic(() => import("./AeroShards"), { ssr: false });
const LenisScroll = dynamic(() => import("@/components/hero/LenisScroll"), { ssr: false });

/* where the links under the headline go — as the design names them */
const LINKS = [
  { label: "@shadcnlabs", href: "https://x.com/shadcnlabs", Icon: XIcon },
  { label: "shadcn-labs . com", href: "https://shadcn-labs.com", Icon: LabsIcon },
  { label: "github.com/shadcn-labs", href: "https://github.com/shadcn-labs", Icon: GitHubIcon },
];

/* what Shadcn Labs is made of — Pin UI first, then the lab's projects, as shadcn-labs.com lists them */
const MEMBERS = [
  { name: "Pin UI", href: "/" },
  { name: "sensory-ui", href: "https://www.sensory-ui.com" },
  { name: "termcn", href: "https://termcn.dev" },
  { name: "emailcn", href: "https://emailcn.run" },
  { name: "framecn", href: "https://framecn.dev" },
  { name: "ogimagecn", href: "https://ogimagecn.com" },
  { name: "agentcn", href: "https://agentcn.run" },
  { name: "mcpcn", href: "https://mcpcn.dev" },
  { name: "editorcn", href: "https://editorcn.vercel.app" },
  { name: "pdfcn", href: "https://pdfcn.dev" },
  { name: "shadercn", href: "https://shadercn.run" },
  { name: "startercn", href: "https://startercn.vercel.app" },
  { name: "shadcn-cssinjs", href: "https://shadcn-cssinjs.com" },
  { name: "skills", href: "https://www.skills.sh/shadcn-labs/skills" },
];

/*
 * The strip's drift, in em a second, and how far it slows under the pointer.
 * The list runs twice over in each half of the track, so even the widest
 * screen never sees the end of a half; the track is two halves, so the drift
 * wraps without a seam.
 */
const DRIFT = 2.4;
const SLOWED = 0.14;
const RUNS = 4;

/** Pin UI × Shadcn Labs — the lockup: the mark and name, the pixel cross, Shadcn Labs. */
function Lockup({ className }: { className?: string }) {
  return (
    <div className={`labs__lockup ${className ?? ""}`}>
      <span className="labs__pin">
        <PinMark className="labs__pinMark" />
        <span className="labs__pinWord">Pin UI</span>
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="labs__x" src="/labs/x.svg" alt="×" width={62} height={62} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="labs__shadcn" src="/labs/shadcn-labs.svg" alt="Shadcn Labs" width={384} height={74} />
    </div>
  );
}

/**
 * The "consists of" strip: the lab's projects drifting past, each a link.
 *
 * The drift is driven here rather than by a CSS animation so its speed can
 * change smoothly: under the pointer it eases down to a crawl, so a name can
 * be read and caught, and it eases back up when the pointer leaves. The name
 * under the pointer lights white; the rest dim back. Keyboard focus stops the
 * strip and brings the focused name to the middle. At either end a
 * progressive blur takes the names in and out of sight.
 */
function Strip() {
  const stripRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const strip = stripRef.current;
    const track = trackRef.current;
    if (!strip || !track) return;

    const still = matchMedia("(prefers-reduced-motion: reduce)");
    let half = 0; /* one half of the track, in px — the drift wraps at it */
    let em = 16;
    let x = 0;
    let speed = 1; /* the share of DRIFT the strip runs at now… */
    let target = 1; /* …and the share it is easing towards */
    let hovering = false;
    let focused = false;
    let onScreen = false;
    let raf = 0;
    let last = 0;

    const place = () => {
      track.style.transform = `translate3d(${-x}px, 0, 0)`;
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      /* ease the speed to its target — settled in about half a second */
      speed += (target - speed) * (1 - Math.exp(-dt * 7));
      x = (x + DRIFT * em * speed * dt) % half;
      place();
    };

    const sync = () => {
      target = focused ? 0 : hovering ? SLOWED : 1;
      const run = !still.matches && onScreen && half > 0;
      if (run && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      } else if (!run && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    let started = false;
    const measure = () => {
      half = track.scrollWidth / 2;
      em = parseFloat(getComputedStyle(track).fontSize) || 16;
      if (half > 0 && !started) {
        /* open with Pin UI just clear of the left blur, the last of the list fading out behind it */
        started = true;
        x = half - (strip.querySelector<HTMLElement>(".labs__edge")?.offsetWidth ?? 0);
      }
      if (half > 0) x %= half;
      place();
      sync();
    };

    const onEnter = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      hovering = true;
      sync();
    };
    const onLeave = () => {
      hovering = false;
      sync();
    };
    /* a name taken by the keyboard: stop, and bring it to the middle (the strip itself never scrolls) */
    const onFocusIn = (e: FocusEvent) => {
      focused = true;
      strip.scrollLeft = 0;
      const item = (e.target as HTMLElement).closest("li");
      if (item && half > 0) {
        x = (((item.offsetLeft + item.offsetWidth / 2 - strip.clientWidth / 2) % half) + half) % half;
        place();
      }
      sync();
    };
    const onFocusOut = (e: FocusEvent) => {
      if (strip.contains(e.relatedTarget as Node)) return;
      focused = false;
      sync();
    };

    /* the browser scrolls a clipped box to show what takes focus; the drift has already placed it, so undo that */
    const onScroll = () => {
      if (strip.scrollLeft) strip.scrollLeft = 0;
    };

    strip.addEventListener("scroll", onScroll);
    strip.addEventListener("pointerenter", onEnter);
    strip.addEventListener("pointerleave", onLeave);
    strip.addEventListener("focusin", onFocusIn);
    strip.addEventListener("focusout", onFocusOut);
    still.addEventListener("change", sync);
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      sync();
    });
    io.observe(strip);
    measure();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      strip.removeEventListener("scroll", onScroll);
      strip.removeEventListener("pointerenter", onEnter);
      strip.removeEventListener("pointerleave", onLeave);
      strip.removeEventListener("focusin", onFocusIn);
      strip.removeEventListener("focusout", onFocusOut);
      still.removeEventListener("change", sync);
    };
  }, []);

  /*
   * The second run is the list itself; every other run is only picture —
   * hidden from assistive tech and the tab order. Second, not first, so a
   * focused name always has a run to its left to centre against.
   */
  const items = Array.from({ length: RUNS }, (_, run) =>
    MEMBERS.map(({ name, href }) => {
      const copy = run !== 1;
      const external = href.startsWith("http");
      return (
        <li key={`${run}-${name}`} className="labs__member" aria-hidden={copy || undefined}>
          <a
            className="labs__cell"
            href={href}
            tabIndex={copy ? -1 : undefined}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {name}
            <ArrowIcon className="labs__cellArrow" />
            {external && !copy && <span className="labs__sr"> (opens in a new tab)</span>}
          </a>
        </li>
      );
    }),
  ).flat();

  return (
    <div ref={stripRef} className="labs__strip pin-reveal">
      <ul ref={trackRef} className="labs__track" aria-labelledby="labs-members">
        {items}
      </ul>
      {/* the progressive blur at each end: four layers, each blurring harder and reaching less far in */}
      {(["start", "end"] as const).map((side) => (
        <span key={side} className={`labs__edge labs__edge--${side}`} aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
      ))}
    </div>
  );
}

/**
 * /shadcn-labs — Figma 596:131.
 *
 * Pin UI joining Shadcn Labs: the site's bar, a red dithered banner with the
 * joint lockup, the announcement with its links, a strip of what Shadcn Labs
 * consists of, and at the foot the lockup again in the eye of a ring of red
 * glass shards. Smooth-scrolled with Lenis, as the landing is.
 */
export default function ShadcnLabs() {
  /* the GPU field could not start (no WebGPU, or the device was lost): show the still */
  const [still, setStill] = useState(false);
  /* the ring follows the switch: dark glass on black, or the field's own light mode on white */
  const { theme } = usePinTheme();
  /*
   * A phone or small tablet gets a lighter field: fewer shards and fewer pixels
   * per point, so the ring keeps its frame rate on a mobile GPU.
   */
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const mq = matchMedia("(max-width: 820px), (pointer: coarse)");
    const sync = () => setCompact(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <div className="site lib-page labs-page">
      {/* the ring at the foot is the page's finale: the bar steps aside for it */}
      <PageBar hideOver=".labs__ring" />

      <main className="labs">
        {/* the banner: brand red under a Bayer 16 × 16 dither, as the design's shader draws it */}
        <section className="labs__banner" aria-label="Pin UI × Shadcn Labs">
          <DitherBanner />
          <Lockup className="labs__lockup--banner pin-rise" />
        </section>

        <section className="labs__intro">
          <h1 className="labs__title pin-rise" style={{ "--rise-d": "0.05s" } as React.CSSProperties}>
            <span className="labs__red">Pin UI</span> is now the part of{" "}
            <span className="labs__titleEnd">
              Shadcn Labs<span className="labs__red">.</span>
            </span>
          </h1>
          <p className="labs__lead pin-rise" style={{ "--rise-d": "0.1s" } as React.CSSProperties}>
            At Shadcn Labs, we are committed to building open-source technologies that push the limits of{" "}
            <a href="https://github.com/shadcn-ui" target="_blank" rel="noopener noreferrer">
              shadcn/ui
            </a>{" "}
            ecosystem.
          </p>
          <p className="labs__note pin-rise" style={{ "--rise-d": "0.14s" } as React.CSSProperties}>
            *Shadcn Labs isn&rsquo;t affiliated with or endorsed by{" "}
            <a href="https://github.com/shadcn" target="_blank" rel="noopener noreferrer">
              shadcn
            </a>
            .
          </p>
          <ul className="labs__links pin-rise" style={{ "--rise-d": "0.18s" } as React.CSSProperties}>
            {LINKS.map(({ label, href, Icon }) => (
              <li key={href}>
                <a className="labs__link" href={href} target="_blank" rel="noopener noreferrer">
                  <Icon className="labs__linkIcon" />
                  <span className="labs__linkText">{label}</span>
                  <ArrowIcon className="labs__linkArrow" />
                  <span className="labs__sr"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="labs__members" aria-labelledby="labs-members">
          <h2 id="labs-members" className="labs__subtitle pin-reveal">
            Shadcn Labs consists of<span className="labs__red">.</span>
          </h2>
          <Strip />
        </section>

        <section className="labs__ring" data-still={still || undefined} aria-label="Pin UI × Shadcn Labs">
          <div className="labs__field" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="labs__still" src="/labs/aero-still.webp" alt="" width={1086} height={678} loading="lazy" decoding="async" />
            {!still && (
              <AeroShards
                shardColor="#ff002a"
                lightMode={theme === "light"}
                accentColor="#ff002a"
                placement="center"
                material="glass"
                markers="plus"
                count={compact ? 900 : 1500}
                depthOfField={0.75}
                vignette={0.3}
                mouseInteraction
                pulseOnClick
                holdToGather
                twist={1.4}
                /* sharp enough on a retina screen without paying for every device pixel */
                dpr={compact ? 1.25 : 1.5}
                style={{ position: "absolute", inset: 0 }}
                onError={(error: Error) => {
                  console.warn("[shadcn-labs] the shard field could not start; showing the still instead.", error);
                  setStill(true);
                }}
              />
            )}
          </div>
          <Lockup className="labs__lockup--ring pin-reveal" />
        </section>
      </main>

      <LenisScroll />
      <LabsIntro />
    </div>
  );
}
