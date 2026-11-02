"use client";

import { useEffect, useLayoutEffect } from "react";
import { lenisRef } from "@/lib/lenis";
import { INTRO_ATTR } from "./intro";

/*
 * The arrival on /shadcn-labs (see intro.ts): open on the foot, hold, then
 * glide to the top on Lenis.
 *
 *   hold  — at the foot, the ring and its lockup on screen, the bar out of
 *           the way; long enough for the shard field to come up.
 *   run   — the glide: slow to leave, quick through the middle, settling
 *           softly onto the banner. The bar slides back in on its own as the
 *           ring drops away (PageBar's hideOver).
 *
 * Any hand on the page — wheel, touch, key, click — ends it on the spot and
 * the page is the reader's from wherever it is. It renders nothing.
 */

const HOLD = 1300;
/* the glide's length: about 650px a second, never rushed, never a wait */
const glideFor = (distance: number) => Math.min(3.6, Math.max(2.2, distance / 650));
const easeInOutQuart = (t: number) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2);

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export default function LabsIntro() {
  /*
   * Arriving by an in-app link the inline script never ran: decide here,
   * before paint, and cover the page for the moment until the router has
   * finished its own scroll to the top and the jump to the foot is made.
   */
  useIsoLayoutEffect(() => {
    const d = document.documentElement;
    if (d.hasAttribute(INTRO_ATTR)) return;
    if (location.hash || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    d.setAttribute(INTRO_ATTR, "cover");
  }, []);

  useEffect(() => {
    const d = document.documentElement;
    if (!d.hasAttribute(INTRO_ATTR)) return;

    let timer = 0;
    let poll = 0;
    let frame = 0;
    let gliding = false;
    let over = false;

    const bottom = () => d.scrollHeight - window.innerHeight;
    const toFoot = () => {
      const lenis = lenisRef.current;
      if (lenis) lenis.scrollTo(bottom(), { immediate: true, force: true });
      else window.scrollTo({ top: bottom(), behavior: "instant" });
    };

    const end = () => {
      if (over) return;
      over = true;
      window.clearTimeout(timer);
      window.clearInterval(poll);
      cancelAnimationFrame(frame);
      d.removeAttribute(INTRO_ATTR);
      if ("scrollRestoration" in history) history.scrollRestoration = "auto";
      for (const type of INPUTS) window.removeEventListener(type, takeOver, true);
    };

    /* the reader takes over: stop the glide where it is */
    const takeOver = () => {
      const lenis = lenisRef.current;
      if (gliding && lenis) lenis.scrollTo(window.scrollY, { immediate: true, force: true });
      end();
    };
    const INPUTS = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    for (const type of INPUTS) window.addEventListener(type, takeOver, { capture: true, passive: true });

    const glide = () => {
      if (over) return;
      d.setAttribute(INTRO_ATTR, "run");
      gliding = true;
      const lenis = lenisRef.current;
      const from = window.scrollY;
      if (lenis) {
        lenis.scrollTo(0, { duration: glideFor(from), easing: easeInOutQuart, force: true, onComplete: end });
      } else {
        /* no Lenis (it failed to load): the browser's own smooth scroll, then done */
        window.scrollTo({ top: 0, behavior: "smooth" });
        timer = window.setTimeout(end, glideFor(from) * 1000);
      }
    };

    /* after the router's own scroll (an in-app arrival), land on the foot and lift the cover */
    frame = requestAnimationFrame(() => {
      toFoot();
      if (d.getAttribute(INTRO_ATTR) === "cover") d.setAttribute(INTRO_ATTR, "hold");
      const started = performance.now();
      /* hold — and wait for Lenis to be up (it loads on its own), but never longer than a second past the hold */
      poll = window.setInterval(() => {
        const waited = performance.now() - started;
        if (waited < HOLD) return;
        if (!lenisRef.current && waited < HOLD + 1000) return;
        window.clearInterval(poll);
        /* type may have moved the foot while held — start from the true bottom */
        toFoot();
        glide();
      }, 50);
    });

    return end;
  }, []);

  return null;
}
