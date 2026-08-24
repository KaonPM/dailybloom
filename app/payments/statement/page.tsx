"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import FeeStatementDocument, {
  FeeStatementRow,
  FeeStatementSchool,
} from "@/app/parent/fees/invoice/FeeStatementDocument";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";

type Charge = {
  id: string;
  description?: string | null;
  billing_period?: string | null;
  due_date?: string | null;
  amount?: number | null;
  is_scheduled?: boolean | null;
  created_at?: string | null;
};

type Payment = {
  id: string;
  amount?: number | null;
  payment_date?: string | null;
  payment_method?: string | null;
  reference_number?: string | null;
  receipt_number?: string | null;
  created_at?: string | null;
};

type StatementResponse = {
  charges?: Charge[];
  payments?: Payment[];
  balance?: number;
  opening_balance?: number;
  statement_period?: string | null;
  learner?: { name?: string | null; legal_name?: string | null; monthly_fee?: number | null } | null;
  school?: FeeStatementSchool | null;
  error?: string;
};

const displayDate = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-ZA", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
};

const nextMonthlyBillingDate = () => {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth() + 1, 1)
    .toISOString()
    .slice(0, 10);
};

function buildStatement(charges: Charge[], payments: Payment[], openingBalance = 0): FeeStatementRow[] {
  const entries = [
    ...(openingBalance ? [{ id: "opening-balance", date: "", activity: "Opening balance", invoiced: openingBalance > 0 ? openingBalance : 0, payment: openingBalance < 0 ? Math.abs(openingBalance) : 0, detail: "Balance brought forward" }] : []),
    ...charges.map((charge) => ({
      id: `charge-${charge.id}`,
      date: charge.billing_period || charge.due_date || charge.created_at || "",
      activity: charge.description || "Learner fee charge",
      invoiced: charge.is_scheduled ? 0 : Number(charge.amount || 0),
      payment: 0,
      detail: charge.is_scheduled
        ? `Scheduled for ${displayDate(charge.billing_period || charge.due_date)}`
        : charge.due_date ? `Due ${displayDate(charge.due_date)}` : null,
    })),
    ...payments.map((payment) => ({
      id: `payment-${payment.id}`,
      date: payment.payment_date || payment.created_at || "",
      activity: `Payment received${payment.payment_method ? ` - ${payment.payment_method}` : ""}`,
      invoiced: 0,
      payment: Number(payment.amount || 0),
      detail: [payment.receipt_number, payment.reference_number]
        .filter(Boolean)
        .join(" | ") || null,
    })),
  ].sort((left, right) => left.date.localeCompare(right.date));

  let runningTotal = 0;
  return entries.map((entry) => {
    runningTotal += entry.invoiced - entry.payment;
    return { ...entry, date: displayDate(entry.date), runningTotal };
  });
}

export default function StaffLearnerFeeStatementPage() {
  const searchParams = useSearchParams();
  const learnerId = String(searchParams.get("learner") || "");
  const schoolId = Number(searchParams.get("school"));
  const period = String(searchParams.get("period") || "");
  const [statement, setStatement] = useState<StatementResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!learnerId || !Number.isFinite(schoolId) || schoolId <= 0) {
      setError("Choose a learner from Payments before opening a statement.");
      return;
    }

    let cancelled = false;
    async function loadStatement() {
      try {
        const response = await authenticatedFetch(
          `/api/learner-fees/statement?learner_id=${encodeURIComponent(learnerId)}&school_id=${schoolId}${period ? `&period=${encodeURIComponent(period)}` : ""}`
        );
        const payload = (await response.json()) as StatementResponse;
        if (!response.ok) throw new Error(payload.error || "Could not load this statement.");
        if (!cancelled) setStatement(payload);
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load this statement."
          );
        }
      }
    }
    void loadStatement();
    return () => {
      cancelled = true;
    };
  }, [learnerId, period, schoolId]);

  const rows = useMemo(
    () => buildStatement(statement?.charges || [], statement?.payments || [], Number(statement?.opening_balance || 0)),
    [statement]
  );

  if (error) {
    return (
      <main className="db-page-shell">
        <div className="db-card db-card-pink">
          <h1>Learner Fee Statement</h1>
          <p className="db-helper">{error}</p>
          <a className="db-button-secondary" href={`/payments?school=${schoolId || ""}`}>
            Back to payments
          </a>
        </div>
      </main>
    );
  }

  if (!statement) {
    return <main className="db-page-shell"><p className="db-helper">Loading learner statement...</p></main>;
  }

  const nextPaymentDate = nextMonthlyBillingDate();
  return (
    <main className="db-page-shell">
      <FeeStatementDocument
        school={statement.school || null}
        learnerName={statement.learner?.name || statement.learner?.legal_name || "Learner"}
        statementDate={displayDate(new Date().toISOString())}
        nextPaymentDate={displayDate(nextPaymentDate)}
        monthlyFee={Number(statement.learner?.monthly_fee || 0)}
        balance={Number(statement.balance || 0)}
        rows={rows}
        statementTitle={period ? "Monthly Fee Statement" : "Year-to-Date Fee Statement"}
        backHref={`/payments?school=${schoolId}`}
        backLabel="Back to payments"
      />
    </main>
  );
}
