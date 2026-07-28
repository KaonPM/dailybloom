"use client";

import { useEffect, useState } from "react";

type Props = { learnerId: string; schoolId: number };
type FeeSummary = { balance?: number; charges?: unknown[]; payments?: unknown[] };

const money = (value: number) =>
  `R${Math.abs(Number(value || 0)).toFixed(2)}`;

export default function FeesReceiptsCard({ learnerId, schoolId }: Props) {
  const [summary, setSummary] = useState<FeeSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({
      learner_id: learnerId,
      school_id: String(schoolId),
    });
    fetch(`/api/parent-fees?${query}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load fees.");
        if (active) setSummary(result);
      })
      .catch(() => {
        if (active) setSummary(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [learnerId, schoolId]);

  const balance = Number(summary?.balance || 0);
  const activityCount =
    Number(summary?.charges?.length || 0) + Number(summary?.payments?.length || 0);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <p className="db-helper" style={{ margin: 0 }}>
        {loading
          ? "Loading the learner fee account..."
          : balance > 0
            ? `${money(balance)} is currently due.`
            : balance < 0
              ? `-${money(balance)} credit is available.`
              : activityCount
                ? "The learner fee account is paid up."
                : "No fee activity has been recorded yet."}
      </p>
      <a
        href="/parent/fees"
        className="db-button-primary"
        style={{ textDecoration: "none", width: "fit-content" }}
      >
        View Statement
      </a>
    </div>
  );
}
