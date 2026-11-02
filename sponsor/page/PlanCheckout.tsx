"use client";

import { useEffect, useState } from "react";
import type { SponsorPlan } from "@/sponsor/plans";

/**
 * A plan's button: a plain form that posts the plan to the checkout route,
 * which answers with a redirect to Dodo Payments. It works without any
 * JavaScript; with it, the button says it is on its way and cannot be pressed
 * twice while the session is being made.
 */
export default function PlanCheckout({ plan, label }: { plan: SponsorPlan; label: string }) {
  const [pending, setPending] = useState(false);

  /* coming back with the browser's back button restores the page from cache: let the button go again */
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => {
      if (e.persisted) setPending(false);
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  return (
    <form
      className="sp__form"
      method="post"
      action="/api/sponsor/checkout"
      onSubmit={(e) => {
        if (pending) e.preventDefault();
        else setPending(true);
      }}
    >
      <input type="hidden" name="plan" value={plan} />
      <button className="sp__cta" type="submit" aria-disabled={pending} data-pending={pending || undefined}>
        {pending ? "Opening checkout…" : label}
      </button>
    </form>
  );
}
