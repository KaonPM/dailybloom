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
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(
    50,
    Math.max(10, Number(searchParams.get("page_size") || 10))
  );
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
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
      "id, school_id, subscription_id, invoice_number, charge_type, description, plan_name, issue_date, due_date, period_start, period_end, subtotal, total_amount, amount_paid, balance_due, status, download_token, emailed_at, exemption_reason, exempted_at, created_at, schools(id, school_name, logo_url)",
      { count: "exact" }
    )
    .neq("status", "void")
    .order("issue_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  let paymentQuery = supabaseAdmin
    .from("subscription_payments")
    .select(
      "id, school_id, subscription_id, amount, original_amount, unapplied_amount, payment_date, charge_type, plan_name, payment_method, notes, receipt_number, created_at, schools(id, school_name, logo_url)",
      { count: "exact" }
    )
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);
  let journalQuery = supabaseAdmin
    .from("billing_journal_entries")
    .select(
      "id, school_id, invoice_id, entry_type, amount, reason, created_at, schools(id, school_name, logo_url)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);
  let adjustmentQuery = supabaseAdmin
    .from("billing_payment_adjustments")
    .select(
      "id, school_id, payment_id, adjustment_type, amount, reason, created_at, schools(id, school_name, logo_url)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (schoolId) {
    invoiceQuery = invoiceQuery.eq("school_id", schoolId);
    paymentQuery = paymentQuery.eq("school_id", schoolId);
    journalQuery = journalQuery.eq("school_id", schoolId);
    adjustmentQuery = adjustmentQuery.eq("school_id", schoolId);
  }

  const [invoiceResult, paymentResult, journalResult, adjustmentResult] = await Promise.all([
    invoiceQuery,
    paymentQuery,
    journalQuery,
    adjustmentQuery,
  ]);
  if (invoiceResult.error) {
    return NextResponse.json({ error: invoiceResult.error.message }, { status: 400 });
  }
  if (paymentResult.error) {
    return NextResponse.json({ error: paymentResult.error.message }, { status: 400 });
  }
  if (journalResult.error) {
    return NextResponse.json({ error: journalResult.error.message }, { status: 400 });
  }
  if (adjustmentResult.error) {
    return NextResponse.json(
      { error: adjustmentResult.error.message },
      { status: 400 }
    );
  }

  const invoices = invoiceResult.data || [];
  const payments = paymentResult.data || [];
  const journals = journalResult.data || [];
  const adjustments = adjustmentResult.data || [];
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
    journals,
    adjustments,
    pagination: {
      page,
      page_size: pageSize,
      invoice_total: invoiceResult.count || 0,
      payment_total: paymentResult.count || 0,
      journal_total: journalResult.count || 0,
      adjustment_total: adjustmentResult.count || 0,
      has_more:
        to + 1 < (invoiceResult.count || 0) ||
        to + 1 < (paymentResult.count || 0) ||
        to + 1 < (journalResult.count || 0) ||
        to + 1 < (adjustmentResult.count || 0),
    },
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
