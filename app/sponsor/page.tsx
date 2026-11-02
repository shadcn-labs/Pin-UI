import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SPONSOR_ENABLED } from "@/sponsor/config";
import SponsorRoute, { metadata as sponsorMetadata } from "@/sponsor/page/SponsorRoute";

/* /sponsor — the page itself lives in sponsor/page; this only answers to the switch (sponsor/config.ts) */
export const metadata: Metadata = SPONSOR_ENABLED ? sponsorMetadata : {};

export default function Page(props: Parameters<typeof SponsorRoute>[0]) {
  if (!SPONSOR_ENABLED) notFound();
  return <SponsorRoute {...props} />;
}
