"use client";

import { useEffect, useState } from "react";

type Props = {
  learnerId: string;
  schoolId: number;
  onPendingChange: (count: number) => void;
};

export default function PermissionsCard({ learnerId, schoolId, onPendingChange }: Props) {
  const [pending, setPending] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const response = await fetch(`/api/parent-permissions/respond?learner_id=${encodeURIComponent(learnerId)}&school_id=${schoolId}`, { cache: "no-store" });
      const body = await response.json();
      if (!active) return;
      const rows = response.ok ? body.requests || [] : [];
      const count = rows.filter((row: { parent_permission_responses?: unknown[] | object | null }) => {
        const saved = row.parent_permission_responses;
        return Array.isArray(saved) ? saved.length === 0 : !saved;
      }).length;
      setPending(count);
      onPendingChange(count);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [learnerId, onPendingChange, schoolId]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div>
        <strong>{loading ? "Loading permissions..." : pending ? `${pending} request${pending === 1 ? "" : "s"} waiting for your response` : "No permission requests are waiting."}</strong>
        <p className="db-helper" style={{ margin: "5px 0 0" }}>Photos, videos, general consent and school excursions</p>
      </div>
      <a href="/parent/permissions" className="db-button-primary" style={{ textDecoration: "none", width: "auto", padding: "10px 16px" }}>Open Permissions</a>
    </div>
  );
}
