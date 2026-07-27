"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Charge = {
  id: number;
  description: string;
  billing_period: string;
  due_date: string;
  amount: number;
};
type School = {
  school_name?: string | null;
  logo_url?: string | null;
  contact_number?: string | null;
  email_address?: string | null;
  physical_address?: string | null;
};
type Learner = { name?: string | null; legal_name?: string | null };

export default function ParentFeeInvoicePage() {
  const params = useSearchParams();
  const learnerId = params.get("learner") || "";
  const schoolId = params.get("school") || "";
  const chargeId = Number(params.get("charge"));
  const [charge, setCharge] = useState<Charge | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [learner, setLearner] = useState<Learner | null>(null);
  const [balance, setBalance] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!learnerId || !schoolId || !chargeId) return;
    const query = new URLSearchParams({
      learner_id: learnerId,
      school_id: schoolId,
    });
    fetch(`/api/parent-fees?${query}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Could not load invoice.");
        }
        setCharge(
          (result.charges || []).find(
            (item: Charge) => Number(item.id) === chargeId
          ) || null
        );
        setSchool(result.school || null);
        setLearner(result.learner || null);
        setBalance(Number(result.balance || 0));
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error ? reason.message : "Could not load invoice."
        )
      );
  }, [learnerId, schoolId, chargeId]);

  const money = (value: number) =>
    `R${Math.abs(Number(value || 0)).toFixed(2)}`;
  if (error) {
    return (
      <div className="db-soft-card" style={{ padding: 20 }}>
        {error}
      </div>
    );
  }
  if (!charge) {
    return (
      <div className="db-soft-card" style={{ padding: 20 }}>
        Loading invoice...
      </div>
    );
  }

  return (
    <div className="db-soft-card" style={{ padding: 28 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 18,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {school?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={school.logo_url}
              alt={`${school.school_name || "School"} logo`}
              style={{
                width: 76,
                height: 76,
                objectFit: "cover",
                borderRadius: 16,
              }}
            />
          ) : null}
          <div>
            <h2 style={{ margin: 0, color: "#2D2A3E" }}>
              {school?.school_name || "Preschool"}
            </h2>
            {school?.physical_address ? (
              <p style={{ margin: "5px 0" }}>{school.physical_address}</p>
            ) : null}
            <p style={{ margin: "5px 0", color: "#6D6888" }}>
              {[school?.contact_number, school?.email_address]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
        <div className="print-hide" style={{ display: "flex", gap: 10 }}>
          <a className="db-button-secondary" href="/parent/fees">
            Back
          </a>
          <button
            className="db-button-primary"
            onClick={() => window.print()}
          >
            Print
          </button>
        </div>
      </div>

      <hr
        style={{
          border: 0,
          borderTop: "4px solid #75C7EA",
          margin: "22px 0",
        }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 className="db-page-title">School Fee Invoice</h1>
          <p className="db-page-subtitle">
            {learner?.legal_name || learner?.name || "Learner"}
          </p>
        </div>
        <div>
          <strong>Due date</strong>
          <p>{charge.due_date}</p>
        </div>
      </div>

      <div
        style={{
          marginTop: 24,
          border: "1px solid #F0E3D8",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            padding: 18,
            background: "#F8F4FF",
          }}
        >
          <strong>Description</strong>
          <strong>Amount</strong>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            padding: 18,
          }}
        >
          <span>{charge.description}</span>
          <strong>{money(charge.amount)}</strong>
        </div>
      </div>

      <div
        style={{
          marginTop: 22,
          marginLeft: "auto",
          maxWidth: 390,
          padding: 18,
          borderRadius: 16,
          background: "#F8F4FF",
          textAlign: "right",
        }}
      >
        <p style={{ margin: "0 0 10px" }}>
          Invoice total: <strong>{money(charge.amount)}</strong>
        </p>
        <strong>
          Account balance:{" "}
          {balance > 0
            ? `${money(balance)} due`
            : balance < 0
              ? `-${money(balance)} credit`
              : "R0.00"}
        </strong>
      </div>
      <p style={{ color: "#6D6888", marginTop: 24 }}>
        Issued by {school?.school_name || "the preschool"} through DailyBloom.
      </p>
    </div>
  );
}
