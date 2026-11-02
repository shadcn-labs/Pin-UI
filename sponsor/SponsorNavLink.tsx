import Link from "next/link";
import { SPONSOR_ENABLED } from "./config";

/** The phone menu's entry for the sponsor page — added to its list only while sponsoring is on. */
export const SPONSOR_PLACE = {
  label: "Sponsor",
  href: "/sponsor",
  match: (p: string) => p.startsWith("/sponsor"),
};

/**
 * The "Sponsor" link in a navbar or footer. Each bar passes its own link
 * class, so it sits in the row like the links beside it; while sponsoring is
 * switched off (config.ts) it renders nothing at all.
 */
export default function SponsorNavLink({ className }: { className: string }) {
  if (!SPONSOR_ENABLED) return null;
  return (
    <Link className={className} href="/sponsor">
      Sponsor
    </Link>
  );
}
