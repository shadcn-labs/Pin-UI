"use client";

import { useEffect, useRef } from "react";

/*
 * The banner's dither, alive — the design's shader (Bayer 16 × 16, 6 levels a
 * channel, 2px cells) run over the brand red, with the red's brightness swayed
 * by a few slow waves. The threshold matrix stays still while the light moves
 * through it, so the pixels shimmer and flow across the bar the way an
 * animated dither does.
 *
 * Drawn on the CPU at one canvas pixel per 2px cell (a 1280 bar is 640 × 50 —
 * 32k pixels), about 30 times a second, and only while the bar is on screen
 * and the tab is open. With reduced motion it draws one frame and stops. Until
 * the first frame lands, the banner's own tiled still (shadcn-labs.css) shows.
 */

const CELL = 2;
const LEVELS = 5; /* 6 levels a channel: 0, 1/5 … 1 */
const FRAME_MS = 1000 / 30;
/* the brand red, #e60024, as the shader reads it */
const BASE_R = 230 / 255;
const BASE_B = 36 / 255;

/* the Bayer 16 × 16 thresholds, as (n + 0.5) / 256 */
const BAYER = (() => {
  let m = [[0]];
  for (let size = 1; size < 16; size *= 2) {
    const next: number[][] = Array.from({ length: size * 2 }, () => new Array(size * 2).fill(0));
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const v = m[y][x] * 4;
        next[y][x] = v;
        next[y][x + size] = v + 2;
        next[y + size][x] = v + 3;
        next[y + size][x + size] = v + 1;
      }
    m = next;
  }
  const out = new Float32Array(256);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) out[y * 16 + x] = (m[y][x] + 0.5) / 256;
  return out;
})();

export default function DitherBanner() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement;
    const ctx = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !host || !ctx) return;

    const still = matchMedia("(prefers-reduced-motion: reduce)");
    let image: ImageData | null = null;
    let w = 0;
    let h = 0;
    let raf = 0;
    let last = 0;
    let onScreen = true;
    let drawn = false;
    /* the time the waves have run — kept across pauses so a resume carries on, not jumps */
    let t = 0;

    const draw = (time: number) => {
      if (!image) return;
      const px = image.data;
      /* the waves: one long swell rolling right, a cross wave rolling left, a slow breath */
      for (let y = 0; y < h; y++) {
        const row = (y & 15) * 16;
        const wy = Math.sin(y * 0.19 - time * 0.7);
        for (let x = 0; x < w; x++) {
          const swell =
            Math.sin(x * 0.034 - time * 1.1 + wy * 0.9) * 0.6 +
            Math.sin((x * 0.6 + y * 2.2) * 0.05 + time * 0.8) * 0.4;
          /* the light: the red between 80% and 112% of itself */
          const k = 0.96 + swell * 0.16;
          const th = BAYER[row + (x & 15)];
          const r = Math.min(LEVELS, Math.floor(BASE_R * k * LEVELS + th));
          const b = Math.min(LEVELS, Math.floor(BASE_B * k * LEVELS + th));
          const i = (y * w + x) * 4;
          px[i] = (r * 255) / LEVELS;
          px[i + 1] = 0;
          px[i + 2] = (b * 255) / LEVELS;
          px[i + 3] = 255;
        }
      }
      ctx.putImageData(image, 0, 0);
      if (!drawn) {
        drawn = true;
        canvas.dataset.ready = "";
      }
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = now - last;
      if (dt < FRAME_MS) return;
      /* a long gap (a dropped tab, a stall) moves the waves on by one frame, not by the gap */
      t += Math.min(dt, FRAME_MS * 2) / 1000;
      last = now;
      draw(t);
    };

    const sync = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      if (still.matches) {
        draw(t);
        return;
      }
      if (onScreen && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };

    /* one canvas pixel per cell, the canvas set to exactly twice that — no fractional scaling, so every cell stays square */
    const size = () => {
      const nw = Math.max(1, Math.ceil(host.clientWidth / CELL));
      const nh = Math.max(1, Math.ceil(host.clientHeight / CELL));
      if (nw === w && nh === h) return;
      w = nw;
      h = nh;
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = `${w * CELL}px`;
      canvas.style.height = `${h * CELL}px`;
      image = ctx.createImageData(w, h);
      draw(t);
    };

    size();
    const ro = new ResizeObserver(size);
    ro.observe(host);
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      sync();
    });
    io.observe(host);
    document.addEventListener("visibilitychange", sync);
    still.addEventListener("change", sync);
    sync();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
      still.removeEventListener("change", sync);
    };
  }, []);

  return <canvas ref={ref} className="labs__dither" aria-hidden="true" />;
}
