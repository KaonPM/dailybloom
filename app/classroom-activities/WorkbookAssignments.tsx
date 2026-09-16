"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { authenticatedFetch } from "../lib/authenticated-fetch";
import { normalizeSelectedPages, selectedPagesLabel, workbookPagesFromQuery, type WorkbookCatalogueItem } from "../lib/grade-r-workbooks";

type Usage = { id: number; resource_id: number; page_from?: number | null; page_to?: number | null; selected_pages: number[]; learning_resources: WorkbookCatalogueItem | null };
type Target = { id: number; classroom_id: number; activity_date: string; activity_name?: string; instruction_note?: string; activity_learning_resources?: Usage[]; homework_learning_resources?: Usage[] };

export default function WorkbookAssignments({ schoolId, classroomId, resourceId, pages, homework, onSaved }: {
  schoolId: number; classroomId: number; resourceId?: number; pages: number[]; homework: boolean; onSaved: () => Promise<void>;
}) {
  const [resource, setResource] = useState<WorkbookCatalogueItem>();
  const [plans, setPlans] = useState<Target[]>([]);
  const [assignments, setAssignments] = useState<Target[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState("");
  const load = useCallback(async () => {
    const response = await authenticatedFetch(`/api/learning-resource-links?school_id=${schoolId}`);
    const body = await response.json();
    if (!response.ok) { setMessage("Workbook links could not be loaded."); return; }
    setPlans(body.plans || []); setAssignments(body.homework || []);
    if (resourceId) {
      const response = await authenticatedFetch(`/api/learning-resources?school_id=${schoolId}&resource_id=${resourceId}`);
      const data = await response.json();
      setResource(response.ok ? data.resources?.[0] : undefined);
    }
  }, [schoolId, resourceId]);
  useEffect(() => { void load().catch(() => setMessage("Workbook links could not be loaded.")); }, [load]);
  async function save(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const response = await authenticatedFetch("/api/learning-resource-links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ school_id: schoolId, classroom_id: classroomId, resource_id: resourceId, selected_pages: pages, ...body }) });
      const result = await response.json();
      setMessage(response.ok ? "Saved with the selected workbook pages." : result.error || "Could not save workbook pages.");
      if (response.ok) { await load(); await onSaved(); }
    } catch { setMessage("Could not save workbook pages. Please try again."); }
    finally { setBusy(false); }
  }
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save({ action: "create", entity_type: homework ? "homework" : "activity", ...Object.fromEntries(new FormData(event.currentTarget)) });
  }
  const targets = (homework ? assignments : plans).filter((item) => item.classroom_id === classroomId);
  const usages = [...plans, ...assignments].filter((item) => item.classroom_id === classroomId && (item.activity_learning_resources?.length || item.homework_learning_resources?.length));
  const usageCards = usages.map((item) => <div className="db-list-card" key={`${item.activity_learning_resources ? "activity" : "homework"}-${item.id}`}><strong>{item.activity_date} · {item.activity_name || item.instruction_note}</strong>{(item.activity_learning_resources || item.homework_learning_resources || []).map((link) => { const linkedPages = normalizeSelectedPages(link.selected_pages || []).length ? normalizeSelectedPages(link.selected_pages || []) : workbookPagesFromQuery(null, String(link.page_from || ""), String(link.page_to || "")); return <p key={link.id}><Link href={`/classroom-activities/workbook?resource_id=${link.resource_id}&school_id=${schoolId}&pages=${linkedPages.join(",")}`}>{link.learning_resources?.title || "DBE workbook"} · {selectedPagesLabel(linkedPages)} — Open in workbook reader</Link></p>; })}</div>);
  if (!resourceId) return <details className="db-card db-card-lavender" style={{ padding: 16, marginBottom: 16 }}><summary style={{ cursor: "pointer", fontWeight: 800 }}>Workbook links ({usages.length})</summary><p className="db-helper">These are workbook page sets already attached to classroom activities or homework. Open a saved link below to review it. To select new pages, open a workbook from the Grade R Learning Hub.</p>{message ? <p role="status">{message}</p> : null}<div style={{ display: "grid", gap: 8, marginTop: 10 }}>{usageCards.length ? usageCards : <p className="db-helper">No workbook pages have been linked yet.</p>}</div></details>;
  return <section className="db-card db-card-lavender" style={{ padding: 16, marginBottom: 16 }}>
    <>
      <h3 style={{ marginTop: 0 }}>{resource?.title || "Selected DBE workbook"}</h3>
      <p className="db-helper">{resource?.academic_year} · {resource?.book_number} · {resource?.language} · {selectedPagesLabel(pages)}</p>
      <p className="db-helper">Source: Department of Basic Education</p>
      <form key={`${resourceId}-${homework}`} onSubmit={create} style={{ display: "grid", gap: 10 }}>
        <strong>Create {homework ? "homework" : "classroom activity"} for the classroom selected above</strong>
        <label>Title<input className="db-input" name="title" required maxLength={160} defaultValue={`DBE workbook — ${selectedPagesLabel(pages)}`} /></label>
        <label>Instructions and notes<textarea className="db-input" name="instructions" required maxLength={330} defaultValue={`Complete ${selectedPagesLabel(pages).toLowerCase()}.`} /></label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label>Activity date<input className="db-input" type="date" name="activity_date" required /></label>
          {homework ? <label>Due date<input className="db-input" type="date" name="due_date" required /></label> : <label>Learning focus<select className="db-input" name="learning_focus"><option>Language</option><option>Mathematics</option><option>Life Skills</option></select></label>}
        </div>
        <button className="db-button-primary" disabled={busy || !resource || !classroomId || !pages.length}>Save {homework ? "homework" : "activity"} with workbook pages</button>
      </form>
      <details style={{ marginTop: 12 }}><summary>Link to an existing {homework ? "homework assignment" : "activity"}</summary><select aria-label="Existing assignment" className="db-input" value={target} onChange={(event) => setTarget(event.target.value)}><option value="">Select a saved item</option>{targets.map((item) => <option key={item.id} value={item.id}>{item.activity_date} · {item.activity_name || item.instruction_note}</option>)}</select><button className="db-button-secondary" disabled={!target || busy} onClick={() => void save(homework ? { homework_assignment_id: Number(target) } : { weekly_plan_id: Number(target) })}>Attach selected pages</button></details>
    </>
    {message ? <p role="status">{message}</p> : null}
    <details style={{ marginTop: 14 }}><summary>Saved workbook activities and homework ({usages.length})</summary>{usageCards}</details>
  </section>;
}
