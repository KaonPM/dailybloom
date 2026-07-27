import { NextResponse } from "next/server";
import { getCurrentParent } from "@/app/lib/getCurrentParent";
import { parentCanAccessLearnerAtSchool } from "@/app/lib/parent-authorization-policy";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const parent = await getCurrentParent();
  if (!parent) return NextResponse.json({ error: "Parent session required." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const learnerId = String(searchParams.get("learner_id") || "");
  const schoolId = Number(searchParams.get("school_id"));
  if (!parentCanAccessLearnerAtSchool(parent.children || [], schoolId, learnerId)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const [chargeResult, paymentResult, schoolResult, registrationResult, learnerResult] = await Promise.all([
    supabaseAdmin.from("learner_fee_charges").select("id, description, billing_period, due_date, amount, created_at").eq("school_id", schoolId).eq("learner_id", learnerId).order("billing_period", { ascending: false }),
    supabaseAdmin.from("learner_fee_payments").select("id, amount, payment_date, payment_method, reference_number, receipt_number, created_at").eq("school_id", schoolId).eq("learner_id", learnerId).order("payment_date", { ascending: false }),
    supabaseAdmin.from("schools").select("id, school_name, logo_url, contact_number, primary_color, secondary_color").eq("id", schoolId).maybeSingle(),
    supabaseAdmin.from("dbe_registration").select("email_address, physical_address, contact_number").eq("school_id", schoolId).maybeSingle(),
    supabaseAdmin.from("learners").select("id, name, legal_name, monthly_fee").eq("id", learnerId).eq("school_id", schoolId).maybeSingle(),
  ]);
  if (chargeResult.error || paymentResult.error || schoolResult.error || learnerResult.error) {
    return NextResponse.json(
      { error: chargeResult.error?.message || paymentResult.error?.message || schoolResult.error?.message || learnerResult.error?.message },
      { status: 500 }
    );
  }

  const charges = chargeResult.data || [];
  const payments = paymentResult.data || [];
  const totalCharged = charges.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const totalPaid = payments.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  return NextResponse.json(
    {
      charges,
      payments,
      total_charged: totalCharged,
      total_paid: totalPaid,
      balance: totalCharged - totalPaid,
      learner: learnerResult.data,
      school: {
        ...(schoolResult.data || {}),
        email_address: registrationResult.data?.email_address || null,
        physical_address: registrationResult.data?.physical_address || null,
        contact_number: registrationResult.data?.contact_number || schoolResult.data?.contact_number || null,
      },
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
