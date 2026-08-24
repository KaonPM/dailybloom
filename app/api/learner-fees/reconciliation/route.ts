import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/app/lib/permissions";
import {
  requireStaffPermission,
  writeSecurityAudit,
} from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export const dynamic = "force-dynamic";

const journalScopes = new Set([
  "opening_balance",
  "monthly_fee",
  "registration_fee",
  "correction",
]);

function periodFor(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function periodLabel(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-ZA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function scopeLabel(scope: string) {
  return {
    opening_balance: "Opening balance",
    monthly_fee: "School-fee adjustment",
    registration_fee: "Registration-fee adjustment",
    correction: "Account correction",
  }[scope] || "Account journal";
}

async function allocateCredit({
  schoolId,
  learnerId,
  paymentId,
  amount,
  allocationPeriod,
  entryScope,
}: {
  schoolId: number;
  learnerId: string;
  paymentId: number;
  amount: number;
  allocationPeriod: string | null;
  entryScope: string;
}) {
  const chargesResult = await supabaseAdmin
    .from("learner_fee_charges")
    .select("id, amount, billing_period, is_scheduled")
    .eq("school_id", schoolId)
    .eq("learner_id", learnerId)
    .eq("is_scheduled", false)
    .order("billing_period", { ascending: true })
    .order("id", { ascending: true });
  if (chargesResult.error) throw chargesResult.error;

  const charges = chargesResult.data || [];
  const chargeIds = charges.map((charge) => charge.id);
  const allocationsResult = chargeIds.length
    ? await supabaseAdmin
        .from("learner_fee_allocations")
        .select("charge_id, amount")
        .in("charge_id", chargeIds)
    : { data: [], error: null };
  if (allocationsResult.error) throw allocationsResult.error;

  const allocated = new Map<number, number>();
  for (const row of allocationsResult.data || []) {
    const chargeId = Number(row.charge_id);
    allocated.set(chargeId, (allocated.get(chargeId) || 0) + Number(row.amount || 0));
  }

  const journalChargesResult = entryScope === "registration_fee"
    ? await supabaseAdmin
        .from("learner_fee_journal_entries")
        .select("charge_id")
        .eq("school_id", schoolId)
        .eq("learner_id", learnerId)
        .eq("entry_scope", "registration_fee")
        .not("charge_id", "is", null)
    : { data: [], error: null };
  if (journalChargesResult.error) throw journalChargesResult.error;
  const priorityChargeIds = new Set(
    (journalChargesResult.data || []).map((entry) => Number(entry.charge_id))
  );
  const orderedCharges = [...charges].sort((left, right) => {
    const leftRegistration = priorityChargeIds.has(Number(left.id)) ? 0 : 1;
    const rightRegistration = priorityChargeIds.has(Number(right.id)) ? 0 : 1;
    if (leftRegistration !== rightRegistration) return leftRegistration - rightRegistration;
    const leftMonth = allocationPeriod && left.billing_period === allocationPeriod ? 0 : 1;
    const rightMonth = allocationPeriod && right.billing_period === allocationPeriod ? 0 : 1;
    return leftMonth - rightMonth;
  });
  let remaining = amount;
  const rows: Array<{ payment_id: number; charge_id: number; amount: number }> = [];
  for (const charge of orderedCharges) {
    if (remaining <= 0) break;
    const outstanding = Math.max(
      0,
      Number(charge.amount || 0) - (allocated.get(Number(charge.id)) || 0)
    );
    const applied = Math.min(remaining, outstanding);
    if (applied > 0) {
      rows.push({ payment_id: paymentId, charge_id: Number(charge.id), amount: applied });
      remaining -= applied;
    }
  }
  if (rows.length) {
    const insertResult = await supabaseAdmin.from("learner_fee_allocations").insert(rows);
    if (insertResult.error) throw insertResult.error;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = String(body.action || "");
    const schoolId = Number(body.school_id);
    const authorization = await requireStaffPermission(
      request,
      PERMISSIONS.BILLING_MANAGE,
      schoolId
    );
    if (!authorization.ok) return authorization.response;

    if (action === "create_year_schedule") {
      const year = Number(body.year);
      if (!Number.isInteger(year) || year < 2020 || year > 2100) {
        return NextResponse.json({ error: "Choose a valid billing year." }, { status: 400 });
      }
      const learnersResult = await supabaseAdmin
        .from("learners")
        .select("id, monthly_fee, fee_billing_start_date")
        .eq("school_id", schoolId)
        .or("is_deleted.is.null,is_deleted.eq.false")
        .gt("monthly_fee", 0);
      if (learnersResult.error) throw learnersResult.error;

      const currentPeriod = periodFor(new Date().getFullYear(), new Date().getMonth() + 1);
      const rows: Array<Record<string, unknown>> = [];
      for (const learner of learnersResult.data || []) {
        const start = String(learner.fee_billing_start_date || `${year}-01-01`);
        for (let month = 1; month <= 12; month += 1) {
          const billingPeriod = periodFor(year, month);
          if (billingPeriod < start) continue;
          rows.push({
            school_id: schoolId,
            learner_id: learner.id,
            charge_type: "monthly_fee",
            description: `School fees - ${periodLabel(year, month)}`,
            billing_period: billingPeriod,
            due_date: billingPeriod,
            amount: Number(learner.monthly_fee || 0),
            created_by: authorization.staff.userId,
            is_scheduled: billingPeriod > currentPeriod,
          });
        }
      }
      if (rows.length) {
        const result = await supabaseAdmin
          .from("learner_fee_charges")
          .upsert(rows, {
            onConflict: "school_id,learner_id,charge_type,billing_period",
            ignoreDuplicates: true,
          });
        if (result.error) throw result.error;
      }
      await writeSecurityAudit(authorization.staff, "learner_fee.year_schedule_created", {
        school_id: schoolId,
        year,
        planned_charge_count: rows.length,
      });
      return NextResponse.json({ success: true, planned_charge_count: rows.length });
    }

    if (action !== "record_journal") {
      return NextResponse.json({ error: "Unknown reconciliation action." }, { status: 400 });
    }

    const learnerId = String(body.learner_id || "");
    const entryType = String(body.entry_type || "");
    const entryScope = String(body.entry_scope || "");
    const amount = Number(body.amount);
    const effectiveDate = String(body.effective_date || "");
    const allocationPeriod = body.allocation_period ? String(body.allocation_period) : null;
    const reason = String(body.reason || "").trim();
    if (
      !learnerId ||
      !["debit", "credit"].includes(entryType) ||
      !journalScopes.has(entryScope) ||
      !Number.isFinite(amount) || amount <= 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) ||
      effectiveDate > new Date().toISOString().slice(0, 10) ||
      reason.length < 3
    ) {
      return NextResponse.json(
        { error: "Complete a valid learner, journal type, amount, past or current effective date, and reason." },
        { status: 400 }
      );
    }
    if (allocationPeriod && !/^\d{4}-\d{2}-01$/.test(allocationPeriod)) {
      return NextResponse.json({ error: "Choose a valid allocation month." }, { status: 400 });
    }

    const learnerResult = await supabaseAdmin
      .from("learners")
      .select("id, name")
      .eq("id", learnerId)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (learnerResult.error) throw learnerResult.error;
    if (!learnerResult.data) return NextResponse.json({ error: "Learner not found in this school." }, { status: 404 });

    let journalReference: number;
    if (entryType === "debit") {
      const chargeResult = await supabaseAdmin
        .from("learner_fee_charges")
        .insert({
          school_id: schoolId,
          learner_id: learnerId,
          charge_type: `journal_debit_${crypto.randomUUID()}`,
          description: `${scopeLabel(entryScope)} debit - ${reason}`,
          billing_period: effectiveDate,
          due_date: effectiveDate,
          amount,
          created_by: authorization.staff.userId,
          is_scheduled: false,
        })
        .select("id")
        .single();
      if (chargeResult.error || !chargeResult.data) throw chargeResult.error || new Error("Could not record debit journal.");
      const journalResult = await supabaseAdmin
        .from("learner_fee_journal_entries")
        .insert({
          school_id: schoolId, learner_id: learnerId, entry_type: entryType,
          entry_scope: entryScope, amount, effective_date: effectiveDate,
          allocation_period: allocationPeriod, reason, charge_id: chargeResult.data.id,
          created_by: authorization.staff.userId,
        })
        .select("id")
        .single();
      if (journalResult.error || !journalResult.data) throw journalResult.error || new Error("Could not create journal audit entry.");
      journalReference = Number(journalResult.data.id);
    } else {
      const receipt = `PS-JRN-${effectiveDate.replaceAll("-", "")}-${schoolId}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      const paymentResult = await supabaseAdmin
        .from("learner_fee_payments")
        .insert({
          school_id: schoolId, learner_id: learnerId, amount, payment_date: effectiveDate,
          payment_method: "Journal credit", reference_number: reason, receipt_number: receipt,
          recorded_by: authorization.staff.userId, entry_source: "journal_credit",
          allocation_period: allocationPeriod,
        })
        .select("id")
        .single();
      if (paymentResult.error || !paymentResult.data) throw paymentResult.error || new Error("Could not record credit journal.");
      await allocateCredit({
        schoolId, learnerId, paymentId: Number(paymentResult.data.id), amount,
        allocationPeriod, entryScope,
      });
      const journalResult = await supabaseAdmin
        .from("learner_fee_journal_entries")
        .insert({
          school_id: schoolId, learner_id: learnerId, entry_type: entryType,
          entry_scope: entryScope, amount, effective_date: effectiveDate,
          allocation_period: allocationPeriod, reason, payment_id: paymentResult.data.id,
          created_by: authorization.staff.userId,
        })
        .select("id")
        .single();
      if (journalResult.error || !journalResult.data) throw journalResult.error || new Error("Could not create journal audit entry.");
      journalReference = Number(journalResult.data.id);
    }

    await writeSecurityAudit(authorization.staff, "learner_fee.journal_recorded", {
      school_id: schoolId, learner_id: learnerId, entry_type: entryType,
      entry_scope: entryScope, amount, effective_date: effectiveDate,
      journal_entry_id: journalReference,
    });
    return NextResponse.json({ success: true, journal_entry_id: journalReference });
  } catch (error) {
    console.error("Learner fee reconciliation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update learner fee reconciliation." },
      { status: 500 }
    );
  }
}
