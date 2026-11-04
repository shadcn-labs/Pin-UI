/**
 * The anar's sound, synthesised with the Web Audio API — no files to fetch.
 *
 * A real flower pot is mostly noise: a bright, rushing hiss from the mouth, a
 * soft roar under it, and the dry crackle of sparks popping as they burn out.
 * So everything here is shaped white noise:
 *
 *   catching  — a few faint, quickening crackles while a flame is held at the
 *               wick, the way a fuse spits before it takes
 *   ignite    — the "tssshh" of the fuse catching: a band of noise sweeping up
 *   roar      — the fountain itself: a hiss band and a low rumble, both riding
 *               the burn's strength, with crackles scattered over them
 *   stop      — everything fades with the fire
 *
 * Browsers only allow sound after the visitor has touched the page, so the
 * audio graph is built on the first gesture (picking up the diya, or Enter on
 * it) and never before: a page that is only looked at stays silent. Levels are
 * kept modest — it is a delight on the page, not an alarm.
 */

type Engine = {
  catching: (charge: number, dt: number) => void;
  ignite: () => void;
  roar: (strength: number, dt: number) => void;
  stop: () => void;
  dispose: () => void;
};

const MASTER = 0.55;

export function createAnarSound(): { wake: () => void; engine: () => Engine | null } {
  let ctx: AudioContext | null = null;
  let noise: AudioBuffer | null = null;
  let master: GainNode | null = null;
  let engine: Engine | null = null;

  /* the roar's nodes, alive only while the anar burns */
  let roar: { src: AudioBufferSourceNode; hiss: GainNode; rumble: GainNode } | null = null;

  const build = () => {
    const AC: typeof AudioContext | undefined =
      typeof window !== "undefined" ? window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext : undefined;
    if (!AC) return;
    ctx = new AC();
    /* two seconds of white noise, looped and sliced for every sound */
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    master = ctx.createGain();
    master.gain.value = MASTER;
    /* a gentle limiter, so a burst of pops on the roar never clips */
    const limit = ctx.createDynamicsCompressor();
    limit.threshold.value = -10;
    limit.knee.value = 8;
    limit.ratio.value = 6;
    limit.attack.value = 0.003;
    limit.release.value = 0.12;
    master.connect(limit).connect(ctx.destination);

    /* a single crackle: a few milliseconds of noise through a narrow band, struck and gone */
    const pop = (level: number) => {
      if (!ctx || !noise || !master) return;
      const now = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = 1500 + Math.random() * 5000;
      band.Q.value = 1.4 + Math.random() * 2;
      const amp = ctx.createGain();
      const length = 0.012 + Math.random() * 0.035;
      amp.gain.setValueAtTime(0, now);
      amp.gain.linearRampToValueAtTime(level, now + 0.0015);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + length);
      src.connect(band).connect(amp).connect(master);
      src.start(now, Math.random() * 1.8, length + 0.02);
    };

    engine = {
      catching: (charge, dt) => {
        /* the fuse spits faster and louder as the ember grows */
        if (charge <= 0.02) return;
        if (Math.random() < (4 + charge * 26) * dt) pop(0.05 + charge * 0.12);
      },

      ignite: () => {
        if (!ctx || !noise || !master) return;
        const now = ctx.currentTime;
        /* the catch: a band of noise sweeping up, bright and quick */
        const src = ctx.createBufferSource();
        src.buffer = noise;
        const band = ctx.createBiquadFilter();
        band.type = "bandpass";
        band.Q.value = 0.9;
        band.frequency.setValueAtTime(700, now);
        band.frequency.exponentialRampToValueAtTime(5200, now + 0.38);
        const amp = ctx.createGain();
        amp.gain.setValueAtTime(0, now);
        amp.gain.linearRampToValueAtTime(0.32, now + 0.04);
        amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
        src.connect(band).connect(amp).connect(master);
        src.start(now, 0, 0.7);

        /* and the roar it starts: a hiss band and a low rumble, both silent until the burn lifts them */
        if (roar) return;
        const loop = ctx.createBufferSource();
        loop.buffer = noise;
        loop.loop = true;
        const high = ctx.createBiquadFilter();
        high.type = "highpass";
        high.frequency.value = 1400;
        const air = ctx.createBiquadFilter();
        air.type = "peaking";
        air.frequency.value = 5200;
        air.Q.value = 0.8;
        air.gain.value = 5;
        const hiss = ctx.createGain();
        hiss.gain.value = 0;
        loop.connect(high).connect(air).connect(hiss).connect(master);
        const low = ctx.createBiquadFilter();
        low.type = "lowpass";
        low.frequency.value = 320;
        low.Q.value = 0.6;
        const rumble = ctx.createGain();
        rumble.gain.value = 0;
        loop.connect(low).connect(rumble).connect(master);
        loop.start(now, Math.random() * 1.5);
        roar = { src: loop, hiss, rumble };
      },

      roar: (strength, dt) => {
        if (!ctx || !roar) return;
        const now = ctx.currentTime;
        /* the hiss and the rumble follow the fountain's strength, with a little breath in them */
        const breath = 1 + 0.12 * Math.sin(now * 9) * Math.sin(now * 2.7);
        roar.hiss.gain.setTargetAtTime(strength * 0.2 * breath, now, 0.06);
        roar.rumble.gain.setTargetAtTime(strength * 0.32, now, 0.1);
        /* sparks crackling as they burn out over the top of it */
        if (Math.random() < strength * 34 * dt) pop(0.06 + Math.random() * 0.16 * strength);
      },

      stop: () => {
        if (!ctx || !roar) return;
        const now = ctx.currentTime;
        const { src, hiss, rumble } = roar;
        hiss.gain.setTargetAtTime(0, now, 0.25);
        rumble.gain.setTargetAtTime(0, now, 0.3);
        src.stop(now + 1.6);
        roar = null;
      },

      dispose: () => {
        roar = null;
        void ctx?.close();
        ctx = null;
        engine = null;
      },
    };
  };

  return {
    /* on a gesture: build the graph the first time, and wake it if the browser put it to sleep */
    wake: () => {
      if (!ctx) build();
      if (ctx && ctx.state === "suspended") void ctx.resume();
    },
    engine: () => engine,
  };
}
