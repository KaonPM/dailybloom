"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";

type OutcomeRow = {
  id: number;
  school_id: number;
  classroom_id: number;
  learner_id: number;
  developmental_area: string | null;
  outcome_status: string | null;
  support_status?: string | null;
  created_at?: string | null;
};

export default function LearnerSupportWidget() {
  const [profile, setProfile] = useState<any>(null);
  const [outcomes, setOutcomes] = useState<OutcomeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const role = String(profile?.role || "").toLowerCase();
  const isTeacher = role === "teacher";

  useEffect(() => {
    loadWidget();
  }, []);

  const latestOutcomes = useMemo(() => {
    const latest = new Map<string, OutcomeRow>();

    outcomes.forEach((item) => {
      if (!item.learner_id || !item.developmental_area) return;

      const key = `${item.learner_id}-${item.developmental_area}`;
      const existing = latest.get(key);

      if (!existing) {
        latest.set(key, item);
        return;
      }

      const existingDate = new Date(existing.created_at || "");
      const itemDate = new Date(item.created_at || "");

      if (itemDate > existingDate) {
        latest.set(key, item);
      }
    });

    return Array.from(latest.values());
  }, [outcomes]);

  const stats = useMemo(() => {
    return {
      open: latestOutcomes.filter((item) => ["new", "active", "improving"].includes(supportStatusValue(item))).length,
      monitoring: latestOutcomes.filter((item) => supportStatusValue(item) === "monitoring").length,
      resolved: latestOutcomes.filter((item) => supportStatusValue(item) === "resolved").length,
    };
  }, [latestOutcomes]);

  async function loadWidget() {
    const { profile: currentProfile, error } = await getCurrentProfile();

    if (error || !currentProfile?.school_id) {
      setLoading(false);
      return;
    }

    setProfile(currentProfile);

    let query = supabase
      .from("learner_activity_outcomes")
      .select("id, school_id, classroom_id, learner_id, developmental_area, outcome_status, support_status, created_at")
      .eq("school_id", currentProfile.school_id)
      .eq("outcome_status", "needs_support");

    if (String(currentProfile.role || "").toLowerCase() === "teacher" && currentProfile.classroom_id) {
      query = query.eq("classroom_id", currentProfile.classroom_id);
    }

    const { data } = await query.order("created_at", { ascending: false });

    setOutcomes(data || []);
    setLoading(false);
  }

  if (loading) return null;

  return (
    <div className="db-card db-card-lavender" style={{ padding: "16px", marginBottom: "16px" }}>
      <h3 style={{ margin: "0 0 8px 0", color: "var(--db-text)" }}>Learner Support</h3>
      <p style={{ margin: "0 0 12px 0", color: "var(--db-text-soft)", fontSize: "13px" }}>
        {isTeacher ? "Support cases in your classroom." : "School-wide learner support cases."}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "10px" }}>
        <MiniStat label="Open" value={stats.open} />
        <MiniStat label="Monitoring" value={stats.monitoring} />
        <MiniStat label="Resolved" value={stats.resolved} />
      </div>

      <Link href="/support-register" className="db-button-primary" style={{ display: "block", textAlign: "center", marginTop: "12px", textDecoration: "none" }}>
        View Support Register
      </Link>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="db-list-card" style={{ padding: "10px" }}>
      <p style={{ margin: 0, color: "var(--db-text-soft)", fontSize: "12px" }}>{label}</p>
      <strong style={{ fontSize: "22px", color: "var(--db-text)" }}>{value}</strong>
    </div>
  );
}

function supportStatusValue(item: any) {
  if (item?.support_status) return item.support_status;
  if (item?.outcome_status === "improving") return "improving";
  if (item?.outcome_status === "meeting_expectations") return "resolved";
  return "new";
}
