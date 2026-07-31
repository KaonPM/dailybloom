"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";
import { resolveSchoolContext } from "@/app/lib/school-context";
import { supabase } from "@/app/lib/supabase";

type Learner = { id: string; name?: string | null; classroom_id?: number | null; parent_phone?: string | null };
type Classroom = { id: number; classroom_name?: string | null };
type ResponseRow = { response: "granted" | "declined"; learner_id: string; parent_name: string; responded_at: string };
type PermissionRequest = {
  id: number;
  permission_type: string;
  title: string;
  description: string;
  event_date?: string | null;
  response_deadline?: string | null;
  status: "sent" | "closed";
  created_at: string;
  parent_permission_request_learners?: { learner_id: string }[];
  parent_permission_responses?: ResponseRow[];
};

const typeOptions = [
  { value: "photos_videos", label: "Photos & Videos" },
  { value: "general", label: "General Consent" },
  { value: "school_excursion", label: "School Excursion" },
];

export default function ParentPermissionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [requests, setRequests] = useState<PermissionRequest[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [audience, setAudience] = useState("all");
  const [permissionType, setPermissionType] = useState("photos_videos");
  const [title, setTitle] = useState("Consent to use photos and videos");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadPage() {
    const context = await resolveSchoolContext(searchParams.get("school"));
    if (context.error) return router.push("/login");
    if (context.shouldReturnToMaster || !context.schoolId) return router.push("/master");
    setSchoolId(context.schoolId);
    const [{ data: learnerRows }, { data: classroomRows }] = await Promise.all([
      supabase.from("learners").select("id, name, classroom_id, parent_phone").eq("school_id", context.schoolId).order("name"),
      supabase.from("classrooms").select("id, classroom_name").eq("school_id", context.schoolId).order("classroom_name"),
    ]);
    setLearners((learnerRows || []) as Learner[]);
    setClassrooms((classroomRows || []) as Classroom[]);
    setSelectedIds((learnerRows || []).map((learner) => String(learner.id)));
    await loadRequests(context.schoolId);
  }

  async function loadRequests(currentSchoolId: number) {
    const response = await authenticatedFetch(`/api/parent-permissions?school_id=${currentSchoolId}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) return setMessage(body.error || "Consent requests could not be loaded.");
    setRequests(body.requests || []);
  }

  useEffect(() => {
    void loadPage();
    // School context is resolved once when the route opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedLearners = useMemo(
    () => learners.filter((learner) => selectedIds.includes(String(learner.id))),
    [learners, selectedIds]
  );

  function updateAudience(value: string) {
    setAudience(value);
    setSelectedIds(value === "all"
      ? learners.map((learner) => String(learner.id))
      : learners.filter((learner) => String(learner.classroom_id) === value).map((learner) => String(learner.id)));
  }

  function updateType(value: string) {
    setPermissionType(value);
    if (value === "photos_videos") setTitle("Consent to use photos and videos");
    if (value === "general") setTitle("General parent consent");
    if (value === "school_excursion") setTitle("School excursion consent");
  }

  async function submitRequest() {
    if (!schoolId) return;
    setSaving(true);
    setMessage("");
    const response = await authenticatedFetch("/api/parent-permissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        school_id: schoolId,
        permission_type: permissionType,
        title,
        description,
        event_date: eventDate || null,
        response_deadline: deadline || null,
        learner_ids: selectedIds,
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      setSaving(false);
      return setMessage(body.error || "Consent request could not be sent.");
    }
    authenticatedFetch("/api/notifications/parent-push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "parent_permission",
        school_id: schoolId,
        title: "A consent request needs your response",
        parent_phones: body.parent_phones || [],
      }),
    }).catch(console.error);
    setShowCreate(false);
    setDescription("");
    setEventDate("");
    setDeadline("");
    setMessage("Consent request sent to the selected parents.");
    await loadRequests(schoolId);
    setSaving(false);
  }

  async function setRequestStatus(requestId: number, status: "sent" | "closed") {
    if (!schoolId) return;
    const response = await authenticatedFetch("/api/parent-permissions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ school_id: schoolId, request_id: requestId, status }),
    });
    const body = await response.json();
    if (!response.ok) return setMessage(body.error || "Request could not be updated.");
    await loadRequests(schoolId);
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <section className="db-page-header db-card-blue">
        <div>
          <h1 className="db-page-title">✅ Parent Consent</h1>
          <p className="db-page-subtitle">Request and track learner-specific consent securely.</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="db-main-pill db-main-pill-yellow" type="button" onClick={() => router.push(schoolId ? `/dashboard?school=${schoolId}` : "/dashboard")}>🏠 Dashboard</button>
          <button className="db-button-primary" type="button" onClick={() => setShowCreate((value) => !value)}>
            {showCreate ? "Close" : "+ New Consent Request"}
          </button>
        </div>
      </section>

      {message ? <div className="db-soft-card" style={{ padding: 14 }}>{message}</div> : null}

      {showCreate ? (
        <section className="db-card db-card-blue" style={{ padding: 22, display: "grid", gap: 18 }}>
          <div><h2 style={{ margin: 0 }}>📝 Create consent request</h2><p className="db-helper" style={{ marginBottom: 0 }}>Choose who should respond and explain clearly what consent is needed.</p></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16 }}>
            <label style={{ display: "grid", gap: 7 }}><strong>Consent type</strong><select className="db-input" value={permissionType} onChange={(event) => updateType(event.target.value)}>
              {typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select></label>
            <label style={{ display: "grid", gap: 7 }}><strong>Recipients</strong><select className="db-input" value={audience} onChange={(event) => updateAudience(event.target.value)}>
              <option value="all">All learners</option>
              {classrooms.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroom.classroom_name}</option>)}
            </select></label>
            <label style={{ display: "grid", gap: 7 }}><strong>Title</strong><input className="db-input" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <label style={{ display: "grid", gap: 7 }}><strong>Response deadline</strong><input className="db-input" type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label>
            {permissionType === "school_excursion" ? (
              <label style={{ display: "grid", gap: 7 }}><strong>Excursion date</strong><input className="db-input" type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} /></label>
            ) : null}
          </div>
          <label style={{ display: "grid", gap: 7 }}><strong>Clear explanation</strong><textarea className="db-input" rows={5} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explain exactly what the parent is agreeing to." /></label>
          <div className="db-soft-card" style={{ padding: 14 }}>👨‍👩‍👧 <strong>{selectedLearners.length} learners selected.</strong> <span className="db-helper">No response is treated as consent not granted.</span></div>
          <button className="db-button-primary" type="button" disabled={saving || selectedIds.length === 0} onClick={() => void submitRequest()}>
            {saving ? "Sending..." : "Send Consent Request"}
          </button>
        </section>
      ) : null}

      <section className="db-card" style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div><h2 style={{ margin: 0 }}>📋 Consent request history</h2><p className="db-helper" style={{ margin: "5px 0 16px" }}>Track responses and reopen or close requests.</p></div>
          <span className="db-main-pill db-main-pill-yellow">{requests.length} request{requests.length === 1 ? "" : "s"}</span>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          {requests.length ? requests.map((request) => {
            const targets = request.parent_permission_request_learners?.length || 0;
            const responses = request.parent_permission_responses || [];
            const granted = responses.filter((item) => item.response === "granted").length;
            const declined = responses.filter((item) => item.response === "declined").length;
            return (
              <article key={request.id} className="db-soft-card" style={{ padding: 16, display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div><strong>{request.title}</strong><p className="db-helper" style={{ margin: "4px 0 0" }}>{typeOptions.find((item) => item.value === request.permission_type)?.label}</p></div>
                  <span className="db-main-pill db-main-pill-blue">{request.status}</span>
                </div>
                <p style={{ margin: 0 }}>{request.description}</p>
                <p className="db-helper" style={{ margin: 0 }}>{granted} granted · {declined} declined · {Math.max(0, targets - responses.length)} awaiting</p>
                <button className="db-button-secondary" type="button" onClick={() => void setRequestStatus(request.id, request.status === "closed" ? "sent" : "closed")}>
                  {request.status === "closed" ? "Reopen" : "Close Consent Request"}
                </button>
              </article>
            );
          }) : <div style={{ padding: "34px 16px", textAlign: "center" }}><div style={{ fontSize: 38 }}>📭</div><h3 style={{ marginBottom: 6 }}>No consent requests yet</h3><p className="db-helper" style={{ margin: 0 }}>Select “New Consent Request” when consent is needed.</p></div>}
        </div>
      </section>
    </div>
  );
}
