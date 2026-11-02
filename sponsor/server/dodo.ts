import "server-only";
import DodoPayments from "dodopayments";
import type { SponsorPlan } from "../plans";

/**
 * Dodo Payments, on the server only.
 *
 * The API key and the webhook secret never leave the server: `server-only`
 * makes importing this file from a client component a build error, and none
 * of the variables below carry a NEXT_PUBLIC_ prefix, so Next never inlines
 * them into the browser bundle.
 *
 * The environment defaults to test mode. Live mode has to be asked for by
 * name, so a missing or misspelt variable can never take real money.
 */

type DodoEnvironment = "test_mode" | "live_mode";

export function dodoEnvironment(): DodoEnvironment {
  return process.env.DODO_PAYMENTS_ENVIRONMENT?.trim() === "live_mode" ? "live_mode" : "test_mode";
}

let client: DodoPayments | null = null;

/** The API client, or null when no key is configured (the page then says checkout is unavailable). */
export function dodo(): DodoPayments | null {
  const bearerToken = process.env.DODO_PAYMENTS_API_KEY?.trim();
  if (!bearerToken) return null;

  client ??= new DodoPayments({
    bearerToken,
    webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim() || null,
    environment: dodoEnvironment(),
    /* a stuck call should fail the redirect quickly rather than hang the visitor */
    timeout: 15_000,
    maxRetries: 1,
  });
  return client;
}

/* each plan sells one product, created in the Dodo dashboard and named here by id */
const PRODUCT_ENV: Record<SponsorPlan, string> = {
  diamond: "DODO_PRODUCT_DIAMOND",
  gold: "DODO_PRODUCT_GOLD",
  supporter: "DODO_PRODUCT_SUPPORTER",
};

export function productFor(plan: SponsorPlan): string | null {
  return process.env[PRODUCT_ENV[plan]]?.trim() || null;
}

/** Which plan a product id belongs to — for reading webhooks, whose payloads name the product. */
export function planForProduct(productId: string | null | undefined): SponsorPlan | null {
  if (!productId) return null;
  for (const plan of Object.keys(PRODUCT_ENV) as SponsorPlan[]) {
    if (productFor(plan) === productId) return plan;
  }
  return null;
}

/*
 * Where Dodo's hosted checkout lives. The route only ever redirects a visitor
 * to one of these hosts, so a bad response can never turn it into an open
 * redirect to somewhere else.
 */
export function isDodoCheckoutUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "dodopayments.com" || url.hostname.endsWith(".dodopayments.com"));
  } catch {
    return false;
  }
}
