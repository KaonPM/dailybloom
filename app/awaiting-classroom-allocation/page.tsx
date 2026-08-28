"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { authenticatedFetch } from "@/app/lib/authenticated-fetch";
import { resolveSchoolContext } from "@/app/lib/school-context";

type Classroom = { id: number; classroom_name: string };
type ApprovedEnrolment = {
  id: string;
  learner_id: string;
  enquiry_reference: string;
  parent_name: string;
  academic_year: number;
  learner?: { name?: string | null; legal_name?: string | null; guardian_name?: string | null; class?: string | null } | null;
  placement?: { classroom_id: number | null } | null;
};
type ApprovedReenrolment = { id: string; learner_id: string; learner_name: string; classroom_name: string; reenrolment_reference: string; status: string; next_classroom_id?: number | null };
type AllocationData = { classrooms: Classroom[]; approved_enrolments: ApprovedEnrolment[]; reenrolments: ApprovedReenrolment[] };

export default function AwaitingClassroomAllocationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [isMaster, setIsMaster] = useState(false);
  const [data, setData] = useState<AllocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selections, setSelections] = useState<Record<string, string>>({});

  const schoolQuery = useMemo(() => (isMaster && schoolId ? `?school=${schoolId}` : ""), [isMaster, schoolId]);
  const load = useCallback(async (id: number) => {
    const response = await authenticatedFetch(`/api/re-enrolments?school_id=${id}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Classroom allocations could not be loaded.");
    setData(body as AllocationData);
  }, []);

  useEffect(() => {
    let active = true;
    async function initialise() {
      setLoading(true); setError("");
      try {
        const context = await resolveSchoolContext(searchParams.get("school"));
        if (!active) return;
        if (context.error) throw new Error(context.error);
        if (context.shouldReturnToMaster) { router.replace("/master?view=manage-schools"); return; }
        if (!context.schoolId) throw new Error("Choose a school before allocating classrooms.");
        setSchoolId(context.schoolId); setIsMaster(context.isMaster); await load(context.schoolId);
      } catch (loadError) { if (active) setError(loadError instanceof Error ? loadError.message : "Classroom allocations could not be loaded."); }
      finally { if (active) setLoading(false); }
    }
    void initialise();
    return () => { active = false; };
  }, [load, router, searchParams]);

  async function allocate(type: "enrolment" | "reenrolment", recordId: string) {
    const key = `${type}:${recordId}`;
    const classroomId = Number(selections[key]);
    if (!schoolId || !Number.isInteger(classroomId) || classroomId <= 0) { setError("Select a classroom first."); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await authenticatedFetch(type === "enrolment" ? "/api/enrolments" : "/api/re-enrolments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(type === "enrolment" ? { action: "assign_waiting_classroom", school_id: schoolId, enquiry_id: recordId, classroom_id: classroomId } : { action: "assign_classroom", school_id: schoolId, reenrolment_id: recordId, next_classroom_id: classroomId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Classroom allocation failed.");
      setMessage(body.message || "Classroom allocated."); setSelections((current) => ({ ...current, [key]: "" })); await load(schoolId);
    } catch (allocationError) { setError(allocationError instanceof Error ? allocationError.message : "Classroom allocation failed."); }
    finally { setSaving(false); }
  }

  const enrolments = data?.approved_enrolments.filter((item) => !item.placement?.classroom_id) || [];
  const reenrolments = data?.reenrolments.filter((item) => item.status === "approved" && !item.next_classroom_id) || [];
  const rows = [...enrolments.map((item) => ({ key: `enrolment:${item.id}`, type: "enrolment" as const, id: item.id, learnerId: item.learner_id, learnerName: item.learner?.name || item.learner?.legal_name || "Approved learner", detail: `${item.parent_name || item.learner?.guardian_name || "Parent not recorded"} · ${item.enquiry_reference} · ${item.academic_year}`, classroom: item.learner?.class || "Unassigned" })), ...reenrolments.map((item) => ({ key: `reenrolment:${item.id}`, type: "reenrolment" as const, id: item.id, learnerId: item.learner_id, learnerName: item.learner_name, detail: `${item.reenrolment_reference} · Re-enrolment`, classroom: item.classroom_name || "Unassigned" }))];

  return <main style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 18px 44px", display: "grid", gap: 18 }}>
    <section className="db-card db-card-green" style={{ padding: 24 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}><div><p className="db-eyebrow">School Management</p><h1 className="db-page-title" style={{ marginBottom: 8 }}>Awaiting Classroom Allocation</h1><p className="db-page-subtitle">Allocate a classroom once an enrolment or re-enrolment has been approved.</p></div><div className="db-page-actions"><Link className="db-main-pill db-main-pill-yellow" href={`/dashboard${schoolQuery}`}>Dashboard</Link><Link className="db-button-secondary" href={`/re-enrolments${schoolQuery}`}>Re-enrolments</Link></div></div></section>
    {error ? <div className="db-error-banner" role="alert">{error}</div> : null}{message ? <div className="db-success-banner" role="status">{message}</div> : null}{loading ? <section className="db-card"><p className="db-helper">Loading approved learners…</p></section> : null}
    {!loading && data ? <section className="db-card" style={{ padding: 24 }}>{rows.length === 0 ? <p className="db-helper">There are no approved learners awaiting classroom allocation.</p> : <div style={{ display: "grid", gap: 10 }}>{rows.map((row) => <div className="db-soft-card" key={row.key} style={{ padding: 14, display: "grid", gridTemplateColumns: "minmax(210px, 1.1fr) minmax(150px, .8fr) minmax(330px, 1.5fr)", gap: 12, alignItems: "center" }}><div><strong>{row.learnerName}</strong><small className="db-helper" style={{ display: "block" }}>{row.detail}</small></div><div><small className="db-helper" style={{ display: "block" }}>Current classroom</small>{row.classroom}</div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><select className="db-input" aria-label={`Classroom for ${row.learnerName}`} value={selections[row.key] || ""} onChange={(event) => setSelections((current) => ({ ...current, [row.key]: event.target.value }))}><option value="">Select classroom</option>{data.classrooms.map((room) => <option key={room.id} value={room.id}>{room.classroom_name}</option>)}</select><button className="db-button-primary" type="button" disabled={!selections[row.key] || saving} onClick={() => void allocate(row.type, row.id)}>Allocate</button><Link className="db-button-secondary" href={`/children/${row.learnerId}${schoolQuery}`}>View learner</Link><Link className="db-button-secondary" href={isMaster && schoolId ? `/children?school=${schoolId}&edit=${row.learnerId}` : `/children?edit=${row.learnerId}`}>Edit learner</Link></div></div>)}</div>}</section> : null}
  </main>;
}
