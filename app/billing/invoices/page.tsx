"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import jsPDF from "jspdf";
import { authenticatedFetch } from "../../lib/authenticated-fetch";
import { getCurrentProfile } from "../../lib/auth";

type SchoolRelation =
  | { id: number; school_name: string | null; logo_url?: string | null }
  | { id: number; school_name: string | null; logo_url?: string | null }[]
  | null;

type Invoice = {
  id: string;
  school_id: number;
  invoice_number: string;
  charge_type: "setup_fee" | "subscription";
  description: string;
  plan_name: string | null;
  issue_date: string;
  due_date: string;
  period_start: string | null;
  period_end: string | null;
  subtotal: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  status: string;
  download_token: string;
  emailed_at: string | null;
  schools: SchoolRelation;
};

type Payment = {
  id: number;
  school_id: number;
  amount: number;
  unapplied_amount: number;
  payment_date: string;
  payment_method: string | null;
  receipt_number: string | null;
};

type Summary = {
  outstanding_balance: number;
  credit_balance: number;
  open_invoices: number;
};

export default function BillingInvoicesPage() {
  const searchParams = useSearchParams();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<Summary>({
    outstanding_balance: 0,
    credit_balance: 0,
    open_invoices: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "paid">("all");
  const [sendingId, setSendingId] = useState("");
  const requestedSchool = searchParams.get("school") || "";

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError("");

    const { profile } = await getCurrentProfile();
    if (!profile) {
      setError("Please log in to view billing invoices.");
      setLoading(false);
      return;
    }

    const querySchoolId =
      Number(requestedSchool || 0) || Number(profile.school_id || 0);
    const query = querySchoolId ? `?school_id=${querySchoolId}` : "";
    const response = await authenticatedFetch(`/api/billing/invoices${query}`);
    const result = await response.json();

    if (!response.ok) {
      setError(result.error || "Invoices could not be loaded.");
      setLoading(false);
      return;
    }

    setInvoices((result.invoices || []) as Invoice[]);
    setPayments((result.payments || []) as Payment[]);
    setSummary(
      result.summary || {
        outstanding_balance: 0,
        credit_balance: 0,
        open_invoices: 0,
      }
    );
    setLoading(false);
  }, [requestedSchool]);

  useEffect(() => {
    // Data loading is the external synchronization performed by this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadInvoices();
  }, [loadInvoices]);

  const visibleInvoices = useMemo(() => {
    if (filter === "open") {
      return invoices.filter((invoice) =>
        ["issued", "partially_paid"].includes(invoice.status)
      );
    }
    if (filter === "paid") {
      return invoices.filter((invoice) => invoice.status === "paid");
    }
    return invoices;
  }, [filter, invoices]);

  async function emailInvoice(invoice: Invoice) {
    setSendingId(invoice.id);
    const response = await authenticatedFetch("/api/billing/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoice_id: invoice.id,
        school_id: invoice.school_id,
      }),
    });
    const result = await response.json();
    setSendingId("");

    if (!response.ok) {
      alert(result.reason || result.error || "Invoice email could not be sent.");
      return;
    }

    await loadInvoices();
    alert("Invoice email sent.");
  }

  function openPrintableInvoice(invoice: Invoice) {
    window.open(
      `/api/billing/invoices/document?token=${invoice.download_token}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function downloadPdf(invoice: Invoice) {
    const school = schoolFromRelation(invoice.schools);
    const paid = invoice.status === "paid";
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();

    pdf.setFillColor(255, 248, 242);
    pdf.rect(0, 0, pageWidth, 297, "F");
    pdf.setTextColor(45, 42, 62);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(24);
    pdf.text("DailyBloom", 18, 24);
    pdf.setDrawColor(117, 199, 234);
    pdf.setLineWidth(1.3);
    pdf.line(18, 31, pageWidth - 18, 31);

    pdf.setFontSize(18);
    pdf.text(paid ? "Payment Receipt" : "Invoice", pageWidth - 18, 22, {
      align: "right",
    });
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text(invoice.invoice_number, pageWidth - 18, 28, { align: "right" });

    pdf.setFont("helvetica", "bold");
    pdf.text("Billed to", 18, 44);
    pdf.setFont("helvetica", "normal");
    pdf.text(school?.school_name || "Preschool", 18, 50);
    pdf.text(`Issue date: ${invoice.issue_date}`, pageWidth - 18, 44, {
      align: "right",
    });
    pdf.text(`Due date: ${invoice.due_date}`, pageWidth - 18, 50, {
      align: "right",
    });

    pdf.setFillColor(234, 247, 253);
    pdf.roundedRect(18, 62, pageWidth - 36, 32, 3, 3, "F");
    pdf.setFont("helvetica", "bold");
    pdf.text("Description", 24, 72);
    pdf.text("Amount", pageWidth - 24, 72, { align: "right" });
    pdf.setFont("helvetica", "normal");
    const description = pdf.splitTextToSize(invoice.description, 120);
    pdf.text(description, 24, 81);
    pdf.text(`R${money(invoice.total_amount)}`, pageWidth - 24, 81, {
      align: "right",
    });

    const totalsX = pageWidth - 82;
    pdf.text("Subtotal", totalsX, 112);
    pdf.text(`R${money(invoice.subtotal)}`, pageWidth - 18, 112, {
      align: "right",
    });
    pdf.text("VAT", totalsX, 120);
    pdf.text("R0.00", pageWidth - 18, 120, { align: "right" });
    pdf.text("Amount paid", totalsX, 128);
    pdf.text(`R${money(invoice.amount_paid)}`, pageWidth - 18, 128, {
      align: "right",
    });
    pdf.setFont("helvetica", "bold");
    pdf.text("Balance due", totalsX, 139);
    pdf.text(`R${money(invoice.balance_due)}`, pageWidth - 18, 139, {
      align: "right",
    });

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(111, 104, 128);
    pdf.text(
      "DailyBloom is not currently registered for VAT. No VAT has been charged.",
      18,
      272
    );
    pdf.text("Powered by Lesedi Smart Solutions", 18, 279);
    pdf.save(`${invoice.invoice_number}-${paid ? "receipt" : "invoice"}.pdf`);
  }

  if (loading) return <p>Loading invoices...</p>;

  return (
    <div>
      <section className="db-soft-card" style={headerCard}>
        <div>
          <p style={eyebrow}>BILLING</p>
          <h1 className="db-page-title">Invoices & Payment Receipts</h1>
          <p className="db-page-subtitle">
            Setup fees, subscription packages, payments, credits and balances.
          </p>
        </div>
      </section>

      {error ? <div className="db-alert-error">{error}</div> : null}

      <section style={summaryGrid}>
        <SummaryCard
          label="Outstanding"
          value={`R${money(summary.outstanding_balance)}`}
          helper={`${summary.open_invoices} open invoice${
            summary.open_invoices === 1 ? "" : "s"
          }`}
          background="#FFF4D8"
          border="#F1DEA2"
        />
        <SummaryCard
          label="Credit Available"
          value={`R${money(summary.credit_balance)}`}
          helper="Applied to future charges"
          background="#EAF8EF"
          border="#CDE8D5"
        />
        <SummaryCard
          label="Invoices"
          value={String(invoices.length)}
          helper="Complete billing history"
          background="#EAF7FD"
          border="#CBEAF7"
        />
      </section>

      <section className="db-soft-card" style={{ padding: 20, marginBottom: 22 }}>
        <div style={filterRow}>
          {(["all", "open", "paid"] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={
                filter === option ? "db-button-primary" : "db-button-secondary"
              }
              onClick={() => setFilter(option)}
            >
              {option === "all" ? "All" : option === "open" ? "Outstanding" : "Paid"}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gap: 13, marginTop: 18 }}>
          {visibleInvoices.length === 0 ? (
            <div style={emptyState}>
              <strong>No invoices here yet.</strong>
              <span>New charges will appear automatically.</span>
            </div>
          ) : (
            visibleInvoices.map((invoice) => {
              const school = schoolFromRelation(invoice.schools);
              return (
                <article
                  key={invoice.id}
                  className="db-billing-invoice-card"
                  style={invoiceCard}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={invoiceHeadingRow}>
                      <strong>{invoice.description}</strong>
                      <span style={statusStyle(invoice.status)}>
                        {statusLabel(invoice.status)}
                      </span>
                    </div>
                    <p style={meta}>
                      {school?.school_name || "Preschool"} · {invoice.invoice_number}
                    </p>
                    <p style={meta}>
                      Issued {invoice.issue_date} · Due {invoice.due_date}
                      {invoice.emailed_at ? " · Email sent" : ""}
                    </p>
                    <div style={amountRow}>
                      <span>Total: <strong>R{money(invoice.total_amount)}</strong></span>
                      <span>Paid: <strong>R{money(invoice.amount_paid)}</strong></span>
                      <span>Balance: <strong>R{money(invoice.balance_due)}</strong></span>
                    </div>
                  </div>

                  <div style={actionRow}>
                    <button
                      type="button"
                      className="db-button-secondary"
                      onClick={() => openPrintableInvoice(invoice)}
                    >
                      Print
                    </button>
                    <button
                      type="button"
                      className="db-button-secondary"
                      onClick={() => downloadPdf(invoice)}
                    >
                      Download PDF
                    </button>
                    <button
                      type="button"
                      className="db-button-primary"
                      disabled={sendingId === invoice.id}
                      onClick={() => emailInvoice(invoice)}
                    >
                      {sendingId === invoice.id ? "Sending..." : "Email"}
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className="db-soft-card" style={{ padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>Payment History</h2>
        <div style={{ display: "grid", gap: 10 }}>
          {payments.length === 0 ? (
            <p className="db-helper">No subscription payments recorded yet.</p>
          ) : (
            payments.map((payment) => (
              <div key={payment.id} style={paymentRow}>
                <div>
                  <strong>{payment.receipt_number || "Payment"}</strong>
                  <p style={meta}>
                    {payment.payment_date} · {payment.payment_method || "Method not set"}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <strong>R{money(payment.amount)}</strong>
                  {Number(payment.unapplied_amount || 0) > 0 ? (
                    <p style={creditText}>
                      R{money(payment.unapplied_amount)} credit
                    </p>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  background,
  border,
}: {
  label: string;
  value: string;
  helper: string;
  background: string;
  border: string;
}) {
  return (
    <div style={{ ...summaryCard, background, borderColor: border }}>
      <span style={meta}>{label}</span>
      <strong style={{ fontSize: 28 }}>{value}</strong>
      <span style={meta}>{helper}</span>
    </div>
  );
}

function schoolFromRelation(relation: SchoolRelation) {
  return Array.isArray(relation) ? relation[0] || null : relation;
}

function money(value: unknown) {
  return Number(value || 0).toFixed(2);
}

function statusLabel(status: string) {
  if (status === "partially_paid") return "Partially Paid";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusStyle(status: string): React.CSSProperties {
  const paid = status === "paid";
  const partial = status === "partially_paid";
  return {
    flexShrink: 0,
    padding: "6px 10px",
    borderRadius: 999,
    background: paid ? "#EAF8EF" : partial ? "#EAF7FD" : "#FFF4D8",
    color: paid ? "#267244" : partial ? "#28637A" : "#805D00",
    fontSize: 12,
    fontWeight: 800,
  };
}

const headerCard: React.CSSProperties = {
  padding: "22px 24px",
  marginBottom: 20,
  borderTop: "5px solid #75C7EA",
};
const eyebrow: React.CSSProperties = {
  margin: "0 0 5px",
  color: "#817699",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.08em",
};
const summaryGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 14,
  marginBottom: 22,
};
const summaryCard: React.CSSProperties = {
  minHeight: 140,
  padding: 19,
  border: "1px solid",
  borderRadius: 20,
  display: "grid",
  alignContent: "space-between",
};
const filterRow: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
};
const invoiceCard: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 18,
  padding: 17,
  border: "1px solid #EDE2DB",
  borderRadius: 17,
  background: "#FFFDFC",
};
const invoiceHeadingRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};
const meta: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#746D80",
  fontSize: 13,
  lineHeight: 1.45,
};
const amountRow: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px 18px",
  marginTop: 12,
  fontSize: 14,
};
const actionRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  flexWrap: "wrap",
  gap: 8,
};
const emptyState: React.CSSProperties = {
  display: "grid",
  gap: 6,
  padding: 28,
  textAlign: "center",
  color: "#6F6880",
  border: "1px dashed #DCCFC6",
  borderRadius: 16,
};
const paymentRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  padding: 14,
  border: "1px solid #EDE2DB",
  borderRadius: 14,
};
const creditText: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#267244",
  fontSize: 12,
  fontWeight: 700,
};
