/**
 * Liquid glass for the Reader Card.
 *
 * The optical model follows liquid-glass-studio (iyinchao/liquid-glass-studio):
 *   – a Snell's-law bevel: depth inside the edge → incidence angle → refracted
 *     angle (IOR) → displacement, strongest at the rim and fading inward
 *   – chromatic dispersion: R, G and B sampled with slightly different offsets
 *   – a fresnel rim light and an angled glare with a weaker opposite highlight
 *
 * Instead of a WebGL pass, the bevel is baked into a displacement map that an
 * SVG filter applies to the element's backdrop (`backdrop-filter: url(#…)`),
 * and the light (fresnel + glare) is baked into a transparent overlay image.
 * Chromium renders the full effect; other engines get a frosted fallback with
 * the same baked light. Every instance can be destroyed, leaving the element
 * exactly as it was found.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/* the classes the stylesheet styles the glass and its light by */
const GLASS_CLASS = "prc-lg";
const SHEEN_CLASS = "prc-lg__sheen";

export type GlassOptions = {
  /** px; null reads the element's own border-radius */
  radius: number | null;
  /** refraction bevel depth, px */
  thickness: number;
  /** refraction factor */
  ior: number;
  /** maximum displacement at the rim, px */
  refraction: number;
  /** R and B channel offset spread */
  dispersion: number;
  /** backdrop blur, px */
  blur: number;
  saturate: number;
  fresnel: number;
  fresnelRange: number;
  fresnelHardness: number;
  glare: number;
  glareRange: number;
  glareHardness: number;
  /** degrees; -135 is light from the top left */
  glareAngle: number;
  glareConvergence: number;
  glareOpposite: number;
};

export type Glass = { update: () => void; destroy: () => void };

const DEFAULTS: GlassOptions = {
  radius: null,
  thickness: 16,
  ior: 1.4,
  refraction: 18,
  dispersion: 0.14,
  blur: 1,
  saturate: 1.35,
  fresnel: 0.32,
  fresnelRange: 7,
  fresnelHardness: 1.6,
  glare: 0.85,
  glareRange: 4,
  glareHardness: 1.25,
  glareAngle: -135,
  glareConvergence: 2.2,
  glareOpposite: 0.55,
};

/* read lazily: this module is imported on the server too, where there is no navigator */
let svgBackdrop: boolean | null = null;
function supportsSvgBackdrop(): boolean {
  if (svgBackdrop !== null) return svgBackdrop;
  const brands =
    (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData?.brands?.map(
      (b) => b.brand,
    ) ?? [];
  const chromium = brands.some((b) => /Chromium|Google Chrome|Microsoft Edge/.test(b));
  svgBackdrop = chromium && CSS.supports("backdrop-filter", "url(#x)");
  return svgBackdrop;
}

/* one hidden <svg> holds every instance's filter; it goes when the last one does */
let defs: SVGDefsElement | null = null;
let users = 0;
function acquireDefs(): SVGDefsElement {
  users++;
  if (defs) return defs;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.setAttribute("aria-hidden", "true");
  svg.style.position = "absolute";
  svg.style.pointerEvents = "none";
  defs = document.createElementNS(SVG_NS, "defs");
  svg.appendChild(defs);
  document.body.appendChild(svg);
  return defs;
}
function releaseDefs() {
  users = Math.max(0, users - 1);
  if (users === 0 && defs) {
    defs.ownerSVGElement?.remove();
    defs = null;
  }
}

/* signed distance and outward normal for a rounded rectangle centred at 0 */
function roundedRect(px: number, py: number, hw: number, hh: number, r: number) {
  const qx = Math.abs(px) - (hw - r);
  const qy = Math.abs(py) - (hh - r);
  const sx = Math.sign(px) || 1;
  const sy = Math.sign(py) || 1;
  if (qx > 0 && qy > 0) {
    const l = Math.hypot(qx, qy);
    return { d: l - r, nx: (qx / l) * sx, ny: (qy / l) * sy };
  }
  if (qx > qy) return { d: qx - r, nx: sx, ny: 0 };
  return { d: qy - r, nx: 0, ny: sy };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/* the Snell bevel as an edge factor: 0 at depth ≥ thickness, ~1 at the rim */
function edgeFactor(depth: number, thickness: number, ior: number) {
  if (depth >= thickness) return 0;
  const x = 1 - depth / thickness;
  const thetaI = Math.asin(Math.min(1, x * x));
  const thetaT = Math.asin(Math.sin(thetaI) / ior);
  return -Math.tan(thetaT - thetaI);
}

/* bake the displacement map (optional) and the light overlay, in CSS px */
function bake(w: number, h: number, radius: number, o: GlassOptions, withMap: boolean) {
  const W = Math.max(2, Math.round(w));
  const H = Math.max(2, Math.round(h));
  const r = Math.min(radius, W / 2, H / 2);

  const light = document.createElement("canvas");
  light.width = W;
  light.height = H;
  const lctx = light.getContext("2d")!;
  const L = lctx.createImageData(W, H);

  let disp: HTMLCanvasElement | null = null;
  let D: ImageData | null = null;
  if (withMap) {
    disp = document.createElement("canvas");
    disp.width = W;
    disp.height = H;
    D = disp.getContext("2d")!.createImageData(W, H);
  }

  const maxEF = edgeFactor(0, o.thickness, o.ior) || 1;
  const glareA = (o.glareAngle * Math.PI) / 180;
  /* the light only lives near the rim: skip the deep interior entirely */
  const reach = Math.max(o.fresnelRange, o.glareRange, withMap ? o.thickness : 0) + 1;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const { d, nx, ny } = roundedRect(x + 0.5 - W / 2, y + 0.5 - H / 2, W / 2, H / 2, r);
      const depth = -d; // > 0 inside

      if (D) {
        /* sample inward along the normal, like a convex lens */
        const ef = depth > 0 ? edgeFactor(depth, o.thickness, o.ior) / maxEF : 0;
        D.data[i] = 128 + Math.round(-nx * ef * 127);
        D.data[i + 1] = 128 + Math.round(-ny * ef * 127);
        D.data[i + 2] = 128;
        D.data[i + 3] = 255;
      }

      if (depth > -1 && depth < reach) {
        const aa = clamp01(depth + 0.5); // anti-aliased coverage
        const fres = Math.pow(clamp01(1 - depth / o.fresnelRange), o.fresnelHardness);
        const geo = Math.pow(clamp01(1 - depth / o.glareRange), o.glareHardness);
        const facing = Math.cos(Math.atan2(ny, nx) - glareA); // 1 faces the light
        const side = facing >= 0 ? 1 : o.glareOpposite;
        const g = Math.pow(Math.abs(facing), o.glareConvergence) * side;
        const alpha = clamp01(fres * o.fresnel + geo * g * o.glare) * aa;
        L.data[i] = 255;
        L.data[i + 1] = 255;
        L.data[i + 2] = 255;
        L.data[i + 3] = Math.round(alpha * 255);
      }
    }
  }
  lctx.putImageData(L, 0, 0);
  let map = "";
  if (disp && D) {
    disp.getContext("2d")!.putImageData(D, 0, 0);
    map = disp.toDataURL();
  }
  return { W, H, map, light: light.toDataURL() };
}

let uid = 0;

function addSheen(el: HTMLElement) {
  el.classList.add(GLASS_CLASS);
  const sheen = document.createElement("span");
  sheen.className = SHEEN_CLASS;
  sheen.setAttribute("aria-hidden", "true");
  el.prepend(sheen);
  return sheen;
}

function readRadius(el: HTMLElement, o: GlassOptions) {
  return o.radius ?? (parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0);
}

/**
 * Turn a small floating control into refracting liquid glass. The element
 * needs a position other than static and a border-radius.
 */
export function liquidGlass(el: HTMLElement, options: Partial<GlassOptions> = {}): Glass {
  const o = { ...DEFAULTS, ...options };
  const sheen = addSheen(el);
  const full = supportsSvgBackdrop();

  let filter: SVGFilterElement | null = null;
  let feImage: SVGFEImageElement | null = null;
  let maps: SVGFEDisplacementMapElement[] = [];

  if (full) {
    filter = document.createElementNS(SVG_NS, "filter");
    filter.id = `prc-lg-${++uid}`;
    filter.setAttribute("filterUnits", "userSpaceOnUse");
    filter.setAttribute("primitiveUnits", "userSpaceOnUse");
    filter.setAttribute("color-interpolation-filters", "sRGB");
    filter.innerHTML = `
      <feGaussianBlur in="SourceGraphic" stdDeviation="${o.blur}" result="b"/>
      <feImage x="0" y="0" preserveAspectRatio="none" result="m"/>
      <feDisplacementMap in="b" in2="m" xChannelSelector="R" yChannelSelector="G" result="dr"/>
      <feDisplacementMap in="b" in2="m" xChannelSelector="R" yChannelSelector="G" result="dg"/>
      <feDisplacementMap in="b" in2="m" xChannelSelector="R" yChannelSelector="G" result="db"/>
      <feColorMatrix in="dr" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/>
      <feColorMatrix in="dg" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g"/>
      <feColorMatrix in="db" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="bl"/>
      <feBlend in="r" in2="g" mode="screen" result="rg"/>
      <feBlend in="rg" in2="bl" mode="screen" result="rgb"/>
      <feColorMatrix in="rgb" type="saturate" values="${o.saturate}"/>`;
    acquireDefs().appendChild(filter);
    feImage = filter.querySelector("feImage");
    maps = [...filter.querySelectorAll("feDisplacementMap")];
    const s = o.refraction * 2;
    maps[0].setAttribute("scale", String(s * (1 + o.dispersion)));
    maps[1].setAttribute("scale", String(s));
    maps[2].setAttribute("scale", String(s * (1 - o.dispersion)));
  }

  let lastKey = "";
  function update() {
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (!w || !h) return;
    const radius = readRadius(el, o);
    /* a press squashes the element with a transform, which leaves its box alone; only a real resize re-bakes */
    const key = `${w}x${h}r${radius}`;
    if (key === lastKey) return;
    lastKey = key;
    const { W, H, map, light } = bake(w, h, radius, o, full);
    sheen.style.backgroundImage = `url(${light})`;
    if (filter && feImage) {
      filter.setAttribute("x", "0");
      filter.setAttribute("y", "0");
      filter.setAttribute("width", String(W));
      filter.setAttribute("height", String(H));
      feImage.setAttribute("width", String(W));
      feImage.setAttribute("height", String(H));
      feImage.setAttribute("href", map);
      el.style.backdropFilter = `url(#${filter.id})`;
    } else {
      const frost = `blur(${Math.max(6, o.blur * 3)}px) saturate(${o.saturate + 0.25})`;
      el.style.backdropFilter = frost;
      el.style.setProperty("-webkit-backdrop-filter", frost);
    }
  }

  let raf = 0;
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(update);
  });
  ro.observe(el);
  update();

  return {
    update,
    destroy() {
      ro.disconnect();
      cancelAnimationFrame(raf);
      sheen.remove();
      el.classList.remove(GLASS_CLASS);
      el.style.backdropFilter = "";
      el.style.removeProperty("-webkit-backdrop-filter");
      if (filter) {
        filter.remove();
        releaseDefs();
      }
    },
  };
}

/**
 * Glass for a large reading surface.
 *
 * Over a big panel the backdrop is already heavily blurred, so bevel
 * refraction is imperceptible there while costing a full-panel SVG filter on
 * every scroll frame. The sheet uses the browser's own GPU blur and saturation
 * instead, and keeps the same baked light, the fresnel rim and the angled
 * glare, which is what reads as glass. Its light is re-baked a beat after a
 * resize settles rather than on every frame of it.
 */
export function glassSheet(el: HTMLElement, options: Partial<GlassOptions> = {}): Glass {
  const o = { ...DEFAULTS, ...options };
  const sheen = addSheen(el);
  const frost = `blur(${o.blur}px) saturate(${o.saturate})`;
  el.style.backdropFilter = frost;
  el.style.setProperty("-webkit-backdrop-filter", frost);

  let lastKey = "";
  function update() {
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (!w || !h) return;
    const radius = readRadius(el, o);
    const key = `${w}x${h}r${radius}`;
    if (key === lastKey) return;
    lastKey = key;
    sheen.style.backgroundImage = `url(${bake(w, h, radius, o, false).light})`;
  }

  let timer = 0;
  const ro = new ResizeObserver(() => {
    window.clearTimeout(timer);
    timer = window.setTimeout(update, 140);
  });
  ro.observe(el);
  update();

  return {
    update,
    destroy() {
      ro.disconnect();
      window.clearTimeout(timer);
      sheen.remove();
      el.classList.remove(GLASS_CLASS);
      el.style.backdropFilter = "";
      el.style.removeProperty("-webkit-backdrop-filter");
    },
  };
}
