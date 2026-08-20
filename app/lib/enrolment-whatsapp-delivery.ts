import "server-only";

import { decryptEnrolmentDeliveryPayload, encryptEnrolmentDeliveryPayload } from "@/app/lib/enrolment-delivery-crypto";
import { hashEnrolmentSecret } from "@/app/lib/enrolment-form-security";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { EnrolmentWhatsAppKind, getEnrolmentWhatsAppTemplateDetails, sendEnrolmentWhatsApp, WhatsAppSendError } from "@/app/lib/whatsapp";

type LegacyDeliveryKind = Exclude<EnrolmentWhatsAppKind, "access_code">;

type DeliveryInput = {
  enquiryId: string;
  schoolId: number;
  kind: EnrolmentWhatsAppKind;
  phone: string;
  bodyParameters: string[];
  /** Authentication codes are never persisted for retry and expire rapidly. */
  accessCode?: string;
};

const RETRY_DELAYS_MS = [30_000, 2 * 60_000, 10 * 60_000];

function legacyFields(kind: EnrolmentWhatsAppKind, input: { status: string; error: string | null; providerMessageId?: string | null; sentAt?: string | null }) {
  if (kind === "registration") return {
    registration_delivery_status: input.status,
    registration_delivery_error: input.error,
    ...(input.providerMessageId !== undefined ? { registration_provider_message_id: input.providerMessageId } : {}),
    ...(input.sentAt !== undefined ? { registration_request_sent_at: input.sentAt } : {}),
  };
  if (kind === "form") return {
    form_delivery_status: input.status,
    form_delivery_error: input.error,
    ...(input.providerMessageId !== undefined ? { form_provider_message_id: input.providerMessageId } : {}),
    ...(input.sentAt !== undefined ? { form_sent_at: input.sentAt } : {}),
  };
  return {
    form_access_otp_delivery_status: input.status,
    form_access_otp_delivery_error: input.error,
    ...(input.providerMessageId !== undefined ? { form_access_otp_provider_message_id: input.providerMessageId } : {}),
    ...(input.sentAt !== undefined ? { form_access_otp_sent_at: input.sentAt } : {}),
  };
}

async function updateLegacy(enquiryId: string, kind: EnrolmentWhatsAppKind, fields: ReturnType<typeof legacyFields>) {
  await supabaseAdmin.from("school_enrolment_enquiries").update(fields).eq("id", enquiryId);
}

async function addHistory(input: DeliveryInput, attemptCount: number) {
  const template = getEnrolmentWhatsAppTemplateDetails(input.kind);
  const { data } = await supabaseAdmin.from("enrolment_message_deliveries").insert({
    enquiry_id: input.enquiryId,
    school_id: input.schoolId,
    message_kind: input.kind,
    template_name: template.templateName,
    template_version: template.templateVersion,
    template_category: template.category,
    template_approved_at: template.approvedAt,
    template_meta_id: template.metaTemplateId,
    recipient_phone: input.phone,
    status: "sending",
    attempt_count: attemptCount,
  }).select("id").maybeSingle();
  return data?.id || null;
}

function retryTiming(attemptCount: number) {
  const delay = RETRY_DELAYS_MS[attemptCount - 1];
  return delay ? new Date(Date.now() + delay).toISOString() : null;
}

function secureTokenFromUrl(value: string) {
  try {
    return new URL(value).pathname.split("/").filter(Boolean).pop() || "";
  } catch {
    return "";
  }
}

async function isCurrentFormLink(enquiryId: string, formUrl: string) {
  const token = secureTokenFromUrl(formUrl);
  if (!token) return false;
  const { data } = await supabaseAdmin.from("school_enrolment_enquiries")
    .select("status, form_token_hash, form_token_expires_at")
    .eq("id", enquiryId)
    .maybeSingle();
  return Boolean(
    data
      && data.status === "form_issued"
      && data.form_token_hash === hashEnrolmentSecret(token)
      && data.form_token_expires_at
      && new Date(data.form_token_expires_at).getTime() > Date.now()
  );
}

async function completeHistory(input: { id: string | null; enquiryId: string; kind: EnrolmentWhatsAppKind; status: string; error: string | null; providerMessageId?: string | null; sentAt?: string | null; retryPayload?: string | null; nextRetryAt?: string | null }) {
  if (input.id) {
    await supabaseAdmin.from("enrolment_message_deliveries").update({
      status: input.status,
      last_error: input.error,
      ...(input.providerMessageId !== undefined ? { provider_message_id: input.providerMessageId } : {}),
      ...(input.sentAt !== undefined ? { sent_at: input.sentAt } : {}),
      ...(input.retryPayload !== undefined ? { retry_payload_encrypted: input.retryPayload } : {}),
      ...(input.nextRetryAt !== undefined ? { next_retry_at: input.nextRetryAt } : {}),
      ...(input.status === "failed" ? { failed_at: new Date().toISOString() } : {}),
    }).eq("id", input.id);
  }
  await updateLegacy(input.enquiryId, input.kind, legacyFields(input.kind, {
    status: input.status === "retry_scheduled" ? "retrying" : input.status,
    error: input.error,
    providerMessageId: input.providerMessageId,
    sentAt: input.sentAt,
  }));
}

export async function sendTrackedEnrolmentWhatsApp(input: DeliveryInput) {
  let historyId: string | null = null;
  try {
    historyId = await addHistory(input, 1);
  } catch {
    // Existing enrolment sends continue safely until the accompanying migration is applied.
  }
  try {
    const result = await sendEnrolmentWhatsApp(input);
    const sentAt = new Date().toISOString();
    await completeHistory({ id: historyId, enquiryId: input.enquiryId, kind: input.kind, status: "sent", error: null, providerMessageId: result.providerMessageId, sentAt, retryPayload: null, nextRetryAt: null });
    return { sent: true, error: "", providerMessageId: result.providerMessageId, retryScheduled: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "WhatsApp delivery could not be completed.";
    const retryable = input.kind !== "access_code" && error instanceof WhatsAppSendError && error.isRetryable;
    const nextRetryAt = retryable ? retryTiming(1) : null;
    const retryPayload = nextRetryAt ? encryptEnrolmentDeliveryPayload({ phone: input.phone, bodyParameters: input.bodyParameters }) : null;
    const status = nextRetryAt && retryPayload ? "retry_scheduled" : "failed";
    await completeHistory({ id: historyId, enquiryId: input.enquiryId, kind: input.kind, status, error: message, retryPayload, nextRetryAt });
    return { sent: false, error: message, providerMessageId: null, retryScheduled: status === "retry_scheduled" };
  }
}

export async function processEnrolmentWhatsAppDeliveryRetries({ batchSize = 25 }: { batchSize?: number } = {}) {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin.from("enrolment_message_deliveries")
    .select("id, enquiry_id, message_kind, attempt_count, retry_payload_encrypted")
    .eq("status", "retry_scheduled")
    .lte("next_retry_at", now)
    .order("next_retry_at", { ascending: true })
    .limit(batchSize);
  if (error) throw new Error(error.message);

  let sent = 0;
  let rescheduled = 0;
  let failed = 0;
  for (const entry of data || []) {
    const kind = entry.message_kind as LegacyDeliveryKind;
    const attempts = Number(entry.attempt_count || 1);
    const claim = await supabaseAdmin.from("enrolment_message_deliveries")
      .update({ status: "sending", next_retry_at: null })
      .eq("id", entry.id).eq("status", "retry_scheduled")
      .select("id").maybeSingle();
    if (!claim.data) continue;

    const payload = typeof entry.retry_payload_encrypted === "string"
      ? decryptEnrolmentDeliveryPayload(entry.retry_payload_encrypted)
      : null;
    if (!payload || !["registration", "form"].includes(kind)) {
      await completeHistory({ id: entry.id, enquiryId: entry.enquiry_id, kind, status: "failed", error: "Retry data is unavailable. Please resend this message from the enrolment record.", retryPayload: null, nextRetryAt: null });
      failed += 1;
      continue;
    }
    if (kind === "form" && !(await isCurrentFormLink(entry.enquiry_id, payload.bodyParameters[3] || ""))) {
      await completeHistory({ id: entry.id, enquiryId: entry.enquiry_id, kind, status: "failed", error: "This retry was cancelled because its secure link expired or was replaced.", retryPayload: null, nextRetryAt: null });
      failed += 1;
      continue;
    }
    try {
      const result = await sendEnrolmentWhatsApp({ kind, phone: payload.phone, bodyParameters: payload.bodyParameters });
      const sentAt = new Date().toISOString();
      await completeHistory({ id: entry.id, enquiryId: entry.enquiry_id, kind, status: "sent", error: null, providerMessageId: result.providerMessageId, sentAt, retryPayload: null, nextRetryAt: null });
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "WhatsApp retry could not be completed.";
      const nextAttemptCount = attempts + 1;
      // attempt_count includes the original send. The retry sequence is therefore
      // 30 seconds after attempt 1, then 2 minutes after attempt 2, then 10 minutes
      // after attempt 3. Access codes are never queued for a retry.
      const nextRetryAt = error instanceof WhatsAppSendError && error.isRetryable ? retryTiming(nextAttemptCount) : null;
      const status = nextRetryAt ? "retry_scheduled" : "failed";
      await supabaseAdmin.from("enrolment_message_deliveries").update({ attempt_count: nextAttemptCount }).eq("id", entry.id);
      await completeHistory({ id: entry.id, enquiryId: entry.enquiry_id, kind, status, error: message, retryPayload: status === "retry_scheduled" ? entry.retry_payload_encrypted : null, nextRetryAt });
      if (status === "retry_scheduled") rescheduled += 1;
      else failed += 1;
    }
  }
  return { processed: (data || []).length, sent, rescheduled, failed };
}
