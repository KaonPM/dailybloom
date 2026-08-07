import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/app/lib/permissions";
import { requireStaffPermission } from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const learnerId = String(searchParams.get("learner_id") || "").trim();
  const schoolId = Number(searchParams.get("school_id"));

  if (!learnerId || !Number.isFinite(schoolId) || schoolId <= 0) {
    return NextResponse.json(
      { error: "A learner and school are required." },
      { status: 400 }
    );
  }

  const authorization = await requireStaffPermission(
    request,
    PERMISSIONS.BILLING_MANAGE,
    schoolId
  );
  if (!authorization.ok) return authorization.response;

  const [chargeResult, paymentResult, schoolResult, registrationResult, learnerResult] =
    await Promise.all([
      supabaseAdmin
        .from("learner_fee_charges")
        .select("id, description, billing_period, due_date, amount, created_at")
        .eq("school_id", schoolId)
        .eq("learner_id", learnerId)
        .order("billing_period", { ascending: false }),
      supabaseAdmin
        .from("learner_fee_payments")
        .select("id, amount, payment_date, payment_method, reference_number, receipt_number, created_at")
        .eq("school_id", schoolId)
        .eq("learner_id", learnerId)
        .order("payment_date", { ascending: false }),
      supabaseAdmin
        .from("schools")
        .select("id, school_name, logo_url, contact_number, primary_color, secondary_color")
        .eq("id", schoolId)
        .maybeSingle(),
      supabaseAdmin
        .from("dbe_registration")
        .select("email_address, physical_address, contact_number")
        .eq("school_id", schoolId)
        .maybeSingle(),
      supabaseAdmin
        .from("learners")
        .select("id, name, legal_name, monthly_fee")
        .eq("id", learnerId)
        .eq("school_id", schoolId)
        .maybeSingle(),
    ]);

  const queryError =
    chargeResult.error ||
    paymentResult.error ||
    schoolResult.error ||
    registrationResult.error ||
    learnerResult.error;
  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }
  if (!learnerResult.data) {
    return NextResponse.json({ error: "Learner not found." }, { status: 404 });
  }

  const charges = chargeResult.data || [];
  const payments = paymentResult.data || [];
  const totalCharged = charges.reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0
  );
  const totalPaid = payments.reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0
  );

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
        contact_number:
          registrationResult.data?.contact_number ||
          schoolResult.data?.contact_number ||
          null,
      },
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
