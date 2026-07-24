import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/app/lib/permissions";
import {
  requireStaffPermission,
  writeSecurityAudit,
} from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const schoolId = Number(searchParams.get("school_id") || 0);
  const authorization = await requireStaffPermission(
    request,
    PERMISSIONS.BILLING_MANAGE,
    schoolId || null
  );
  if (!authorization.ok) return authorization.response;

  if (!authorization.staff.isPlatformUser && !schoolId) {
    return NextResponse.json({ error: "School context required." }, { status: 400 });
  }

  let invoiceQuery = supabaseAdmin
    .from("billing_invoices")
    .select(
      "id, school_id, subscription_id, invoice_number, charge_type, description, plan_name, issue_date, due_date, period_start, period_end, subtotal, vat_amount, total_amount, amount_paid, balance_due, status, download_token, emailed_at, created_at, schools(id, school_name, logo_url)"
    )
    .order("issue_date", { ascending: false })
    .order("created_at", { ascending: false });

  let paymentQuery = supabaseAdmin
    .from("subscription_payments")
    .select(
      "id, school_id, subscription_id, amount, unapplied_amount, payment_date, charge_type, plan_name, payment_method, notes, receipt_number, created_at"
    )
    .order("payment_date", { ascending: false });

  if (schoolId) {
    invoiceQuery = invoiceQuery.eq("school_id", schoolId);
    paymentQuery = paymentQuery.eq("school_id", schoolId);
  }

  const [invoiceResult, paymentResult] = await Promise.all([
    invoiceQuery,
    paymentQuery,
  ]);
  if (invoiceResult.error) {
    return NextResponse.json({ error: invoiceResult.error.message }, { status: 400 });
  }
  if (paymentResult.error) {
    return NextResponse.json({ error: paymentResult.error.message }, { status: 400 });
  }

  const invoices = invoiceResult.data || [];
  const payments = paymentResult.data || [];
  const outstandingBalance = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.balance_due || 0),
    0
  );
  const creditBalance = payments.reduce(
    (sum, payment) => sum + Number(payment.unapplied_amount || 0),
    0
  );

  return NextResponse.json({
    invoices,
    payments,
    summary: {
      outstanding_balance: outstandingBalance,
      credit_balance: creditBalance,
      open_invoices: invoices.filter((invoice) =>
        ["issued", "partially_paid"].includes(String(invoice.status))
      ).length,
    },
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const schoolId = Number(body.school_id || 0);
  const invoiceId = String(body.invoice_id || "");
  const authorization = await requireStaffPermission(
    request,
    PERMISSIONS.BILLING_MANAGE,
    schoolId || null
  );
  if (!authorization.ok) return authorization.response;
  if (!schoolId || !invoiceId) {
    return NextResponse.json(
      { error: "Invoice and school are required." },
      { status: 400 }
    );
  }

  const { data: invoice, error } = await supabaseAdmin
    .from("billing_invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error || !invoice) {
    return NextResponse.json({ error: "Invoice was not found." }, { status: 404 });
  }

  const { sendInvoiceEmail } = await import("@/app/lib/billing-ledger");
  const result = await sendInvoiceEmail(invoice);
  await writeSecurityAudit(authorization.staff, "billing.invoice_email_requested", {
    school_id: schoolId,
    invoice_id: invoiceId,
    sent: result.sent,
  });

  return NextResponse.json(result, { status: result.sent ? 200 : 400 });
}
