"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type School = { id: number; school_name?: string | null; status?: string | null };
type Counts = Record<number, number>;

type Props = { schools: School[] };

function startOfWeek() {
  const date = new Date();
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function countBySchool(rows: Array<{ school_id?: number | null }>): Counts {
  return rows.reduce<Counts>((counts, row) => {
    const schoolId = Number(row.school_id || 0);
    if (schoolId) counts[schoolId] = (counts[schoolId] || 0) + 1;
    return counts;
  }, {});
}

export default function PlatformAdoptionHealthPanel({ schools }: Props) {
  const [counts, setCounts] = useState({ classrooms: {} as Counts, learners: {} as Counts, practitioners: {} as Counts, weeklyActivity: {} as Counts });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const weekStart = startOfWeek();
      const [classrooms, learners, practitioners, attendance, summaries, broadcasts] = await Promise.all([
        supabase.from("classrooms").select("school_id").limit(5000),
        supabase.from("learners").select("school_id").or("is_deleted.is.null,is_deleted.eq.false").limit(5000),
        supabase.from("profiles").select("school_id").eq("role", "teacher").limit(5000),
        supabase.from("attendance").select("school_id").gte("attendance_date", weekStart.slice(0, 10)).limit(5000),
        supabase.from("summaries").select("school_id").gte("created_at", weekStart).limit(5000),
        supabase.from("broadcasts").select("school_id").gte("created_at", weekStart).limit(5000),
      ]);
      const weeklyActivity = [attendance.data || [], summaries.data || [], broadcasts.data || []];
      setCounts({
        classrooms: countBySchool(classrooms.data || []),
        learners: countBySchool(learners.data || []),
        practitioners: countBySchool(practitioners.data || []),
        weeklyActivity: countBySchool(weeklyActivity.flat()),
      });
      setLoading(false);
    }
    void load();
  }, []);

  const health = useMemo(() => schools
    .filter((school) => String(school.status || "active").toLowerCase() !== "inactive")
    .map((school) => {
      const classroomCount = counts.classrooms[school.id] || 0;
      const learnerCount = counts.learners[school.id] || 0;
      const practitionerCount = counts.practitioners[school.id] || 0;
      const weeklyActivity = counts.weeklyActivity[school.id] || 0;
      const completed = [classroomCount > 0, learnerCount > 0, practitionerCount > 0, weeklyActivity > 0].filter(Boolean).length;
      const status = completed < 3 ? "Needs setup" : weeklyActivity === 0 ? "At risk" : "Active";
      const nextAction = classroomCount === 0 ? "Add a classroom" : learnerCount === 0 ? "Add learners" : practitionerCount === 0 ? "Invite a practitioner" : weeklyActivity === 0 ? "Record this week’s activity" : "Keep the weekly routine going";
      return { school, classroomCount, learnerCount, practitionerCount, weeklyActivity, completed, status, nextAction };
    })
    .sort((a, b) => a.completed - b.completed || a.school.school_name?.localeCompare(b.school.school_name || "") || 0), [counts, schools]);

  const attention = health.filter((item) => item.status !== "Active");

  return (
    <section className="db-card db-card-green" style={{ padding: 18, marginTop: 18 }}>
      <div style={headerStyle}>
        <div>
          <h3 style={titleStyle}>School Adoption Health</h3>
          <p className="db-helper" style={{ margin: 0 }}>Activation progress and this week’s meaningful school activity.</p>
        </div>
        {!loading ? <span style={summaryStyle}>{health.filter((item) => item.status === "Active").length} active · {attention.length} need attention</span> : null}
      </div>

      {loading ? <p className="db-helper">Loading school engagement…</p> : attention.length === 0 ? <p className="db-helper">Every active school has completed setup and recorded activity this week.</p> : (
        <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
          {attention.map((item) => <article key={item.school.id} style={rowStyle}>
            <div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <strong>{item.school.school_name || "Unnamed school"}</strong>
                <span style={item.status === "At risk" ? riskPill : setupPill}>{item.status}</span>
              </div>
              <p className="db-helper" style={{ margin: "5px 0 0" }}>{item.classroomCount} classrooms · {item.learnerCount} learners · {item.practitionerCount} practitioners · {item.weeklyActivity} actions this week</p>
              <p className="db-helper" style={{ margin: "3px 0 0" }}><strong>Next step:</strong> {item.nextAction}</p>
            </div>
            <Link className="db-button-secondary" href={`/master/school/${item.school.id}`} style={{ textDecoration: "none" }}>Open school</Link>
          </article>)}
        </div>
      )}
    </section>
  );
}

const headerStyle = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" as const };
const titleStyle = { margin: "0 0 5px", color: "#2D2A3E", fontSize: 20, fontWeight: 800 as const };
const summaryStyle = { background: "#EAF7FD", border: "1px solid #CBEAF7", borderRadius: 999, padding: "5px 10px", fontSize: 12, fontWeight: 800, color: "#2D2A3E" };
const rowStyle = { background: "#FFFDFB", border: "1px solid #F0E3D8", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" as const };
const setupPill = { background: "#FFF7D9", border: "1px solid #F3E4A3", borderRadius: 999, padding: "3px 8px", fontSize: 11, fontWeight: 800, color: "#6D6888" };
const riskPill = { background: "#FFF0F0", border: "1px solid #F3C2C2", borderRadius: 999, padding: "3px 8px", fontSize: 11, fontWeight: 800, color: "#A43838" };
