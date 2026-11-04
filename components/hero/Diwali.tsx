"use client";

import { useEffect, useRef } from "react";
import { usePinTheme } from "@/lib/theme";
import "./diwali.css";

/**
 * Diwali in the hero: a lit diya in the bottom-right corner and an anar (a
 * flower-pot firework) at the foot of the frame, in the middle.
 *
 * The diya can be picked up. Carry its flame to the anar's wick and hold it
 * there a moment — the wick catches with a growing ember — and the anar goes
 * up: a fountain of sparks, white-hot at the mouth and cooling through gold to
 * red as they fall, crackling as they die. The fountain is real ballistics
 * with one rule laid over it: no spark is ever thrown hard enough to rise past
 * about two-thirds of the frame's height, nor into the masthead — high, a proper
 * fountain, and never over the nav. The sparks are drawn behind the claim and
 * the stamp, so where the fountain crosses the headline the type stays crisp
 * over the fire. It burns for a few seconds, dies down, and after a breath a fresh
 * anar is ready to light again.
 *
 * Dragging is done outside React — the diya's transform is written straight
 * from the pointer on every move, its flame leans against the motion, and on
 * release it springs home on a CSS curve — so carrying it never waits on a
 * render. The sparks are one canvas, drawn only while there is fire or a
 * flame in the hand. With the keyboard, Enter or Space on the diya lights the
 * anar. Light and crimson both: sparks add up as light on the dark face and
 * are drawn as fire on the light one.
 */

/* the burn: how long it takes to catch, how long it roars, how long it dies down (s) */
const RAMP = 0.5;
const HOLD = 6;
const FADE = 1.6;
const BURN = RAMP + HOLD + FADE;
/* how long after it dies a fresh anar is ready (ms) */
const RESET_MS = 2600;
/* how long the flame has to stay at the wick for it to catch (s) */
const CATCH = 0.32;
/* gravity on a spark, px/s² */
const G = 1150;
/* how high the fountain may go, as a share of the frame's height */
const REACH = 0.68;
/* the clearance kept under the masthead, px */
const CLEAR = 24;
const MAX_SPARKS = 1500;

type Spark = {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  width: number;
  /* a crackle: a tiny white fleck thrown off a dying spark */
  fleck: boolean;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* a roughly normal spread from three uniform draws */
const spread = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

export default function Diwali() {
  const rootRef = useRef<HTMLDivElement>(null);
  const diyaRef = useRef<HTMLDivElement>(null);
  const flameRef = useRef<HTMLSpanElement>(null);
  const anarRef = useRef<HTMLDivElement>(null);
  const wickRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = usePinTheme();
  const themeRef = useRef(theme);
  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    const root = rootRef.current;
    const frame = root?.parentElement;
    const diya = diyaRef.current;
    const flame = flameRef.current;
    const anar = anarRef.current;
    const wick = wickRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!root || !frame || !diya || !flame || !anar || !wick || !canvas || !ctx) return;

    const still = matchMedia("(prefers-reduced-motion: reduce)");
    let w = 0;
    let h = 0;
    let dpr = 1;

    const size = () => {
      w = frame.clientWidth;
      h = frame.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(frame);

    /* --- the burn ---------------------------------------------------------- */

    let state: "ready" | "burning" | "spent" = "ready";
    let burnT = 0;
    let charge = 0;
    let resetTimer = 0;
    const sparks: Spark[] = [];

    const ignite = () => {
      if (state !== "ready") return;
      state = "burning";
      burnT = 0;
      charge = 0;
      anar.dataset.state = "burning";
      anar.style.setProperty("--charge", "0");
      root.dataset.lit = "";
      /* the note has done its job */
      root.dataset.done = "";
      wake();
    };

    /* where the anar's mouth and wick are, and how high its sparks may go, in the frame's px */
    const anarGeometry = () => {
      const fr = frame.getBoundingClientRect();
      const a = anar.getBoundingClientRect();
      const mouthX = a.left + a.width / 2 - fr.left;
      const mouthY = a.top + a.height * 0.15 - fr.top;
      /* a fountain half the frame high, its peak never reaching into the masthead */
      const masthead = frame.querySelector(".hero__masthead");
      const roof = masthead ? masthead.getBoundingClientRect().bottom - fr.top + CLEAR : CLEAR;
      const rise = Math.max(24, Math.min(h * REACH, mouthY - roof));
      return { mouthX, mouthY, rise, base: a.bottom - fr.top };
    };

    /* the fountain's strength over the burn: catching, roaring, dying down */
    const envelope = (t: number) => {
      if (t < RAMP) return t / RAMP;
      if (t < RAMP + HOLD) return 1 - 0.08 * Math.sin(t * 7) * Math.sin(t * 2.3);
      return Math.max(0, 1 - (t - RAMP - HOLD) / FADE);
    };

    /* --- the drag ---------------------------------------------------------- */

    let drag: { id: number; sx: number; sy: number; minX: number; maxX: number; minY: number; maxY: number } | null = null;
    let offX = 0;
    let offY = 0;
    let lastX = 0;
    let lastT = 0;
    let vx = 0;
    let lean = 0;

    const place = (x: number, y: number, lifted: boolean) => {
      const tilt = lifted ? clamp(vx * 0.01, -9, 9) : 0;
      diya.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${tilt}deg) scale(${lifted ? 1.06 : 1})`;
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      /* keep every move on the diya, even when the pointer outruns it; a pointer already gone cannot be captured */
      try {
        diya.setPointerCapture(e.pointerId);
      } catch {
        /* the moves still arrive while the pointer is over the diya */
      }
      diya.style.transition = "none";
      /* the diya may go anywhere inside the frame, its whole body kept in view */
      const fr = frame.getBoundingClientRect();
      const d = diya.getBoundingClientRect();
      const homeLeft = d.left - offX;
      const homeTop = d.top - offY;
      drag = {
        id: e.pointerId,
        sx: e.clientX - offX,
        sy: e.clientY - offY,
        minX: fr.left - homeLeft + 4,
        maxX: fr.right - (homeLeft + d.width) - 4,
        minY: fr.top - homeTop + 4,
        maxY: fr.bottom - (homeTop + d.height) - 4,
      };
      lastX = e.clientX;
      lastT = e.timeStamp;
      root.dataset.dragging = "";
      document.documentElement.style.cursor = "grabbing";
      place(offX, offY, true);
      wake();
    };

    const onMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      offX = clamp(e.clientX - drag.sx, drag.minX, drag.maxX);
      offY = clamp(e.clientY - drag.sy, drag.minY, drag.maxY);
      const dt = Math.max(1, e.timeStamp - lastT);
      vx = vx * 0.6 + ((e.clientX - lastX) / dt) * 1000 * 0.4;
      lastX = e.clientX;
      lastT = e.timeStamp;
      place(offX, offY, true);
    };

    const onUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      charge = 0;
      anar.style.setProperty("--charge", "0");
      delete root.dataset.dragging;
      document.documentElement.style.cursor = "";
      /* home on a soft spring, the flame settling upright as it goes */
      diya.style.transition = still.matches ? "none" : "transform 0.75s cubic-bezier(0.2, 1.25, 0.35, 1)";
      offX = 0;
      offY = 0;
      vx = 0;
      place(0, 0, false);
      wake();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      ignite();
    };

    diya.addEventListener("pointerdown", onDown);
    diya.addEventListener("pointermove", onMove);
    diya.addEventListener("pointerup", onUp);
    diya.addEventListener("pointercancel", onUp);
    diya.addEventListener("keydown", onKey);
    /* the browser's own image drag would fight the carry */
    const noNative = (e: Event) => e.preventDefault();
    diya.addEventListener("dragstart", noNative);

    /* --- the loop: runs only while there is something to move ---------------- */

    let raf = 0;
    let last = 0;

    const emit = (count: number, g: ReturnType<typeof anarGeometry>, scale: number) => {
      /* the fastest a spark may leave: the speed whose peak is exactly the fountain's reach */
      const vmax = Math.sqrt(2 * G * g.rise);
      for (let i = 0; i < count && sparks.length < MAX_SPARKS; i++) {
        /*
         * A fountain's shape: a dense core thrown nearly straight up, fastest,
         * and a wide fan of slower sparks arcing out to either side — so the
         * spray rises tall in the middle and opens like a flower as it falls.
         */
        const fan = spread();
        const angle = (-90 + fan * 30) * (Math.PI / 180);
        const core = 1 - Math.min(1, Math.abs(fan)) * 0.35;
        const speed = vmax * core * (0.6 + 0.4 * Math.pow(Math.random(), 0.5));
        const x = g.mouthX + spread() * 3 * scale;
        sparks.push({
          x,
          y: g.mouthY,
          px: x,
          py: g.mouthY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          age: 0,
          life: 0.75 + Math.random() * 0.85,
          width: (0.9 + Math.random() * 1.3) * scale,
          fleck: false,
        });
      }
    };

    const frameStep = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const dark = themeRef.current !== "light";
      const scale = clamp(w / 1280, 0.7, 1.2);

      /* the flame leans against the carry and rights itself */
      vx *= Math.exp(-dt * 6);
      const targetLean = drag ? clamp(-vx * 0.035, -28, 28) : 0;
      lean += (targetLean - lean) * (1 - Math.exp(-dt * 10));
      flame.style.setProperty("--lean", `${lean.toFixed(2)}deg`);

      /* the flame held at the wick: the ember grows, and catches */
      if (drag && state === "ready") {
        const f = flame.getBoundingClientRect();
        const k = wick.getBoundingClientRect();
        const fx = f.left + f.width / 2;
        const fy = f.top + f.height * 0.55;
        const d = Math.hypot(fx - (k.left + k.width / 2), fy - (k.top + k.height / 2));
        const reach = Math.max(30, f.height * 0.75);
        if (d < reach) charge += dt / CATCH;
        else charge = Math.max(0, charge - dt * 3);
        anar.style.setProperty("--charge", charge.toFixed(3));
        if (charge >= 1) ignite();
      }

      const g = anarGeometry();
      if (state === "burning") {
        burnT += dt;
        const strength = envelope(burnT);
        anar.style.setProperty("--burn", strength.toFixed(3));
        root.style.setProperty("--burn", strength.toFixed(3));
        emit(Math.round((still.matches ? 110 : 380) * strength * dt + Math.random()), g, scale);
        if (burnT >= BURN) {
          state = "spent";
          anar.dataset.state = "spent";
          anar.style.setProperty("--burn", "0");
          root.style.setProperty("--burn", "0");
          delete root.dataset.lit;
          window.clearTimeout(resetTimer);
          resetTimer = window.setTimeout(() => {
            state = "ready";
            anar.dataset.state = "ready";
          }, RESET_MS);
        }
      }

      /* the sparks: fly, fall, cool, crackle, and draw themselves as short streaks */
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
      ctx.lineCap = "round";
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.age += dt;
        s.px = s.x;
        s.py = s.y;
        s.vy += G * dt;
        /* light air: the fan keeps its width as it falls */
        s.vx *= 1 - 0.18 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        const t = s.age / s.life;
        if (t >= 1 || s.y > g.base + 6) {
          sparks.splice(i, 1);
          continue;
        }
        /* a dying spark sometimes throws off a few white flecks */
        if (!s.fleck && t > 0.6 && Math.random() < 0.035 && sparks.length < MAX_SPARKS - 4) {
          for (let j = 0; j < 4; j++) {
            const a = Math.random() * Math.PI * 2;
            const v = 70 + Math.random() * 110;
            sparks.push({
              x: s.x,
              y: s.y,
              px: s.x,
              py: s.y,
              vx: Math.cos(a) * v,
              vy: Math.sin(a) * v,
              age: 0,
              life: 0.18 + Math.random() * 0.14,
              width: 0.8 * scale,
              fleck: true,
            });
          }
        }
        /* white-hot, then gold, then orange, then a dull red as it cools */
        let r: number;
        let gg: number;
        let b: number;
        if (s.fleck) {
          r = 255;
          gg = 248;
          b = 230;
        } else if (t < 0.25) {
          r = 255;
          gg = 246 - t * 200;
          b = 210 - t * 600;
        } else if (t < 0.7) {
          r = 255;
          gg = 196 - (t - 0.25) * 220;
          b = 60 - (t - 0.25) * 100;
        } else {
          r = 240 - (t - 0.7) * 180;
          gg = 96 - (t - 0.7) * 160;
          b = 20;
        }
        if (!dark) {
          /* on white, fire is drawn deeper so it reads */
          r *= 0.95;
          gg *= 0.72;
          b *= 0.5;
        }
        const alpha = (1 - t) * (dark ? 0.95 : 0.9);
        ctx.strokeStyle = `rgba(${r | 0},${Math.max(0, gg) | 0},${Math.max(0, b) | 0},${alpha.toFixed(3)})`;
        ctx.lineWidth = s.width * (1 - t * 0.5);
        ctx.beginPath();
        /* a streak a little longer than the frame's travel, so the fountain reads as motion */
        ctx.moveTo(s.x - (s.x - s.px) * 2.2, s.y - (s.y - s.py) * 2.2);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";

      const busy = drag !== null || state === "burning" || sparks.length > 0 || Math.abs(lean) > 0.05;
      if (busy) raf = requestAnimationFrame(frameStep);
      else raf = 0;
    };

    function wake() {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(frameStep);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(resetTimer);
      ro.disconnect();
      diya.removeEventListener("pointerdown", onDown);
      diya.removeEventListener("pointermove", onMove);
      diya.removeEventListener("pointerup", onUp);
      diya.removeEventListener("pointercancel", onUp);
      diya.removeEventListener("keydown", onKey);
      diya.removeEventListener("dragstart", noNative);
      document.documentElement.style.cursor = "";
    };
  }, []);

  return (
    <div ref={rootRef} className="diwali">
      <canvas ref={canvasRef} className="diwali__sparks" aria-hidden="true" />
      {/* the warm pool the anar throws on the ground while it burns */}
      <span className="diwali__floor" aria-hidden="true" />

      {/* the anar: a clay-red flower pot with gold bands and a twist of wick */}
      <div ref={anarRef} className="anar" data-state="ready" aria-hidden="true">
        <svg viewBox="0 0 100 150" className="anar__body">
          <defs>
            <linearGradient id="anar-red" x1="0" x2="1">
              <stop offset="0" stopColor="#8f0d16" />
              <stop offset="0.38" stopColor="#e3202c" />
              <stop offset="0.62" stopColor="#d01722" />
              <stop offset="1" stopColor="#7a0a12" />
            </linearGradient>
            <linearGradient id="anar-gold" x1="0" x2="1">
              <stop offset="0" stopColor="#a8731c" />
              <stop offset="0.45" stopColor="#ffd56a" />
              <stop offset="1" stopColor="#9c6a17" />
            </linearGradient>
          </defs>
          {/* the cone */}
          <path d="M37 22 L63 22 L86 134 L14 134 Z" fill="url(#anar-red)" />
          {/* its gold bands, following the taper */}
          <path d="M33.6 40 L66.4 40 L67.6 46 L32.4 46 Z" fill="url(#anar-gold)" />
          <path d="M25.9 78 L74.1 78 L75.5 85 L24.5 85 Z" fill="url(#anar-gold)" />
          <path d="M18.5 114 L81.5 114 L83 121 L17 121 Z" fill="url(#anar-gold)" />
          {/* stars between the bands */}
          <g fill="#ffe08a">
            <path d="M50 54 l2.2 4.6 5 .7 -3.6 3.5 .9 5 -4.5 -2.4 -4.5 2.4 .9 -5 -3.6 -3.5 5 -.7 Z" />
            <circle cx="36" cy="64" r="1.6" />
            <circle cx="64" cy="64" r="1.6" />
            <path d="M50 92 l2.6 5.4 5.9 .8 -4.3 4.1 1 5.9 -5.2 -2.8 -5.2 2.8 1 -5.9 -4.3 -4.1 5.9 -.8 Z" />
            <circle cx="30" cy="102" r="1.8" />
            <circle cx="70" cy="102" r="1.8" />
          </g>
          {/* a highlight down the cone, so it has a round side */}
          <path d="M42 24 L46 24 L34 132 L27 132 Z" fill="#ffffff" opacity="0.16" />
          {/* the base rim */}
          <rect x="10" y="132" width="80" height="12" rx="3" fill="url(#anar-gold)" />
          <rect x="10" y="132" width="80" height="3" rx="1.5" fill="#fff1c2" opacity="0.5" />
          {/* the cap at the mouth */}
          <ellipse cx="50" cy="22" rx="14" ry="3.6" fill="url(#anar-gold)" />
          <ellipse className="anar__mouth" cx="50" cy="21.4" rx="9" ry="2.2" fill="#3a1206" />
          {/* the wick */}
          <path className="anar__wick" d="M50 21 C48 17 52 14 50 10 C48.6 7.5 50.6 6 50 4" fill="none" stroke="#6b3d12" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        {/* the wick's tip: where a flame must be held, and the ember that grows there */}
        <span ref={wickRef} className="anar__tip" />
        {/* the white-hot mouth while it burns */}
        <span className="anar__fire" />
      </div>

      {/* the diya: a clay lamp with a spout, its oil, and a living flame */}
      <div
        ref={diyaRef}
        className="diya"
        role="button"
        tabIndex={0}
        aria-label="Diya. Drag its flame to the anar to light it, or press Enter."
      >
        <span ref={flameRef} className="diya__flame" aria-hidden="true">
          <span className="diya__halo" />
          <svg viewBox="0 0 40 70" className="diya__fire">
            <defs>
              <radialGradient id="diya-outer" cx="50%" cy="78%" r="70%">
                <stop offset="0" stopColor="#fff6c8" />
                <stop offset="0.35" stopColor="#ffc93a" />
                <stop offset="0.75" stopColor="#ff7a12" />
                <stop offset="1" stopColor="#ff4d00" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="diya-inner" cx="50%" cy="80%" r="60%">
                <stop offset="0" stopColor="#ffffff" />
                <stop offset="0.6" stopColor="#fff0a8" />
                <stop offset="1" stopColor="#ffd34a" stopOpacity="0" />
              </radialGradient>
            </defs>
            <path className="diya__outer" d="M20 2 C27 18 36 30 36 46 C36 58 29 67 20 67 C11 67 4 58 4 46 C4 30 13 18 20 2 Z" fill="url(#diya-outer)" />
            <path className="diya__inner" d="M20 22 C24 32 28 40 28 50 C28 58 24.5 63 20 63 C15.5 63 12 58 12 50 C12 40 16 32 20 22 Z" fill="url(#diya-inner)" />
            <ellipse cx="20" cy="62" rx="4.2" ry="3" fill="#7fb6ff" opacity="0.55" />
          </svg>
        </span>
        <svg viewBox="0 0 200 112" className="diya__lamp" aria-hidden="true">
          <defs>
            <linearGradient id="diya-clay" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e07a2c" />
              <stop offset="0.55" stopColor="#b44d17" />
              <stop offset="1" stopColor="#6b2709" />
            </linearGradient>
            <linearGradient id="diya-rim" x1="0" x2="1">
              <stop offset="0" stopColor="#9a3d10" />
              <stop offset="0.5" stopColor="#f0a052" />
              <stop offset="1" stopColor="#9a3d10" />
            </linearGradient>
            <radialGradient id="diya-oil" cx="30%" cy="40%" r="80%">
              <stop offset="0" stopColor="#ffcf6a" />
              <stop offset="0.35" stopColor="#c27a1c" />
              <stop offset="1" stopColor="#4a1d06" />
            </radialGradient>
          </defs>
          {/* the spout, drawn out to a lip where the wick lies */}
          <path d="M44 44 C30 40 16 34 6 26 C10 38 22 52 44 60 Z" fill="url(#diya-clay)" />
          {/* the bowl */}
          <path d="M30 44 C36 90 172 94 184 44 Z" fill="url(#diya-clay)" />
          {/* its foot */}
          <ellipse cx="107" cy="96" rx="30" ry="6" fill="#5a2006" />
          <path d="M80 88 C88 100 126 100 134 88 Z" fill="#7c300c" />
          {/* the rim and the oil within */}
          <ellipse cx="107" cy="44" rx="77" ry="12" fill="url(#diya-rim)" />
          <ellipse cx="107" cy="45" rx="68" ry="8.5" fill="url(#diya-oil)" />
          {/* the pattern pressed round the bowl */}
          <g fill="none" stroke="#f6c560" strokeWidth="2.2" strokeLinecap="round" opacity="0.9">
            <path d="M48 66 q7 -8 14 0 q7 8 14 0 q7 -8 14 0 q7 8 14 0 q7 -8 14 0 q7 8 14 0 q7 -8 14 0 q7 8 14 0" />
          </g>
          <g fill="#ffd77a">
            <circle cx="62" cy="76" r="2" />
            <circle cx="82" cy="80" r="2" />
            <circle cx="107" cy="82" r="2.2" />
            <circle cx="132" cy="80" r="2" />
            <circle cx="152" cy="76" r="2" />
          </g>
          {/* the wick lying in the spout */}
          <path d="M40 46 C30 42 18 36 10 29" fill="none" stroke="#3b1a07" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>

      <span className="diwali__hint" aria-hidden="true">
        light the anar
      </span>
    </div>
  );
}
