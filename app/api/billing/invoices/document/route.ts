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
      "id, invoice_number, description, plan_name, charge_type, issue_date, due_date, period_start, period_end, subtotal, vat_amount, total_amount, amount_paid, balance_due, status, exemption_reason, exempted_at, schools(school_name)"
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
  const html = `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <meta name="robots" content="noindex,nofollow" />
      <title>${escapeHtml(title)} ${escapeHtml(invoice.invoice_number)}</title>
      <style>
        *{box-sizing:border-box} body{margin:0;background:#fff8f2;color:#2d2a3e;font-family:Arial,sans-serif}
        .page{max-width:820px;margin:28px auto;background:#fff;border:1px solid #eadfd8;border-radius:20px;padding:38px;box-shadow:0 14px 40px rgba(50,40,70,.08)}
        .head{display:flex;justify-content:space-between;gap:24px;border-bottom:4px solid #75c7ea;padding-bottom:22px}
        .brand{width:250px;height:76px;overflow:hidden}.brand img{display:block;width:250px;height:250px;transform:translateY(-87px)}.doc{text-align:right}.doc h2{margin:0 0 8px}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin:28px 0}.muted{color:#6f6880}
        table{width:100%;border-collapse:collapse;margin:24px 0}th,td{padding:14px;border-bottom:1px solid #eee;text-align:left}th:last-child,td:last-child{text-align:right}
        .totals{margin-left:auto;max-width:340px}.row{display:flex;justify-content:space-between;padding:8px 0}.total{font-size:20px;font-weight:800;border-top:2px solid #2d2a3e;margin-top:6px;padding-top:12px}
        .status{display:inline-block;padding:8px 12px;border-radius:999px;background:${isPaid ? "#e9f8ed" : "#fff4d3"};color:${isPaid ? "#267244" : "#805d00"};font-weight:700}
        .note{margin-top:32px;background:#f7f4fb;border-radius:12px;padding:15px;font-size:13px}.actions{text-align:center;margin:22px}.actions button{border:0;border-radius:12px;background:#75c7ea;color:#fff;padding:13px 20px;font-weight:700;cursor:pointer}
        @media print{body{background:#fff}.page{margin:0;max-width:none;border:0;box-shadow:none}.actions{display:none}} @media(max-width:600px){.page{margin:0;border-radius:0;padding:24px}.head,.grid{grid-template-columns:1fr;display:grid}.doc{text-align:left}}
      </style>
    </head>
    <body>
      <div class="actions"><button onclick="window.print()">Print or save as PDF</button></div>
      <main class="page">
        <div class="head">
          <div><div class="brand"><img src="/icon-512.png" alt="DailyBloom — Where preschools bloom every day" /></div></div>
          <div class="doc"><h2>${escapeHtml(title)}</h2><div>${escapeHtml(invoice.invoice_number)}</div><p><span class="status">${escapeHtml(isExempted ? "setup fee exempted" : String(invoice.status).replaceAll("_", " "))}</span></p></div>
        </div>
        <div class="grid">
          <div><strong>Billed to</strong><p>${escapeHtml(school?.school_name || "Preschool")}</p></div>
          <div><strong>Issue date</strong><p>${escapeHtml(invoice.issue_date)}</p><strong>Due date</strong><p>${escapeHtml(invoice.due_date)}</p></div>
        </div>
        <table><thead><tr><th>Description</th><th>Amount</th></tr></thead><tbody><tr><td>${escapeHtml(invoice.description)}${invoice.period_start ? `<br><small class="muted">${escapeHtml(invoice.period_start)} to ${escapeHtml(invoice.period_end || "")}</small>` : ""}</td><td>R${money(invoice.total_amount)}</td></tr></tbody></table>
        <div class="totals">
          <div class="row"><span>Subtotal</span><span>R${money(invoice.subtotal)}</span></div>
          <div class="row"><span>VAT</span><span>R0.00</span></div>
          <div class="row"><span>Paid</span><span>R${money(invoice.amount_paid)}</span></div>
          <div class="row total"><span>${isPaid ? "Total paid" : "Balance due"}</span><span>R${money(isPaid ? invoice.amount_paid : invoice.balance_due)}</span></div>
        </div>
        ${
          paymentDetails
            ? `<div class="note"><strong>Payment details</strong>${paymentDetails}</div>`
            : ""
        }
        ${
          invoice.exempted_at
            ? `<div class="note"><strong>Setup fee exempted</strong><p>${escapeHtml(
                invoice.exemption_reason || "Approved exemption"
              )}</p><p>No setup-fee payment is required.</p></div>`
            : ""
        }
        <div class="note">DailyBloom is not currently registered for VAT. No VAT has been charged.</div>
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

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
