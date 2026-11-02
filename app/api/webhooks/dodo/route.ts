import { NextResponse } from "next/server";
import { SPONSOR_ENABLED } from "@/sponsor/config";
import { POST as webhook } from "@/sponsor/server/webhook";

/* POST /api/webhooks/dodo — the handler lives in sponsor/server; this only answers to the switch (sponsor/config.ts) */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!SPONSOR_ENABLED) return NextResponse.json({ message: "Not found." }, { status: 404 });
  return webhook(request);
}
