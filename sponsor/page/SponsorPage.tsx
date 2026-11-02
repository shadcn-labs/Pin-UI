import type React from "react";
import PageBar from "@/components/PageBar";
import SiteFooter from "@/components/hero/SiteFooter";
import PlanCheckout from "./PlanCheckout";
import { LINKS } from "@/lib/links";
import type { SponsorPlan } from "@/sponsor/plans";
import glow from "@/sponsor/assets/glow.webp";
import "@/components/library/library.css";
import "./sponsor-page.css";

/**
 * /sponsor — "Back the Vision." (Figma 562:43).
 *
 * Three plans side by side: Diamond in the brand's red, running down into
 * blush, and Gold and Supporter on charcoal with a red glow under their
 * buttons. The landing's sponsor boxes and the Sponsor link in every nav
 * point here; a box lands on its own plan.
 */

type Plan = {
  key: SponsorPlan;
  name: string;
  /* the price, or the plan's name set as large where there is no fixed price */
  big: string;
  per?: string;
  note?: string;
  perks: string[];
  cta: string;
};

const PLANS: Plan[] = [
  {
    key: "diamond",
    name: "Diamond",
    big: "$67",
    per: "/Month",
    perks: [
      "Featured logo on the Pin UI website",
      "Priority placement on the Sponsors page",
      "Featured recognition in the GitHub README",
      "Dedicated shoutout on X",
      "Direct channel for feedback and collaboration",
    ],
    cta: "Sponsor as Diamond",
  },
  {
    key: "gold",
    name: "Gold",
    big: "$24",
    per: "/Month",
    perks: [
      "Logo featured on the Sponsors page",
      "Recognition in the GitHub README",
      "Mention in Pin UI community updates",
      "Dedicated shoutout on X",
    ],
    cta: "Sponsor as Gold",
  },
  {
    key: "supporter",
    name: "Support",
    note: "Contribute $5–$20 to Pin UI",
    big: "Supporter",
    perks: [
      "Listed on the Pin UI Supporters page",
      "Help shape the future of Pin UI",
      "Support independent open-source development",
      "Dedicated shoutout on X",
    ],
    cta: "Become a supporter",
  },
];

/* what the page says when it is sent back here instead of to the checkout */
const NOTICES = {
  unavailable: "Checkout isn't open yet. Please try again soon, or write to us at ",
  error: "We couldn't open the checkout just now. Please try again, or write to us at ",
  busy: "Too many tries in a row. Wait a minute and try again, or write to us at ",
} as const;

export type CheckoutNotice = keyof typeof NOTICES;

function Check() {
  return (
    <svg className="sp__check" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path d="M13.3333 4L6 11.3333L2.66667 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function SponsorPage({ notice }: { notice?: CheckoutNotice | null }) {
  return (
    <div className="site lib-page sp-page">
      <PageBar />

      <main className="sp" id="top">
        <header className="sp__head">
          <h1 className="sp__title pin-rise">
            Back the <span className="sp__accent">Vision.</span>
          </h1>
          <p className="sp__lead pin-rise" style={{ "--rise-d": "0.06s" } as React.CSSProperties}>
            Help us build what&rsquo;s next. Your support fuels new blocks, Components and everything
          </p>
        </header>

        {notice && (
          <p className="sp__notice" role="alert">
            {NOTICES[notice]}
            <a href={`mailto:${LINKS.email}`}>{LINKS.email}</a>.
          </p>
        )}

        <ul className="sp__plans">
          {PLANS.map((plan, i) => (
            <li
              key={plan.key}
              id={plan.key}
              className={`sp__plan sp__plan--${plan.key} pin-rise`}
              style={{ "--rise-d": `${0.12 + i * 0.06}s` } as React.CSSProperties}
            >
              {plan.key !== "diamond" && (
                <img className="sp__glow" src={glow.src} alt="" width={732} height={190} loading="lazy" decoding="async" />
              )}

              <div className="sp__top">
                <h2 className="sp__name">
                  {plan.name}
                  {plan.note && <span className="sp__note">{plan.note}</span>}
                </h2>

                <p className={`sp__big${plan.per ? "" : " sp__big--word"}`}>
                  {plan.big}
                  {plan.per && <span className="sp__per">{plan.per}</span>}
                </p>
              </div>

              <hr className="sp__rule" />

              <ul className="sp__perks">
                {plan.perks.map((perk) => (
                  <li key={perk}>
                    <Check />
                    {perk}
                  </li>
                ))}
              </ul>

              <PlanCheckout plan={plan.key} label={plan.cta} />
            </li>
          ))}
        </ul>
      </main>

      <SiteFooter />
    </div>
  );
}
