"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCurrentProfile } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { isGradeRClassroom } from "../lib/classroom-programme";
import { authenticatedFetch } from "../lib/authenticated-fetch";

type Resource = { id: number; title: string; resource_type: string; source_url?: string | null; language?: string | null; term?: number | null; academic_year?: number | null; learning_area?: string | null };
const learningAreas = ["English Home Language", "Afrikaans First Additional Language", "Other Home Languages", "Mathematics", "Life Skills"];

export default function GradeRLearningPage() {
  const [hasGradeR, setHasGradeR] = useState<boolean | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [pages, setPages] = useState<Record<number, { from: string; to: string }>>({});

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
      <div className="db-list-card"><strong>DBE Workbooks</strong><p className="db-helper">Choose a subject, term and workbook, then select the pages you need.</p></div>
      <div className="db-list-card"><strong>Classroom use</strong><p className="db-helper">Send the selected pages to Classroom Activities or the existing Homework workflow.</p></div>
    </div>
    <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
      {learningAreas.map((learningArea) => {
        const areaResources = resources.filter((resource) => (resource.learning_area || "English Home Language") === learningArea);
        return (
          <details className="db-card" key={learningArea} open={learningArea === "English Home Language"}>
            <summary style={{ cursor: "pointer", padding: 16, fontWeight: 700 }}>{learningArea}</summary>
            <div style={{ display: "grid", gap: 8, padding: "0 16px 16px" }}>
              {[1, 2, 3, 4].map((term) => {
                const termResources = areaResources.filter((resource) => resource.term === term);
                return (
                  <details className="db-list-card" key={term}>
                    <summary style={{ cursor: "pointer", padding: "10px 12px", fontWeight: 600 }}>Term {term} <span className="db-helper">({termResources.length})</span></summary>
                    <div style={{ display: "grid", gap: 10, padding: "0 12px 12px" }}>
                      {termResources.length === 0 ? <p className="db-helper" style={{ margin: 0 }}>No approved resource has been added for this term yet.</p> : null}
                      {termResources.map((resource) => {
                        const selected = pages[resource.id] || { from: "", to: "" };
                        const query = `resource_id=${resource.id}&page_from=${encodeURIComponent(selected.from)}&page_to=${encodeURIComponent(selected.to)}`;
                        return (
                          <div className="db-card db-card-lavender" style={{ padding: 14 }} key={resource.id}>
                            <strong>{resource.title}</strong>
                            <p className="db-helper">{resource.language} · {resource.academic_year} · DBE official workbook</p>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                              <input className="db-input" style={{ maxWidth: 130 }} type="number" min="1" placeholder="Page from" value={selected.from} onChange={(event) => setPages((current) => ({ ...current, [resource.id]: { ...selected, from: event.target.value } }))} />
                              <input className="db-input" style={{ maxWidth: 130 }} type="number" min="1" placeholder="Page to" value={selected.to} onChange={(event) => setPages((current) => ({ ...current, [resource.id]: { ...selected, to: event.target.value } }))} />
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {resource.source_url ? <Link className="db-button-secondary" href={`/grade-r-learning/reader?title=${encodeURIComponent(resource.title)}&url=${encodeURIComponent(resource.source_url)}&page_from=${encodeURIComponent(selected.from)}`}>Open workbook</Link> : null}
                              <Link className="db-button-primary" href={`/classroom-activities?${query}`}>Add to Classroom Activity</Link>
                              <Link className="db-button-primary" href={`/classroom-activities?${query}&homework=1`}>Assign as Homework</Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                );
              })}
            </div>
          </details>
        );
      })}
    </div>
  </div>;
}
