import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import {
  requireStaffPermission,
  writeSecurityAudit,
} from "@/app/lib/server-authorization";
import { PERMISSIONS } from "@/app/lib/permissions";
import { recordCommunicationNotification } from "@/app/lib/communication-notification-centre";

function createReceiptNumber(schoolId: number) {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `PS-${date}-${schoolId}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

async function sendParentPush(
  phone: string,
  schoolName: string,
  learnerName: string,
  receipt: string
) {
  const appId =
    process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  const key = process.env.ONESIGNAL_REST_API_KEY;
  if (!appId || !key || !phone) return { skipped: true, providerMessageId: null };

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.dailybloom.co.za";
  const response = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: {
      Authorization: `Key ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      app_id: appId,
      target_channel: "push",
      include_aliases: { external_id: [phone] },
      headings: { en: schoolName },
      contents: {
        en: `Payment recorded for ${learnerName}. Receipt ${receipt} is available.`,
      },
      url: `${siteUrl}/parent/fees`,
    }),
  });
  if (!response.ok) {
    console.error("Parent fee push failed:", await response.text());
    return { skipped: true, providerMessageId: null };
  }
  const payload = await response.json().catch(() => ({}));
  return { skipped: false, providerMessageId: String(payload?.id || "") || null };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const schoolId = Number(body.school_id);
    const learnerId = String(body.learner_id || "");
    const paymentAmount = Number(body.payment_amount);
    const month = Number(body.payment_month);
    const year = Number(body.payment_year);
    const paymentDate = String(body.payment_date || "");
    const paymentMethod = String(body.payment_method || "").trim();
    const referenceNumber =
      String(body.reference_number || "").trim() || null;

    const authorization = await requireStaffPermission(
      request,
      PERMISSIONS.BILLING_MANAGE,
      schoolId
    );
    if (!authorization.ok) return authorization.response;
    if (
      !schoolId ||
      !learnerId ||
      !paymentDate ||
      !paymentMethod ||
      paymentAmount <= 0 ||
      month < 1 ||
      month > 12 ||
      !year
    ) {
      return NextResponse.json(
        {
          error:
            "Complete the learner, payment amount, payment date and method.",
        },
        { status: 400 }
      );
    }

    const [learnerResult, schoolResult] = await Promise.all([
      supabaseAdmin
        .from("learners")
        .select("id, name, parent_phone, monthly_fee")
        .eq("id", learnerId)
        .eq("school_id", schoolId)
        .maybeSingle(),
      supabaseAdmin
        .from("schools")
        .select("school_name")
        .eq("id", schoolId)
        .maybeSingle(),
    ]);
    const learner = learnerResult.data;
    if (!learner) {
      return NextResponse.json(
        { error: "Learner not found in this school." },
        { status: 404 }
      );
    }
    const monthlyFee = Number(learner.monthly_fee || 0);
    if (monthlyFee <= 0) {
      return NextResponse.json(
        {
          error:
            "Set this learner's monthly school fee before recording a payment.",
        },
        { status: 400 }
      );
    }

    const billingPeriod = `${year}-${String(month).padStart(2, "0")}-01`;
    const periodLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleString(
      "en-ZA",
      { month: "long", year: "numeric", timeZone: "UTC" }
    );

    let chargeResult = await supabaseAdmin
      .from("learner_fee_charges")
      .select("id, amount")
      .eq("school_id", schoolId)
      .eq("learner_id", learnerId)
      .eq("charge_type", "monthly_fee")
      .eq("billing_period", billingPeriod)
      .maybeSingle();
    if (chargeResult.error) throw chargeResult.error;

    if (!chargeResult.data) {
      chargeResult = await supabaseAdmin
        .from("learner_fee_charges")
        .insert({
          school_id: schoolId,
          learner_id: learnerId,
          charge_type: "monthly_fee",
          description: `School fees - ${periodLabel}`,
          billing_period: billingPeriod,
          due_date: billingPeriod,
          amount: monthlyFee,
          created_by: authorization.staff.userId,
        })
        .select("id, amount")
        .single();
    }
    if (chargeResult.error || !chargeResult.data) {
      throw chargeResult.error || new Error("Could not create fee charge.");
    }

    const receipt = createReceiptNumber(schoolId);
    const paymentResult = await supabaseAdmin
      .from("learner_fee_payments")
      .insert({
        school_id: schoolId,
        learner_id: learnerId,
        amount: paymentAmount,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        reference_number: referenceNumber,
        receipt_number: receipt,
        recorded_by: authorization.staff.userId,
      })
      .select("id")
      .single();
    if (paymentResult.error || !paymentResult.data) {
      throw paymentResult.error || new Error("Could not record payment.");
    }

    const outstandingResult = await supabaseAdmin
      .from("learner_fee_charges")
      .select("id, amount, billing_period")
      .eq("school_id", schoolId)
      .eq("learner_id", learnerId)
      .order("billing_period", { ascending: true })
      .order("id", { ascending: true });
    if (outstandingResult.error) throw outstandingResult.error;

    const chargeIds = (outstandingResult.data || []).map((item) => item.id);
    const allocationResult = chargeIds.length
      ? await supabaseAdmin
          .from("learner_fee_allocations")
          .select("charge_id, amount")
          .in("charge_id", chargeIds)
      : { data: [], error: null };
    if (allocationResult.error) throw allocationResult.error;

    const allocatedByCharge = new Map<number, number>();
    for (const row of allocationResult.data || []) {
      const id = Number(row.charge_id);
      allocatedByCharge.set(
        id,
        (allocatedByCharge.get(id) || 0) + Number(row.amount || 0)
      );
    }

    let remaining = paymentAmount;
    const allocations: Array<{
      payment_id: number;
      charge_id: number;
      amount: number;
    }> = [];
    for (const item of outstandingResult.data || []) {
      if (remaining <= 0) break;
      const outstanding = Math.max(
        0,
        Number(item.amount) -
          (allocatedByCharge.get(Number(item.id)) || 0)
      );
      const applied = Math.min(remaining, outstanding);
      if (applied > 0) {
        allocations.push({
          payment_id: paymentResult.data.id,
          charge_id: item.id,
          amount: applied,
        });
        remaining -= applied;
      }
    }
    if (allocations.length) {
      const result = await supabaseAdmin
        .from("learner_fee_allocations")
        .insert(allocations);
      if (result.error) throw result.error;
    }

    const legacyResult = await supabaseAdmin.from("payments").insert({
      learner_name: learner.name,
      amount: paymentAmount,
      payment_date: paymentDate,
      status:
        paymentAmount >= Number(chargeResult.data.amount || monthlyFee)
          ? "paid"
          : "partial",
      school_id: schoolId,
      payment_month: month,
      payment_year: year,
      parent_phone: learner.parent_phone || null,
      payment_method: paymentMethod,
      reference_number: referenceNumber || receipt,
    });
    if (legacyResult.error) throw legacyResult.error;

    await writeSecurityAudit(
      authorization.staff,
      "learner_fee.payment_recorded",
      {
        school_id: schoolId,
        learner_id: learnerId,
        receipt_number: receipt,
        amount: paymentAmount,
      }
    );
    const push = await sendParentPush(
      String(learner.parent_phone || ""),
      String(schoolResult.data?.school_name || "DailyBloom"),
      String(learner.name || "your child"),
      receipt
    );
    await recordCommunicationNotification({
      schoolId,
      learnerId,
      channel: "push",
      communicationType: "learner_fee_payment_receipt",
      sourceType: "learner_fee_payment",
      sourceId: String(paymentResult.data.id),
      status: push.skipped ? "skipped" : "sent",
      recipientName: String(learner.name || ""),
      recipientPhone: String(learner.parent_phone || "") || null,
      subject: String(schoolResult.data?.school_name || "DailyBloom"),
      bodyPreview: `Payment recorded for ${learner.name}. Receipt ${receipt} is available.`,
      providerMessageId: push.providerMessageId,
      sentAt: push.skipped ? null : new Date().toISOString(),
      createdBy: authorization.staff.userId,
    });
    return NextResponse.json({
      success: true,
      receipt_number: receipt,
      push,
    });
  } catch (error: unknown) {
    console.error("Learner fee payment failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not record payment.",
      },
      { status: 500 }
    );
  }
}
