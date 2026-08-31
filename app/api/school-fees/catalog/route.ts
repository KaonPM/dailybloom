import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import {
  requireStaffPermission,
  writeSecurityAudit,
} from "@/app/lib/server-authorization";
import { PERMISSIONS } from "@/app/lib/permissions";

type FeeInput = {
  id?: number;
  fee_code?: string;
  fee_name?: string;
  fee_category?: "registration" | "monthly" | "other";
  billing_frequency?: "once_off" | "monthly";
  amount?: number;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const schoolId = Number(url.searchParams.get("school_id"));
  const learnerId = String(url.searchParams.get("learner_id") || "");
  const authorization = await requireStaffPermission(
    request,
    PERMISSIONS.BILLING_MANAGE,
    schoolId
  );
  if (!authorization.ok) return authorization.response;

  const [feesResult, assignmentsResult, recurringAssignmentsResult] = await Promise.all([
    supabaseAdmin
      .from("school_fee_types")
      .select(
        "id, school_id, fee_code, fee_name, fee_category, billing_frequency, amount, is_active"
      )
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .order("fee_category")
      .order("fee_name"),
    learnerId
      ? supabaseAdmin
          .from("learner_fee_assignments")
          .select("fee_type_id")
          .eq("school_id", schoolId)
          .eq("learner_id", learnerId)
          .eq("is_active", true)
      : Promise.resolve({ data: [], error: null }),
    learnerId
      ? supabaseAdmin.from("learner_recurring_fee_assignments").select("fee_type_id, start_date, end_date").eq("school_id", schoolId).eq("learner_id", learnerId).eq("is_active", true)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (feesResult.error || assignmentsResult.error || recurringAssignmentsResult.error) {
    return NextResponse.json(
      { error: feesResult.error?.message || assignmentsResult.error?.message || recurringAssignmentsResult.error?.message },
      { status: 500 }
    );
  }
  return NextResponse.json({
    fees: feesResult.data || [],
    selected_fee_ids: (assignmentsResult.data || []).map((row) =>
      Number(row.fee_type_id)
    ),
    selected_recurring_addon_ids: (recurringAssignmentsResult.data || []).map((row) => Number(row.fee_type_id)),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const schoolId = Number(body.school_id);
    const action = String(body.action || "");
    const authorization = await requireStaffPermission(
      request,
      PERMISSIONS.BILLING_MANAGE,
      schoolId
    );
    if (!authorization.ok) return authorization.response;

    if (action === "save_standard") {
      const registrationAmount = Number(body.registration_amount || 0);
      const monthlyAmount = Number(body.monthly_amount || 0);
      if (registrationAmount < 0 || monthlyAmount < 0) {
        return NextResponse.json(
          { error: "Fee amounts cannot be negative." },
          { status: 400 }
        );
      }
      const rows: FeeInput[] = [
        {
          fee_code: "registration",
          fee_name: "Registration Fee",
          fee_category: "registration",
          billing_frequency: "once_off",
          amount: registrationAmount,
        },
        {
          fee_code: "monthly_school_fee",
          fee_name: "Monthly School Fee",
          fee_category: "monthly",
          billing_frequency: "monthly",
          amount: monthlyAmount,
        },
      ];
      const result = await supabaseAdmin.from("school_fee_types").upsert(
        rows.map((row) => ({
          ...row,
          school_id: schoolId,
          is_active: true,
          created_by: authorization.staff.userId,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "school_id,fee_code" }
      );
      if (result.error) throw result.error;
    } else if (action === "add_other") {
      const feeName = String(body.fee_name || "").trim();
      const amount = Number(body.amount || 0);
      if (!feeName || amount < 0) {
        return NextResponse.json(
          { error: "Enter the fee name and a valid amount." },
          { status: 400 }
        );
      }
      const result = await supabaseAdmin.from("school_fee_types").insert({
        school_id: schoolId,
        fee_code: `other_${crypto.randomUUID()}`,
        fee_name: feeName,
        fee_category: "other",
        billing_frequency: "once_off",
        amount,
        created_by: authorization.staff.userId,
      });
      if (result.error) throw result.error;
    } else if (action === "add_monthly") {
      const feeName = String(body.fee_name || "").trim();
      const amount = Number(body.amount || 0);
      if (!feeName || amount <= 0) {
        return NextResponse.json(
          { error: "Enter the monthly fee name and an amount greater than zero." },
          { status: 400 }
        );
      }
      const result = await supabaseAdmin.from("school_fee_types").insert({
        school_id: schoolId,
        fee_code: `monthly_${crypto.randomUUID()}`,
        fee_name: feeName,
        fee_category: "monthly",
        billing_frequency: "monthly",
        amount,
        created_by: authorization.staff.userId,
      });
      if (result.error) throw result.error;
    } else if (action === "add_recurring_addon") {
      const feeName = String(body.fee_name || "").trim();
      const amount = Number(body.amount || 0);
      if (!feeName || amount <= 0) return NextResponse.json({ error: "Enter the recurring service name and an amount greater than zero." }, { status: 400 });
      const result = await supabaseAdmin.from("school_fee_types").insert({ school_id: schoolId, fee_code: `recurring_${crypto.randomUUID()}`, fee_name: feeName, fee_category: "recurring_addon", billing_frequency: "monthly", amount, created_by: authorization.staff.userId });
      if (result.error) throw result.error;
    } else if (action === "archive_monthly") {
      const feeId = Number(body.fee_id);
      const { count, error: countError } = await supabaseAdmin
        .from("learners")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("monthly_fee_type_id", feeId)
        .or("is_deleted.is.null,is_deleted.eq.false");
      if (countError) throw countError;
      if (count) {
        return NextResponse.json(
          { error: "This monthly fee is still assigned to active learners." },
          { status: 409 }
        );
      }
      const result = await supabaseAdmin
        .from("school_fee_types")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", feeId)
        .eq("school_id", schoolId)
        .eq("fee_category", "monthly")
        .neq("fee_code", "monthly_school_fee");
      if (result.error) throw result.error;
    } else if (action === "archive_other") {
      const feeId = Number(body.fee_id);
      const result = await supabaseAdmin
        .from("school_fee_types")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", feeId)
        .eq("school_id", schoolId)
        .eq("fee_category", "other");
      if (result.error) throw result.error;
    } else if (action === "archive_recurring_addon") {
      const feeId = Number(body.fee_id);
      const { count, error: countError } = await supabaseAdmin.from("learner_recurring_fee_assignments").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("fee_type_id", feeId).eq("is_active", true);
      if (countError) throw countError;
      if (count) return NextResponse.json({ error: "This recurring service is still assigned to active learners." }, { status: 409 });
      const result = await supabaseAdmin.from("school_fee_types").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", feeId).eq("school_id", schoolId).eq("fee_category", "recurring_addon");
      if (result.error) throw result.error;
    } else if (action === "sync_learner") {
      const learnerId = String(body.learner_id || "");
      const selectedFeeIds: number[] = Array.isArray(body.fee_ids)
        ? body.fee_ids.map(Number).filter((id: number) => id > 0)
        : [];
      const learnerResult = await supabaseAdmin
        .from("learners")
        .select("id")
        .eq("id", learnerId)
        .eq("school_id", schoolId)
        .maybeSingle();
      if (!learnerResult.data) {
        return NextResponse.json(
          { error: "Learner was not found in this school." },
          { status: 404 }
        );
      }
      const feeResult = await supabaseAdmin
        .from("school_fee_types")
        .select("id, fee_name, amount")
        .eq("school_id", schoolId)
        .eq("fee_category", "other")
        .eq("is_active", true);
      if (feeResult.error) throw feeResult.error;
      const allowed = new Map(
        (feeResult.data || []).map((fee) => [Number(fee.id), fee])
      );
      const safeIds = selectedFeeIds.filter((id: number) => allowed.has(id));

      const existingResult = await supabaseAdmin
        .from("learner_fee_assignments")
        .select("fee_type_id, is_active")
        .eq("school_id", schoolId)
        .eq("learner_id", learnerId);
      if (existingResult.error) throw existingResult.error;
      const existingActive = new Set(
        (existingResult.data || [])
          .filter((row) => row.is_active)
          .map((row) => Number(row.fee_type_id))
      );

      const deactivateResult = await supabaseAdmin
        .from("learner_fee_assignments")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("school_id", schoolId)
        .eq("learner_id", learnerId);
      if (deactivateResult.error) throw deactivateResult.error;

      if (safeIds.length) {
        const assignmentResult = await supabaseAdmin
          .from("learner_fee_assignments")
          .upsert(
            safeIds.map((feeId) => ({
              school_id: schoolId,
              learner_id: learnerId,
              fee_type_id: feeId,
              assigned_amount: Number(allowed.get(feeId)?.amount || 0),
              is_active: true,
              assigned_by: authorization.staff.userId,
              updated_at: new Date().toISOString(),
            })),
            { onConflict: "school_id,learner_id,fee_type_id" }
          );
        if (assignmentResult.error) throw assignmentResult.error;
      }

      const newIds = safeIds.filter(
        (id: number) => !existingActive.has(id)
      );
      if (newIds.length) {
        const today = new Date().toISOString().slice(0, 10);
        const chargeResult = await supabaseAdmin
          .from("learner_fee_charges")
          .upsert(
            newIds.map((feeId) => ({
              school_id: schoolId,
              learner_id: learnerId,
              charge_type: `other_fee_${feeId}`,
              description: allowed.get(feeId)?.fee_name || "Additional fee",
              billing_period: today,
              due_date: today,
              amount: Number(allowed.get(feeId)?.amount || 0),
              created_by: authorization.staff.userId,
            })),
            {
              onConflict:
                "school_id,learner_id,charge_type,billing_period",
            }
          );
        if (chargeResult.error) throw chargeResult.error;
      }
    } else if (action === "sync_recurring_addons") {
      const learnerId = String(body.learner_id || "");
      const feeIds = Array.isArray(body.fee_ids) ? body.fee_ids.map(Number).filter((id: number) => id > 0) : [];
      const learnerResult = await supabaseAdmin.from("learners").select("id").eq("id", learnerId).eq("school_id", schoolId).maybeSingle();
      if (!learnerResult.data) return NextResponse.json({ error: "Learner was not found in this school." }, { status: 404 });
      const feesResult = await supabaseAdmin.from("school_fee_types").select("id, amount").eq("school_id", schoolId).eq("fee_category", "recurring_addon").eq("is_active", true);
      if (feesResult.error) throw feesResult.error;
      const allowed = new Map((feesResult.data || []).map((fee) => [Number(fee.id), fee]));
      const safeIds = feeIds.filter((id: number) => allowed.has(id));
      const deactivate = await supabaseAdmin.from("learner_recurring_fee_assignments").update({ is_active: false, end_date: body.end_date || null, updated_at: new Date().toISOString() }).eq("school_id", schoolId).eq("learner_id", learnerId);
      if (deactivate.error) throw deactivate.error;
      if (safeIds.length) {
        const startDate = String(body.start_date || `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 2).padStart(2, "0")}-01`);
        const upsert = await supabaseAdmin.from("learner_recurring_fee_assignments").upsert(safeIds.map((feeId: number) => ({ school_id: schoolId, learner_id: learnerId, fee_type_id: feeId, assigned_amount: Number(allowed.get(feeId)?.amount || 0), start_date: startDate, end_date: null, is_active: true, assigned_by: authorization.staff.userId, updated_at: new Date().toISOString() })), { onConflict: "school_id,learner_id,fee_type_id" });
        if (upsert.error) throw upsert.error;
      }
    } else {
      return NextResponse.json(
        { error: "Unknown school fee action." },
        { status: 400 }
      );
    }

    await writeSecurityAudit(authorization.staff, `school_fee.${action}`, {
      school_id: schoolId,
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update school fees.",
      },
      { status: 500 }
    );
  }
}
