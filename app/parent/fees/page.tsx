"use client";

import { useEffect, useMemo, useState } from "react";

type Learner = {
  id: string | number;
  name?: string | null;
  school_id?: number | null;
};
type Charge = {
  id: number;
  description: string;
  billing_period: string;
  amount: number;
};
type Payment = {
  id: number;
  amount: number;
  payment_date: string;
  payment_method: string;
  receipt_number: string;
};
type School = {
  school_name?: string | null;
  logo_url?: string | null;
};

export default function ParentFeesPage() {
  const [learners, setLearners] = useState<Learner[]>([]);
  const [selected, setSelected] = useState("");
  const [charges, setCharges] = useState<Charge[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

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
    setLoading(true);
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
        setBalance(Number(result.balance || 0));
      })
      .finally(() => setLoading(false));
  }, [learner?.id, learner?.school_id]);

  const money = (value: number) =>
    `R${Math.abs(Number(value || 0)).toFixed(2)}`;
  const activity: Array<{
    date: string;
    label: string;
    amount: string;
    id: string;
    receipt?: string;
    paymentId?: number;
    chargeId?: number;
  }> = [
    ...charges.map((row) => ({
      date: row.billing_period,
      label: row.description,
      amount: `${money(row.amount)} invoiced`,
      id: `c-${row.id}`,
      chargeId: row.id,
    })),
    ...payments.map((row) => ({
      date: row.payment_date,
      label: `Payment received · ${row.payment_method}`,
      amount: `${money(row.amount)} paid`,
      id: `p-${row.id}`,
      receipt: row.receipt_number,
      paymentId: row.id,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div className="db-soft-card" style={{ padding: 20 }}>
        <div
          style={{
            display: "flex",
            gap: 14,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {school?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={school.logo_url}
              alt={`${school.school_name || "School"} logo`}
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                objectFit: "cover",
              }}
            />
          ) : null}
          <div>
            <h1 className="db-page-title">Fees & Receipts</h1>
            <p className="db-page-subtitle">
              {school?.school_name
                ? `${school.school_name} fee account`
                : "View school fee charges, payments and receipts."}
            </p>
          </div>
        </div>
        {learners.length > 1 ? (
          <select
            className="db-input"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            style={{ marginTop: 14 }}
          >
            {learners.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="db-card db-card-blue" style={{ padding: 18 }}>
        <p style={{ margin: 0, color: "#6D6888", fontWeight: 700 }}>
          Current account
        </p>
        <h2 style={{ margin: "8px 0", color: "#2D2A3E" }}>
          {balance > 0
            ? `${money(balance)} due`
            : balance < 0
              ? `-${money(balance)} credit`
              : "Paid up"}
        </h2>
        <p className="db-helper">
          Registration and monthly school-fee activity appears here.
        </p>
      </div>

      <div className="db-soft-card" style={{ padding: 18 }}>
        <h2 style={{ color: "#2D2A3E" }}>Account activity</h2>
        {loading ? (
          <p>Loading...</p>
        ) : activity.length === 0 ? (
          <p>No fee activity recorded yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {activity.map((row) => (
              <div
                key={row.id}
                style={{
                  border: "1px solid #F0E3D8",
                  borderRadius: 14,
                  padding: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <strong>{row.label}</strong>
                  <p style={{ margin: "5px 0 0", color: "#6D6888" }}>
                    {row.date}
                    {row.receipt ? ` · ${row.receipt}` : ""}
                  </p>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <strong>{row.amount}</strong>
                  {row.chargeId && learner?.school_id ? (
                    <a
                      className="db-button-secondary"
                      href={`/parent/fees/invoice?charge=${row.chargeId}&learner=${encodeURIComponent(String(learner.id))}&school=${learner.school_id}`}
                    >
                      View Invoice
                    </a>
                  ) : null}
                  {row.paymentId && learner?.school_id ? (
                    <a
                      className="db-button-secondary"
                      href={`/parent/fees/receipt?payment=${row.paymentId}&learner=${encodeURIComponent(String(learner.id))}&school=${learner.school_id}`}
                    >
                      View Receipt
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
