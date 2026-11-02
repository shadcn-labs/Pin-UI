import type { Metadata } from "next";
import Link from "next/link";
import PageBar from "@/components/PageBar";
import SiteFooter from "@/components/hero/SiteFooter";
import { LINKS } from "@/lib/links";
import "@/app/hero.css";
import "@/app/sections.css";
import "@/components/library/library.css";
import "./sponsor-page.css";

export const metadata: Metadata = {
  title: "Thank you — Pin UI",
  /* a page someone lands on after paying: nothing for a search engine here */
  robots: { index: false, follow: false },
};

/*
 * Where Dodo Payments sends a sponsor back to after the checkout, with a
 * `status` on the address. That status only chooses the words on this page —
 * it is typed into a URL, so anyone can write any value. Whether a sponsorship
 * is real is decided by the signed webhook (sponsor/server/webhook.ts), never here.
 */
const DONE = new Set(["active", "succeeded"]);
const WAITING = new Set(["pending", "processing"]);

export default async function ThanksRoute({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = (await searchParams).status;
  const status = typeof raw === "string" ? raw : "";
  const state = DONE.has(status) ? "done" : WAITING.has(status) ? "waiting" : "failed";

  const copy = {
    done: {
      title: (
        <>
          Thank <span className="sp__accent">you.</span>
        </>
      ),
      lead: "Your sponsorship is in. A receipt is on its way to your email — reply to it with your logo and link, and we'll have you on Pin UI within 48 hours.",
    },
    waiting: {
      title: <>Almost there.</>,
      lead: "Your payment is still processing. You'll get an email the moment it goes through — there's nothing more to do.",
    },
    failed: {
      title: <>That didn&rsquo;t go through.</>,
      lead: "No money was taken. You can try again from the plans, or write to us and we'll sort it out.",
    },
  }[state];

  return (
    <div className="site lib-page sp-page">
      <PageBar />
      <main className="sp sp--thanks" id="top">
        <header className="sp__head">
          <h1 className="sp__title pin-rise">{copy.title}</h1>
          <p className="sp__lead pin-rise" style={{ "--rise-d": "0.06s" } as React.CSSProperties}>
            {copy.lead}
          </p>
          <div className="sp__thanksActions pin-rise" style={{ "--rise-d": "0.12s" } as React.CSSProperties}>
            {state === "failed" ? (
              <Link className="sp__cta" href="/sponsor">
                Back to the plans
              </Link>
            ) : (
              <Link className="sp__cta" href="/">
                Back to Pin UI
              </Link>
            )}
            <a className="sp__thanksMail" href={`mailto:${LINKS.email}`}>
              {LINKS.email}
            </a>
          </div>
        </header>
      </main>
      <SiteFooter />
    </div>
  );
}
