"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { getCurrentProfile } from "../lib/auth";
import { supabase } from "../lib/supabase";
import {
  awardCategories,
  awardDefinitions,
  getAwardDefinition,
} from "../lib/award-types";
import { AwardCertificate } from "./AwardCertificate";

type AwardTab = "create" | "nominations" | "issued" | "reprints";
type Identifier = string | number | null | undefined;
type ProfileRow = { id: string; school_id?: number | null; role?: string | null; full_name?: string | null; name?: string | null; email?: string | null; classroom_id?: number | null };
type SchoolRow = { id?: number; school_name?: string | null; primary_color?: string | null; secondary_color?: string | null };
type ClassroomRow = { id: number; classroom_name?: string | null; teacher_id?: string | null };
type LearnerRow = { id: string; name?: string | null; legal_name?: string | null; classroom_id?: number | null; class?: string | null; classroom?: string | null; classroom_name?: string | null; class_name?: string | null; assigned_classroom?: string | null; assigned_classroom_name?: string | null };
type PeriodRow = { id: number; title?: string | null; academic_year?: number | null; created_at?: string | null };
type AwardRow = { id: number; school_id: number; learner_id: string; classroom_id?: number | null; teacher_id?: string | null; report_period_id?: number | null; award_name?: string | null; award_category?: string | null; award_reason?: string | null; award_year?: number | null; academic_year?: number | null; teacher_name?: string | null; principal_name?: string | null; workflow_status?: string | null };
type ReprintRow = { certificate_id: number };

const PAGE_SIZE = 12;

export default function AchievementAwardsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [school, setSchool] = useState<SchoolRow | null>(null);
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);
  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [teachers, setTeachers] = useState<ProfileRow[]>([]);
  const [approvers, setApprovers] = useState<ProfileRow[]>([]);
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [awards, setAwards] = useState<AwardRow[]>([]);
  const [reprintCounts, setReprintCounts] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<AwardTab>("create");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [totalAwards, setTotalAwards] = useState(0);

  const [learnerId, setLearnerId] = useState("");
  const [classroomId, setClassroomId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [awardName, setAwardName] = useState("");
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [replacementOf, setReplacementOf] = useState<number | null>(null);

  const [filterLearner, setFilterLearner] = useState("");
  const [filterClassroom, setFilterClassroom] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterAwardName, setFilterAwardName] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterIssuedBy, setFilterIssuedBy] = useState("");
  const [selectedCertificate, setSelectedCertificate] = useState<AwardRow | null>(null);

  const role = String(profile?.role || "").toLowerCase();
  const isTeacher = role === "teacher";
  const canIssue = ["principal", "admin", "master"].includes(role);
  const definition = getAwardDefinition(awardName);
  const reason = customReason.trim() || selectedReason;
  const selectedLearner = learners.find((item) => String(item.id) === learnerId);
  const selectedPeriod = periods.find((item) => String(item.id) === periodId);
  const selectedTeacher = teachers.find((item) => String(item.id) === teacherId);
  const academicYear = selectedPeriod?.academic_year || yearFromPeriod(selectedPeriod) || new Date().getFullYear();

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    if (!profile?.school_id || tab === "create") return;
    fetchAwards(Number(profile.school_id));
  }, [tab, page, filterLearner, filterClassroom, filterPeriod, filterCategory, filterAwardName, filterYear, filterIssuedBy, profile?.school_id]);

  async function loadPage() {
    const { profile: currentProfile, error } = await getCurrentProfile();
    if (error || !currentProfile) {
      router.push("/login");
      return;
    }

    setProfile(currentProfile as ProfileRow);
    if (String(currentProfile.role).toLowerCase() === "teacher") setTab("create");
    const schoolId = Number(currentProfile.school_id);
    if (!schoolId) {
      router.push("/dashboard");
      return;
    }

    const [schoolResult, classroomResult, learnerResult, teacherResult, periodResult] = await Promise.all([
      supabase.from("schools").select("*").eq("id", schoolId).single(),
      supabase.from("classrooms").select("*").eq("school_id", schoolId).order("classroom_name"),
      supabase.from("learners").select("*").eq("school_id", schoolId).or("is_deleted.is.null,is_deleted.eq.false").order("name"),
      supabase.from("profiles").select("*").eq("school_id", schoolId).order("full_name"),
      supabase.from("report_periods").select("*").eq("school_id", schoolId).order("created_at", { ascending: false }),
    ]);

    const firstError = [schoolResult.error, classroomResult.error, learnerResult.error, teacherResult.error, periodResult.error].find(Boolean);
    if (firstError) alert(firstError.message);
    setSchool((schoolResult.data as SchoolRow | null) || null);
    setClassrooms((classroomResult.data || []) as ClassroomRow[]);
    setLearners((learnerResult.data || []) as LearnerRow[]);
    const staff = (teacherResult.data || []) as ProfileRow[];
    setTeachers(staff.filter((item) => ["teacher", "practitioner", "educator"].includes(String(item.role).toLowerCase())));
    setApprovers(staff.filter((item) => ["principal", "admin", "master"].includes(String(item.role).toLowerCase())));
    setPeriods((periodResult.data || []) as PeriodRow[]);

    if (currentProfile.role === "teacher") {
      setTeacherId(String(currentProfile.id));
      if (currentProfile.classroom_id) setClassroomId(String(currentProfile.classroom_id));
    }
    await fetchAwards(schoolId);
    setLoading(false);
  }

  async function fetchAwards(schoolId: number) {
    const desiredStatus = tab === "nominations"
      ? isTeacher ? "" : "nominated"
      : tab === "issued" || tab === "reprints" ? "issued" : "";
    let query = supabase
      .from("achievement_awards")
      .select("*", { count: "exact" })
      .eq("school_id", schoolId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (desiredStatus) query = query.eq("workflow_status", desiredStatus);
    if (isTeacher) query = query.eq("nominated_by", profile.id);
    if (filterLearner) query = query.eq("learner_id", filterLearner);
    if (filterClassroom) query = query.eq("classroom_id", filterClassroom);
    if (filterPeriod) query = query.eq("report_period_id", filterPeriod);
    if (filterCategory) query = query.eq("award_category", filterCategory);
    if (filterAwardName) query = query.eq("award_name", filterAwardName);
    if (filterYear) query = query.eq("academic_year", Number(filterYear));
    if (filterIssuedBy) query = query.eq("approved_by", filterIssuedBy);
    const from = (page - 1) * PAGE_SIZE;
    const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) {
      alert(error.message);
      return;
    }
    setAwards((data || []) as AwardRow[]);
    setTotalAwards(count || 0);

    if (tab === "reprints" && (data || []).length > 0) {
      const ids = ((data || []) as AwardRow[]).map((item) => item.id);
      const { data: prints } = await supabase.from("certificate_reprints").select("certificate_id").in("certificate_id", ids);
      const counts: Record<string, number> = {};
      ((prints || []) as ReprintRow[]).forEach((item) => { counts[String(item.certificate_id)] = (counts[String(item.certificate_id)] || 0) + 1; });
      setReprintCounts(counts);
    }
  }

  function selectLearner(nextLearnerId: string) {
    setLearnerId(nextLearnerId);
    const learner = learners.find((item) => String(item.id) === nextLearnerId);
    const directClassroomId = learner?.classroom_id ? String(learner.classroom_id) : "";
    const learnerClassNames = [learner?.class, learner?.classroom, learner?.classroom_name, learner?.class_name, learner?.assigned_classroom, learner?.assigned_classroom_name]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase());
    const matchedClassroom = classrooms.find((item) => learnerClassNames.includes(String(item.classroom_name || "").trim().toLowerCase()));
    const nextClassroomId = directClassroomId || String(matchedClassroom?.id || "");
    setClassroomId(nextClassroomId);
    const classroom = classrooms.find((item) => String(item.id) === nextClassroomId);
    if (!isTeacher) setTeacherId(String(classroom?.teacher_id || ""));
  }

  function resetForm() {
    setLearnerId("");
    setClassroomId(isTeacher ? classroomId : "");
    setTeacherId(isTeacher ? String(profile?.id || "") : "");
    setPeriodId("");
    setAwardName("");
    setSelectedReason("");
    setCustomReason("");
    setReplacementOf(null);
    setPreviewOpen(false);
  }

  function validateForm() {
    if (!learnerId || !classroomId || !teacherId || !periodId || !awardName || !reason) {
      alert("Please complete the learner, period, award and reason fields.");
      return false;
    }
    return true;
  }

  async function saveAward() {
    if (!validateForm() || !profile?.school_id) return;
    setSaving(true);
    const payload = {
      school_id: Number(profile.school_id),
      learner_id: learnerId,
      classroom_id: classroomId,
      teacher_id: teacherId,
      report_period_id: periodId,
      award_name: awardName,
      award_category: definition?.category || "General",
      award_reason: reason,
      teacher_name: selectedTeacher?.full_name || selectedTeacher?.name || profile.full_name || "Practitioner",
      principal_name: canIssue ? profile.full_name || profile.name || "Principal" : null,
      award_year: academicYear,
      academic_year: academicYear,
      workflow_status: canIssue ? "issued" : "nominated",
      nominated_by: isTeacher ? profile.id : null,
      approved_by: canIssue ? profile.id : null,
      issued_at: canIssue ? new Date().toISOString() : null,
      certificate_generated: canIssue,
      replacement_of: replacementOf,
    };

    const { error } = replacementOf
      ? await supabase.rpc("reissue_achievement_award", {
          p_original_id: replacementOf,
          p_payload: payload,
        })
      : await supabase.from("achievement_awards").insert([payload]);
    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }
    alert(canIssue ? "Certificate issued." : "Nomination submitted to the principal.");
    resetForm();
    setSaving(false);
    setTab(canIssue ? "issued" : "nominations");
  }

  async function approveNomination(item: AwardRow) {
    if (!canIssue) return;
    const { error } = await supabase.from("achievement_awards").update({ workflow_status: "issued", approved_by: profile.id, principal_name: profile.full_name || profile.name || "Principal", issued_at: new Date().toISOString(), certificate_generated: true }).eq("id", item.id);
    if (error) return alert(error.message);
    await fetchAwards(Number(profile.school_id));
    alert("Nomination approved and certificate issued.");
  }

  async function declineNomination(item: AwardRow) {
    if (!canIssue) return;
    const reasonText = prompt("Reason for declining this nomination:");
    if (!reasonText?.trim()) return;
    const { error } = await supabase
      .from("achievement_awards")
      .update({ workflow_status: "declined", revoke_reason: reasonText.trim() })
      .eq("id", item.id);
    if (error) return alert(error.message);
    await fetchAwards(Number(profile.school_id));
    alert("Nomination declined.");
  }

  async function revokeAward(item: AwardRow) {
    const reasonText = prompt("Reason for revoking this certificate:");
    if (!reasonText?.trim()) return;
    const { error } = await supabase.from("achievement_awards").update({ workflow_status: "revoked", deleted_at: new Date().toISOString(), revoked_at: new Date().toISOString(), revoked_by: profile.id, revoke_reason: reasonText.trim() }).eq("id", item.id);
    if (error) return alert(error.message);
    await fetchAwards(Number(profile.school_id));
    alert("Certificate revoked.");
  }

  function correctAndReissue(item: AwardRow) {
    setReplacementOf(item.id);
    setLearnerId(String(item.learner_id));
    setClassroomId(String(item.classroom_id || ""));
    setTeacherId(String(item.teacher_id || ""));
    setPeriodId(String(item.report_period_id || ""));
    setAwardName(item.award_name || "");
    setSelectedReason(item.award_reason || "");
    setCustomReason("");
    setTab("create");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function downloadCertificate(item: AwardRow) {
    setSelectedCertificate(item);
    requestAnimationFrame(async () => {
      const element = document.querySelector(".award-certificate-document") as HTMLElement | null;
      if (!element) return;
      try {
        const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: "#fff" });
        const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 297, 210);
        await supabase.from("certificate_reprints").insert([{ certificate_id: item.id, school_id: item.school_id, learner_id: item.learner_id, action: "download", performed_by: profile.id }]);
        pdf.save(`${learnerName(item.learner_id).replace(/\s+/g, "_")}_Certificate.pdf`);
      } catch (error) {
        console.error(error);
        alert("Certificate download failed.");
      }
    });
  }

  function learnerName(id: Identifier) { const item = learners.find((learner) => String(learner.id) === String(id)); return item?.legal_name || item?.name || "Learner"; }
  function classroomName(id: Identifier) { return classrooms.find((item) => String(item.id) === String(id))?.classroom_name || "Class not recorded"; }
  function teacherName(id: Identifier, snapshot?: string | null) { const item = teachers.find((teacher) => String(teacher.id) === String(id)); return snapshot || item?.full_name || item?.name || "Practitioner"; }
  function periodName(id: Identifier) { return periods.find((item) => String(item.id) === String(id))?.title || "Period not recorded"; }

  if (loading) return <p>Loading achievement awards...</p>;

  const tabs: Array<[AwardTab, string]> = isTeacher
    ? [["create", "Nominate Learner"], ["nominations", "My Nominations"]]
    : [["create", "Create Award"], ["nominations", "Nominations"], ["issued", "Issued Awards"], ["reprints", "Reprint History"]];

  return (
    <div>
      <div className="db-soft-card" style={cardStyle}>
        <h1 className="db-page-title">Achievement Awards</h1>
        <p className="db-page-subtitle">{isTeacher ? "Nominate learners for principal approval." : "Preview, issue and manage learner certificates."}</p>
      </div>

      <div className="db-card" style={{ ...cardStyle, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
        {tabs.map(([value, label]) => <button key={value} className="db-button-primary" style={tab === value ? tabActive : tabInactive} onClick={() => { setTab(value); setPage(1); }}>{label}</button>)}
      </div>

      {tab === "create" ? (
        <div className="db-card db-card-yellow" style={cardStyle}>
          <h3 style={sectionTitle}>{replacementOf ? "Correct and Reissue Certificate" : isTeacher ? "Nominate a Learner" : "Create Achievement Award"}</h3>
          <div style={formGrid}>
            <Field label="Learner"><select className="db-input" value={learnerId} onChange={(event) => selectLearner(event.target.value)}><option value="">Select learner</option>{learners.map((item) => <option key={item.id} value={item.id}>{item.legal_name || item.name}</option>)}</select></Field>
            <Field label="Class"><input className="db-input" readOnly value={classroomName(classroomId)} /></Field>
            <Field label="Practitioner"><select className="db-input" value={teacherId} disabled={isTeacher} onChange={(event) => setTeacherId(event.target.value)}><option value="">Select practitioner</option>{teachers.map((item) => <option key={item.id} value={item.id}>{item.full_name || item.name}</option>)}</select></Field>
            <Field label="Report Period"><select className="db-input" value={periodId} onChange={(event) => setPeriodId(event.target.value)}><option value="">Select report period</option>{periods.map((item) => <option key={item.id} value={item.id}>{item.title} ({item.academic_year || yearFromPeriod(item)})</option>)}</select></Field>
            <Field label="Award"><select className="db-input" value={awardName} onChange={(event) => { setAwardName(event.target.value); setSelectedReason(""); setCustomReason(""); }}><option value="">Select award</option>{awardDefinitions.map((item) => <option key={item.name} value={item.name}>{item.name} · {item.category}</option>)}</select></Field>
            <Field label="Suggested Reason"><select className="db-input" value={selectedReason} disabled={!definition} onChange={(event) => setSelectedReason(event.target.value)}><option value="">Select a reason</option>{(definition?.reasons || []).map((item) => <option key={item} value={item}>{item}</option>)}</select></Field>
            <div style={{ gridColumn: "1 / -1" }}><Field label="Custom Reason (optional)"><textarea className="db-input" value={customReason} onChange={(event) => setCustomReason(event.target.value)} placeholder="Use this instead of the suggested reason" style={{ minHeight: 78 }} /></Field></div>
          </div>
          <div style={actionRow}><button className="db-button-primary" onClick={() => validateForm() && setPreviewOpen(true)}>Preview</button>{isTeacher ? <button className="db-button-primary" disabled={saving} onClick={saveAward}>{saving ? "Submitting..." : "Submit Nomination"}</button> : null}{replacementOf ? <button className="db-button-primary" style={{ background: "#777" }} onClick={resetForm}>Cancel Reissue</button> : null}</div>
        </div>
      ) : null}

      {tab !== "create" ? (
        <div className="db-card db-card-lavender" style={cardStyle}>
          <div style={formGrid}>
            <select className="db-input" value={filterLearner} onChange={(e) => { setFilterLearner(e.target.value); setPage(1); }}><option value="">All learners</option>{learners.map((item) => <option key={item.id} value={item.id}>{item.legal_name || item.name}</option>)}</select>
            <select className="db-input" value={filterClassroom} onChange={(e) => { setFilterClassroom(e.target.value); setPage(1); }}><option value="">All classrooms</option>{classrooms.map((item) => <option key={item.id} value={item.id}>{item.classroom_name}</option>)}</select>
            <select className="db-input" value={filterPeriod} onChange={(e) => { setFilterPeriod(e.target.value); setPage(1); }}><option value="">All periods</option>{periods.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
            <select className="db-input" value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}><option value="">All categories</option>{awardCategories.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <select className="db-input" value={filterAwardName} onChange={(e) => { setFilterAwardName(e.target.value); setPage(1); }}><option value="">All award types</option>{awardDefinitions.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select>
            <select className="db-input" value={filterYear} onChange={(e) => { setFilterYear(e.target.value); setPage(1); }}><option value="">All years</option>{Array.from(new Set(periods.map((item) => item.academic_year || yearFromPeriod(item)).filter(Boolean))).map((year) => <option key={String(year)} value={String(year)}>{String(year)}</option>)}</select>
            {!isTeacher ? <select className="db-input" value={filterIssuedBy} onChange={(e) => { setFilterIssuedBy(e.target.value); setPage(1); }}><option value="">All issuing principals</option>{approvers.map((item) => <option key={item.id} value={item.id}>{item.full_name || item.name || item.email}</option>)}</select> : null}
          </div>
          <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
            {awards.length === 0 ? <p className="db-helper">No awards found.</p> : awards.map((item) => (
              <div key={item.id} className="db-list-card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div><strong>{learnerName(item.learner_id)}</strong><p style={textStyle}>{item.award_name} · {item.award_category || "General"}</p><p style={textStyle}>{classroomName(item.classroom_id)} · {periodName(item.report_period_id)}</p><p style={smallText}>{item.award_reason}</p>{tab === "nominations" ? <span style={pill}>{String(item.workflow_status || "nominated").replace(/\b\w/g, (letter: string) => letter.toUpperCase())}</span> : null}{tab === "reprints" ? <span style={pill}>{reprintCounts[String(item.id)] || 0} downloads</span> : null}</div>
                  <div style={actionRow}>
                    {tab === "nominations" && canIssue ? <><button className="db-button-primary" onClick={() => approveNomination(item)}>Approve & Issue</button><button className="db-button-primary" style={{ background: "#777" }} onClick={() => declineNomination(item)}>Decline</button></> : null}
                    {item.workflow_status === "issued" ? <><button className="db-button-primary" onClick={() => setSelectedCertificate(item)}>View</button><button className="db-button-primary" onClick={() => downloadCertificate(item)}>Download</button>{canIssue ? <button className="db-button-primary" onClick={() => correctAndReissue(item)}>Correct & Reissue</button> : null}{canIssue ? <button className="db-button-primary" style={{ background: "#c94b4b" }} onClick={() => revokeAward(item)}>Revoke</button> : null}</> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={actionRow}><button className="db-button-primary" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span style={smallText}>Page {page} of {Math.max(1, Math.ceil(totalAwards / PAGE_SIZE))}</span><button className="db-button-primary" disabled={page * PAGE_SIZE >= totalAwards} onClick={() => setPage((value) => value + 1)}>Next</button></div>
        </div>
      ) : null}

      {previewOpen || selectedCertificate ? (
        <div className="db-card" style={{ ...cardStyle, overflowX: "auto" }}>
          <AwardCertificate
            school={school}
            learnerName={selectedCertificate ? learnerName(selectedCertificate.learner_id) : selectedLearner?.legal_name || selectedLearner?.name || ""}
            awardName={selectedCertificate?.award_name || awardName}
            awardSubtitle={getAwardDefinition(selectedCertificate?.award_name || awardName)?.subtitle || String(selectedCertificate?.award_name || awardName).toUpperCase()}
            awardReason={selectedCertificate?.award_reason || reason}
            academicYear={selectedCertificate?.academic_year || selectedCertificate?.award_year || academicYear}
            teacherName={teacherName(selectedCertificate?.teacher_id || teacherId, selectedCertificate?.teacher_name)}
            principalName={selectedCertificate?.principal_name || (isTeacher ? "Principal Approval Pending" : profile?.full_name || "Principal")}
            preview={!selectedCertificate}
          />
          <div style={actionRow}><button className="db-button-primary" style={{ background: "#777" }} onClick={() => { setPreviewOpen(false); setSelectedCertificate(null); }}>Close</button>{previewOpen ? <button className="db-button-primary" disabled={saving} onClick={saveAward}>{saving ? "Saving..." : canIssue ? replacementOf ? "Confirm Reissue" : "Issue Certificate" : "Submit Nomination"}</button> : null}</div>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label style={{ display: "grid", gap: 6, color: "var(--db-text)", fontSize: 13, fontWeight: 800 }}>{label}{children}</label>; }
function yearFromPeriod(period?: PeriodRow | null) { const match = String(period?.title || "").match(/20\d{2}/); return match ? Number(match[0]) : period?.created_at ? new Date(period.created_at).getFullYear() : null; }

const cardStyle = { padding: 20, marginBottom: 18 };
const formGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 };
const actionRow = { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" as const, marginTop: 14 };
const sectionTitle = { margin: "0 0 14px", color: "var(--db-text)", fontSize: 22, fontWeight: 800 };
const textStyle = { margin: "5px 0", color: "var(--db-text-soft)" };
const smallText = { margin: "5px 0", color: "var(--db-text-soft)", fontSize: 12 };
const pill = { display: "inline-block", padding: "5px 9px", borderRadius: 999, background: "#eef8ff", color: "#32617d", fontSize: 12, fontWeight: 800 };
const tabActive = { minHeight: 42, borderRadius: 12, background: "linear-gradient(135deg,#72c8ee,#8ed8f4)", color: "#17324d" };
const tabInactive = { minHeight: 42, borderRadius: 12, background: "#fff", color: "#5e5570", border: "1px solid #e5dced" };
