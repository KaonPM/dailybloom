import "server-only";
import { Resend } from "resend";
import { supabaseAdmin } from "./supabase-admin";
import {
  recordCommunicationNotification,
  updateCommunicationNotificationBySource,
} from "./communication-notification-centre";

type OutboxRow = {
  id: string;
  school_id: number;
  payment_id: number;
  attempts: number;
};

type DeliverySummary = {
  claimed: number;
  sent: number;
  failed: number;
  results: Array<{
    payment_id: number;
    sent: boolean;
    reason?: string;
  }>;
};

function appUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "https://dailybloom.co.za"
  ).replace(/\/+$/, "");
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function retryDelayMinutes(attempts: number) {
  return Math.min(24 * 60, Math.max(5, 5 * 2 ** Math.max(0, attempts - 1)));
}

async function sendPaymentReceipt(paymentId: number, attemptCount: number) {
  const { data: payment, error: paymentError } = await supabaseAdmin
    .from("subscription_payments")
    .select(
      "id, school_id, subscription_id, original_amount, payment_date, charge_type, plan_name, payment_method, notes, receipt_number"
    )
    .eq("id", paymentId)
    .single();
  if (paymentError) throw paymentError;

  const [
    { data: school, error: schoolError },
    { data: contacts, error: contactError },
    { data: subscription, error: subscriptionError },
    { data: allocations, error: allocationError },
  ] = await Promise.all([
    supabaseAdmin
      .from("schools")
      .select("id, school_name")
      .eq("id", payment.school_id)
      .single(),
    supabaseAdmin
      .from("profiles")
      .select("full_name, email, role")
      .eq("school_id", payment.school_id)
      .in("role", ["owner", "principal"])
      .eq("is_active", true)
      .not("email", "is", null)
      .order("role", { ascending: true })
      .limit(1),
    supabaseAdmin
      .from("school_subscriptions")
      .select("next_billing_date")
      .eq("id", payment.subscription_id)
      .maybeSingle(),
    supabaseAdmin
      .from("billing_payment_allocations")
      .select("invoice_id, billing_invoices(download_token)")
      .eq("payment_id", payment.id)
      .order("id", { ascending: true })
      .limit(1),
  ]);
  if (schoolError) throw schoolError;
  if (contactError) throw contactError;
  if (subscriptionError) throw subscriptionError;
  if (allocationError) throw allocationError;

  const contact = contacts?.[0];
  if (!contact?.email) {
    throw new Error("No active principal or owner email was found.");
  }

  const invoiceRelation = allocations?.[0]?.billing_invoices;
  const invoice = Array.isArray(invoiceRelation)
    ? invoiceRelation[0]
    : invoiceRelation;
  const receiptUrl = invoice?.download_token
    ? `${appUrl()}/api/billing/invoices/document?token=${invoice.download_token}`
    : `${appUrl()}/billing`;
  const amount = Number(payment.original_amount || 0);
  const paymentType =
    payment.charge_type === "setup_fee" ? "Setup Fee" : "Subscription Fee";

  await recordCommunicationNotification({
    schoolId: Number(payment.school_id),
    recipientName: contact.full_name || null,
    recipientEmail: contact.email,
    channel: "email",
    communicationType: "Payment receipt",
    subject: `Payment Received - ${school.school_name || "DailyBloom"}`,
    bodyPreview: `${paymentType} payment receipt ${payment.receipt_number}`,
    status: "sending",
    sourceType: "billing_payment_receipt",
    sourceId: String(payment.id),
    attemptCount,
    metadata: {
      provider: "resend",
      receipt_number: payment.receipt_number,
      receipt_url: receiptUrl,
    },
  });

  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send(
    {
      from:
        process.env.DAILYBLOOM_FROM_EMAIL ||
        "DailyBloom <info@dailybloom.co.za>",
      to: contact.email,
      subject: `Payment Received - ${school.school_name || "DailyBloom"}`,
      html: `
      <div style="font-family:Arial,sans-serif;background:#FFF8F2;padding:24px;color:#2D2A3E">
        <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #F0E3D8;border-radius:18px;padding:26px">
          <h1 style="margin:0 0 8px">Daily<span style="color:#FF5EA8">Bloom</span></h1>
          <p>Dear ${escapeHtml(contact.full_name || "Principal")},</p>
          <p>Thank you. DailyBloom has received a payment for <strong>${escapeHtml(
            school.school_name || "your preschool"
          )}</strong>.</p>
          <div style="background:#EAF7FD;border:1px solid #CBEAF7;border-radius:14px;padding:16px;margin:20px 0">
            <p><strong>Receipt:</strong> ${escapeHtml(payment.receipt_number)}</p>
            <p><strong>Payment type:</strong> ${paymentType}</p>
            <p><strong>Package:</strong> ${escapeHtml(
              payment.plan_name || "DailyBloom"
            )} Subscription Package</p>
            <p><strong>Amount received:</strong> R${amount.toFixed(2)}</p>
            <p><strong>Payment date:</strong> ${escapeHtml(payment.payment_date)}</p>
            <p><strong>Payment method:</strong> ${escapeHtml(
              payment.payment_method || "Not specified"
            )}</p>
            <p><strong>Next payment due:</strong> ${escapeHtml(
              subscription?.next_billing_date || "Not set"
            )}</p>
            ${
              payment.notes
                ? `<p><strong>Notes:</strong> ${escapeHtml(payment.notes)}</p>`
                : ""
            }
          </div>
          <p><a href="${escapeHtml(
            receiptUrl
          )}" style="display:inline-block;background:#75C7EA;color:#fff;text-decoration:none;font-weight:700;padding:13px 18px;border-radius:12px">Open payment receipt</a></p>
          <p style="color:#6F6880;font-size:13px">DailyBloom is a subsidiary of Lesedi Smart Solutions (Pty) Ltd.</p>
        </div>
      </div>`,
    },
    { idempotencyKey: `billing-payment-receipt-${payment.id}` }
  );
  if (error) throw new Error(error.message);

  await updateCommunicationNotificationBySource({
    channel: "email",
    status: "sent",
    sourceType: "billing_payment_receipt",
    sourceId: String(payment.id),
    providerMessageId: data?.id || null,
    attemptCount,
    nextRetryAt: null,
    sentAt: new Date().toISOString(),
    failedAt: null,
    errorMessage: null,
  });
}

export async function processBillingReceiptOutbox(options?: {
  paymentId?: number;
  batchSize?: number;
}): Promise<DeliverySummary> {
  const { data, error } = await supabaseAdmin.rpc(
    "claim_billing_email_outbox",
    {
      batch_size: Math.min(100, Math.max(1, options?.batchSize || 20)),
      target_payment_id: options?.paymentId || null,
    }
  );
  if (error) throw error;

  const rows = (data || []) as OutboxRow[];
  const summary: DeliverySummary = {
    claimed: rows.length,
    sent: 0,
    failed: 0,
    results: [],
  };

  for (const row of rows) {
    try {
      await sendPaymentReceipt(Number(row.payment_id), Number(row.attempts || 1));
      const { error: updateError } = await supabaseAdmin
        .from("billing_email_outbox")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (updateError) throw updateError;
      summary.sent += 1;
      summary.results.push({ payment_id: Number(row.payment_id), sent: true });
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Receipt delivery failed.";
      const terminal = Number(row.attempts || 0) >= 5;
      const nextAttempt = new Date(
        Date.now() + retryDelayMinutes(Number(row.attempts || 1)) * 60_000
      ).toISOString();
      await updateCommunicationNotificationBySource({
        channel: "email",
        status: terminal ? "failed" : "retry_scheduled",
        sourceType: "billing_payment_receipt",
        sourceId: String(row.payment_id),
        attemptCount: Number(row.attempts || 1),
        nextRetryAt: terminal ? null : nextAttempt,
        failedAt: terminal ? new Date().toISOString() : null,
        errorMessage: reason,
      });
      await supabaseAdmin
        .from("billing_email_outbox")
        .update({
          status: "failed",
          next_attempt_at: terminal
            ? new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString()
            : nextAttempt,
          last_error: reason.slice(0, 1000),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      summary.failed += 1;
      summary.results.push({
        payment_id: Number(row.payment_id),
        sent: false,
        reason,
      });
    }
  }

  return summary;
}
