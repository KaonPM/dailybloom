"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authenticatedFetch } from "../lib/authenticated-fetch";
import { resolveSchoolContext } from "../lib/school-context";

type ParentGroup = { phone: string; parent_name: string; learners: { id: string; name: string }[]; status: string; invite_sent_at?: string | null; invite_error?: string | null };

export default function ParentAccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [groups, setGroups] = useState<ParentGroup[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => { void initialise(); }, []);
  async function initialise() {
    const context = await resolveSchoolContext(searchParams.get("school"));
    if (!context.schoolId) { router.push(context.shouldReturnToMaster ? "/master" : "/dashboard"); return; }
    setSchoolId(context.schoolId); await loadGroups(context.schoolId);
  }
  async function loadGroups(id: number) {
    setLoading(true);
    const response = await authenticatedFetch(`/api/parent-access/manage?school_id=${id}`);
    const result = await response.json();
    if (!response.ok) alert(result.error || "Could not load Parent Portal access.");
    setGroups(result.groups || []); setLoading(false);
  }
  function toggle(phone: string) { setSelected((current) => current.includes(phone) ? current.filter((item) => item !== phone) : [...current, phone]); }
  async function sendInvites() {
    if (!schoolId || !selected.length) return;
    setSending(true);
    const response = await authenticatedFetch("/api/parent-access/manage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ school_id: schoolId, phones: selected }) });
    const result = await response.json();
    if (!response.ok) alert(result.error || "Invitations could not be sent.");
    else {
      const failed = (result.results || []).filter((item: any) => !item.sent).length;
      alert(failed ? `Invitations processed, but ${failed} SMS message(s) failed. Check the status below.` : "Parent Portal invitations sent successfully.");
      setSelected([]); await loadGroups(schoolId);
    }
    setSending(false);
  }
  const selectable = groups.filter((group) => group.status !== "active");
  return <div>
    <div className="db-soft-card" style={{ padding: 18, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div><h1 className="db-page-title">Parent Portal Access</h1><p className="db-page-subtitle">Invite existing parents securely by SMS. One phone number receives one account for all linked learners.</p></div>
        <button className="db-button-primary" type="button" onClick={sendInvites} disabled={!selected.length || sending}>{sending ? "Sending..." : `Send ${selected.length || ""} Invitation${selected.length === 1 ? "" : "s"}`}</button>
      </div>
    </div>
    {loading ? <p>Loading parent access...</p> : <div style={{ display: "grid", gap: 10 }}>
      {selectable.length > 0 ? <label className="db-soft-card" style={{ padding: 12, display: "flex", gap: 9, alignItems: "center" }}><input type="checkbox" checked={selected.length === selectable.length} onChange={() => setSelected(selected.length === selectable.length ? [] : selectable.map((group) => group.phone))} /><strong>Select all parents requiring access</strong></label> : null}
      {groups.map((group) => <div key={group.phone} className="db-soft-card" style={{ padding: 14, display: "grid", gridTemplateColumns: "auto minmax(0, 1fr) auto", gap: 12, alignItems: "center" }}>
        <input type="checkbox" disabled={group.status === "active"} checked={selected.includes(group.phone)} onChange={() => toggle(group.phone)} />
        <div><strong>{group.parent_name}</strong><p className="db-helper" style={{ margin: "3px 0" }}>{group.phone} · {group.learners.map((learner) => learner.name).join(", ")}</p>{group.invite_error ? <p style={{ margin: 0, color: "#A33A3A", fontSize: 12 }}>{group.invite_error}</p> : null}</div>
        <span style={{ borderRadius: 999, padding: "6px 9px", fontSize: 12, fontWeight: 800, background: group.status === "active" ? "#EEF9EE" : group.status === "failed" ? "#FDECEC" : "#FFF7D9" }}>{group.status.replaceAll("_", " ")}</span>
      </div>)}
      {!groups.length ? <div className="db-soft-card" style={{ padding: 18 }}>No parent contact numbers are available yet.</div> : null}
    </div>}
  </div>;
}
