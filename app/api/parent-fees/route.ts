import { NextResponse } from "next/server";
import { getCurrentParent } from "@/app/lib/getCurrentParent";
import { parentCanAccessLearnerAtSchool } from "@/app/lib/parent-authorization-policy";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { statementAccount } from "@/app/lib/learner-fee-statement";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const parent = await getCurrentParent();
  if (!parent) return NextResponse.json({ error: "Parent session required." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const learnerId = String(searchParams.get("learner_id") || "");
  const schoolId = Number(searchParams.get("school_id"));
  const period = String(searchParams.get("period") || "").trim();
  if (!parentCanAccessLearnerAtSchool(parent.children || [], schoolId, learnerId)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }
  if (period && !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return NextResponse.json({ error: "Choose a valid statement month." }, { status: 400 });

  const [chargeResult, paymentResult, schoolResult, registrationResult, learnerResult, bankingResult] = await Promise.all([
    supabaseAdmin.from("learner_fee_charges").select("id, description, billing_period, due_date, amount, is_scheduled, created_at").eq("school_id", schoolId).eq("learner_id", learnerId).order("billing_period", { ascending: false }),
    supabaseAdmin.from("learner_fee_payments").select("id, amount, payment_date, allocation_period, payment_method, reference_number, receipt_number, created_at").eq("school_id", schoolId).eq("learner_id", learnerId).order("payment_date", { ascending: false }),
    supabaseAdmin.from("schools").select("id, school_name, logo_url, contact_number, primary_color, secondary_color").eq("id", schoolId).maybeSingle(),
    supabaseAdmin.from("dbe_registration").select("email_address, physical_address, contact_number").eq("school_id", schoolId).maybeSingle(),
    supabaseAdmin.from("learners").select("id, name, legal_name, monthly_fee").eq("id", learnerId).eq("school_id", schoolId).maybeSingle(),
    supabaseAdmin.from("school_setup_settings").select("bank_account_name, bank_name, bank_account_number, bank_branch_code, bank_account_type").eq("school_id", schoolId).maybeSingle(),
  ]);
  if (chargeResult.error || paymentResult.error || schoolResult.error || learnerResult.error || bankingResult.error) {
    return NextResponse.json(
      { error: chargeResult.error?.message || paymentResult.error?.message || schoolResult.error?.message || learnerResult.error?.message || bankingResult.error?.message },
      { status: 500 }
    );
  }

  const allCharges = chargeResult.data || [];
  const allocationResult = allCharges.length
    ? await supabaseAdmin.from("learner_fee_allocations").select("charge_id, payment_id, amount").in("charge_id", allCharges.map((charge) => charge.id))
    : { data: [], error: null };
  if (allocationResult.error) return NextResponse.json({ error: allocationResult.error.message }, { status: 500 });
  const account = statementAccount(allCharges, paymentResult.data || [], allocationResult.data || [], period || null);
  return NextResponse.json(
    {
      charges: account.charges,
      payments: account.payments,
      total_charged: account.totalCharged,
      total_paid: account.totalPaid,
      balance: account.balance,
      opening_balance: account.openingBalance,
      statement_period: period || null,
      learner: learnerResult.data,
      school: {
        ...(schoolResult.data || {}),
        email_address: registrationResult.data?.email_address || null,
        physical_address: registrationResult.data?.physical_address || null,
        contact_number: registrationResult.data?.contact_number || schoolResult.data?.contact_number || null,
        banking_details: bankingResult.data || null,
      },
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
