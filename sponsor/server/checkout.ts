import { NextResponse } from "next/server";
import "server-only";
import { dodo, isDodoCheckoutUrl, productFor } from "./dodo";
import { isSponsorPlan } from "../plans";
import { SITE_URL } from "@/lib/site";

/*
 * Starts a sponsorship: the plan buttons on /sponsor are plain forms that post
 * their plan here, and the answer is a redirect to Dodo Payments' hosted
 * checkout. Card details are only ever typed on Dodo's page — none of them
 * touch this site.
 *
 * The browser sends nothing but a plan key. Which product (and so which
 * price) that buys is looked up here, from server configuration, so a
 * tampered form can at worst ask for a different one of the three plans.
 */
/** Where to send the visitor back to: this deployment in development, the real site everywhere else. */
function siteOrigin(request: Request): string {
  if (process.env.NODE_ENV !== "production") return new URL(request.url).origin;
  return new URL(SITE_URL).origin;
}

/*
 * Only this site's own pages may start a checkout. A form posted from
 * anywhere else is refused, so another page cannot open sessions in our name.
 */
function fromThisSite(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return origin === new URL(request.url).origin || origin === new URL(SITE_URL).origin;
}

/*
 * A light brake on scripts: a few checkouts a minute from one address is
 * plenty for a person. In memory, so it is per server instance — Dodo's own
 * limits stand behind it.
 */
const WINDOW_MS = 60_000;
const LIMIT = 8;
const recent = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  recent.set(ip, hits);
  if (recent.size > 5_000) recent.clear();
  return hits.length > LIMIT;
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

/** Back to the plans, with a note the page shows: why the checkout did not open. */
function backToPlans(origin: string, reason: "unavailable" | "error" | "busy", plan?: string) {
  const url = new URL("/sponsor", origin);
  url.searchParams.set("checkout", reason);
  if (plan) url.hash = plan;
  return NextResponse.redirect(url, { status: 303, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const origin = siteOrigin(request);

  if (!fromThisSite(request)) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  let plan: FormDataEntryValue | null = null;
  try {
    plan = (await request.formData()).get("plan");
  } catch {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }
  if (!isSponsorPlan(plan)) {
    return NextResponse.json({ message: "Unknown plan." }, { status: 400 });
  }

  if (rateLimited(clientIp(request))) return backToPlans(origin, "busy", plan);

  const client = dodo();
  const productId = productFor(plan);
  if (!client || !productId) {
    console.error(`[sponsor] checkout for "${plan}" is not configured — set DODO_PAYMENTS_API_KEY and its product id`);
    return backToPlans(origin, "unavailable", plan);
  }

  try {
    const session = await client.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      return_url: new URL("/sponsor/thanks", origin).toString(),
      cancel_url: new URL(`/sponsor#${plan}`, origin).toString(),
      /* carried onto the subscription and back in every webhook, so an event always names its plan */
      metadata: { plan, source: "pinui.xyz/sponsor" },
    });

    if (!isDodoCheckoutUrl(session.checkout_url)) {
      console.error("[sponsor] checkout session came back without a Dodo checkout URL", session.session_id);
      return backToPlans(origin, "error", plan);
    }

    return NextResponse.redirect(session.checkout_url, {
      status: 303,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    /* the SDK's error carries the status and Dodo's message; never the key */
    console.error("[sponsor] could not create a checkout session", error);
    return backToPlans(origin, "error", plan);
  }
}
