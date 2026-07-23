import { NextResponse } from "next/server";
import { platformOperationPermission } from "../../lib/platform-operation-policy";
import { requireStaffPermission, writeSecurityAudit } from "../../lib/server-authorization";
import { supabaseAdmin } from "../../lib/supabase-admin";

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
      await writeSecurityAudit(authorization.staff, "platform.onboarding_updated", { school_id: schoolId });
      return NextResponse.json({ success: true });
    }

    if (action === "activate_school") {
      if (!schoolId) return NextResponse.json({ error: "School is required." }, { status: 400 });
      const now = new Date().toISOString();
      const { error: schoolError } = await supabaseAdmin.from("schools").update({ status: "active", activated_at: now }).eq("id", schoolId);
      if (schoolError) throw schoolError;
      const { error: onboardingError } = await supabaseAdmin.from("school_onboarding").upsert({ school_id: schoolId, onboarding_status: "Activated", updated_at: now }, { onConflict: "school_id" });
      if (onboardingError) throw onboardingError;
      await writeSecurityAudit(authorization.staff, "platform.school_activated", { school_id: schoolId });
      return NextResponse.json({ success: true });
    }

    if (action === "save_subscription") {
      if (!schoolId) return NextResponse.json({ error: "School is required." }, { status: 400 });
      const planName = String(body.plan_name || "").trim();
      const monthlyPrice = Number(body.monthly_price);
      const status = String(body.status || "trial");
      if (!planName || !Number.isFinite(monthlyPrice) || monthlyPrice < 0) return NextResponse.json({ error: "A valid plan is required." }, { status: 400 });
      const { error } = await supabaseAdmin.from("school_subscriptions").upsert({ school_id: schoolId, plan_name: planName, monthly_price: monthlyPrice, status, next_billing_date: body.next_billing_date || null, updated_at: new Date().toISOString() }, { onConflict: "school_id" });
      if (error) throw error;
      await supabaseAdmin.from("schools").update({ billing_status: status }).eq("id", schoolId);
      await writeSecurityAudit(authorization.staff, "platform.subscription_saved", { school_id: schoolId, plan_name: planName, status });
      return NextResponse.json({ success: true });
    }

    if (action === "record_payment") {
      const subscriptionId = numberId(body.subscription_id);
      const amount = Number(body.amount);
      if (!schoolId || !subscriptionId || !Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "A valid subscription and payment amount are required." }, { status: 400 });
      const { data: subscription } = await supabaseAdmin.from("school_subscriptions").select("id, school_id").eq("id", subscriptionId).eq("school_id", schoolId).maybeSingle();
      if (!subscription) return NextResponse.json({ error: "Subscription was not found for this school." }, { status: 404 });
      const today = new Date();
      const nextDate = new Date(today);
      nextDate.setMonth(nextDate.getMonth() + 1);
      const paymentDate = today.toISOString().slice(0, 10);
      const nextBillingDate = nextDate.toISOString().slice(0, 10);
      const receiptNumber = `DB-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}-${subscriptionId}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      const { error: paymentError } = await supabaseAdmin.from("subscription_payments").insert({ school_id: schoolId, subscription_id: subscriptionId, amount, payment_date: paymentDate, payment_method: String(body.payment_method || "EFT"), notes: body.notes || null, receipt_number: receiptNumber });
      if (paymentError) throw paymentError;
      const { error: subscriptionError } = await supabaseAdmin.from("school_subscriptions").update({ status: "active", last_payment_date: paymentDate, next_billing_date: nextBillingDate, updated_at: new Date().toISOString() }).eq("id", subscriptionId);
      if (subscriptionError) throw subscriptionError;
      await supabaseAdmin.from("schools").update({ billing_status: "active" }).eq("id", schoolId);
      await writeSecurityAudit(authorization.staff, "platform.payment_recorded", { school_id: schoolId, subscription_id: subscriptionId, amount, receipt_number: receiptNumber });
      return NextResponse.json({ success: true, payment_date: paymentDate, next_billing_date: nextBillingDate, receipt_number: receiptNumber });
    }

    const subscriptionId = numberId(body.subscription_id);
    if (!schoolId || !subscriptionId) return NextResponse.json({ error: "Subscription is required." }, { status: 400 });
    const { error } = await supabaseAdmin.from("school_subscriptions").update({ status: "overdue", updated_at: new Date().toISOString() }).eq("id", subscriptionId).eq("school_id", schoolId);
    if (error) throw error;
    await supabaseAdmin.from("schools").update({ billing_status: "overdue" }).eq("id", schoolId);
    await writeSecurityAudit(authorization.staff, "platform.subscription_overdue", { school_id: schoolId, subscription_id: subscriptionId });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Platform operation failed." }, { status: 400 });
  }
}
