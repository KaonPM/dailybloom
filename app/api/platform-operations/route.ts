import { NextResponse } from "next/server";
import { platformOperationPermission } from "../../lib/platform-operation-policy";
import { requireStaffPermission, writeSecurityAudit } from "../../lib/server-authorization";
import { supabaseAdmin } from "../../lib/supabase-admin";
import {
  activateSubscriptionBilling,
  createSetupFeeInvoice,
} from "../../lib/billing-ledger";

const ONBOARDING_FIELDS = [
  "onboarding_status", "setup_fee_paid", "subscription_paid", "setup_date",
  "onboarding_notes", "logo_received", "brand_colours_received",
  "learner_list_received", "teacher_list_received", "classroom_list_received",
  "year_planner_received",
] as const;

function numberId(value: unknown) {
  const id = Number(value || 0);
  return Number.isInteger(id) && id > 0 ? id : 0;
}

function dateOnly(value: unknown) {
  const date = String(value || "");
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

async function getSchoolBillingContext(schoolId: number) {
  const { data: school, error } = await supabaseAdmin
    .from("schools")
    .select("id, school_name, contact_number, is_demo_school")
    .eq("id", schoolId)
    .maybeSingle();
  if (error) throw error;
  if (!school) throw new Error("School was not found.");
  return school;
}

async function assertDailyBloomBillableSchool(schoolId: number) {
  const school = await getSchoolBillingContext(schoolId);
  if (school.is_demo_school) {
    throw new Error("This is a Demo school. DailyBloom billing is disabled.");
  }
  return school;
}

async function repairBillingAccount(
  schoolId: number,
  requireSubscription = false
) {
  const school = await getSchoolBillingContext(schoolId);
  if (school.is_demo_school) {
    return {
      skipped: true,
      reason: "Demo schools are excluded from DailyBloom billing.",
    };
  }
  const { data: subscription, error: subscriptionError } = await supabaseAdmin
    .from("school_subscriptions")
    .select("id")
    .eq("school_id", schoolId)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (subscriptionError) throw subscriptionError;
  if (!subscription) {
    if (requireSubscription) {
      throw new Error("Save a subscription package before repairing billing.");
    }
    return { skipped: true, reason: "No subscription package." };
  }
  const { data, error } = await supabaseAdmin.rpc(
    "reconcile_school_billing_account",
    {
      target_school_id: schoolId,
      setup_fee_value: 599,
    }
  );
  if (error) throw error;
  return data;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = String(body.action || "");
    const permission = platformOperationPermission(action);
    if (!permission) return NextResponse.json({ error: "Unsupported platform operation." }, { status: 400 });

    const schoolId = numberId(body.school_id);
    const authorization = await requireStaffPermission(request, permission, schoolId || null);
    if (!authorization.ok) return authorization.response;

    if (action === "set_school_active") {
      if (!schoolId || typeof body.is_active !== "boolean") return NextResponse.json({ error: "School and status are required." }, { status: 400 });
      const { error: schoolError } = await supabaseAdmin.from("schools").update({ is_active: body.is_active }).eq("id", schoolId);
      if (schoolError) throw schoolError;
      const { error: profileError } = await supabaseAdmin.from("profiles").update({ is_active: body.is_active }).eq("school_id", schoolId).in("role", ["owner", "principal", "admin", "teacher"]);
      if (profileError) throw profileError;
      if (body.is_active) {
        await repairBillingAccount(schoolId);
      }
      await writeSecurityAudit(authorization.staff, "platform.school_access_updated", { school_id: schoolId, is_active: body.is_active });
      return NextResponse.json({ success: true });
    }

    if (action === "remove_principal") {
      const userId = String(body.user_id || "");
      if (!userId) return NextResponse.json({ error: "Principal account is required." }, { status: 400 });
      const { data: target, error: targetError } = await supabaseAdmin.from("profiles").select("id, school_id, role").eq("id", userId).maybeSingle();
      if (targetError || !target || !["owner", "principal"].includes(String(target.role))) return NextResponse.json({ error: "Principal account was not found." }, { status: 404 });
      const targetSchoolId = numberId(target.school_id);
      if (schoolId && targetSchoolId !== schoolId) return NextResponse.json({ error: "Principal does not belong to this school." }, { status: 409 });
      const { error } = await supabaseAdmin.from("profiles").update({ school_id: null, is_active: false }).eq("id", userId);
      if (error) throw error;
      if (targetSchoolId) await supabaseAdmin.from("school_memberships").update({ status: "revoked", updated_at: new Date().toISOString() }).eq("user_id", userId).eq("school_id", targetSchoolId);
      await writeSecurityAudit(authorization.staff, "platform.principal_removed", { target_user_id: userId, school_id: targetSchoolId });
      return NextResponse.json({ success: true });
    }

    if (action === "save_onboarding") {
      if (!schoolId) return NextResponse.json({ error: "School is required." }, { status: 400 });
      const row: Record<string, unknown> = { school_id: schoolId, updated_at: new Date().toISOString() };
      for (const field of ONBOARDING_FIELDS) if (Object.prototype.hasOwnProperty.call(body, field)) row[field] = body[field];
      const { error } = await supabaseAdmin.from("school_onboarding").upsert(row, { onConflict: "school_id" });
      if (error) throw error;
      if (Object.prototype.hasOwnProperty.call(body, "setup_date")) {
        await repairBillingAccount(schoolId);
      }
      await writeSecurityAudit(authorization.staff, "platform.onboarding_updated", { school_id: schoolId });
      return NextResponse.json({ success: true });
    }

    if (action === "activate_school") {
      if (!schoolId) return NextResponse.json({ error: "School is required." }, { status: 400 });
      const now = new Date().toISOString();
      const { error: schoolError } = await supabaseAdmin
        .from("schools")
        .update({ status: "active" })
        .eq("id", schoolId);
      if (schoolError) throw schoolError;
      const { error: onboardingError } = await supabaseAdmin.from("school_onboarding").upsert({ school_id: schoolId, onboarding_status: "Activated", updated_at: now }, { onConflict: "school_id" });
      if (onboardingError) throw onboardingError;
      const subscription = await activateSubscriptionBilling(
        schoolId,
        new Date(now)
      );
      await repairBillingAccount(schoolId);
      const setupInvoice = await createSetupFeeInvoice(schoolId);
      await writeSecurityAudit(authorization.staff, "platform.school_activated", { school_id: schoolId });
      return NextResponse.json({
        success: true,
        setup_invoice: setupInvoice,
        next_billing_date: subscription.next_billing_date,
        invoice_email_sent: false,
        invoice_email_reason: "Email is sent after payment is recorded.",
      });
    }

    if (action === "save_subscription") {
      if (!schoolId) return NextResponse.json({ error: "School is required." }, { status: 400 });
      await assertDailyBloomBillableSchool(schoolId);
      const planName = String(body.plan_name || "").trim();
      const monthlyPrice = Number(body.monthly_price);
      const status = String(body.status || "trial");
      if (status === "demo") {
        return NextResponse.json(
          { error: "Use Set Demo School to stop DailyBloom billing for a demo school." },
          { status: 400 }
        );
      }
      if (!planName || !Number.isFinite(monthlyPrice) || monthlyPrice < 0) return NextResponse.json({ error: "A valid plan is required." }, { status: 400 });
      const { error } = await supabaseAdmin.from("school_subscriptions").upsert({ school_id: schoolId, plan_name: planName, monthly_price: monthlyPrice, status, next_billing_date: body.next_billing_date || null, updated_at: new Date().toISOString() }, { onConflict: "school_id" });
      if (error) throw error;
      await supabaseAdmin.from("schools").update({ billing_status: status }).eq("id", schoolId);
      const billingRepair = await repairBillingAccount(schoolId, true);
      await writeSecurityAudit(authorization.staff, "platform.subscription_saved", { school_id: schoolId, plan_name: planName, status });
      return NextResponse.json({ success: true, billing_repair: billingRepair });
    }

    if (action === "ensure_setup_invoices") {
      const { data: subscriptions, error: subscriptionsError } =
        await supabaseAdmin.from("school_subscriptions").select("school_id");
      if (subscriptionsError) throw subscriptionsError;
      const repaired = [];
      for (const id of [
        ...new Set((subscriptions || []).map((row) => Number(row.school_id))),
      ]) {
        repaired.push(await repairBillingAccount(id, true));
      }
      await writeSecurityAudit(
        authorization.staff,
        "billing.accounts_repaired",
        { repaired: repaired.length }
      );
      return NextResponse.json({
        success: true,
        repaired,
      });
    }

    if (action === "repair_billing_account") {
      if (!['master', 'master_admin'].includes(authorization.staff.role)) {
        return NextResponse.json(
          { error: "Only Master billing users may run emergency billing repair." },
          { status: 403 }
        );
      }
      if (!schoolId) {
        return NextResponse.json(
          { error: "Select a school to repair." },
          { status: 400 }
        );
      }
      const result = await repairBillingAccount(schoolId, true);

      await writeSecurityAudit(
        authorization.staff,
        "billing.account_repaired",
        { school_id: schoolId, result }
      );
      return NextResponse.json({ success: true, result });
    }

    if (action === "set_demo_school") {
      if (!['master', 'master_admin'].includes(authorization.staff.role)) {
        return NextResponse.json(
          { error: "Only Master billing users may set a Demo school." },
          { status: 403 }
        );
      }
      const reason = String(body.reason || "").trim();
      if (!schoolId || reason.length < 3) {
        return NextResponse.json(
          { error: "Select a school and enter a demo-school reason." },
          { status: 400 }
        );
      }
      const { data, error } = await supabaseAdmin.rpc("set_dailybloom_demo_school", {
        target_school_id: schoolId,
        demo_reason: reason,
        actor_id: authorization.staff.userId,
      });
      if (error) throw error;
      await writeSecurityAudit(authorization.staff, "billing.school_marked_demo", {
        school_id: schoolId,
        reason,
      });
      return NextResponse.json({ success: true, result: data });
    }

    if (action === "send_billing_payment_reminder") {
      if (!['master', 'master_admin'].includes(authorization.staff.role)) {
        return NextResponse.json(
          { error: "Only Master billing users may send DailyBloom payment reminders." },
          { status: 403 }
        );
      }
      const subscriptionId = numberId(body.subscription_id);
      const message = String(body.message || "").trim();
      const scheduledDate = dateOnly(body.scheduled_date);
      if (
        !schoolId ||
        !subscriptionId ||
        message.length < 8 ||
        !scheduledDate ||
        scheduledDate < new Date().toISOString().slice(0, 10)
      ) {
        return NextResponse.json(
          {
            error:
              "Select a subscription, reminder date and payment reminder message.",
          },
          { status: 400 }
        );
      }
      const school = await assertDailyBloomBillableSchool(schoolId);
      if (!school.contact_number) {
        return NextResponse.json(
          { error: "Add a school contact number before sending a payment reminder." },
          { status: 400 }
        );
      }
      const { data: subscription, error: subscriptionError } = await supabaseAdmin
        .from("school_subscriptions")
        .select("id")
        .eq("id", subscriptionId)
        .eq("school_id", schoolId)
        .maybeSingle();
      if (subscriptionError) throw subscriptionError;
      if (!subscription) {
        return NextResponse.json({ error: "Subscription was not found for this school." }, { status: 404 });
      }
      const { error: reminderError } = await supabaseAdmin
        .from("billing_payment_reminders")
        .insert({
          school_id: schoolId,
          subscription_id: subscriptionId,
          phone_number: school.contact_number,
          message,
          scheduled_date: scheduledDate,
          status: "scheduled",
          retry_count: 0,
          sent_by: authorization.staff.userId,
        });
      if (reminderError) throw reminderError;
      await writeSecurityAudit(authorization.staff, "billing.payment_reminder_scheduled", {
        school_id: schoolId,
        subscription_id: subscriptionId,
        scheduled_date: scheduledDate,
      });
      return NextResponse.json({ success: true, scheduled_date: scheduledDate });
    }

    if (action === "post_billing_journal") {
      if (!['master', 'master_admin'].includes(authorization.staff.role)) {
        return NextResponse.json(
          { error: "Only Master billing users may pass billing journals." },
          { status: 403 }
        );
      }
      const subscriptionId = numberId(body.subscription_id);
      const journalType = String(body.journal_type || "");
      const amount = Number(body.amount);
      const effectiveDate = dateOnly(body.effective_date);
      const reason = String(body.reason || "").trim();
      if (
        !schoolId ||
        !subscriptionId ||
        !['credit', 'debit'].includes(journalType) ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        !effectiveDate ||
        effectiveDate > new Date().toISOString().slice(0, 10) ||
        reason.length < 3
      ) {
        return NextResponse.json(
          { error: "Journal type, amount, effective date and reason are required." },
          { status: 400 }
        );
      }
      await assertDailyBloomBillableSchool(schoolId);
      const { data, error } = await supabaseAdmin.rpc("post_school_billing_journal", {
        target_school_id: schoolId,
        target_subscription_id: subscriptionId,
        journal_type: journalType,
        journal_amount: amount,
        effective_on: effectiveDate,
        journal_reason: reason,
        actor_id: authorization.staff.userId,
      });
      if (error) throw error;
      await writeSecurityAudit(authorization.staff, "billing.journal_posted", {
        school_id: schoolId,
        subscription_id: subscriptionId,
        journal_type: journalType,
        amount,
        effective_date: effectiveDate,
        reason,
      });
      return NextResponse.json({ success: true, result: data });
    }

    if (action === "exempt_setup_fee") {
      const reason = String(body.reason || "").trim();
      if (!schoolId || reason.length < 3) {
        return NextResponse.json(
          { error: "Select a school and enter an exemption reason." },
          { status: 400 }
        );
      }

      await assertDailyBloomBillableSchool(schoolId);
      await repairBillingAccount(schoolId, true);
      const { data: invoiceId, error: exemptionError } = await supabaseAdmin.rpc(
        "apply_setup_fee_exemption",
        {
          target_school_id: schoolId,
          exemption_reason: reason,
          actor_id: authorization.staff.userId,
        }
      );
      if (exemptionError) throw exemptionError;

      const billingRepair = await repairBillingAccount(schoolId, true);
      const { data: exemptedInvoice, error: invoiceError } = await supabaseAdmin
        .from("billing_invoices")
        .select("*")
        .eq("id", invoiceId)
        .single();
      if (invoiceError) throw invoiceError;

      await writeSecurityAudit(
        authorization.staff,
        "billing.setup_fee_exempted",
        {
          school_id: schoolId,
          invoice_id: invoiceId,
          reason,
          billing_repair: billingRepair,
        }
      );
      return NextResponse.json({
        success: true,
        invoice: exemptedInvoice,
        invoice_email_sent: false,
        invoice_email_reason: "Email is sent after payment is recorded.",
      });
    }

    if (action === "record_payment") {
      const subscriptionId = numberId(body.subscription_id);
      const amount = Number(body.amount);
      const chargeType = String(body.charge_type || "subscription");
      if (!["setup_fee", "subscription"].includes(chargeType)) {
        return NextResponse.json(
          { error: "A valid payment type is required." },
          { status: 400 }
        );
      }
      if (!schoolId || !subscriptionId || !Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "A valid subscription and payment amount are required." }, { status: 400 });
      await assertDailyBloomBillableSchool(schoolId);
      const { data: subscription } = await supabaseAdmin
        .from("school_subscriptions")
        .select("id, school_id, plan_name, next_billing_date")
        .eq("id", subscriptionId)
        .eq("school_id", schoolId)
        .maybeSingle();
      if (!subscription) return NextResponse.json({ error: "Subscription was not found for this school." }, { status: 404 });
      const today = new Date();
      const paymentDate = String(
        body.payment_date || today.toISOString().slice(0, 10)
      );
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate) ||
        paymentDate > today.toISOString().slice(0, 10)
      ) {
        return NextResponse.json(
          { error: "Enter a valid payment date that is not in the future." },
          { status: 400 }
        );
      }
      const nextBillingDate =
        subscription.next_billing_date ||
        new Date(
          Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1)
        )
          .toISOString()
          .slice(0, 10);
      const receiptNumber = `DB-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}-${subscriptionId}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      const { data: paymentResult, error: paymentError } =
        await supabaseAdmin.rpc("record_school_billing_payment", {
          target_school_id: schoolId,
          target_subscription_id: subscriptionId,
          payment_amount: amount,
          received_on: paymentDate,
          payment_charge_type: chargeType,
          payment_plan_name: String(
            body.plan_name || subscription.plan_name || "Bloom"
          ),
          payment_method_value: String(body.payment_method || "EFT"),
          payment_notes: body.notes || null,
          payment_receipt_number: receiptNumber,
        });
      if (paymentError) throw paymentError;
      const paymentId = Number(
        (paymentResult as { payment_id?: number } | null)?.payment_id || 0
      );
      let receiptDelivery: {
        sent: boolean;
        queued: boolean;
        reason?: string;
      } = { sent: false, queued: true };
      if (paymentId) {
        try {
          const { processBillingReceiptOutbox } = await import(
            "../../lib/billing-receipt-delivery"
          );
          const delivery = await processBillingReceiptOutbox({
            paymentId,
            batchSize: 1,
          });
          const result = delivery.results[0];
          receiptDelivery = {
            sent: Boolean(result?.sent),
            queued: !result?.sent,
            reason: result?.reason,
          };
        } catch (deliveryError) {
          receiptDelivery = {
            sent: false,
            queued: true,
            reason:
              deliveryError instanceof Error
                ? deliveryError.message
                : "Receipt delivery remains queued.",
          };
        }
      }
      await writeSecurityAudit(authorization.staff, "platform.payment_recorded", { school_id: schoolId, subscription_id: subscriptionId, amount, receipt_number: receiptNumber });
      const result = paymentResult as {
        credit_balance?: number;
        outstanding_balance?: number;
        invoice_id?: string | null;
        invoice_download_token?: string | null;
      };
      return NextResponse.json({
        success: true,
        payment_date: paymentDate,
        next_billing_date: nextBillingDate,
        receipt_number: receiptNumber,
        credit_balance: Number(result.credit_balance || 0),
        outstanding_balance: Number(result.outstanding_balance || 0),
        invoice_id: result.invoice_id || null,
        invoice_document_url: result.invoice_download_token
          ? `/api/billing/invoices/document?token=${result.invoice_download_token}`
          : null,
        receipt_email_sent: receiptDelivery.sent,
        receipt_email_queued: receiptDelivery.queued,
        receipt_email_reason: receiptDelivery.reason || null,
      });
    }

    if (action === "adjust_payment") {
      if (!["master", "master_admin"].includes(authorization.staff.role)) {
        return NextResponse.json(
          { error: "Only Master billing users may reverse or refund payments." },
          { status: 403 }
        );
      }
      const paymentId = numberId(body.payment_id);
      const adjustmentType = String(body.adjustment_type || "");
      const amount = Number(body.amount);
      const reason = String(body.reason || "").trim();
      if (
        !schoolId ||
        !paymentId ||
        !["reversal", "refund"].includes(adjustmentType) ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        reason.length < 3
      ) {
        return NextResponse.json(
          { error: "Payment, adjustment type, amount and reason are required." },
          { status: 400 }
        );
      }

      await assertDailyBloomBillableSchool(schoolId);

      const { data: payment, error: paymentLookupError } = await supabaseAdmin
        .from("subscription_payments")
        .select("id, school_id, amount")
        .eq("id", paymentId)
        .eq("school_id", schoolId)
        .maybeSingle();
      if (paymentLookupError) throw paymentLookupError;
      if (!payment) {
        return NextResponse.json(
          { error: "Payment was not found for this school." },
          { status: 404 }
        );
      }

      const { data: adjustment, error: adjustmentError } =
        await supabaseAdmin.rpc("apply_billing_payment_adjustment", {
          target_payment_id: paymentId,
          adjustment_kind: adjustmentType,
          adjustment_amount: amount,
          adjustment_reason: reason,
          actor_id: authorization.staff.userId,
        });
      if (adjustmentError) throw adjustmentError;

      await writeSecurityAudit(
        authorization.staff,
        `billing.payment_${adjustmentType}`,
        {
          school_id: schoolId,
          payment_id: paymentId,
          amount,
          reason,
          result: adjustment,
        }
      );
      return NextResponse.json({ success: true, adjustment });
    }

    const subscriptionId = numberId(body.subscription_id);
    if (!schoolId || !subscriptionId) return NextResponse.json({ error: "Subscription is required." }, { status: 400 });
    await assertDailyBloomBillableSchool(schoolId);
    const { error } = await supabaseAdmin.from("school_subscriptions").update({ status: "overdue", updated_at: new Date().toISOString() }).eq("id", subscriptionId).eq("school_id", schoolId);
    if (error) throw error;
    await supabaseAdmin.from("schools").update({ billing_status: "overdue" }).eq("id", schoolId);
    await writeSecurityAudit(authorization.staff, "platform.subscription_overdue", { school_id: schoolId, subscription_id: subscriptionId });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error &&
            typeof error === "object" &&
            "message" in error &&
            typeof error.message === "string"
          ? error.message
          : "Platform operation failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
