import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    return new NextResponse("Invoice link is invalid.", { status: 400 });
  }

  const { data: invoice, error } = await supabaseAdmin
    .from("billing_invoices")
    .select(
      "id, school_id, invoice_number, description, plan_name, charge_type, issue_date, due_date, period_start, period_end, subtotal, vat_amount, total_amount, amount_paid, balance_due, status, exemption_reason, exempted_at, schools(school_name)"
    )
    .eq("download_token", token)
    .maybeSingle();

  if (error || !invoice) {
    return new NextResponse("Invoice was not found.", { status: 404 });
  }

  const school = Array.isArray(invoice.schools)
    ? invoice.schools[0]
    : invoice.schools;
  const isExempted = Boolean(invoice.exempted_at);
  const isPaid = invoice.status === "paid" && !isExempted;
  const title = isPaid ? "Payment Receipt" : "Invoice";
  const [accountInvoiceResult, accountPaymentResult, subscriptionResult] =
    await Promise.all([
    supabaseAdmin
      .from("billing_invoices")
      .select(
        "id, issue_date, charge_type, description, plan_name, total_amount, status"
      )
      .eq("school_id", invoice.school_id)
      .neq("status", "void"),
    supabaseAdmin
      .from("subscription_payments")
      .select(
        "id, payment_date, amount, charge_type, plan_name, payment_method, receipt_number"
      )
      .eq("school_id", invoice.school_id),
    supabaseAdmin
      .from("school_subscriptions")
      .select("plan_name, monthly_price, next_billing_date, status")
      .eq("school_id", invoice.school_id)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (
    accountInvoiceResult.error ||
    accountPaymentResult.error ||
    subscriptionResult.error
  ) {
    return new NextResponse("Billing account could not be loaded.", {
      status: 500,
    });
  }
  const { data: allocations } = await supabaseAdmin
    .from("billing_payment_allocations")
    .select(
      "amount, subscription_payments(payment_date, charge_type, plan_name, payment_method, receipt_number)"
    )
    .eq("invoice_id", invoice.id)
    .order("created_at", { ascending: true });
  const paymentDetails = (allocations || [])
    .map((allocation) => {
      const relation = allocation.subscription_payments;
      const payment = Array.isArray(relation) ? relation[0] : relation;
      if (!payment) return "";
      return `<div class="row"><span>${escapeHtml(
        payment.charge_type === "setup_fee"
          ? "Setup Fee"
          : "Subscription Fee"
      )} · ${escapeHtml(payment.plan_name || invoice.plan_name || "DailyBloom")} Package · ${escapeHtml(
        payment.payment_method || "Method not set"
      )}</span><span>R${money(allocation.amount)}</span></div>
      <div class="muted" style="font-size:12px;margin:-3px 0 8px">${escapeHtml(
        payment.payment_date
      )} · ${escapeHtml(payment.receipt_number || "")}</div>`;
    })
    .join("");
  void paymentDetails;
  let runningBalance = Number(invoice.total_amount || 0);
  const paymentLedgerRows = (allocations || [])
    .map((allocation) => {
      const relation = allocation.subscription_payments;
      const payment = Array.isArray(relation) ? relation[0] : relation;
      if (!payment) return "";
      runningBalance = Math.max(
        0,
        runningBalance - Number(allocation.amount || 0)
      );
      return `<tr>
        <td>${escapeHtml(payment.payment_date)}</td>
        <td>Payment received · ${escapeHtml(
          payment.payment_method || "Method not set"
        )}<br><small class="muted">${escapeHtml(
          payment.receipt_number || ""
        )}</small></td>
        <td>—</td>
        <td>R${money(allocation.amount)}</td>
        <td>R${money(runningBalance)}</td>
      </tr>`;
    })
    .join("");
  const invoiceLedgerRows = `<tr>
    <td>${escapeHtml(invoice.issue_date)}</td>
    <td>${escapeHtml(invoice.description)}</td>
    <td>R${money(invoice.total_amount)}</td>
    <td>—</td>
    <td>R${money(invoice.total_amount)}</td>
  </tr>${paymentLedgerRows}`;
  void invoiceLedgerRows;

  const accountActivities = [
    ...(accountInvoiceResult.data || []).map((accountInvoice) => ({
      key: `invoice-${accountInvoice.id}`,
      date: String(accountInvoice.issue_date),
      order: 0,
      description:
        accountInvoice.charge_type === "setup_fee"
          ? `DailyBloom Setup Fee · ${
              accountInvoice.plan_name || "DailyBloom"
            } Package`
          : String(accountInvoice.description),
      invoiced: Number(accountInvoice.total_amount || 0),
      payment: 0,
      reference: "",
    })),
    ...(accountPaymentResult.data || []).map((payment) => ({
      key: `payment-${payment.id}`,
      date: String(payment.payment_date),
      order: 1,
      description: `Payment received · ${
        payment.payment_method || "Method not set"
      }`,
      invoiced: 0,
      payment: Number(payment.amount || 0),
      reference: String(payment.receipt_number || ""),
    })),
  ].sort(
    (left, right) =>
      left.date.localeCompare(right.date) || left.order - right.order
  );

  let accountBalance = 0;
  let totalInvoiced = 0;
  let totalPayments = 0;
  const accountLedgerRows = accountActivities
    .map((activity) => {
      totalInvoiced += activity.invoiced;
      totalPayments += activity.payment;
      accountBalance += activity.invoiced - activity.payment;
      return `<tr>
        <td>${escapeHtml(activity.date)}</td>
        <td>${escapeHtml(activity.description)}${
          activity.reference
            ? `<br><small class="muted">${escapeHtml(activity.reference)}</small>`
            : ""
        }</td>
        <td>${activity.invoiced ? `R${money(activity.invoiced)}` : "—"}</td>
        <td>${activity.payment ? `R${money(activity.payment)}` : "—"}</td>
        <td>${accountBalanceLabel(accountBalance)}</td>
      </tr>`;
    })
    .join("");
  const accountPosition =
    accountBalance > 0.005
      ? accountBalance
      : accountBalance < -0.005
        ? accountBalance
        : 0;
  const subscription = subscriptionResult.data;
  const nextInvoiceDate =
    subscription?.next_billing_date ||
    new Date(
      Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)
    )
      .toISOString()
      .slice(0, 10);
  const nextInvoiceText = subscription
    ? `Next invoice R${money(subscription.monthly_price)} · ${escapeHtml(
        subscription.plan_name || "DailyBloom"
      )} Package · due ${escapeHtml(nextInvoiceDate)}`
    : "The next invoice will be created when a subscription package is active.";
  const html = `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <meta name="robots" content="noindex,nofollow" />
      <title>${escapeHtml(title)} ${escapeHtml(invoice.invoice_number)}</title>
      <style>
        *{box-sizing:border-box} body{margin:0;background:#fff8f2;color:#2d2a3e;font-family:Arial,sans-serif}
        .page{max-width:940px;margin:28px auto;background:#fff;border:1px solid #eadfd8;border-radius:24px;padding:40px;box-shadow:0 18px 50px rgba(50,40,70,.1)}
        .head{display:flex;justify-content:space-between;gap:24px;border-bottom:5px solid #75c7ea;padding-bottom:24px}
        .brand{width:250px;height:76px;overflow:hidden}.brand img{display:block;width:250px;height:250px;transform:translateY(-87px)}.company{margin-top:10px;font-size:13px;line-height:1.6;color:#6f6880}.company strong{display:block;color:#2d2a3e;font-size:14px}.doc{text-align:right}.doc h2{margin:0 0 8px;font-size:30px}
        .grid{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:22px;margin:28px 0;padding:20px;border-radius:16px;background:#fffaf6}.grid strong{display:block;margin-bottom:12px}.grid p{margin:0}.muted{color:#6f6880}
        .section-title{margin:30px 0 4px;font-size:18px}.section-helper{margin:0;color:#6f6880;font-size:13px}
        .table-wrap{overflow-x:auto;border:1px solid #eadfd8;border-radius:15px;margin:18px 0 24px}table{width:100%;min-width:720px;border-collapse:collapse;font-size:13px}th,td{padding:12px 10px;border-bottom:1px solid #eee;text-align:left;vertical-align:top}th{background:#f8f5fb;color:#675e78}tr:last-child td{border-bottom:0}th:nth-child(n+3),td:nth-child(n+3){text-align:right;white-space:nowrap}
        .totals{margin-left:auto;max-width:390px;padding:18px;border-radius:16px;background:#f8f5fb}.row{display:flex;justify-content:space-between;padding:8px 0}.total{font-size:20px;font-weight:800;border-top:2px solid #2d2a3e;margin-top:6px;padding-top:12px}.next-invoice{margin:8px 0 0;text-align:right;color:#6f6880;font-size:10px;line-height:1.5}
        .status{display:inline-block;padding:8px 12px;border-radius:999px;background:${isPaid ? "#e9f8ed" : "#fff4d3"};color:${isPaid ? "#267244" : "#805d00"};font-weight:700}
        .note{margin-top:24px;background:#fff4d8;border:1px solid #f2dda0;border-radius:14px;padding:15px;font-size:13px}.footer{display:flex;justify-content:space-between;gap:18px;margin-top:28px;padding-top:18px;border-top:1px solid #eadfd8;color:#6f6880;font-size:12px;line-height:1.6}.actions{text-align:center;margin:22px}.actions button{border:0;border-radius:12px;background:#75c7ea;color:#fff;padding:13px 20px;font-weight:700;cursor:pointer}
        @media print{body{background:#fff}.page{margin:0;max-width:none;border:0;box-shadow:none}.actions{display:none}} @media(max-width:600px){.page{margin:0;border-radius:0;padding:24px}.head,.grid{grid-template-columns:1fr;display:grid}.doc{text-align:left}}
      </style>
    </head>
    <body>
      <div class="actions"><button onclick="window.print()">Print or save as PDF</button></div>
      <main class="page">
        <div class="head">
          <div><div class="brand"><img src="/icon-512.png" alt="DailyBloom — Where preschools bloom every day" /></div></div>
          <div class="company"><strong>DailyBloom</strong>A subsidiary of Lesedi Smart Solutions (Pty) Ltd<br>info@dailybloom.co.za · www.dailybloom.co.za</div>
          <div class="doc"><h2>${escapeHtml(title)}</h2><div>${escapeHtml(invoice.invoice_number)}</div></div>
        </div>
        <div class="grid">
          <div><strong>Billed to</strong><p>${escapeHtml(school?.school_name || "Preschool")}</p></div>
          <div><strong>Issue date</strong><p>${escapeHtml(invoice.issue_date)}</p></div>
          <div><strong>Due date</strong><p>${escapeHtml(invoice.due_date)}</p></div>
        </div>
        <h3 class="section-title">Billing</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>Date</th><th>Account activity</th><th>Invoiced</th><th>Payment</th><th>Running total</th></tr></thead>
          <tbody>${accountLedgerRows}</tbody>
        </table></div>
        <div class="totals">
          <div class="row"><span>Total invoiced</span><span>R${money(totalInvoiced)}</span></div>
          <div class="row"><span>VAT</span><span>R0.00</span></div>
          <div class="row"><span>Total payments</span><span>R${money(totalPayments)}</span></div>
          <div class="row total"><span>Running Total</span><span>${signedCurrency(accountPosition)}</span></div>
          <p class="next-invoice">${nextInvoiceText}</p>
        </div>
        ${
          invoice.exempted_at
            ? `<div class="note"><strong>Setup fee exempted</strong><p>${escapeHtml(
                invoice.exemption_reason || "Approved exemption"
              )}</p><p>No setup-fee payment is required.</p></div>`
            : ""
        }
        <div class="note">DailyBloom is not currently registered for VAT. No VAT has been charged.</div>
        <div class="footer"><span>DailyBloom · Preschool management made simpler</span><span>Lesedi Smart Solutions (Pty) Ltd</span></div>
      </main>
    </body>
  </html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow",
      "Content-Security-Policy":
        "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline';",
    },
  });
}

function money(value: unknown) {
  return Number(value || 0).toFixed(2);
}

function accountBalanceLabel(value: number) {
  return signedCurrency(value);
}

function signedCurrency(value: number) {
  if (value < -0.005) return `-R${money(Math.abs(value))}`;
  return `R${money(Math.max(0, value))}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
