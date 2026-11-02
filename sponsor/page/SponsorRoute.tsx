import type { Metadata } from "next";
import SponsorPage, { type CheckoutNotice } from "./SponsorPage";
import "@/app/hero.css";
import "@/app/sections.css";

export const metadata: Metadata = {
  title: "Sponsor — Pin UI",
  description:
    "Back Pin UI: sponsor as Diamond or Gold, or chip in as a supporter, and help fund new open-source blocks and components.",
  alternates: { canonical: "/sponsor" },
};

const NOTICES: readonly CheckoutNotice[] = ["unavailable", "error", "busy"];

/**
 * The sponsor plans — where the landing page's sponsor boxes go. The checkout
 * route sends a visitor back here with `?checkout=…` when it cannot open
 * Dodo's checkout, and the page says why.
 */
export default async function SponsorRoute({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const value = (await searchParams).checkout;
  const notice = NOTICES.find((n) => n === value) ?? null;
  return <SponsorPage notice={notice} />;
}
