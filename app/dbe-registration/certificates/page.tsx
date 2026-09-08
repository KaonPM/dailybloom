"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";
import { getCurrentProfile } from "@/app/lib/auth";
import { resolveSchoolContext } from "@/app/lib/school-context";
import { isRenewalInProgress, renewalDisplayStatus, type RenewalItem, type RenewalSource, type RenewalSummary } from "@/app/lib/renewal-aggregation";
import { ComplianceHeader, formatComplianceDate } from "../components";

type Response = { items: RenewalItem[]; summary: RenewalSummary };
const sources: Array<["All" | RenewalSource, string]> = [["All", "All sources"], ["registration", "Registration"], ["document", "Documents & Evidence"], ["staff", "Staff Compliance"], ["manual", "Manual Certificate"]];
const statuses = ["All", "Expiring Soon", "Expired", "Renewal In Progress", "Current", "No Expiry"] as const;
const formatDate = (value?: string | null) => formatComplianceDate(value, "No expiry");

export default function CertificatesPage() {
  const router = useRouter(); const params = useSearchParams();
  const [schoolId, setSchoolId] = useState<number>(); const [data, setData] = useState<Response>(); const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<(typeof statuses)[number]>("All"); const [source, setSource] = useState<"All" | RenewalSource>("All"); const [category, setCategory] = useState("All"); const [search, setSearch] = useState("");
  const [showNoExpiry, setShowNoExpiry] = useState(false); const [showManual, setShowManual] = useState(false); const [manualToEdit, setManualToEdit] = useState<RenewalItem | null>(null); const [saving, setSaving] = useState(false);

  const load = async (id: number) => {
    const response = await authenticatedFetch(`/api/compliance/renewals?school_id=${id}`); const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Certificates and renewals could not be loaded.");
    setData(result);
  };
  useEffect(() => { void (async () => {
    const { profile } = await getCurrentProfile(); if (!profile || profile.role === "teacher") { router.replace(profile ? "/teacher" : "/login"); return; }
    const context = await resolveSchoolContext(params.get("school")); if (!context.schoolId) { router.replace(context.shouldReturnToMaster ? "/master" : "/login"); return; }
    try { setSchoolId(context.schoolId); await load(context.schoolId); } catch (error) { alert(error instanceof Error ? error.message : "Certificates and renewals could not be loaded."); } finally { setLoading(false); }
  })(); }, [params, router]);
  const route = (path: string) => `${path}${params.get("school") ? `?school=${params.get("school")}` : ""}`;
  const categories = useMemo(() => [...new Set((data?.items || []).map((item) => item.category))].sort(), [data]);
  const visibleItems = useMemo(() => (data?.items || []).filter((item) => {
    const display = renewalDisplayStatus(item); const haystack = `${item.title} ${item.holder} ${item.category}`.toLowerCase();
    if (!showNoExpiry && item.expiry_status === "No Expiry") return false;
    if (status === "Renewal In Progress" ? !isRenewalInProgress(item.renewal_status) : status !== "All" && status !== display && status !== item.expiry_status) return false;
    if (source !== "All" && source !== item.source_type) return false;
    if (category !== "All" && category !== item.category) return false;
    return !search.trim() || haystack.includes(search.trim().toLowerCase());
  }), [category, data, search, showNoExpiry, source, status]);

  async function addManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!schoolId) return; setSaving(true); const form = new FormData(event.currentTarget);
    const payload = { school_id: schoolId, resource: "certificates", certificate_type: form.get("certificate_type"), holder_name: form.get("holder_name"), issue_date: form.get("issue_date"), expiry_date: form.get("expiry_date"), renewal_status: form.get("renewal_status"), ...(manualToEdit ? {} : { issuing_authority: form.get("issuing_authority"), certificate_reference: form.get("certificate_reference"), notes: form.get("notes") }) };
    const response = await authenticatedFetch("/api/compliance", { method: manualToEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(manualToEdit ? { ...payload, id: manualToEdit.source_id } : payload) });
    const result = await response.json(); setSaving(false); if (!response.ok) { alert(result.error || "Manual certificate could not be saved."); return; }
    event.currentTarget.reset(); setManualToEdit(null); setShowManual(false); await load(schoolId);
  }
  if (loading) return <p>Loading certificates and renewals...</p>;
  const summary = data?.summary || { total: 0, expiringSoon: 0, expired: 0, renewalInProgress: 0, current: 0, noExpiry: 0, attention: 0 };
  return <div><ComplianceHeader title="Certificates & Renewals" description="One renewal view built from the school’s existing registration, document, staff and manual certificate records." />
    <section style={summaryStyle}><Metric label="Total tracked" value={summary.total} /><Metric label="Expiring soon" value={summary.expiringSoon} /><Metric label="Expired" value={summary.expired} /><Metric label="Renewal in progress" value={summary.renewalInProgress} /><Metric label="Current" value={summary.current} /></section>
    <section className="db-card db-card-blue" style={{ padding: 16, marginTop: 14 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}><div><h3 style={{ margin: 0 }}>What expires next?</h3><p className="db-helper" style={{ marginBottom: 0 }}>Source records remain authoritative. This view does not create duplicate certificates.</p></div><button className="db-button-secondary" onClick={() => { setManualToEdit(null); setShowManual((value) => !value); }}>{showManual ? "Close manual certificate" : "Add manual certificate"}</button></div>
      {showManual ? <form key={manualToEdit?.id || "new"} onSubmit={addManual} style={{ display: "grid", gap: 10, marginTop: 14 }}><strong>{manualToEdit ? "Manage Manual Certificate" : "Manual Certificate"}</strong><p className="db-helper" style={{ margin: 0 }}>{manualToEdit ? "Update the renewal state or dates. Existing authority, reference and notes are preserved." : "Use this only for a certificate that is not already represented in Registration, Documents & Evidence, or Staff Compliance."}</p><div style={formGrid}><label>Certificate name<input name="certificate_type" className="db-input" required maxLength={160} defaultValue={manualToEdit?.title || ""} /></label><label>Belongs to / holder<input name="holder_name" className="db-input" maxLength={160} placeholder="School or staff member" defaultValue={manualToEdit?.holder === "School" ? "" : manualToEdit?.holder || ""} /></label><label>Issue date<input name="issue_date" className="db-input" type="date" defaultValue={manualToEdit?.issue_date || ""} /></label><label>Expiry date<input name="expiry_date" className="db-input" type="date" defaultValue={manualToEdit?.expiry_date || ""} /></label>{!manualToEdit ? <><label>Issuing authority<input name="issuing_authority" className="db-input" maxLength={160} /></label><label>Reference<input name="certificate_reference" className="db-input" maxLength={160} /></label></> : null}<label>Renewal status<select name="renewal_status" className="db-input" defaultValue={manualToEdit?.renewal_status || "Current"}><option>Current</option><option>Not Started</option><option>In Progress</option><option>Renewed</option></select></label></div>{!manualToEdit ? <label>Notes<textarea name="notes" className="db-input" maxLength={1000} /></label> : null}<div><button className="db-button-primary" disabled={saving}>{saving ? "Saving..." : manualToEdit ? "Save renewal" : "Save manual certificate"}</button></div></form> : null}</section>
    <section className="db-card" style={{ padding: 16, marginTop: 14 }}><div style={filterStyle}><input className="db-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search certificate or staff member" aria-label="Search certificates" /><select className="db-input" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>{statuses.map((item) => <option key={item}>{item}</option>)}</select><select className="db-input" value={source} onChange={(event) => setSource(event.target.value as typeof source)}>{sources.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select className="db-input" value={category} onChange={(event) => setCategory(event.target.value)}><option>All</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></div><label className="db-helper" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10 }}><input type="checkbox" checked={showNoExpiry} onChange={(event) => setShowNoExpiry(event.target.checked)} /> Show items with no expiry</label>
      <h3 style={{ marginTop: 16 }}>Tracked renewals ({visibleItems.length})</h3>{visibleItems.length ? <div style={{ display: "grid", gap: 10 }}>{visibleItems.map((item) => <RenewalCard key={item.id} item={item} href={route(item.source_route)} onManage={item.is_manual ? () => { setManualToEdit(item); setShowManual(true); window.scrollTo({ top: 0, behavior: "smooth" }); } : undefined} />)}</div> : <p className="db-helper">{data?.items.length ? (showNoExpiry ? "No certificates match these filters." : "Nothing is expiring in the next 30 days. Turn on ‘Show items with no expiry’ to review them.") : "No certificates or renewal dates are currently being tracked."}</p>}</section>
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="db-list-card"><strong>{label}</strong><p style={{ fontSize: 24, margin: "8px 0 0" }}>{value}</p></div>; }
function RenewalCard({ item, href, onManage }: { item: RenewalItem; href: string; onManage?: () => void }) { const action = item.source_type === "registration" ? "View Registration" : item.source_type === "document" ? "View Document" : item.source_type === "staff" ? "View Staff Compliance" : "Manage Renewal"; return <article className="db-list-card" style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "center" }}><div><strong>{item.title}</strong><p className="db-helper" style={{ margin: "5px 0" }}>{item.category} · {item.holder} · {item.source_label}</p><p className="db-helper" style={{ margin: 0 }}>Expires: {formatDate(item.expiry_date)} · {renewalDisplayStatus(item)}{item.verification_status ? ` · ${item.verification_status}` : ""}{item.possible_duplicate ? " · Possible duplicate" : ""}</p></div>{onManage ? <button className="db-button-secondary" onClick={onManage}>{action}</button> : <Link className="db-button-secondary" href={href}>{action}</Link>}</article>; }
const summaryStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 };
const filterStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 };
const formGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 };
