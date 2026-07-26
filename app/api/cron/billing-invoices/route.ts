import { NextResponse } from "next/server";
import { generateMonthlyInvoices } from "@/app/lib/billing-ledger";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const monthlyInvoices = await generateMonthlyInvoices(new Date());

    return NextResponse.json({
      success: true,
      created: monthlyInvoices.length,
      monthly_created: monthlyInvoices.length,
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
