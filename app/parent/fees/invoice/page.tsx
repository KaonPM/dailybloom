"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import FeeStatementDocument, {
  type FeeStatementRow,
  type FeeStatementSchool,
} from "./FeeStatementDocument";

type Charge = {
  id: number;
  description: string;
  billing_period: string;
  due_date: string;
  amount: number;
  is_scheduled?: boolean | null;
};

type Payment = {
  id: number;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_number?: string | null;
  receipt_number: string;
};

type Learner = {
  name?: string | null;
  legal_name?: string | null;
  monthly_fee?: number | null;
};

type StatementResponse = {
  charges?: Charge[];
  payments?: Payment[];
  school?: FeeStatementSchool | null;
  learner?: Learner | null;
  balance?: number;
  opening_balance?: number;
  statement_period?: string | null;
  error?: string;
};

export default function ParentFeeStatementPage() {
  const params = useSearchParams();
  const learnerId = params.get("learner") || "";
  const schoolId = params.get("school") || "";
  const period = params.get("period") || "";
  const missingContext = !learnerId || !schoolId;
  const [result, setResult] = useState<StatementResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (missingContext) return;

    const query = new URLSearchParams({
      learner_id: learnerId,
      school_id: schoolId,
      ...(period ? { period } : {}),
    });
    fetch(`/api/parent-fees?${query}`, { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as StatementResponse;
        if (!response.ok) {
          throw new Error(body.error || "Could not load fee statement.");
        }
        setResult(body);
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not load fee statement."
        )
      );
  }, [learnerId, missingContext, schoolId]);

  const rows = useMemo(() => buildStatement(result), [result]);
  const statementDate = useMemo(
    () =>
      new Date().toLocaleDateString("en-ZA", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    []
  );
  const nextPaymentDate = useMemo(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth() + 1, 1)
      .toLocaleDateString("en-ZA", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
  }, []);

  if (missingContext) {
    return (
      <div className="db-soft-card" style={{ padding: 20 }}>
        Learner account details are missing.
      </div>
    );
  }
  if (error) {
    return <div className="db-soft-card" style={{ padding: 20 }}>{error}</div>;
  }
  if (!result) {
    return (
      <div className="db-soft-card" style={{ padding: 20 }}>
        Loading fee statement...
      </div>
    );
  }

  return (
    <FeeStatementDocument
      school={result.school || null}
      learnerName={
        result.learner?.legal_name || result.learner?.name || "Learner"
      }
      statementDate={statementDate}
      nextPaymentDate={nextPaymentDate}
      monthlyFee={Number(result.learner?.monthly_fee || 0)}
      balance={Number(result.balance || 0)}
      rows={rows}
      statementTitle={period ? "Monthly Fee Statement" : "Year-to-Date Fee Statement"}
    />
  );
}

function buildStatement(result: StatementResponse | null) {
  if (!result) return [];
  const activities = [
    ...(Number(result.opening_balance || 0) ? [{ id: "opening-balance", date: "", order: -1, activity: "Opening balance", invoiced: Number(result.opening_balance || 0) > 0 ? Number(result.opening_balance) : 0, payment: Number(result.opening_balance || 0) < 0 ? Math.abs(Number(result.opening_balance)) : 0, detail: "Balance brought forward" }] : []),
    ...(result.charges || []).map((charge) => ({
      id: `charge-${charge.id}`,
      date: charge.billing_period,
      order: 0,
      activity: charge.description,
      invoiced: charge.is_scheduled ? 0 : Number(charge.amount || 0),
      payment: 0,
      detail: charge.is_scheduled
        ? `Scheduled for ${charge.billing_period}`
        : `Due ${charge.due_date}`,
    })),
    ...(result.payments || []).map((payment) => ({
      id: `payment-${payment.id}`,
      date: payment.payment_date,
      order: 1,
      activity: `Payment received - ${payment.payment_method}`,
      invoiced: 0,
      payment: Number(payment.amount || 0),
      detail: [
        payment.receipt_number,
        payment.reference_number
          ? `Reference ${payment.reference_number}`
          : null,
      ]
        .filter(Boolean)
        .join(" | "),
    })),
  ].sort(
    (left, right) =>
      left.date.localeCompare(right.date) || left.order - right.order
  );

  return activities.reduce<FeeStatementRow[]>((ledger, activity) => {
    const previous = ledger.at(-1)?.runningTotal || 0;
    ledger.push({
      ...activity,
      runningTotal: previous + activity.invoiced - activity.payment,
    });
    return ledger;
  }, []);
}
