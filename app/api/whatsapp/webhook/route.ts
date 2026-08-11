import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

type WhatsAppDeliveryStatus = {
  id?: unknown;
  status?: unknown;
  errors?: unknown;
};

type WhatsAppWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: { statuses?: WhatsAppDeliveryStatus[] };
    }>;
  }>;
};

type StoredDeliveryStatus = "sent" | "delivered" | "read" | "failed";

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function hasValidMetaSignature(rawBody: string, signature: string | null) {
  if (!signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", requiredEnvironment("WHATSAPP_APP_SECRET")).update(rawBody).digest("hex")}`;
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

function deliveryError(errors: unknown) {
  return Array.isArray(errors) && errors.length > 0
    ? "WhatsApp reported that this message could not be delivered."
    : null;
}

function normaliseDeliveryStatus(status: unknown): StoredDeliveryStatus | null {
  const value = typeof status === "string" ? status.trim().toLowerCase() : "";
  return value === "sent" || value === "delivered" || value === "read" || value === "failed" ? value : null;
}

async function saveDeliveryStatus(messageId: string, status: StoredDeliveryStatus, error: string | null) {
  const timestamp = new Date().toISOString();
  await Promise.all([
    supabaseAdmin
      .from("school_enrolment_enquiries")
      .update({ registration_delivery_status: status, registration_delivery_error: error })
      .eq("registration_provider_message_id", messageId),
    supabaseAdmin
      .from("school_enrolment_enquiries")
      .update({ form_delivery_status: status, form_delivery_error: error })
      .eq("form_provider_message_id", messageId),
    supabaseAdmin
      .from("school_enrolment_enquiries")
      .update({ form_access_otp_delivery_status: status, form_access_otp_delivery_error: error })
      .eq("form_access_otp_provider_message_id", messageId),
    supabaseAdmin
      .from("enrolment_message_deliveries")
      .update({
        status,
        last_error: error,
        ...(status === "delivered" ? { delivered_at: timestamp } : {}),
        ...(status === "read" ? { read_at: timestamp } : {}),
        ...(status === "failed" ? { failed_at: timestamp } : {}),
      })
      .eq("provider_message_id", messageId),
  ]);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const verifyToken = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && challenge && verifyToken === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    if (!hasValidMetaSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
      return new Response("Invalid signature", { status: 401 });
    }

    const payload = JSON.parse(rawBody) as WhatsAppWebhookPayload;
    const statuses = payload.entry?.flatMap((entry) => entry.changes?.flatMap((change) => change.value?.statuses || []) || []) || [];
    await Promise.all(statuses.map(async (entry) => {
      const messageId = typeof entry.id === "string" ? entry.id : "";
      const status = normaliseDeliveryStatus(entry.status);
      if (messageId && status) await saveDeliveryStatus(messageId, status, deliveryError(entry.errors));
    }));
    return NextResponse.json({ received: true });
  } catch {
    // Meta should retry only transient failures; secrets and raw payloads must never be exposed or logged.
    return new Response("Webhook processing failed", { status: 500 });
  }
}
