"use client";

import { useEffect, useRef } from "react";
import { animate, type AnimationPlaybackControlsWithThen } from "motion/react";
import { glassSheet, liquidGlass, type Glass } from "./reader-card-glass";
import "./reader-card.css";

/**
 * Reader Card — a story card that scrolls in place and morphs into a
 * liquid-glass reader.
 *
 * The card is a small page of a story you can scroll with the wheel, under a
 * progressive blur at both edges. Open it and the card's own surface grows
 * into the reader, already on the passage the card was showing, and the
 * lines it was on flash once in the text. The reader is real liquid glass
 * over a drifting ambient light: the close button and the toolbar refract
 * what is behind them, and the panel itself is frosted with a baked rim
 * light. Type size steps up and down without losing your place, a bar keeps
 * your progress, and Escape, the scrim or the close button fold it back into
 * the card.
 *
 * The morph never relayouts: the reader always sits at its final size and only
 * a clip-path moves, between the card's box and the panel's, so the text never
 * re-wraps mid-flight and every frame stays on the compositor. The glass
 * filters are off while anything moves and are switched on only once it is
 * still, under an opaque sheet, so their first paint is never seen.
 */

export type ReaderCardProps = {
  theme?: "light" | "dark";
  /** Take the container's whole box. Without it the scene is 640px tall with rounded corners. */
  fill?: boolean;
  /** Called when the reader has opened, and when it starts to close. */
  onOpenChange?: (open: boolean) => void;
};

/* ── motion ────────────────────────────────────────────────────────────── */
const snappy = { type: "spring", stiffness: 520, damping: 32, mass: 0.7 } as const;
const soft = { type: "spring", stiffness: 240, damping: 26, mass: 0.9 } as const;
const bouncy = { type: "spring", stiffness: 420, damping: 18, mass: 0.8 } as const;
/* visualDuration fixes the spring's perceived length; bounce adds the settle */
const morphOpen = { type: "spring", visualDuration: 0.52, bounce: 0.16 } as const;
const morphClose = { type: "spring", visualDuration: 0.4, bounce: 0 } as const;
const outQuint = [0.22, 1, 0.36, 1] as const;

/* ── the card's excerpt geometry, from the design ─────────────────────── */
/** where the first visible line sits in the card */
const EXCERPT_TOP = 72.5;
const EXCERPT_PAD_BOTTOM = 118;
const EXCERPT_LINE = 23;
const CARD_RADIUS = 40;

/** the reader's type sizes, smallest to largest; it opens on the middle one */
const SIZES = [16, 17.5, 19, 21, 23];
const START_SIZE = 2;

type Rect = { left: number; top: number; width: number; height: number };
type Panel = Rect & { radius: number };
type State = "closed" | "opening" | "open" | "closing";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/* the lines the card's excerpt is set in: hand-broken in the design, so they read the same everywhere */
const CARD_LINES = [
  "soon be racing along the beach in",
  "search of treasure the storm had",
  "thrown ashore, and how they would",
  "tease her for spending the bright",
  "morning indoors with dusty glass",
  "and old brass. She reached the lamp",
  "room and wiped the lenses one by",
  "one. In the third pane she found a",
  "crack no wider than a hair, and in",
  "the crack, caught like a pressed",
];

function ProgressiveBlur({ edge, className = "" }: { edge: "top" | "bottom"; className?: string }) {
  return (
    <div className={`prc__pblur prc__pblur--${edge} ${className}`} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </div>
  );
}

export default function ReaderCard({ theme = "light", fill = false, onOpenChange }: ReaderCardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const onOpenChangeRef = useRef(onOpenChange);
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const q = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector(sel) as T;

    const stage = q(".prc__stage");
    const card = q(".prc__card");
    const cardContent = q(".prc__content");
    const excerpt = q(".prc__excerpt");
    const excerptAnchor = q(".prc__lines");
    const openPill = q<HTMLButtonElement>(".prc__open");
    const bounds = q(".prc__bounds");
    const scrim = q(".prc__scrim");
    const shadow = q(".prc__shadow");
    const reader = q(".prc__reader");
    const glassEl = q(".prc__glass");
    const solid = q(".prc__solid");
    const previewHost = q(".prc__previewHost");
    const inner = q(".prc__inner");
    const scroller = q(".prc__scroll");
    const prose = q(".prc__prose");
    const exStart = q("[data-ex-start]");
    const exEnd = q("[data-resume]");
    const resumeMark = q(".prc__resume");
    const closeBtn = q<HTMLButtonElement>(".prc__close");
    const toolbar = q(".prc__toolbar");
    const fontBtns = [...root.querySelectorAll<HTMLButtonElement>("[data-font]")];
    const progressFill = q(".prc__progressFill");
    const progressText = q(".prc__progressText");

    const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
    let disposed = false;
    const cleanups: (() => void)[] = [];
    const listen = <K extends keyof HTMLElementEventMap>(
      el: HTMLElement,
      type: K,
      fn: (e: HTMLElementEventMap[K]) => void,
      opts?: AddEventListenerOptions,
    ) => {
      el.addEventListener(type, fn, opts);
      cleanups.push(() => el.removeEventListener(type, fn, opts));
    };

    /* ── liquid glass ──────────────────────────────────────────────────── */
    const glasses: Glass[] = [liquidGlass(openPill, { thickness: 14, refraction: 14, blur: 0.6, glareRange: 5 })];
    let panelGlass = false;
    /* the reader's glass is baked while the page is idle, never on the click that opens it */
    function ensureReaderGlass() {
      if (panelGlass || disposed) return;
      panelGlass = true;
      glasses.push(
        glassSheet(glassEl, {
          thickness: 28,
          refraction: 26,
          ior: 1.45,
          blur: 22,
          saturate: 1.6,
          fresnel: 0.22,
          fresnelRange: 10,
          glare: 0.55,
          glareRange: 8,
        }),
        liquidGlass(closeBtn, { thickness: 13, refraction: 12, blur: 1.2, glare: 0.9 }),
        liquidGlass(toolbar, { thickness: 14, refraction: 14, blur: 1.5, glare: 0.75 }),
      );
    }
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(ensureReaderGlass, { timeout: 1500 })
      : window.setTimeout(ensureReaderGlass, 200);
    cleanups.push(() =>
      window.cancelIdleCallback ? window.cancelIdleCallback(idle) : window.clearTimeout(idle),
    );

    /* ── a liquid press: the glass squashes, then springs back ─────────── */
    function liquidPress(el: HTMLElement) {
      let down = false;
      const release = () => {
        if (!down) return;
        down = false;
        if (!reduce()) animate(el, { scaleX: 1, scaleY: 1 }, bouncy);
      };
      listen(el, "pointerdown", (e) => {
        if (e.button !== 0) return;
        down = true;
        if (!reduce()) animate(el, { scaleX: 1.06, scaleY: 0.92 }, snappy);
      });
      listen(el, "pointerup", release);
      listen(el, "pointerleave", release);
      listen(el, "pointercancel", release);
    }

    /* ── entrance ──────────────────────────────────────────────────────── */
    const fontsReady = Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]);
    fontsReady.then(() => {
      if (disposed) return;
      resetExcerpt();
      if (reduce()) {
        card.style.opacity = "1";
        return;
      }
      animate(
        card,
        { opacity: [0, 1], y: [16, 0], scale: [0.97, 1], filter: ["blur(8px)", "blur(0px)"] },
        soft,
      ).then(() => {
        /* a resting filter, even blur(0), would make the card its own compositing layer for nothing */
        if (!disposed) card.style.filter = "";
      });
      animate(openPill, { opacity: [0, 1], scale: [0.6, 1] }, { ...bouncy, delay: 0.25 });
    });

    /* ── the card's excerpt: scrollable, starting on the passage in the design ── */
    function resetExcerpt() {
      excerpt.scrollTop = excerptAnchor.offsetTop - EXCERPT_TOP;
    }
    resetExcerpt();

    /* ── geometry ──────────────────────────────────────────────────────
       Everything is measured in the scene's own coordinates, so the reader
       grows out of the card wherever the scene sits on the page. The panel's
       room is drawn by .prc__bounds in CSS: a margin all round, more at the
       foot when something floats there.                               */
    let rt: Panel = { left: 0, top: 0, width: 0, height: 0, radius: CARD_RADIUS };
    function local(r: DOMRect): Rect {
      const o = root!.getBoundingClientRect();
      return { left: r.left - o.left, top: r.top - o.top, width: r.width, height: r.height };
    }
    function targetRect(): Panel {
      const b = local(bounds.getBoundingClientRect());
      const width = Math.min(680, b.width);
      const height = Math.min(860, b.height);
      return {
        left: b.left + (b.width - width) / 2,
        top: b.top + (b.height - height) / 2,
        width,
        height,
        radius: root!.clientWidth < 560 ? 32 : CARD_RADIUS,
      };
    }
    function layoutReader() {
      rt = targetRect();
      for (const el of [reader, shadow]) {
        el.style.left = `${rt.left}px`;
        el.style.top = `${rt.top}px`;
        el.style.width = `${rt.width}px`;
        el.style.height = `${rt.height}px`;
        el.style.borderRadius = `${rt.radius}px`;
      }
    }
    layoutReader();

    /* inset() of rect r inside the panel: p = 0 is r, p = 1 the whole panel */
    function clipAt(r: Rect, p: number) {
      const top = lerp(r.top - rt.top, 0, p);
      const left = lerp(r.left - rt.left, 0, p);
      const right = lerp(rt.left + rt.width - (r.left + r.width), 0, p);
      const bottom = lerp(rt.top + rt.height - (r.top + r.height), 0, p);
      const radius = lerp(CARD_RADIUS, rt.radius, clamp01(p));
      return `inset(${top}px ${right}px ${bottom}px ${left}px round ${radius}px)`;
    }

    /* ── reading progress and type size ────────────────────────────────── */
    function updateProgress() {
      const max = scroller.scrollHeight - scroller.clientHeight;
      const p = max > 0 ? clamp01(scroller.scrollTop / max) : 0;
      progressFill.style.transform = `scaleX(${p})`;
      progressText.textContent = `${Math.round(p * 100)}%`;
    }
    listen(scroller, "scroll", updateProgress, { passive: true });

    let sizeIdx = START_SIZE;
    let holdRaf = 0;
    function setSize(idx: number) {
      sizeIdx = Math.max(0, Math.min(SIZES.length - 1, idx));
      const max = scroller.scrollHeight - scroller.clientHeight;
      const ratio = max > 0 ? scroller.scrollTop / max : 0;
      prose.style.setProperty("--prc-size", `${SIZES[sizeIdx]}px`);
      /* hold the reading position while the type size eases */
      const t0 = performance.now();
      cancelAnimationFrame(holdRaf);
      const hold = () => {
        scroller.scrollTop = ratio * (scroller.scrollHeight - scroller.clientHeight);
        if (performance.now() - t0 < 320) holdRaf = requestAnimationFrame(hold);
        else updateProgress();
      };
      holdRaf = requestAnimationFrame(hold);
      fontBtns[0].disabled = sizeIdx === 0;
      fontBtns[1].disabled = sizeIdx === SIZES.length - 1;
    }
    cleanups.push(() => cancelAnimationFrame(holdRaf));
    fontBtns.forEach((b) => listen(b, "click", () => setSize(sizeIdx + Number(b.dataset.font))));

    /* open the reader on the same passage the card is scrolled to */
    function syncReaderToCard() {
      const contentH = excerpt.scrollHeight - EXCERPT_TOP - EXCERPT_PAD_BOTTOM;
      const readLine = excerpt.scrollTop + 2 * EXCERPT_LINE; // the second visible line
      const f = clamp01(readLine / contentH);
      const start = exStart.offsetTop;
      const end = exEnd.offsetTop + exEnd.offsetHeight;
      scroller.scrollTop = Math.max(0, lerp(start, end, f) - rt.height * 0.3);
      updateProgress();
    }

    /* the card's face, cloned into the panel so the morph starts from exactly what was on screen */
    function makePreview(r: Rect) {
      const preview = cardContent.cloneNode(true) as HTMLElement;
      preview.className = "prc__preview";
      preview.setAttribute("aria-hidden", "true");
      preview.querySelectorAll(".prc__pblur").forEach((n) => n.remove()); // no backdrop filters mid-morph
      preview.querySelectorAll("[tabindex]").forEach((n) => n.removeAttribute("tabindex"));
      preview.style.left = `${r.left - rt.left}px`;
      preview.style.top = `${r.top - rt.top}px`;
      previewHost.appendChild(preview);
      (preview.querySelector(".prc__excerpt") as HTMLElement).scrollTop = excerpt.scrollTop;
      return preview;
    }

    /* ── open and close ────────────────────────────────────────────────
       Everything that moves is clip-path, opacity or transform, which
       Motion hands to the compositor, so the morph holds its frame rate
       even while the main thread is busy. Open and close can interrupt
       each other mid-flight.                                         */
    let state: State = "closed";
    let token = 0;
    let cardRect: Rect = { left: 0, top: 0, width: 0, height: 0 };
    let preview: HTMLElement | null = null;
    const running = new Set<AnimationPlaybackControlsWithThen>();
    const run = (anim: AnimationPlaybackControlsWithThen) => {
      running.add(anim);
      anim.then(
        () => running.delete(anim),
        () => running.delete(anim),
      );
      return anim;
    };
    const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

    const ensurePreview = (opacity: number) => {
      if (!preview) {
        preview = makePreview(cardRect);
        preview.style.opacity = String(opacity);
      }
      return preview;
    };
    const dropPreview = () => {
      preview?.remove();
      preview = null;
    };
    const pblurs = [...inner.querySelectorAll<HTMLElement>(".prc__pblur")];

    async function openReader() {
      if (state === "open" || state === "opening") return;
      const t = ++token;
      const fromClosed = state === "closed";
      const still = reduce();
      state = "opening";

      if (fromClosed) {
        ensureReaderGlass();
        layoutReader();
        cardRect = local(card.getBoundingClientRect());
        reader.classList.add("is-morphing");
        reader.style.clipPath = clipAt(cardRect, 0);
        solid.style.opacity = "1";
        inner.style.opacity = "0";
        shadow.style.opacity = "0";
        scrim.style.opacity = "0";
        ensurePreview(1);
        reader.dataset.state = "open";
        reader.inert = false;
        scrim.hidden = false;
        syncReaderToCard();
        card.style.visibility = "hidden";
        stage.inert = true;
        root!.dataset.open = "";
      } else {
        /* reversing a close: it is already a solid, clipped sheet */
        reader.classList.add("is-morphing");
        ensurePreview(1);
      }

      if (still) {
        reader.style.clipPath = "";
        inner.style.opacity = "1";
        scrim.style.opacity = "1";
      } else {
        run(animate(scrim, { opacity: 1 }, { duration: 0.3, ease: "easeOut" }));
        run(animate(preview!, { opacity: 0 }, { duration: 0.2, ease: "easeOut" }));
        run(
          animate(
            inner,
            { opacity: 1, transform: ["translateY(14px)", "translateY(0px)"] },
            { duration: 0.42, delay: fromClosed ? 0.1 : 0, ease: outQuint },
          ),
        );
        await run(animate(reader, { clipPath: clipAt(cardRect, 1) }, morphOpen));
        if (t !== token) return;
      }

      dropPreview();
      /* still now: switch the glass on under the opaque sheet, let it paint, then reveal it */
      reader.classList.remove("is-morphing");
      if (!still) {
        pblurs.forEach((p) => {
          p.style.opacity = "0";
          p.style.visibility = "hidden";
        });
        await nextFrame();
        if (t !== token) return;
        reader.style.clipPath = "";
        /* the glass first; the blur bands sample what is behind them, so they join once the sheet has gone */
        run(animate(shadow, { opacity: 1 }, { duration: 0.25 }));
        await run(animate(solid, { opacity: 0 }, { duration: 0.26, ease: "easeOut" }));
        if (t !== token) return;
        pblurs.forEach((p) => (p.style.visibility = "visible"));
        run(animate(pblurs, { opacity: 1 }, { duration: 0.22, ease: "easeOut" }));
      } else {
        reader.style.clipPath = "";
        solid.style.opacity = "0";
        shadow.style.opacity = "1";
      }
      /* the lines the card was showing flash once, so the eye finds its place */
      resumeMark.classList.remove("is-flash");
      void resumeMark.offsetWidth;
      resumeMark.classList.add("is-flash");
      state = "open";
      closeBtn.focus({ preventScroll: true });
      onOpenChangeRef.current?.(true);
    }

    async function closeReader() {
      if (state === "closed" || state === "closing") return;
      const t = ++token;
      const fromOpen = state === "open";
      const still = reduce();
      state = "closing";
      if (fromOpen) onOpenChangeRef.current?.(false);

      if (!still) {
        run(animate(inner, { opacity: 0, transform: "translateY(8px)" }, { duration: 0.16, ease: "easeIn" }));
        run(animate(shadow, { opacity: 0 }, { duration: 0.16 }));
        if (fromOpen) {
          /* cover the glass before it is switched off */
          await run(animate(solid, { opacity: 1 }, { duration: 0.12, ease: "easeOut" }));
          if (t !== token) return;
        }
      }
      solid.style.opacity = "1";
      reader.classList.add("is-morphing");
      pblurs.forEach((p) => {
        p.style.opacity = "";
        p.style.visibility = "";
      });
      ensurePreview(0);

      if (!still) {
        run(animate(scrim, { opacity: 0 }, { duration: 0.32, ease: "easeOut" }));
        run(animate(preview!, { opacity: 1 }, { duration: 0.2, delay: fromOpen ? 0.14 : 0, ease: "easeOut" }));
        await run(animate(reader, { clipPath: clipAt(cardRect, 0) }, morphClose));
        if (t !== token) return;
      }

      reader.dataset.state = "closed";
      reader.inert = true;
      scrim.hidden = true;
      dropPreview();
      reader.classList.remove("is-morphing");
      requestAnimationFrame(() => {
        if (state === "closed") reader.style.clipPath = "";
      });
      card.style.visibility = "";
      stage.inert = false;
      delete root!.dataset.open;
      state = "closed";
      openPill.focus({ preventScroll: true });
    }

    liquidPress(openPill);
    liquidPress(closeBtn);
    listen(openPill, "click", () => void openReader());
    listen(closeBtn, "click", () => void closeReader());
    listen(scrim, "click", () => void closeReader());

    listen(root, "keydown", (e) => {
      if (state === "closed") return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        void closeReader();
        return;
      }
      if (e.key === "Tab" && state === "open") {
        /* keep focus inside the dialog */
        const items: HTMLElement[] = [scroller, closeBtn, ...fontBtns.filter((b) => !b.disabled)];
        const i = items.indexOf(document.activeElement as HTMLElement);
        e.preventDefault();
        items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
      }
    });

    /* the scene can change size under it (a shrinking stage, a rotating phone): re-lay the panel when nothing moves */
    let resizeRaf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        if (state === "opening" || state === "closing") return;
        layoutReader();
      });
    });
    ro.observe(root);

    return () => {
      disposed = true;
      token++;
      ro.disconnect();
      cancelAnimationFrame(resizeRaf);
      running.forEach((a) => a.stop());
      running.clear();
      cleanups.forEach((fn) => fn());
      glasses.forEach((g) => g.destroy());
      dropPreview();
      /* leave the markup as React rendered it, so a remount starts clean */
      reader.dataset.state = "closed";
      reader.inert = true;
      reader.classList.remove("is-morphing");
      reader.style.clipPath = "";
      scrim.hidden = true;
      card.style.visibility = "";
      stage.inert = false;
      delete root.dataset.open;
    };
  }, []);

  return (
    <div ref={rootRef} className="prc" data-theme={theme} data-fill={fill || undefined}>
      {/* ambient light for the glass to bend */}
      <div className="prc__ambient" aria-hidden="true">
        <span className="prc__orb prc__orb--a" />
        <span className="prc__orb prc__orb--b" />
        <span className="prc__orb prc__orb--c" />
      </div>

      <div className="prc__stage">
        <article className="prc__card" aria-label="The Keeper of Wren Point">
          <div className="prc__content">
            <div className="prc__excerpt" tabIndex={0} aria-label="Excerpt preview, scrollable">
              <p className="prc__wrap">
                Mara climbed the hill with a basket of bread on one arm and a coil of rope on the other. She
                had promised her grandfather she would check the lamp before noon, and she meant to keep that
                promise, though every step up the wet path made her boots slide. At the top she stopped to
                breathe and looked back at the village, small and crooked below her, smoke curling from every
                chimney.
              </p>
              <p className="prc__wrap">
                Inside, the tower smelled of salt and lamp oil. She began to climb the spiral stairs, counting
                them the way she always did. Somewhere above her a shutter banged in the wind, and she thought
                of the children in the village who would
              </p>
              <div className="prc__lines">
                {CARD_LINES.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </div>
              <p className="prc__wrap prc__cont">
                flower, lay a single feather of deep and shining blue. She had never seen a bird that color.
                Not on the cliffs, not in her grandfather&rsquo;s books, not anywhere.
              </p>
            </div>
            <ProgressiveBlur edge="top" />
            <ProgressiveBlur edge="bottom" />
            <div className="prc__fade prc__fade--top" aria-hidden="true" />
            <div className="prc__fade prc__fade--bottom" aria-hidden="true" />
            <h2 className="prc__title">
              The Keeper of
              <br />
              Wren Point
            </h2>
          </div>

          <button type="button" className="prc__open" aria-haspopup="dialog">
            <span className="prc__openLabel">
              Open
              <svg
                viewBox="0 0 24 24"
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            </span>
          </button>
        </article>
      </div>

      {/* the room the open panel may take; drawn in CSS, measured when it opens */}
      <div className="prc__bounds" aria-hidden="true" />

      <div className="prc__scrim" hidden />
      <div className="prc__shadow" aria-hidden="true" />

      <section
        className="prc__reader"
        role="dialog"
        aria-modal="true"
        aria-label="The Keeper of Wren Point, Chapter Two"
        data-state="closed"
        inert
      >
        <div className="prc__glass" />
        <div className="prc__solid" />
        <div className="prc__previewHost" />

        <div className="prc__inner">
          <div className="prc__scroll" tabIndex={0} aria-label="Chapter text">
            <article className="prc__prose">
              <p className="prc__chapter">Chapter Two</p>
              <p className="prc__dropcap">
                The storm had blown itself out by morning, and the sea lay flat and silver under a sky the
                color of milk. Gulls wheeled above the harbor, quarreling over nothing, and the fishing boats
                rocked at their moorings as if they, too, were tired from the night. Up on the headland the old
                lighthouse stood with its lamp gone dark, a white finger pointing at the clouds.
              </p>
              <p data-ex-start="">
                Mara climbed the hill with a basket of bread on one arm and a coil of rope on the other. She
                had promised her grandfather she would check the lamp before noon, and she meant to keep that
                promise, though every step up the wet path made her boots slide. At the top she stopped to
                breathe and looked back at the village, small and crooked below her, smoke curling from every
                chimney.
              </p>
              <p data-resume="">
                Inside, the tower smelled of salt and lamp oil. She began to climb the spiral stairs, counting
                them the way she always did. Somewhere above her a shutter banged in the wind, and she thought
                of the children in the village who would{" "}
                <mark className="prc__resume">
                  soon be racing along the beach in search of treasure the storm had thrown ashore, and how they
                  would tease her for spending the bright morning indoors with dusty glass and old brass.
                </mark>{" "}
                She reached the lamp room and wiped the lenses one by one. In the third pane she found a crack
                no wider than a hair, and in the crack, caught like a pressed flower, lay a single feather of
                deep and shining blue. She had never seen a bird that color. Not on the cliffs, not in her
                grandfather&rsquo;s books, not anywhere.
              </p>
              <p>
                She turned the feather in the light. It was warm, as if it had only just left the bird, and
                when she held it near the great lens the glass began, very faintly, to glow.
              </p>
              <p>&ldquo;Well,&rdquo; said a voice behind her. &ldquo;You found it before I did.&rdquo;</p>
              <p>
                Mara spun around. A boy stood at the top of the stairs, soaked to the knees, his hair full of
                sand. He looked about her age, and he was grinning as if the whole morning had been arranged for
                his amusement.
              </p>
              <p>&ldquo;Who are you?&rdquo; she demanded. &ldquo;Nobody comes up here but us.&rdquo;</p>
              <p>
                &ldquo;I came in with the tide,&rdquo; he said, as though that explained everything. &ldquo;And
                that feather is mine. Or it will be, once you help me find the other two.&rdquo;
              </p>
              <p>
                &ldquo;The other <em>two</em>?&rdquo;
              </p>
              <p>
                He crossed to the window and pointed past the harbor, past the last buoy, to where the water
                turned from grey to a deep and impossible blue. &ldquo;The storm shook them loose last night.
                One is in the village. One is out there.&rdquo; He glanced back at her, and for the first time
                the grin slipped. &ldquo;And if they&rsquo;re still apart when the light goes on tonight, your
                lighthouse won&rsquo;t be the only thing that stays dark.&rdquo;
              </p>
              <p>
                Mara looked at the feather, still glowing softly in her palm, then at the boy, then at the long
                blue line of the horizon. Below them a gull cried once and was quiet. She thought of her
                grandfather, of the lamp, of every ship that had ever found its way home by the light of Wren
                Point.
              </p>
              <p>
                &ldquo;All right,&rdquo; she said, and tucked the feather into her coat. &ldquo;Where do we
                start?&rdquo;
              </p>
              <p className="prc__end" aria-hidden="true">
                ❦
              </p>
            </article>
          </div>

          <ProgressiveBlur edge="top" className="prc__pblur--readerTop" />
          <ProgressiveBlur edge="bottom" className="prc__pblur--readerBottom" />
          <div className="prc__rfade prc__rfade--top" aria-hidden="true" />
          <div className="prc__rfade prc__rfade--bottom" aria-hidden="true" />

          <header className="prc__head">
            <h2 className="prc__rtitle">The Keeper of Wren Point</h2>
            <p className="prc__meta">An original story · Chapter Two</p>
          </header>

          <button type="button" className="prc__close" aria-label="Close reader">
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>

          <div className="prc__toolbar" role="toolbar" aria-label="Reading controls">
            <button type="button" className="prc__tool" data-font="-1" aria-label="Smaller text">
              <span className="prc__toolA prc__toolA--sm">A</span>
            </button>
            <button type="button" className="prc__tool" data-font="1" aria-label="Larger text">
              <span className="prc__toolA prc__toolA--lg">A</span>
            </button>
            <span className="prc__sep" aria-hidden="true" />
            <div className="prc__progress">
              <span className="prc__progressTrack">
                <span className="prc__progressFill" />
              </span>
              <span className="prc__progressText">0%</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
