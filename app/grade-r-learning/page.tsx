"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCurrentProfile } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { isGradeRClassroom } from "../lib/classroom-programme";
import { authenticatedFetch } from "../lib/authenticated-fetch";

type Resource = { id: number; title: string; resource_type: string; source_url?: string | null; language?: string | null; term?: number | null; academic_year?: number | null };

export default function GradeRLearningPage() {
  const [hasGradeR, setHasGradeR] = useState<boolean | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);

  useEffect(() => { void load(); }, []);
  async function load() {
    const { profile } = await getCurrentProfile();
    if (!profile?.school_id) { setHasGradeR(false); return; }
    const { data } = await supabase.from("classrooms").select("classroom_name").eq("school_id", profile.school_id);
    const gradeRExists = (data || []).some((room) => isGradeRClassroom(room.classroom_name));
    setHasGradeR(gradeRExists);
    if (gradeRExists) {
      const response = await authenticatedFetch(`/api/learning-resources?school_id=${profile.school_id}`);
      const body = await response.json();
      if (response.ok) setResources(body.resources || []);
    }
  }

  if (hasGradeR === null) return <p>Loading Grade R Learning Hub...</p>;
  if (!hasGradeR) return <div className="db-card db-card-yellow" style={{ padding: 20 }}><h1 className="db-page-title">Grade R Learning Hub</h1><p className="db-helper">Create a Grade R classroom first to enable this learning hub.</p></div>;
  return <div>
    <div className="db-soft-card" style={{ padding: 20, marginBottom: 16 }}><p className="db-eyebrow">Daily Classroom</p><h1 className="db-page-title">Grade R Learning Hub</h1><p className="db-page-subtitle">A Grade R teaching workspace for DBE workbooks, resources, classroom activities and homework.</p></div>
    <div className="db-card db-card-blue" style={{ padding: 16, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
      <Link className="db-button-primary" href="/classroom-activities">Classroom Activities</Link>
      <div className="db-list-card"><strong>DBE Workbooks</strong><p className="db-helper">Open a full workbook now; page selections will be attached to activities and homework next.</p></div>
      <div className="db-list-card"><strong>Homework</strong><p className="db-helper">Workbook pages will be assigned through the existing homework workflow.</p></div>
    </div>
    <div style={{ display: "grid", gap: 12, marginTop: 16 }}>{resources.map((resource) => <div className="db-card db-card-lavender" style={{ padding: 16 }} key={resource.id}><strong>{resource.title}</strong><p className="db-helper">{resource.language} · {resource.academic_year} · Term {resource.term}</p>{resource.source_url ? <Link className="db-button-primary" href={`/grade-r-learning/reader?title=${encodeURIComponent(resource.title)}&url=${encodeURIComponent(resource.source_url)}`}>Open full workbook</Link> : null}</div>)}</div>
  </div>;
}
