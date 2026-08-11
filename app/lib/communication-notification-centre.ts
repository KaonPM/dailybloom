import "server-only";

import { supabaseAdmin } from "@/app/lib/supabase-admin";

export type CommunicationChannel = "parent_portal" | "in_app" | "push" | "sms" | "whatsapp" | "email";
export type CommunicationStatus = "queued" | "sending" | "sent" | "delivered" | "read" | "retry_scheduled" | "failed" | "skipped";

type CommunicationNotificationInput = {
  schoolId: number;
  channel: CommunicationChannel;
  communicationType: string;
  sourceType: string;
  sourceId?: string | null;
  status: CommunicationStatus;
  learnerId?: string | null;
  enrolmentEnquiryId?: string | null;
  recipientUserId?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  recipientEmail?: string | null;
  recipientCount?: number;
  subject?: string | null;
  bodyPreview?: string | null;
  providerMessageId?: string | null;
  attemptCount?: number;
  nextRetryAt?: string | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
  failedAt?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
};

function safePreview(value?: string | null) {
  return value ? value.trim().slice(0, 500) : null;
}

/**
 * Records operational delivery history without ever preventing the feature
 * which sent the message from succeeding. Do not pass OTPs, PINs, passwords,
 * access tokens, raw provider payloads or sensitive document content here.
 */
export async function recordCommunicationNotification(input: CommunicationNotificationInput) {
  try {
    const payload = {
      school_id: input.schoolId,
      learner_id: input.learnerId || null,
      enrolment_enquiry_id: input.enrolmentEnquiryId || null,
      recipient_user_id: input.recipientUserId || null,
      recipient_name: input.recipientName || null,
      recipient_phone: input.recipientPhone || null,
      recipient_email: input.recipientEmail || null,
      recipient_count: Math.max(0, input.recipientCount ?? 1),
      channel: input.channel,
      communication_type: input.communicationType,
      source_type: input.sourceType,
      source_id: input.sourceId || null,
      subject: input.subject || null,
      body_preview: safePreview(input.bodyPreview),
      provider_message_id: input.providerMessageId || null,
      status: input.status,
      attempt_count: input.attemptCount ?? 0,
      next_retry_at: input.nextRetryAt || null,
      sent_at: input.sentAt || null,
      delivered_at: input.deliveredAt || null,
      read_at: input.readAt || null,
      failed_at: input.failedAt || null,
      error_message: safePreview(input.errorMessage),
      metadata: input.metadata || {},
      created_by: input.createdBy || null,
    };
    const query = input.sourceId
      ? supabaseAdmin.from("communication_notifications").upsert(payload, { onConflict: "source_type,source_id,channel" })
      : supabaseAdmin.from("communication_notifications").insert(payload);
    const { error } = await query;
    if (error) console.warn("Communication notification was not recorded:", error.message);
  } catch (error) {
    console.warn("Communication notification history is unavailable:", error instanceof Error ? error.message : "Unknown error");
  }
}

export async function updateCommunicationNotificationBySource(input: Pick<CommunicationNotificationInput, "sourceType" | "sourceId" | "channel"> & Partial<CommunicationNotificationInput>) {
  if (!input.sourceId) return;
  try {
    const { error } = await supabaseAdmin.from("communication_notifications").update({
      ...(input.status ? { status: input.status } : {}),
      ...(input.providerMessageId !== undefined ? { provider_message_id: input.providerMessageId } : {}),
      ...(input.attemptCount !== undefined ? { attempt_count: input.attemptCount } : {}),
      ...(input.nextRetryAt !== undefined ? { next_retry_at: input.nextRetryAt } : {}),
      ...(input.sentAt !== undefined ? { sent_at: input.sentAt } : {}),
      ...(input.deliveredAt !== undefined ? { delivered_at: input.deliveredAt } : {}),
      ...(input.readAt !== undefined ? { read_at: input.readAt } : {}),
      ...(input.failedAt !== undefined ? { failed_at: input.failedAt } : {}),
      ...(input.errorMessage !== undefined ? { error_message: safePreview(input.errorMessage) } : {}),
    }).eq("source_type", input.sourceType).eq("source_id", input.sourceId).eq("channel", input.channel);
    if (error) console.warn("Communication notification could not be updated:", error.message);
  } catch (error) {
    console.warn("Communication notification update is unavailable:", error instanceof Error ? error.message : "Unknown error");
  }
}

export async function updateCommunicationNotificationByProviderMessageId(input: {
  providerMessageId: string;
  status: CommunicationStatus;
  deliveredAt?: string | null;
  readAt?: string | null;
  failedAt?: string | null;
  errorMessage?: string | null;
}) {
  if (!input.providerMessageId) return;
  try {
    const { error } = await supabaseAdmin.from("communication_notifications").update({
      status: input.status,
      ...(input.deliveredAt !== undefined ? { delivered_at: input.deliveredAt } : {}),
      ...(input.readAt !== undefined ? { read_at: input.readAt } : {}),
      ...(input.failedAt !== undefined ? { failed_at: input.failedAt } : {}),
      ...(input.errorMessage !== undefined ? { error_message: safePreview(input.errorMessage) } : {}),
    }).eq("provider_message_id", input.providerMessageId);
    if (error) console.warn("Provider delivery status could not be recorded:", error.message);
  } catch (error) {
    console.warn("Provider delivery status history is unavailable:", error instanceof Error ? error.message : "Unknown error");
  }
}
