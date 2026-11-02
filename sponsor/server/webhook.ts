import { NextResponse } from "next/server";
import "server-only";
import { dodo, planForProduct } from "./dodo";

/*
 * Dodo Payments' webhooks — how this site hears that a sponsorship started,
 * renewed, failed or ended. Point the endpoint at /api/webhooks/dodo in the
 * Dodo dashboard and put its signing secret in DODO_PAYMENTS_WEBHOOK_KEY.
 *
 * Nothing in a request is believed until its signature checks out: Dodo signs
 * every delivery (Standard Webhooks — `webhook-id`, `webhook-timestamp`,
 * `webhook-signature`) over the exact bytes of the body, and the check also
 * refuses a timestamp more than five minutes old, so a captured request
 * cannot be replayed later. The body is therefore read as raw text and only
 * parsed after it is verified.
 */
/* Dodo's payloads are a few kilobytes; anything near this is not from Dodo */
const MAX_BODY = 256 * 1024;

/*
 * Dodo retries a delivery it is not sure landed, so the same event can arrive
 * twice. The ids of recent ones are kept to answer a repeat without acting on
 * it again — per server instance; a database row is the durable version.
 */
const seen = new Set<string>();

function alreadyHandled(id: string): boolean {
  if (seen.has(id)) return true;
  seen.add(id);
  if (seen.size > 2_000) seen.delete(seen.values().next().value as string);
  return false;
}

/* enough to recognise a sponsor in the logs without writing their address out in full */
function maskEmail(email: string | null | undefined): string {
  if (!email) return "unknown";
  const [name, domain] = email.split("@");
  return `${name?.slice(0, 2) ?? ""}***@${domain ?? ""}`;
}

export async function POST(request: Request) {
  const client = dodo();
  if (!client || !process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim()) {
    console.error("[dodo webhook] DODO_PAYMENTS_API_KEY or DODO_PAYMENTS_WEBHOOK_KEY is not set");
    /* 503 tells Dodo to try again later, once the secret is in place */
    return NextResponse.json({ message: "Webhooks are not configured." }, { status: 503 });
  }

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY) {
    return NextResponse.json({ message: "Payload too large." }, { status: 413 });
  }

  const webhookId = request.headers.get("webhook-id");
  const signature = request.headers.get("webhook-signature");
  const timestamp = request.headers.get("webhook-timestamp");
  if (!webhookId || !signature || !timestamp) {
    return NextResponse.json({ message: "Missing signature." }, { status: 400 });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY) {
    return NextResponse.json({ message: "Payload too large." }, { status: 413 });
  }

  let event: ReturnType<typeof client.webhooks.unwrap>;
  try {
    event = client.webhooks.unwrap(raw, {
      headers: {
        "webhook-id": webhookId,
        "webhook-signature": signature,
        "webhook-timestamp": timestamp,
      },
    });
  } catch {
    /* a bad or stale signature: say nothing about why */
    return NextResponse.json({ message: "Invalid signature." }, { status: 401 });
  }

  if (alreadyHandled(webhookId)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  switch (event.type) {
    case "subscription.active":
    case "subscription.renewed":
    case "subscription.on_hold":
    case "subscription.failed":
    case "subscription.cancelled":
    case "subscription.expired": {
      const sub = event.data;
      const plan = (sub.metadata?.plan as string | undefined) ?? planForProduct(sub.product_id);
      /*
       * The record of who sponsors what. `active` is the moment to add their
       * logo and post the shoutout; `cancelled` / `expired` the moment to take
       * it down. Each one is also listed under Subscriptions in the Dodo
       * dashboard, with the sponsor's full details.
       */
      console.info("[dodo webhook]", event.type, {
        plan,
        subscription: sub.subscription_id,
        status: sub.status,
        customer: sub.customer.customer_id,
        email: maskEmail(sub.customer.email),
        next_billing_date: sub.next_billing_date,
      });
      break;
    }

    case "payment.succeeded":
    case "payment.failed":
    case "refund.succeeded":
    case "dispute.opened": {
      const data = event.data as { payment_id?: string; subscription_id?: string | null; total_amount?: number; currency?: string };
      console.info("[dodo webhook]", event.type, {
        payment: data.payment_id,
        subscription: data.subscription_id ?? null,
        amount: data.total_amount,
        currency: data.currency,
      });
      break;
    }

    default:
      /* every other event is acknowledged so Dodo does not keep retrying it */
      break;
  }

  return NextResponse.json({ received: true });
}
