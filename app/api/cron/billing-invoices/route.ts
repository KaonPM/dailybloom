import { NextResponse } from "next/server";
import {
  generateMonthlyInvoices,
  reconcileSetupFeeInvoices,
  sendInvoiceEmail,
} from "@/app/lib/billing-ledger";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const setupInvoices = await reconcileSetupFeeInvoices();
    const monthlyInvoices = await generateMonthlyInvoices(new Date());
    const invoices = [...setupInvoices, ...monthlyInvoices];
    const delivery = [];

    for (const invoice of invoices) {
      const result = await sendInvoiceEmail(invoice);
      delivery.push({
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        sent: result.sent,
        reason: result.sent ? null : result.reason,
      });
    }

    return NextResponse.json({
      success: true,
      created: invoices.length,
      setup_created: setupInvoices.length,
      monthly_created: monthlyInvoices.length,
      delivery,
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
