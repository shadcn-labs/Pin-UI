"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createThemeSwitch, type EffectName, type ThemeName, type ThemeSwitchEngine } from "./theme-switch-engine";
import "./theme-switch.css";

/**
 * Theme Switch — a theme toggle with three ways to change the theme.
 *
 * A square button with a moon on the light face and a sun on the dark one,
 * and a segmented control under it that picks how the switch happens:
 *
 *   Droplet — a drop of the next theme falls onto the icon, splashes, and
 *             floods the scene from where it landed
 *   Rain    — a shower of the next theme leaves puddles that spread, merge and
 *             fill the scene, the controls changing as the rain reaches them
 *   Diwali  — rockets of the next theme fly out from behind the toggle, burst,
 *             and the stars bloom into dots until they cover everything, with
 *             a whistle, a boom and a crackle
 *
 * All of it happens inside the component's own box; the physics and the
 * guaranteed-coverage maths live in theme-switch-engine.ts. When a switch
 * lands, `onThemeChange` is called with the new theme, so the button can
 * drive a real theme. A change to `theme` from outside — the page's own switch
 * — lands at once, with no effect.
 */

export type ThemeSwitchProps = {
  /** The theme the scene shows. A change from outside lands at once. */
  theme?: ThemeName;
  /** Called with the new theme once a switch has covered the scene. */
  onThemeChange?: (theme: ThemeName) => void;
  /** Which effect is chosen to begin with. */
  defaultEffect?: EffectName;
  /** Called when another effect is picked. */
  onEffectChange?: (effect: EffectName) => void;
  /** Diwali's whistle, boom and crackle — synthesised, and only ever after a press. */
  sound?: boolean;
  /** Take the container's whole box. Without it the scene is 480px tall with rounded corners. */
  fill?: boolean;
};

const EFFECTS: { value: EffectName; label: string }[] = [
  { value: "droplet", label: "Droplet" },
  { value: "rain", label: "Rain" },
  { value: "diwali", label: "Diwali" },
];

export default function ThemeSwitch({
  theme = "light",
  onThemeChange,
  defaultEffect = "droplet",
  onEffectChange,
  sound = true,
  fill = false,
}: ThemeSwitchProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const fxRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ThemeSwitchEngine | null>(null);
  const [effect, setEffect] = useState<EffectName>(defaultEffect);
  const name = useId();

  /* the engine reads these when it needs them, so they never rebuild it */
  const effectRef = useRef(effect);
  const soundRef = useRef(sound);
  const onThemeChangeRef = useRef(onThemeChange);
  useEffect(() => {
    effectRef.current = effect;
    soundRef.current = sound;
    onThemeChangeRef.current = onThemeChange;
  }, [effect, sound, onThemeChange]);

  useEffect(() => {
    const root = rootRef.current;
    const button = buttonRef.current;
    const fx = fxRef.current;
    if (!root || !button || !fx) return;
    const engine = createThemeSwitch({
      root,
      button,
      fx,
      effect: () => effectRef.current,
      sound: () => soundRef.current,
      onCommit: (next) => onThemeChangeRef.current?.(next),
    });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  /*
   * The scene's theme lives on its root as data-theme, which the engine flips
   * the moment a switch covers it. A theme handed in from outside is written
   * there directly, unless a switch is under way — that one lands on its own.
   */
  useEffect(() => {
    const root = rootRef.current;
    if (!root || engineRef.current?.busy()) return;
    root.dataset.theme = theme;
    buttonRef.current?.setAttribute("aria-label", `Switch to ${theme === "dark" ? "light" : "dark"} theme`);
  }, [theme]);

  /* choosing Diwali warms its plan and the audio device while idle, so the first rocket never stutters */
  useEffect(() => {
    if (effect !== "diwali") return;
    const run = () => engineRef.current?.prepare();
    if (window.requestIdleCallback) {
      const idle = window.requestIdleCallback(run, { timeout: 1500 });
      return () => window.cancelIdleCallback(idle);
    }
    const timer = window.setTimeout(run, 200);
    return () => window.clearTimeout(timer);
  }, [effect]);

  const pick = (value: EffectName) => {
    setEffect(value);
    onEffectChange?.(value);
  };

  return (
    <div
      ref={rootRef}
      className="pts"
      data-theme={theme}
      data-effect={effect}
      data-fill={fill || undefined}
    >
      <div className="pts__stage">
        <button ref={buttonRef} type="button" className="pts__toggle" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>
          {/* the moon, on the light face: press it for dark */}
          <svg className="pts__icon pts__icon--moon" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M20.985 12.486C20.8913 14.2221 20.2967 15.894 19.2731 17.2994C18.2495 18.7048 16.8407 19.7837 15.217 20.4055C13.5934 21.0274 11.8243 21.1656 10.1238 20.8035C8.42322 20.4414 6.86395 19.5945 5.63446 18.3652C4.40497 17.1358 3.55789 15.5766 3.19562 13.8761C2.83334 12.1756 2.97139 10.4065 3.59308 8.78282C4.21476 7.15909 5.29346 5.75019 6.69877 4.72644C8.10409 3.70268 9.77586 3.1079 11.512 3.014C11.917 2.992 12.129 3.474 11.914 3.817C11.1949 4.96755 10.887 6.32787 11.0405 7.67595C11.194 9.02403 11.7999 10.2803 12.7593 11.2397C13.7187 12.1991 14.975 12.805 16.323 12.9585C17.6711 13.112 19.0314 12.8041 20.182 12.085C20.526 11.87 21.007 12.081 20.985 12.486Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {/* the sun, on the dark face: press it for light */}
          <svg className="pts__icon pts__icon--sun" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2V4M12 20V22M4.93 4.93L6.34 6.34M17.66 17.66L19.07 19.07M2 12H4M20 12H22M6.34 17.66L4.93 19.07M19.07 4.93L17.66 6.34" />
            </g>
          </svg>
        </button>

        {/* how the switch happens; it takes the new theme when the flood reaches it */}
        <fieldset className="pts__effects" data-pts-target="">
          <legend className="pts__sr">Theme switch effect</legend>
          <span className="pts__thumb" aria-hidden="true" />
          {EFFECTS.map((option) => (
            <label key={option.value} className="pts__option">
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={effect === option.value}
                onChange={() => pick(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
      </div>

      {/* the drop, its ripples and the rain: over the controls, taking no pointer events */}
      <div ref={fxRef} className="pts__fx" aria-hidden="true" />
    </div>
  );
}
