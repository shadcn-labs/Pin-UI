"use client";

import type React from "react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import ComponentCard from "../library/ComponentCard";
import ViewAllCard from "./ViewAllCard";
import { LANDING_SHOWN, LIBRARY } from "../library/registry";
import { BLOCKS, type Block } from "@/lib/blocks";

/**
 * The shelf under the hero — Figma 580:300 (Components) and 580:403 (Blocx).
 *
 * One grid, two libraries. A short rule under the heading fills as the shelf
 * is looked at; when it is full the heading rolls over to the other library
 * and the cards turn, one after another along the rows, to show its pieces —
 * then the rule starts again and, full, turns them back. The turn always goes
 * the same way round, so it reads as one continuous motion, never an undo.
 *
 * The clock runs while the shelf is on screen and the tab is open, and holds
 * while the pointer is on a card or a card has keyboard focus — nothing turns
 * over under a hand reaching for it, but simply reading the heading never
 * stops the rule. The heading is a button too: press it to turn now.
 * With reduced motion the rule still fills — a slow, flat bar moves nothing
 * across the screen — but the turn itself becomes a plain fade (landing.css).
 */

type Side = "components" | "blocx";

/*
 * How long a side stays up, in ms — the rule's fill. Long enough to take in
 * six cards and reach for one; short enough that the other side is seen by
 * anyone who stays on the shelf for a moment.
 */
const DWELL = 8000;
const SHOWN = LANDING_SHOWN;

/* the newest blocks first, as the Blocx shelf tags them */
const SHELF_BLOCKS: Block[] = [...BLOCKS.filter((b) => b.isNew), ...BLOCKS.filter((b) => !b.isNew)].slice(0, SHOWN);

export default function UniqueSection() {
  const sectionRef = useRef<HTMLElement>(null);
  /* how many half-turns have been made: even shows the components, odd the blocks */
  const [turns, setTurns] = useState(0);
  const side: Side = turns % 2 === 0 ? "components" : "blocx";
  const [held, setHeld] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);

  useEffect(() => {
    const onVisibility = () => setTabHidden(document.hidden);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);

    const section = sectionRef.current;
    const io =
      section && typeof IntersectionObserver !== "undefined"
        ? /*
           * On screen means some of it is in the middle of the window — not a
           * share of its height, which on a phone (one card a row, six tall)
           * the window could never show.
           */
          new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { rootMargin: "-15% 0px -15% 0px" })
        : null;
    if (section && io) io.observe(section);
    else setOnScreen(true);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      io?.disconnect();
    };
  }, []);

  const turn = useCallback(() => setTurns((t) => t + 1), []);

  const running = onScreen && !tabHidden && !held;

  /* hold while pointed at or focused inside; let go only when both have left */
  const pointerIn = useRef(false);
  const focusIn = useRef(false);
  const syncHeld = () => setHeld(pointerIn.current || focusIn.current);

  return (
    <section
      ref={sectionRef}
      className="shelf shelf--flip"
      id="components"
      data-side={side}
      aria-labelledby="components-heading"
      onFocus={() => {
        focusIn.current = true;
        syncHeld();
      }}
      onBlur={(e) => {
        if (sectionRef.current?.contains(e.relatedTarget as Node)) return;
        focusIn.current = false;
        syncHeld();
      }}
    >
      <div className="shelf__head shelf__head--flip pin-reveal">
        <h2 id="components-heading" className="shelf__switchTitle">
          <button
            type="button"
            className="shelf__switch"
            onClick={turn}
            aria-label={side === "components" ? "Components — show Blocx" : "Blocx — show Components"}
          >
            {/* both names share one box; the one up rolls away as the other rolls in */}
            <span className="shelf__names" aria-hidden="true">
              <span className="shelf__name" data-up={side === "components" || undefined}>
                Components
              </span>
              <span className="shelf__name" data-up={side === "blocx" || undefined}>
                Blocx
              </span>
            </span>
          </button>
        </h2>

        {/* the rule: a faint track, and the fill that times the shelf — restarted on every turn */}
        <span className="shelf__track" aria-hidden="true">
          <span
            key={turns}
            className="shelf__fill"
            style={
              {
                "--dwell": `${DWELL}ms`,
                animationPlayState: running ? "running" : "paused",
              } as React.CSSProperties
            }
            onAnimationEnd={turn}
          />
        </span>
      </div>

      {/* the hold is on the cards, not the whole section: reading the heading never stops the rule */}
      <ul
        className="shelf__grid"
        onPointerOver={(e) => {
          if (e.pointerType !== "mouse" || pointerIn.current) return;
          if (!(e.target as Element).closest(".shelf__flip")) return;
          pointerIn.current = true;
          syncHeld();
        }}
        onPointerOut={(e) => {
          if (e.pointerType !== "mouse") return;
          const to = e.relatedTarget as Element | null;
          if (to && to.closest?.(".shelf__flip") && e.currentTarget.contains(to)) return;
          pointerIn.current = false;
          syncHeld();
        }}
      >
        {Array.from({ length: SHOWN + 1 }, (_, i) => {
          const entry = LIBRARY[i];
          const block = SHELF_BLOCKS[i];
          const last = i === SHOWN;
          return (
            <li
              key={i}
              className="shelf__flip pin-reveal"
              style={{ "--reveal-i": i % 3, "--flip-i": i } as React.CSSProperties}
            >
              <div className="shelf__flipper" style={{ "--turns": turns } as React.CSSProperties}>
                <div className="shelf__face" inert={side !== "components"}>
                  {last || !entry ? (
                    <ViewAllCard as="div" index={i} total={LIBRARY.length} arrowAtRest />
                  ) : (
                    <ComponentCard as="div" entry={entry} index={i} priority={i < 3} hidden={side !== "components"} />
                  )}
                </div>
                <div className="shelf__face shelf__face--back" inert={side !== "blocx"}>
                  {last || !block ? (
                    <ViewAllCard as="div" index={i} total={BLOCKS.length} library="blocx" arrowAtRest />
                  ) : (
                    <BlockCard block={block} />
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * A block on the landing shelf, dressed as a component card: its picture in
 * the frame, its name and a "New" tag in the bar. The picture is the whole
 * block, contained rather than cropped, on the block's own background — so
 * the margins either side read as more of the block, not as a letterbox.
 */
function BlockCard({ block }: { block: Block }) {
  return (
    <div className="shelf__cell">
      <Link className="card" href={`/blocx/${block.slug}`} aria-label={`${block.name}${block.isNew ? ", new" : ""} — Blocx`}>
        <span className="card__frame" style={{ background: block.canvas }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="card__video card__thumb"
            src={block.thumb}
            alt=""
            width={960}
            height={756}
            loading="lazy"
            decoding="async"
            aria-hidden="true"
          />
        </span>
        <span className="card__foot">
          <span className="card__title">
            {block.name}
            {block.isNew && <span className="card__new">New</span>}
          </span>
          <span className="card__arrow" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M6 18 18 6m0 0H8.4M18 6v9.6"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </span>
      </Link>
    </div>
  );
}
