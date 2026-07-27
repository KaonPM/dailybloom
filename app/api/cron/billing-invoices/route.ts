import { NextResponse } from "next/server";
import { generateMonthlyInvoices } from "@/app/lib/billing-ledger";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const billingDate = new Date();
    const monthlyInvoices = await generateMonthlyInvoices(billingDate);
    const learnerChargesResult = await supabaseAdmin.rpc(
      "generate_learner_monthly_fee_charges",
      { target_date: billingDate.toISOString().slice(0, 10) }
    );
    if (learnerChargesResult.error) throw learnerChargesResult.error;
    const learnerChargesCreated = Number(learnerChargesResult.data || 0);

    return NextResponse.json({
      success: true,
      created: monthlyInvoices.length + learnerChargesCreated,
      monthly_created: monthlyInvoices.length,
      learner_fee_charges_created: learnerChargesCreated,
      delivery: "Billing module only. Email is sent after payment is recorded.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Monthly invoices could not be generated.",
      },
      { status: 500 }
    );
  }
}
