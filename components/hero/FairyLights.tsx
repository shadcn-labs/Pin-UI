"use client";

import { useEffect, useRef } from "react";
import { usePinTheme } from "@/lib/theme";
import "./fairy-lights.css";

/**
 * Fairy lights strung across the top of a frame — the landing hero and the
 * stage on every component page.
 *
 * Strands of fine wire hang in soft catenary sags from the frame's top edge
 * and sides, crossing over the middle like a canopy, with small bulbs strung
 * along them. In the dark they are lit: each bulb glows from its filament and
 * the halos add up the way real light does. On the light face the lights are
 * off — the same string, the glass tinted and unlit, no glow — and switching
 * the theme fades them down or up like a string being switched.
 *
 * Lit, they power on from the middle out and bulbs near the pointer brighten.
 * A click on the frame that is not a link, a button or anything named in
 * `ignore` (the component on a stage) moves to the next pattern — warm
 * twinkle, a chase, festive colours, Pin UI red and white, an icy breath —
 * sending a ripple of light out from the click while the strands hold still.
 * Drawn on one canvas inside the frame, paused off screen (and, by the
 * browser, in a hidden tab), and still for reduced motion.
 */

type RGB = readonly [number, number, number];

type Mode = {
  name: string;
  palette: readonly RGB[];
  /* each bulb's brightness, 0–1, at time t (s), position s along its strand (px) and index i */
  light: (t: number, s: number, i: number, seed: number) => number;
};

const WARM: RGB[] = [
  [255, 198, 112],
  [255, 214, 146],
  [255, 182, 92],
];

const MODES: Mode[] = [
  {
    name: "Warm twinkle",
    palette: WARM,
    light: (t, _s, _i, seed) => 0.78 + 0.22 * Math.sin(t * (1.3 + seed * 2.2) + seed * 40),
  },
  {
    name: "Chase",
    palette: WARM,
    light: (t, s) => 0.28 + 0.72 * Math.pow(0.5 + 0.5 * Math.sin(s * 0.045 - t * 4.2), 3),
  },
  {
    name: "Festive",
    palette: [
      [255, 74, 74],
      [96, 230, 128],
      [92, 162, 255],
      [255, 204, 92],
      [255, 124, 206],
    ],
    light: (t, _s, _i, seed) => {
      const blink = Math.sin(t * (0.9 + seed * 1.6) + seed * 60);
      return 0.45 + 0.55 * Math.max(0, blink) ** 0.6;
    },
  },
  {
    name: "Pin UI",
    palette: [
      [255, 36, 64],
      [255, 238, 232],
    ],
    /* red and white take turns, as a two-step chaser */
    light: (t, _s, i) => {
      const phase = Math.floor(t * 1.6) % 2;
      return (i % 2 === phase ? 1 : 0.22) * (0.9 + 0.1 * Math.sin(t * 9 + i));
    },
  },
  {
    name: "Icy breath",
    palette: [
      [176, 222, 255],
      [226, 242, 255],
    ],
    light: (t, s) => 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 1.1 - s * 0.006)),
  },
];

/*
 * The strands, in the frame's width (x) and the canopy's height (y): where each
 * hangs from, where it hangs to, and how deep it sags (a share of the canopy).
 * Two swags meet at the top centre, two long diagonals cross under them, one
 * sweeps the width, and a small swag hangs at the very top — the canopy.
 */
const STRANDS: { a: [number, number]; b: [number, number]; sag: number }[] = [
  { a: [-0.02, 0.16], b: [0.5, 0.02], sag: 0.34 },
  { a: [0.5, 0.02], b: [1.02, 0.16], sag: 0.34 },
  { a: [0.2, -0.03], b: [1.02, 0.74], sag: 0.17 },
  { a: [0.8, -0.03], b: [-0.02, 0.74], sag: 0.17 },
  { a: [-0.02, 0.5], b: [1.02, 0.5], sag: 0.3 },
  { a: [0.36, -0.03], b: [0.64, -0.03], sag: 0.42 },
];

/*
 * How far down the deepest strand reaches, as a share of the canopy's height —
 * walked from the strands themselves, so a canopy fitted into a given room
 * keeps every strand inside it.
 */
const DEEPEST = Math.max(
  ...STRANDS.map(({ a, b, sag }) => {
    let deepest = 0;
    for (let j = 0; j <= 40; j++) {
      const u = j / 40;
      deepest = Math.max(deepest, a[1] + (b[1] - a[1]) * u + 4 * u * (1 - u) * sag);
    }
    return deepest;
  }),
);

type Bulb = {
  strand: number;
  /* along the strand, 0–1, and in px from its start */
  u: number;
  s: number;
  seed: number;
  size: number;
  /* the colour it shows now, easing to the mode's */
  r: number;
  g: number;
  b: number;
  /* when it powers on, in s from the start */
  on: number;
  /* where it clips onto the wire */
  x: number;
  y: number;
  /* how it hangs: its angle off straight down, and the centre of its glass */
  angle: number;
  gx: number;
  gy: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/*
 * One bulb's proportions, in px: the socket's height (neck) and width (cap),
 * and the glass's length and width (girth). A mini fairy light is about two
 * and a half times as long as it is wide, its socket a little narrower than
 * the glass.
 */
function shape(size: number, scale: number) {
  const unit = scale * size;
  return {
    neck: 2.6 * unit,
    cap: 3.1 * unit,
    glass: 8.6 * unit,
    girth: 4.8 * unit,
  };
}

/* a soft round halo, drawn once per colour and stamped for every bulb */
function haloSprite(color: RGB): HTMLCanvasElement {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const [r, gg, b] = color;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${r},${gg},${b},0.95)`);
  grad.addColorStop(0.16, `rgba(${r},${gg},${b},0.5)`);
  grad.addColorStop(0.45, `rgba(${r},${gg},${b},0.12)`);
  grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

type FairyLightsProps = {
  /* clicks inside this (a component on a stage) are left to it, not taken as a change of pattern */
  ignore?: string;
  /*
   * The element the lights must keep clear of — a stage's component. The
   * canopy sags only as deep as the room above that element's top edge
   * allows, so no bulb ever hangs over it; the strands keep their full length
   * across the frame and simply hang shallower. Measured again whenever the
   * element or the frame changes size.
   */
  clear?: string;
  /* the deepest the canopy may hang, as a share of the frame's height (a scene that fills the frame) */
  band?: number;
  /* drawn over the frame's content instead of under it (a scene that fills the frame) */
  over?: boolean;
};

export default function FairyLights({ ignore, clear, band, over }: FairyLightsProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = usePinTheme();
  const themeRef = useRef(theme);
  /* the drawing reads the theme from here; a change redraws at once, moving or still */
  const redrawRef = useRef<() => void>(() => {});
  useEffect(() => {
    themeRef.current = theme;
    redrawRef.current();
  }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !frame || !ctx) return;

    const still = matchMedia("(prefers-reduced-motion: reduce)");
    let w = 0;
    let h = 0;
    let dpr = 1;
    let canopy = 0;
    let bulbs: Bulb[] = [];
    /* each strand's swing: a displacement and its velocity, on a damped spring */
    const swing = STRANDS.map(() => ({ d: 0, v: 0 }));
    let mode = 0;
    let ripple: { x: number; y: number; t: number } | null = null;
    let pointer: { x: number; y: number } | null = null;
    let raf = 0;
    let last = 0;
    let t = 0;
    /* how lit the string is: 1 in the dark, 0 on the light face, easing between on a switch */
    let glow = themeRef.current === "light" ? 0 : 1;
    const halos = new Map<string, HTMLCanvasElement>();
    const halo = (r: number, g: number, b: number) => {
      /* colours are quantised so a cross-fade between modes reuses a handful of sprites */
      const q = (v: number) => Math.round(v / 16) * 16;
      const key = `${q(r)},${q(g)},${q(b)}`;
      let sprite = halos.get(key);
      if (!sprite) {
        sprite = haloSprite([q(r), q(g), q(b)]);
        halos.set(key, sprite);
      }
      return sprite;
    };

    /* where a strand is at u (0–1), sagging and swinging */
    const at = (k: number, u: number) => {
      const { a, b, sag } = STRANDS[k];
      const ax = a[0] * w;
      const ay = a[1] * canopy;
      const bx = b[0] * w;
      const by = b[1] * canopy;
      const bow = 4 * u * (1 - u);
      const sw = swing[k].d;
      return {
        x: ax + (bx - ax) * u + sw * bow * canopy * 0.06,
        y: ay + (by - ay) * u + bow * canopy * sag * (1 + sw * 0.35),
      };
    };

    const layout = () => {
      w = frame.clientWidth;
      h = frame.clientHeight;
      if (!w || !h) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      /* the canopy hangs over the top of the frame */
      canopy = Math.min(h * (band ?? 0.42), w * 0.62);
      const spacing = clamp(w / 46, 20, 32);
      /*
       * Kept clear of the element below: the room is its top edge less a
       * margin and the length of the longest bulb hanging from the wire, and
       * the canopy is made shallow enough that its deepest strand fits.
       */
      if (clear) {
        const target = frame.querySelector(clear);
        if (target) {
          const box = target.getBoundingClientRect();
          const top = box.top - frame.getBoundingClientRect().top;
          const scaleNow = clamp(w / 1280, 0.7, 1.25);
          const { neck, glass } = shape(1.75, scaleNow);
          const room = top - 18 - neck - glass;
          canopy = Math.min(canopy, Math.max(0, room / DEEPEST));
        }
      }
      /* no room for a canopy worth the name: no lights, rather than a crushed string */
      if (canopy < 36) {
        bulbs = [];
        draw(0);
        return;
      }
      const next: Bulb[] = [];
      STRANDS.forEach((_, k) => {
        /* the strand's length, walked in small steps, sets how many bulbs it carries */
        let len = 0;
        let prev = at(k, 0);
        for (let j = 1; j <= 40; j++) {
          const p = at(k, j / 40);
          len += Math.hypot(p.x - prev.x, p.y - prev.y);
          prev = p;
        }
        const n = Math.max(4, Math.round(len / spacing));
        for (let i = 0; i <= n; i++) {
          const u = i / n;
          const p = at(k, u);
          const seed = (Math.sin((k + 1) * 97.13 + i * 12.9898) * 43758.5453) % 1;
          const s = Math.abs(seed);
          /* power on from the top centre outwards */
          const fromMiddle = Math.hypot(p.x - w / 2, p.y);
          next.push({
            strand: k,
            u,
            s: u * len,
            seed: s,
            /*
             * About one bulb in four is a big soft one — nearer the eye, its
             * glow a wide bokeh — among finer pin-points, which is what gives
             * a real string of lights its depth.
             */
            size: s > 0.74 ? 1.3 + (s - 0.74) * 1.6 : 0.82 + s * 0.3,
            r: 255,
            g: 200,
            b: 120,
            on: 0.35 + fromMiddle / 1400 + s * 0.12,
            x: p.x,
            y: p.y,
            angle: 0,
            gx: p.x,
            gy: p.y,
          });
        }
      });
      /* a re-layout keeps the colours the bulbs already had */
      bulbs = next.map((bulb, i) => (bulbs[i] ? { ...bulb, r: bulbs[i].r, g: bulbs[i].g, b: bulbs[i].b } : bulb));
      draw(0);
    };

    const draw = (dt: number) => {
      if (!w || !h) return;
      const dark = themeRef.current !== "light";
      /* a switch of theme fades the string down or up; a still frame lands on it at once */
      const target = dark ? 1 : 0;
      glow = dt > 0 ? glow + (target - glow) * (1 - Math.exp(-dt * 5)) : target;
      const m = MODES[mode];
      const scale = clamp(w / 1280, 0.7, 1.25);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      /* the swing: a damped spring per strand, with a slow idle sway under it */
      for (let k = 0; k < swing.length; k++) {
        const s = swing[k];
        s.v += (-26 * s.d - 3.2 * s.v) * dt;
        s.d += s.v * dt;
      }
      const idle = still.matches ? 0 : 1;

      /* the wire */
      ctx.lineWidth = Math.max(0.6, 0.85 * scale);
      ctx.strokeStyle = dark ? "rgba(255, 228, 192, 0.16)" : "rgba(52, 36, 22, 0.32)";
      for (let k = 0; k < STRANDS.length; k++) {
        const sway = idle * 0.05 * Math.sin(t * 0.7 + k * 1.7);
        const keep = swing[k].d;
        swing[k].d += sway;
        ctx.beginPath();
        for (let j = 0; j <= 48; j++) {
          const p = at(k, j / 48);
          if (j === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        for (const bulb of bulbs) {
          if (bulb.strand !== k) continue;
          const p = at(k, bulb.u);
          bulb.x = p.x;
          bulb.y = p.y;
          /*
           * Each bulb hangs from its clip at its own small angle off straight
           * down, as a real string never hangs quite true, and swings with
           * its strand. Its glow sits on the glass, not on the wire.
           */
          bulb.angle = (bulb.seed - 0.5) * 0.8 + swing[k].d * 0.45;
          const { neck, glass } = shape(bulb.size, scale);
          const reach = neck + glass * 0.5;
          bulb.gx = p.x - Math.sin(bulb.angle) * reach;
          bulb.gy = p.y + Math.cos(bulb.angle) * reach;
        }
        swing[k].d = keep;
      }

      /* the bulbs: halos first, added together in the dark, then the cores over them */
      const ease = 1 - Math.exp(-dt * 6);
      ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
      const lit: number[] = [];
      for (let i = 0; i < bulbs.length; i++) {
        const bulb = bulbs[i];
        const target = m.palette[i % m.palette.length];
        bulb.r += (target[0] - bulb.r) * ease;
        bulb.g += (target[1] - bulb.g) * ease;
        bulb.b += (target[2] - bulb.b) * ease;

        let level = clamp(m.light(t, bulb.s, i, bulb.seed), 0, 1);
        /* powering on: a quick flick up rather than a fade */
        const power = clamp((t - bulb.on) / 0.18, 0, 1);
        level *= power * power;
        /* the ripple from a click: a ring of light running out across the canopy */
        if (ripple) {
          const age = t - ripple.t;
          const d = Math.hypot(bulb.x - ripple.x, bulb.y - ripple.y);
          const ring = d - age * 900;
          level += Math.exp(-(ring * ring) / (2 * 70 * 70)) * Math.max(0, 1 - age / 1.4);
        }
        /* the pointer warms the bulbs around it */
        if (pointer) {
          const d = Math.hypot(bulb.x - pointer.x, bulb.y - pointer.y);
          level += Math.max(0, 1 - d / 110) * 0.55;
        }
        /* off on the light face: nothing glows, the click and the pointer included */
        level = clamp(level * glow, 0, 1.4);
        lit.push(level);
        if (level < 0.02) continue;

        const radius = (dark ? 16 : 12) * scale * bulb.size * (0.55 + 0.45 * level);
        ctx.globalAlpha = clamp(level * (dark ? 0.95 : 0.5), 0, 1);
        ctx.drawImage(halo(bulb.r, bulb.g, bulb.b), bulb.gx - radius, bulb.gy - radius, radius * 2, radius * 2);
      }
      if (ripple && t - ripple.t > 1.6) ripple = null;

      /*
       * The bulbs, each a small mini fairy light: a dark socket clipped to
       * the wire, and under it a glass bulb — a narrow neck, a fuller body, a
       * rounded tip. The glass is always there, tinted; lit, a hot core
       * glows inside it from the filament outward, and a fine highlight runs
       * down one side so it reads as glass rather than a dot.
       */
      ctx.globalCompositeOperation = "source-over";
      for (let i = 0; i < bulbs.length; i++) {
        const bulb = bulbs[i];
        const level = Math.min(lit[i], 1);
        const { neck, glass, girth, cap } = shape(bulb.size, scale);

        ctx.save();
        ctx.translate(bulb.x, bulb.y);
        ctx.rotate(bulb.angle);

        /* the socket */
        ctx.globalAlpha = dark ? 0.9 : 1;
        ctx.fillStyle = dark ? "rgb(46, 40, 34)" : "rgb(58, 44, 32)";
        ctx.beginPath();
        ctx.roundRect(-cap / 2, -neck * 0.15, cap, neck * 1.1, Math.min(cap, neck) * 0.3);
        ctx.fill();

        /* the glass: neck, body, tip */
        const top = neck * 0.9;
        const half = girth / 2;
        ctx.beginPath();
        ctx.moveTo(-cap * 0.42, top);
        ctx.bezierCurveTo(-half * 1.05, top + glass * 0.22, -half * 0.9, top + glass * 0.82, 0, top + glass);
        ctx.bezierCurveTo(half * 0.9, top + glass * 0.82, half * 1.05, top + glass * 0.22, cap * 0.42, top);
        ctx.closePath();

        /* unlit, it is tinted glass; lit, the colour comes up full and runs toward white at the core */
        const white = clamp(level - 0.3, 0, 1) * (dark ? 0.7 : 0.35);
        const deep = dark ? 1 : 0.88;
        const r = Math.round((bulb.r + (255 - bulb.r) * white) * deep);
        const g = Math.round((bulb.g + (255 - bulb.g) * white) * deep);
        const b = Math.round((bulb.b + (255 - bulb.b) * white) * deep);
        const body = ctx.createLinearGradient(0, top, 0, top + glass);
        body.addColorStop(0, `rgba(${r},${g},${b},${0.55 + 0.45 * level})`);
        body.addColorStop(1, `rgba(${Math.round(r * 0.82)},${Math.round(g * 0.8)},${Math.round(b * 0.8)},${0.5 + 0.5 * level})`);
        ctx.globalAlpha = dark ? 0.35 + 0.65 * level : 0.7 + 0.3 * level;
        ctx.fillStyle = body;
        ctx.fill();

        /* the filament's glow, hottest a third of the way down the glass */
        if (level > 0.05) {
          const cy = top + glass * 0.42;
          const core = ctx.createRadialGradient(0, cy, 0, 0, cy, girth * 0.75);
          core.addColorStop(0, `rgba(255,252,240,${0.95 * level})`);
          core.addColorStop(0.45, `rgba(${r},${g},${b},${0.55 * level})`);
          core.addColorStop(1, `rgba(${r},${g},${b},0)`);
          ctx.globalAlpha = 1;
          ctx.fillStyle = core;
          ctx.fill();
        }

        /* the glint down one side of the glass */
        ctx.globalAlpha = dark ? 0.35 + 0.35 * level : 0.75;
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath();
        ctx.ellipse(-half * 0.38, top + glass * 0.36, Math.max(0.35, half * 0.16), glass * 0.2, 0.12, 0, Math.PI * 2);
        ctx.fill();

        /* on white, a fine edge so the glass holds its shape against the paper */
        if (!dark) {
          ctx.globalAlpha = 0.35;
          ctx.lineWidth = 0.6;
          ctx.strokeStyle = "rgb(90, 56, 30)";
          ctx.beginPath();
          ctx.moveTo(-cap * 0.42, top);
          ctx.bezierCurveTo(-half * 1.05, top + glass * 0.22, -half * 0.9, top + glass * 0.82, 0, top + glass);
          ctx.bezierCurveTo(half * 0.9, top + glass * 0.82, half * 1.05, top + glass * 0.22, cap * 0.42, top);
          ctx.stroke();
        }

        ctx.restore();
      }
      ctx.globalAlpha = 1;
    };

    /*
     * The loop asks each frame whether the hero is in view, rather than
     * waiting to be told: a measurement is cheap, and an observer that misses
     * its "back in view" (a window restored, a viewport that read 0 for a
     * moment) can never leave the lights stuck dark. Out of view it draws
     * nothing and lets time stand still.
     */
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const box = frame.getBoundingClientRect();
      if (box.bottom <= 0 || box.top >= window.innerHeight) return;
      t += dt;
      draw(dt);
    };

    /* running unless motion is reduced; a hidden tab is held by the browser itself */
    const sync = () => {
      const run = !still.matches;
      if (run && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      } else if (!run && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      /* held still: every bulb lit, drawn once */
      if (still.matches) {
        t = Math.max(t, 5);
        draw(0);
      }
    };

    /* a click on the hero itself — not on its links or buttons — moves to the next pattern */
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target?.closest("a, button, input, textarea, select, label, [role='button'], [role='link']")) return;
      /* on a stage, clicks on the component are the component's own */
      if (ignore && target?.closest(ignore)) return;
      const box = frame.getBoundingClientRect();
      const x = e.clientX - box.left;
      const y = e.clientY - box.top;
      mode = (mode + 1) % MODES.length;
      ripple = { x, y, t };
      /* the lights change; the strands stay where they hang — a click is not a shove */
      frame.dataset.lights = MODES[mode].name;
      if (still.matches) draw(0);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const box = frame.getBoundingClientRect();
      pointer = { x: e.clientX - box.left, y: e.clientY - box.top };
    };
    const onLeave = () => {
      pointer = null;
    };

    /* a theme switch while running is left to the loop, so the string fades; held still, it redraws at once */
    redrawRef.current = () => {
      if (!raf) draw(0);
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(frame);
    /* the element kept clear of can change size on its own (it opens, it reflows): measure again when it does */
    const watched = clear ? frame.querySelector(clear) : null;
    if (watched) ro.observe(watched);
    frame.addEventListener("click", onClick);
    frame.addEventListener("pointermove", onMove);
    frame.addEventListener("pointerleave", onLeave);
    still.addEventListener("change", sync);
    sync();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      frame.removeEventListener("click", onClick);
      frame.removeEventListener("pointermove", onMove);
      frame.removeEventListener("pointerleave", onLeave);
      still.removeEventListener("change", sync);
      redrawRef.current = () => {};
    };
  }, [ignore, clear, band]);

  return <canvas ref={canvasRef} className={`flights${over ? " flights--over" : ""}`} aria-hidden="true" />;
}
