import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SPONSOR_ENABLED } from "@/sponsor/config";
import ThanksRoute, { metadata as thanksMetadata } from "@/sponsor/page/ThanksRoute";

/* /sponsor/thanks — the page lives in sponsor/page; this only answers to the switch (sponsor/config.ts) */
export const metadata: Metadata = SPONSOR_ENABLED ? thanksMetadata : {};

export default function Page(props: Parameters<typeof ThanksRoute>[0]) {
  if (!SPONSOR_ENABLED) notFound();
  return <ThanksRoute {...props} />;
}
