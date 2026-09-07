"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Props = {
  schoolId: number;
};

type Engagement = {
  classrooms: number;
  learners: number;
  practitioners: number;
  attendanceThisWeek: number;
  summariesThisWeek: number;
  broadcastsThisWeek: number;
};

const emptyEngagement: Engagement = {
  classrooms: 0,
  learners: 0,
  practitioners: 0,
  attendanceThisWeek: 0,
  summariesThisWeek: 0,
  broadcastsThisWeek: 0,
};

function startOfWeek() {
  const date = new Date();
  const day = date.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - daysSinceMonday);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

export default function SchoolEngagementCard({ schoolId }: Props) {
  const [engagement, setEngagement] = useState<Engagement>(emptyEngagement);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const weekStart = startOfWeek();
      const [classrooms, learners, practitioners, attendance, summaries, broadcasts] = await Promise.all([
        supabase.from("classrooms").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
        supabase.from("learners").select("id", { count: "exact", head: true }).eq("school_id", schoolId).or("is_deleted.is.null,is_deleted.eq.false"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("role", "teacher"),
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("school_id", schoolId).gte("attendance_date", weekStart.slice(0, 10)),
        supabase.from("summaries").select("id", { count: "exact", head: true }).eq("school_id", schoolId).gte("created_at", weekStart),
        supabase.from("broadcasts").select("id", { count: "exact", head: true }).eq("school_id", schoolId).gte("created_at", weekStart),
      ]);

      setEngagement({
        classrooms: classrooms.count || 0,
        learners: learners.count || 0,
        practitioners: practitioners.count || 0,
        attendanceThisWeek: attendance.count || 0,
        summariesThisWeek: summaries.count || 0,
        broadcastsThisWeek: broadcasts.count || 0,
      });
      setLoading(false);
    }

    void load();
  }, [schoolId]);

  const steps = useMemo(() => [
    { label: "Add a classroom", complete: engagement.classrooms > 0, href: "/classrooms" },
    { label: "Add learners", complete: engagement.learners > 0, href: "/children" },
    { label: "Invite a practitioner", complete: engagement.practitioners > 0, href: "/teachers" },
    { label: "Record attendance", complete: engagement.attendanceThisWeek > 0, href: "/attendance" },
    { label: "Share a parent update", complete: engagement.summariesThisWeek > 0 || engagement.broadcastsThisWeek > 0, href: "/summaries" },
  ], [engagement]);

  const completed = steps.filter((step) => step.complete).length;
  const weeklyActivity = engagement.attendanceThisWeek + engagement.summariesThisWeek + engagement.broadcastsThisWeek;
  const nextStep = steps.find((step) => !step.complete);

  return (
    <section className="db-card db-card-lavender" style={{ padding: 18, marginBottom: 16 }}>
      <div style={headerStyle}>
        <div>
          <p className="db-eyebrow" style={{ marginBottom: 4 }}>School engagement</p>
          <h2 style={titleStyle}>This week’s school summary</h2>
          <p className="db-helper" style={{ marginBottom: 0 }}>
            {loading ? "Checking this week’s activity…" : `${completed} of ${steps.length} key setup and engagement actions complete.`}
          </p>
        </div>
        {!loading ? <span style={scoreStyle}>{Math.round((completed / steps.length) * 100)}% ready</span> : null}
      </div>

      {!loading ? <>
        <div style={stepGrid}>
          {steps.map((step) => (
            <Link key={step.label} href={step.href} style={{ ...stepStyle, borderColor: step.complete ? "#BFE4C1" : "#F3E4A3", background: step.complete ? "#F3FBF3" : "#FFFBEA" }}>
              <span aria-hidden="true">{step.complete ? "✓" : "○"}</span>
              <span>{step.label}</span>
            </Link>
          ))}
        </div>

        <div style={weeklyGrid}>
          <Metric label="Attendance records" value={engagement.attendanceThisWeek} />
          <Metric label="Daily summaries" value={engagement.summariesThisWeek} />
          <Metric label="Parent broadcasts" value={engagement.broadcastsThisWeek} />
        </div>

        <div style={nudgeStyle}>
          <strong>{weeklyActivity > 0 ? "This week’s momentum" : "Suggested next step"}</strong>
          <span>{weeklyActivity > 0 ? "Your team has already recorded activity this week. Keep the routine going with a parent update." : nextStep ? `Complete “${nextStep.label}” to unlock more value for your school.` : "Your school is set up and active. Keep attendance and parent communication up to date each week."}</span>
          <Link href={nextStep?.href || "/broadcasts"} className="db-button-primary" style={{ width: "fit-content", textDecoration: "none", whiteSpace: "nowrap" }}>
            {nextStep ? "Take action" : "Send an update"}
          </Link>
        </div>
      </> : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div style={metricStyle}><strong>{value}</strong><span>{label}</span></div>;
}

const headerStyle = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" as const };
const titleStyle = { margin: 0, color: "#2D2A3E", fontSize: 20, fontWeight: 800 as const };
const scoreStyle = { padding: "6px 10px", borderRadius: 999, background: "#EAF7FD", border: "1px solid #CBEAF7", color: "#2D2A3E", fontWeight: 800, fontSize: 13 };
const stepGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))", gap: 8, marginTop: 16 };
const stepStyle = { display: "flex", alignItems: "center", gap: 8, border: "1px solid", borderRadius: 12, padding: "10px 12px", textDecoration: "none", color: "#2D2A3E", fontSize: 13, fontWeight: 700 };
const weeklyGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginTop: 12 };
const metricStyle = { background: "#FFFDFB", border: "1px solid #F0E3D8", borderRadius: 12, padding: "10px 12px", display: "grid", gap: 2, color: "#5B5675", fontSize: 12 };
const nudgeStyle = { marginTop: 12, padding: 12, borderRadius: 12, background: "#FFF7D9", border: "1px solid #F3E4A3", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" as const, color: "#5B5675", fontSize: 13 };
