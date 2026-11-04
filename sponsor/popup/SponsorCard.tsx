"use client";

import Link from "next/link";
import type React from "react";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "motion/react";
import { lenisRef } from "@/lib/lenis";
import type { SponsorPlan } from "@/sponsor/plans";
import diamond from "@/sponsor/assets/diamond.webp";
import gold from "@/sponsor/assets/gold.webp";
import cherry from "@/sponsor/assets/cherry.webp";
import "./sponsor-card.css";

/**
 * The note a visitor meets on the landing page: sponsor or support Pin UI
 * (Figma 609:105, finished).
 *
 * The brand red running down into blush, as drawn. Up top, the three tiers as
 * pixel sprites on tiles — Diamond, Gold and Supporter — with a name bubble
 * over the one chosen. Until the visitor picks one they take turns on their
 * own, so the card shows what it offers without a word. Under the rule, the
 * title and the chosen tier's price and what it buys, and two answers: Browse
 * plans, which opens /sponsor at the tier on show, and Not now. The cross,
 * Escape and a click outside all mean "not now" too.
 *
 * It greets every landing — a first visit, a reload, a new tab — a beat after
 * the visitor's first move, and once per landing: moving around the site and
 * coming back does not bring it up again. While open it is a dialog: focus
 * moves in and stays, the page holds still, and focus goes back where it was
 * on close.
 */

type Tier = {
  key: SponsorPlan;
  name: string;
  sprite: string;
  price: string;
  per: string;
  line: string;
};

const TIERS: Tier[] = [
  {
    key: "diamond",
    name: "Diamond",
    sprite: diamond.src,
    price: "$67",
    per: "/month",
    line: "Your logo on the Pin UI site and README, and a direct line to us.",
  },
  {
    key: "gold",
    name: "Gold",
    sprite: gold.src,
    price: "$24",
    per: "/month",
    line: "Your logo on the Sponsors page and README, and a shoutout on X.",
  },
  {
    key: "supporter",
    name: "Supporter",
    sprite: cherry.src,
    price: "$5–20",
    per: "once",
    line: "Chip in once and join the Supporters page. It all keeps Pin UI free.",
  },
];

/* the first move, then this beat, before it shows: the hero has had its moment */
const DELAY_MS = 1600;
/*
 * How long each tier holds the stage while the card takes turns on its own.
 * Each turn asks the eye to take in a price and a line of about a dozen words:
 * at an easy reading pace that is near two and a half seconds, plus a beat for
 * the slide itself to settle — so a little over three. Long enough to read
 * every tier in full, short enough that all three have been seen in about ten.
 *
 * A pointer resting on the tiles or the buttons pauses the turns where they
 * are (sponsor-card.css), so a tier never changes under a hand about to
 * click; only choosing a tier — a click, or the arrow keys — ends them.
 */
const CYCLE_MS = 3400;
/* the first fill waits for the card's own entrance to settle */
const FIRST_WAIT_MS = 550;

const rise: Transition = { type: "spring", visualDuration: 0.5, bounce: 0.18 };

/* once per landing: a reload starts it over, moving around the site does not */
let shownThisLoad = false;

export default function SponsorCard() {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  /* which way the last change went, so the detail slides with it */
  const [dir, setDir] = useState(1);
  /* the card takes turns on its own until the visitor reaches for it */
  const [auto, setAuto] = useState(true);
  const titleId = useId();
  const bodyId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const returnTo = useRef<HTMLElement | null>(null);

  const tier = TIERS[index];

  /* show after the first move and a beat, once per landing */
  useEffect(() => {
    if (shownThisLoad) return;
    let t = 0;
    const EVENTS = ["pointermove", "pointerdown", "scroll", "keydown", "touchstart", "wheel"] as const;
    const stop = () => EVENTS.forEach((e) => window.removeEventListener(e, start));
    function start() {
      stop();
      t = window.setTimeout(() => {
        shownThisLoad = true;
        returnTo.current = document.activeElement as HTMLElement | null;
        setOpen(true);
      }, DELAY_MS);
    }
    EVENTS.forEach((e) => window.addEventListener(e, start, { passive: true }));
    return () => {
      stop();
      window.clearTimeout(t);
    };
  }, []);

  /*
   * The choice lives in a ref as well as in state, so a change always reads
   * the tier that is really up — however fast the clicks come — and sets the
   * direction and the tier as two plain updates, never one inside another.
   */
  const indexRef = useRef(0);
  const select = useCallback((next: number) => {
    const current = indexRef.current;
    const wrapped = (next + TIERS.length) % TIERS.length;
    if (wrapped === current) return;
    /* a step on (the wrap from the last tier to the first included) slides forward; anything else slides back */
    const forward = wrapped === (current + 1) % TIERS.length;
    indexRef.current = wrapped;
    setDir(forward ? 1 : -1);
    setIndex(wrapped);
  }, []);

  /*
   * The visitor has taken over: no more turns. Kept in a ref too, so a ticker
   * still finishing its exit after the hand-over cannot move the card on.
   */
  const autoRef = useRef(true);
  const takeOver = useCallback(() => {
    autoRef.current = false;
    setAuto(false);
  }, []);

  /*
   * Taking turns: Diamond, Gold, Supporter, round again — never with reduced
   * motion. There is no separate clock: the ticker on the rule filling up is
   * what moves the card on (onAnimationEnd below), so the line and the change
   * can never drift apart, and a tab in the background holds both together.
   */
  const turnsTaken = useRef(0);
  const nextTurn = useCallback(() => {
    if (!autoRef.current) return;
    turnsTaken.current += 1;
    select(indexRef.current + 1);
  }, [select]);

  const later = useCallback(() => setOpen(false), []);

  /* while open: the page holds still, Escape is "later", and Tab stays inside */
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    lenisRef.current?.stop();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        later();
        return;
      }
      if (e.key !== "Tab") return;
      const card = cardRef.current;
      if (!card) return;
      const items = [...card.querySelectorAll<HTMLElement>("button:not([tabindex='-1']), a[href]")];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !card.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !card.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    /*
     * Focus starts on the dialog itself, not on a button: the card may have
     * opened from a key press, and a button focused then would count as the
     * keyboard resting on it and pause the turns before they began. Tab goes
     * on from here to the cross, the tiers and the answers.
     */
    const focusTimer = window.setTimeout(() => cardRef.current?.focus({ preventScroll: true }), 60);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(focusTimer);
      root.style.overflow = prevOverflow;
      lenisRef.current?.start();
    };
  }, [open, later]);

  /* the tiers are one radio group: arrows move the choice and the focus together */
  const onTilesKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    const jump = e.key === "Home" ? 0 : e.key === "End" ? TIERS.length - 1 : null;
    if (!step && jump === null) return;
    e.preventDefault();
    takeOver();
    const next = jump ?? (indexRef.current + step + TIERS.length) % TIERS.length;
    select(next);
    tileRefs.current[next]?.focus();
  };

  return (
    <AnimatePresence onExitComplete={() => returnTo.current?.focus?.({ preventScroll: true })}>
      {open && (
        <motion.div
          key="sponsor-card"
          className="spk"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.22, delay: 0.06 } }}
          transition={{ duration: 0.3 }}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) later();
          }}
        >
          <motion.div
            ref={cardRef}
            className="spk__card"
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            aria-labelledby={titleId}
            aria-describedby={bodyId}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.95, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={
              reduced
                ? { opacity: 0, transition: { duration: 0.15 } }
                : {
                    opacity: 0,
                    y: 14,
                    scale: 0.97,
                    filter: "blur(6px)",
                    transition: { duration: 0.22, ease: [0.4, 0, 1, 1] },
                  }
            }
            transition={rise}
          >
            {/* the wash: the brand red running down into blush, as the design's blurred bands draw it */}
            <span className="spk__wash" aria-hidden="true" />

            <button type="button" className="spk__close" aria-label="Close" onClick={later}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </button>

            <div
              className="spk__tiers"
              role="radiogroup"
              aria-label="Choose a tier"
              onKeyDown={onTilesKey}
              style={{ "--spk-i": index } as React.CSSProperties}
            >
              {/*
                Three layers, bottom to top: each tile's blush fill, the white
                plate that slides under the chosen sprite, and the tiles
                themselves — clear, holding only their sprites. Kept as
                separate layers so the plate can never cover a sprite, whatever
                the tiles' own animation does to their stacking. One position
                (--spk-i) moves the plate and the name bubble together.
              */}
              {TIERS.map((t, i) => (
                <span
                  key={t.key}
                  className="spk__fill"
                  aria-hidden="true"
                  style={{ "--spk-at": i } as React.CSSProperties}
                />
              ))}
              <span className="spk__plate" aria-hidden="true" />
              <span className="spk__tipRail" aria-hidden="true">
                <span className="spk__tip">
                  <span className="spk__tipClip">
                    <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                      <motion.span
                        key={tier.key}
                        className="spk__tipText"
                        custom={dir}
                        variants={{
                          in: (d: number) => (reduced ? { opacity: 0 } : { opacity: 0, y: 7 * d }),
                          at: { opacity: 1, y: 0 },
                          out: (d: number) => (reduced ? { opacity: 0 } : { opacity: 0, y: -7 * d }),
                        }}
                        initial="in"
                        animate="at"
                        exit="out"
                        transition={{
                          duration: 0.22,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                      >
                        {tier.name}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                </span>
              </span>
              {TIERS.map((t, i) => {
                const on = i === index;
                return (
                  <button
                    key={t.key}
                    ref={(el) => {
                      tileRefs.current[i] = el;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={`${t.name}, ${t.price} ${t.per}`}
                    tabIndex={on ? 0 : -1}
                    className="spk__tile"
                    data-on={on || undefined}
                    onClick={() => {
                      takeOver();
                      select(i);
                    }}
                    onFocus={takeOver}
                    style={{ "--spk-at": i } as React.CSSProperties}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="spk__sprite"
                      src={t.sprite}
                      alt=""
                      width={120}
                      height={120}
                      decoding="async"
                      draggable={false}
                    />
                  </button>
                );
              })}
            </div>

            {/*
              The design's rule, and on it the ticker while the card takes
              turns: it fills from the left, and when it is full the next tier
              comes up and the full line wipes away to the right as the next
              one starts filling behind it — a hand-off, not a snap back to
              empty. A hand on the card wipes the ticker away for good.
            */}
            <div className="spk__rule" aria-hidden="true">
              <AnimatePresence initial={false}>
                {auto && !reduced && (
                  <motion.span
                    key={index}
                    className="spk__ticker"
                    /* written the same way at both ends, so the wipe interpolates instead of jumping */
                    initial={{ clipPath: "inset(0% 0% 0% 0%)" }}
                    animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
                    exit={{ clipPath: "inset(0% 0% 0% 100%)", transition: { duration: 0.42, ease: [0.65, 0, 0.35, 1] } }}
                  >
                    <span
                      className="spk__timer"
                      style={
                        {
                          "--spk-cycle": `${CYCLE_MS}ms`,
                          "--spk-wait": `${turnsTaken.current === 0 ? FIRST_WAIT_MS : 0}ms`,
                        } as React.CSSProperties
                      }
                      onAnimationEnd={(e) => {
                        if (e.animationName === "spk-fill") nextTurn();
                      }}
                    />
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            <div className="spk__body">
              <h2 className="spk__title" id={titleId}>
                Sponsor/Support Pin UI Now
              </h2>

              {/* the chosen tier: its price and what it buys, sliding with the change */}
              <div className="spk__detail" id={bodyId} aria-live="polite">
                <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                  <motion.div
                    key={tier.key}
                    className="spk__detailInner"
                    custom={dir}
                    variants={{
                      in: (d: number) => (reduced ? { opacity: 0 } : { opacity: 0, x: 18 * d, filter: "blur(4px)" }),
                      at: { opacity: 1, x: 0, filter: "blur(0px)" },
                      out: (d: number) => (reduced ? { opacity: 0 } : { opacity: 0, x: -18 * d, filter: "blur(4px)" }),
                    }}
                    initial="in"
                    animate="at"
                    exit="out"
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <p className="spk__price">
                      <span className="spk__amount">{tier.price}</span>
                      <span className="spk__per">{tier.per}</span>
                    </p>
                    <p className="spk__line">{tier.line}</p>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/*
              The two answers. Browse plans opens /sponsor at the tier on show
              here, so whoever was reading Gold lands on Gold; Not now is the
              same as the cross.
            */}
            <div className="spk__actions">
              <Link className="spk__cta" href={`/sponsor#${tier.key}`} onClick={later}>
                Browse plans
                <svg className="spk__ctaArrow" viewBox="0 0 16 16" aria-hidden="true">
                  <path
                    d="M3.5 8h9M8.5 4l4 4-4 4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
              <button type="button" className="spk__later" onClick={later}>
                Not now
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
