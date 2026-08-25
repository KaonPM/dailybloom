"use client";

import { useEffect, useMemo, useState } from "react";
import ParentPageActions from "../components/ParentPageActions";

type Learner = { id: string | number; name?: string | null; school_id?: number | null };
type Charge = { id: number; description: string; billing_period: string; amount: number };
type Payment = {
  id: number;
  amount: number;
  payment_date: string;
  payment_method: string;
  receipt_number: string;
};
type BankingDetails = { bank_account_name?: string | null; bank_name?: string | null; bank_account_number?: string | null; bank_branch_code?: string | null; bank_account_type?: string | null };
type School = { school_name?: string | null; logo_url?: string | null; banking_details?: BankingDetails | null };
type LearnerAccount = { monthly_fee?: number | null };
type ActivityRow = {
  date: string;
  label: string;
  invoiced: number;
  payment: number;
  runningTotal: number;
  id: string;
  receipt?: string;
};

const PAGE_SIZE = 10;
const money = (value: number) =>
  `R${Math.abs(Number(value || 0)).toFixed(2)}`;
const balanceLabel = (value: number) =>
  value < 0
    ? `-${money(value)} credit`
    : value > 0
      ? `${money(value)} due`
      : "R0.00";

export default function ParentFeesPage() {
  const [learners, setLearners] = useState<Learner[]>([]);
  const [selected, setSelected] = useState("");
  const [charges, setCharges] = useState<Charge[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [learnerAccount, setLearnerAccount] = useState<LearnerAccount | null>(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetch("/api/parent-context", { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => {
        const rows = (result.children || []) as Learner[];
        setLearners(rows);
        setSelected(String(rows[0]?.id || ""));
      })
      .finally(() => setLoading(false));
  }, []);

  const learner = useMemo(
    () => learners.find((item) => String(item.id) === selected),
    [learners, selected]
  );

  useEffect(() => {
    if (!learner?.id || !learner.school_id) return;
    const params = new URLSearchParams({
      learner_id: String(learner.id),
      school_id: String(learner.school_id),
    });
    fetch(`/api/parent-fees?${params}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => {
        setCharges(result.charges || []);
        setPayments(result.payments || []);
        setSchool(result.school || null);
        setLearnerAccount(result.learner || null);
        setBalance(Number(result.balance || 0));
      })
      .finally(() => setLoading(false));
  }, [learner?.id, learner?.school_id]);

  const statement = useMemo(() => {
    const rows: ActivityRow[] = [
      ...charges.map((row) => ({
        date: row.billing_period,
        label: row.description,
        invoiced: Number(row.amount || 0),
        payment: 0,
        runningTotal: 0,
        id: `c-${row.id}`,
      })),
      ...payments.map((row) => ({
        date: row.payment_date,
        label: `Payment received · ${row.payment_method}`,
        invoiced: 0,
        payment: Number(row.amount || 0),
        runningTotal: 0,
        id: `p-${row.id}`,
        receipt: row.receipt_number,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

    return rows.reduce<ActivityRow[]>((ledger, row) => {
      const previousTotal = ledger.at(-1)?.runningTotal || 0;
      return [
        ...ledger,
        {
          ...row,
          runningTotal: previousTotal + row.invoiced - row.payment,
        },
      ];
    }, []);
  }, [charges, payments]);

  const nextPaymentDate = useMemo(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth() + 1, 1).toLocaleDateString(
      "en-ZA",
      { day: "numeric", month: "long", year: "numeric" }
    );
  }, []);
  const monthlyFee = Number(learnerAccount?.monthly_fee || 0);

  return (
    <div className="fee-print-statement" style={{ display: "grid", gap: 18 }}>
      <div className="no-print"><ParentPageActions /></div>
      <div className="db-soft-card" style={{ padding: 20 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          {school?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={school.logo_url} alt={`${school.school_name || "School"} logo`} style={{ width: 64, height: 64, borderRadius: 16, objectFit: "cover" }} />
          ) : null}
          <div>
            <h1 className="db-page-title">🧾 Fee Statement</h1>
            <p className="db-page-subtitle">
              {school?.school_name
                ? `${school.school_name} continuous learner account`
                : "View billed amounts and recorded payments."}
            </p>
          </div>
        </div>
        {learners.length > 1 ? (
          <select
            className="db-input"
            value={selected}
            onChange={(event) => {
              setLoading(true);
              setPage(0);
              setSelected(event.target.value);
            }}
            style={{ marginTop: 14 }}
          >
            {learners.map((item) => <option key={item.id} value={String(item.id)}>{item.name}</option>)}
          </select>
        ) : null}
      </div>

      <div className="db-soft-card" style={{ padding: 18 }}>
        <p style={{ margin: 0, color: "#6D6888", fontWeight: 700 }}>Running total</p>
        <h2 style={{ margin: "8px 0", color: "#2D2A3E" }}>{balanceLabel(balance)}</h2>
        <p className="db-helper">Registration fees, monthly charges and every recorded payment remain on this statement.</p>
        {monthlyFee > 0 ? (
          <p style={{ margin: "8px 0 0", color: "#6D6888", fontSize: 12 }}>
            Next monthly fee: {money(monthlyFee)} · due {nextPaymentDate}
          </p>
        ) : null}
        {learner?.school_id ? (
          <button
            type="button"
            className="db-button-primary"
            onClick={() => {
              const query = new URLSearchParams({
                learner: String(learner.id),
                school: String(learner.school_id),
              });
              window.open(
                `/parent/fees/invoice?${query}`,
                "_blank",
                "noopener,noreferrer"
              );
            }}
            disabled={loading}
            style={{ display: "inline-flex", marginTop: 12 }}
          >
            Open / Print Statement
          </button>
        ) : null}

        {school?.banking_details?.bank_account_number ? (
          <div className="db-soft-card" style={{ marginTop: 18, padding: 14, background: "#F8F4FF" }}>
            <strong style={{ color: "#2D2A3E" }}>Payment details</strong>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginTop: 10 }}>
              {school.banking_details.bank_account_name ? <span><strong>Account name:</strong> {school.banking_details.bank_account_name}</span> : null}
              {school.banking_details.bank_name ? <span><strong>Bank:</strong> {school.banking_details.bank_name}</span> : null}
              <span><strong>Account number:</strong> {school.banking_details.bank_account_number}</span>
              {school.banking_details.bank_branch_code ? <span><strong>Branch code:</strong> {school.banking_details.bank_branch_code}</span> : null}
              {school.banking_details.bank_account_type ? <span><strong>Account type:</strong> {school.banking_details.bank_account_type}</span> : null}
            </div>
          </div>
        ) : null}

        <h2 style={{ color: "#2D2A3E", marginTop: 24 }}>Account activity</h2>
        <p className="db-helper">
          Monthly fees are billed on the 1st. Payments appear after the school records them.
        </p>
        {loading ? <p>Loading...</p> : statement.length === 0 ? (
          <p>No fee activity recorded yet.</p>
        ) : (
          <>
            <div className="fee-statement-scroll" style={{ overflowX: "auto" }}>
              <div className="fee-statement-table" style={{ minWidth: 760 }}>
                <div className="fee-statement-header" style={statementHeader}>
                  <strong>Date</strong><strong>Account activity</strong><strong>Billed</strong><strong>Payment</strong><strong>Running total</strong>
                </div>
                {statement.map((row, index) => {
                  const visibleOnPage =
                    index >= page * PAGE_SIZE &&
                    index < (page + 1) * PAGE_SIZE;
                  return (
                  <div
                    key={row.id}
                    className={visibleOnPage ? "fee-statement-row" : "fee-statement-row fee-statement-row-hidden"}
                    style={statementRow}
                  >
                    <span className="fee-statement-date">{row.date}</span>
                    <div className="fee-statement-activity">
                      <strong>{row.label}</strong>
                      {row.receipt ? <p style={{ margin: "5px 0 0", color: "#6D6888" }}>{row.receipt}</p> : null}
                    </div>
                    <strong>{row.invoiced ? money(row.invoiced) : "—"}</strong>
                    <strong>{row.payment ? money(row.payment) : "—"}</strong>
                    <strong>{balanceLabel(row.runningTotal)}</strong>
                  </div>
                  );
                })}
              </div>
            </div>
            {statement.length > PAGE_SIZE ? (
              <div className="fee-statement-pagination" style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <button className="db-button-secondary" type="button" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous 10</button>
                <button className="db-button-primary" type="button" disabled={(page + 1) * PAGE_SIZE >= statement.length} onClick={() => setPage((value) => value + 1)}>Next 10</button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

const statementHeader = {
  display: "grid",
  gridTemplateColumns: "110px minmax(280px, 1fr) 110px 110px 140px",
  gap: 12,
  padding: "12px 14px",
  background: "#F8F4FF",
  borderRadius: "14px 14px 0 0",
  color: "#2D2A3E",
} as const;

const statementRow = {
  display: "grid",
  gridTemplateColumns: "110px minmax(280px, 1fr) 110px 110px 140px",
  gap: 12,
  alignItems: "center",
  padding: 14,
  borderBottom: "1px solid #F0E3D8",
} as const;
