import { NextResponse } from "next/server";
import { processBillingReceiptOutbox } from "@/app/lib/billing-receipt-delivery";
import { PERMISSIONS } from "@/app/lib/permissions";
import {
  requireStaffPermission,
  writeSecurityAudit,
} from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const schoolId = Number(body.school_id || 0);
    const authorization = await requireStaffPermission(
      request,
      PERMISSIONS.BILLING_MANAGE,
      schoolId
    );
    if (!authorization.ok) return authorization.response;

    const paymentId = Number(body.payment_id || 0);
    if (
      !Number.isInteger(schoolId) ||
      schoolId <= 0 ||
      !Number.isInteger(paymentId) ||
      paymentId <= 0
    ) {
      return NextResponse.json(
        { error: "Valid school and payment IDs are required." },
        { status: 400 }
      );
    }

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("subscription_payments")
      .select("id")
      .eq("id", paymentId)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (paymentError) throw paymentError;
    if (!payment) {
      return NextResponse.json(
        { error: "Payment was not found for this school." },
        { status: 404 }
      );
    }

    const delivery = await processBillingReceiptOutbox({
      paymentId,
      batchSize: 1,
    });
    const result = delivery.results[0];
    const { data: outbox, error: outboxError } = await supabaseAdmin
      .from("billing_email_outbox")
      .select("status, attempts, next_attempt_at, last_error, sent_at")
      .eq("payment_id", paymentId)
      .eq("email_type", "payment_receipt")
      .maybeSingle();
    if (outboxError) throw outboxError;

    const sent = Boolean(result?.sent || outbox?.status === "sent");
    await writeSecurityAudit(
      authorization.staff,
      "billing.receipt_delivery_requested",
      {
        school_id: schoolId,
        payment_id: paymentId,
        sent,
        outbox_status: outbox?.status || null,
      }
    );

    return NextResponse.json({
      success: true,
      sent,
      queued: !sent && Boolean(outbox),
      status: outbox?.status || "not_queued",
      attempts: Number(outbox?.attempts || 0),
      next_attempt_at: outbox?.next_attempt_at || null,
      reason: result?.reason || outbox?.last_error || null,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not process the payment receipt email.",
      },
      { status: 500 }
    );
  }
}
