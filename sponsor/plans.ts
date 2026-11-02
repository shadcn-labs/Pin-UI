/**
 * The sponsor plans, by key — shared by the /sponsor page (which shows them)
 * and the checkout route (which only accepts these). Nothing secret lives
 * here: which Dodo Payments product each plan sells is server configuration,
 * read in sponsor/server/dodo.ts.
 */
export const SPONSOR_PLANS = ["diamond", "gold", "supporter"] as const;

export type SponsorPlan = (typeof SPONSOR_PLANS)[number];

export function isSponsorPlan(value: unknown): value is SponsorPlan {
  return typeof value === "string" && (SPONSOR_PLANS as readonly string[]).includes(value);
}
