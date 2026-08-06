"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

type AwardTab = "nominate" | "nominations" | "issued" | "reprints";
type Identifier = string | number | null | undefined;
type ProfileRow = {
  id: string;
  school_id?: number | null;
  role?: string | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  classroom_id?: number | null;
  classroom_name?: string | null;
};
type SchoolRow = {
  id?: number;
  school_name?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
};
type ClassroomRow = { id: number; classroom_name?: string | null };
type LearnerRow = {
  id: string;
  name?: string | null;
  legal_name?: string | null;
  classroom_id?: number | null;
  class?: string | null;
  classroom?: string | null;
  classroom_name?: string | null;
  class_name?: string | null;
  assigned_classroom?: string | null;
  assigned_classroom_name?: string | null;
};
type AwardRow = {
  id: number;
  school_id: number;
  learner_id: string;
  classroom_id?: number | null;
  teacher_id?: string | null;
  award_name?: string | null;
  award_category?: string | null;
  award_reason?: string | null;
  award_year?: number | null;
  academic_year?: number | null;
  teacher_name?: string | null;
  principal_name?: string | null;
  workflow_status?: string | null;
  decline_reason?: string | null;
  declined_at?: string | null;
};
type ReprintRow = { certificate_id: number };

const PAGE_SIZE = 12;
const CURRENT_YEAR = new Date().getFullYear();

export default function AchievementAwardsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [school, setSchool] = useState<SchoolRow | null>(null);
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);
  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [practitioners, setPractitioners] = useState<ProfileRow[]>([]);
  const [approvers, setApprovers] = useState<ProfileRow[]>([]);
  const [awards, setAwards] = useState<AwardRow[]>([]);
  const [reprintCounts, setReprintCounts] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<AwardTab>("nominate");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [totalAwards, setTotalAwards] = useState(0);

  const [learnerId, setLearnerId] = useState("");
  const [awardName, setAwardName] = useState("");
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const [filterLearner, setFilterLearner] = useState("");
  const [filterClassroom, setFilterClassroom] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterAwardName, setFilterAwardName] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterIssuedBy, setFilterIssuedBy] = useState("");
  const [selectedCertificate, setSelectedCertificate] = useState<AwardRow | null>(null);

  const role = String(profile?.role || "").toLowerCase();
  const isPractitioner = ["teacher", "practitioner", "educator"].includes(role);
  const canReview = ["principal", "admin", "master"].includes(role);
  const definition = getAwardDefinition(awardName);
  const reason = customReason.trim() || selectedReason;
  const selectedLearner = learners.find((item) => String(item.id) === learnerId);
  const selectedClassroomId = classroomForLearner(selectedLearner, classrooms);
  const selectedPractitioner = practitioners.find((item) => String(item.id) === String(profile?.id));
  // Existing classroom assignments may be stored by name, while newer ones
  // also retain the classroom ID. Resolve both forms exactly as the
  // practitioner dashboard does so an assigned practitioner can nominate.
  const practitionerClassroomId = useMemo(() => {
    const byId = classrooms.find((item) => String(item.id) === String(profile?.classroom_id));
    if (byId) return String(byId.id);

    const assignedName = normalizeClassroomName(profile?.classroom_name);
    return String(
      classrooms.find((item) => normalizeClassroomName(item.classroom_name) === assignedName)?.id || ""
    );
  }, [classrooms, profile?.classroom_id, profile?.classroom_name]);

  const nominableLearners = useMemo(
    () => isPractitioner
      ? learners.filter((learner) => learnerIsInClassroom(learner, practitionerClassroomId, classrooms))
      : [],
    [classrooms, isPractitioner, learners, practitionerClassroomId]
  );

  const awardYears = useMemo(() => {
    const recordedYears = awards
      .map((item) => item.academic_year || item.award_year)
      .filter((year): year is number => Boolean(year));
    return Array.from(new Set([CURRENT_YEAR, CURRENT_YEAR - 1, ...recordedYears])).sort(
      (left, right) => right - left
    );
  }, [awards]);

  const fetchAwards = useCallback(async (schoolId: number) => {
    const desiredStatus = tab === "nominations"
      ? isPractitioner ? "" : "nominated"
      : tab === "issued" || tab === "reprints" ? "issued" : "";
    let query = supabase
      .from("achievement_awards")
      .select("*", { count: "exact" })
      .eq("school_id", schoolId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (desiredStatus) query = query.eq("workflow_status", desiredStatus);
    if (isPractitioner && profile?.id) query = query.eq("nominated_by", profile.id);
    if (filterLearner) query = query.eq("learner_id", filterLearner);
    if (filterClassroom) query = query.eq("classroom_id", filterClassroom);
    if (filterCategory) query = query.eq("award_category", filterCategory);
    if (filterAwardName) query = query.eq("award_name", filterAwardName);
    if (filterYear) query = query.eq("academic_year", Number(filterYear));
    if (filterIssuedBy) query = query.eq("approved_by", filterIssuedBy);

    const from = (page - 1) * PAGE_SIZE;
    const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) {
      alert(error.message);
      return null;
    }

    const nextReprintCounts: Record<string, number> = {};
    if (tab === "reprints" && (data || []).length > 0) {
      const ids = ((data || []) as AwardRow[]).map((item) => item.id);
      const { data: prints } = await supabase
        .from("certificate_reprints")
        .select("certificate_id")
        .in("certificate_id", ids);
      ((prints || []) as ReprintRow[]).forEach((item) => {
        const certificateId = String(item.certificate_id);
        nextReprintCounts[certificateId] = (nextReprintCounts[certificateId] || 0) + 1;
      });
    }

    return {
      awards: (data || []) as AwardRow[],
      total: count || 0,
      reprintCounts: nextReprintCounts,
    };
  }, [
    filterAwardName,
    filterCategory,
    filterClassroom,
    filterIssuedBy,
    filterLearner,
    filterYear,
    isPractitioner,
    page,
    profile,
    tab,
  ]);

  useEffect(() => {
    async function loadPage() {
      const { profile: currentProfile, error } = await getCurrentProfile();
      if (error || !currentProfile) {
        router.push("/login");
        return;
      }

      const currentRole = String(currentProfile.role || "").toLowerCase();
      if (!["teacher", "practitioner", "educator", "principal", "admin", "master"].includes(currentRole)) {
        router.push("/dashboard");
        return;
      }

      setProfile(currentProfile as ProfileRow);
      setTab(["teacher", "practitioner", "educator"].includes(currentRole) ? "nominate" : "nominations");
      const schoolId = Number(currentProfile.school_id);
      if (!schoolId) {
        router.push("/dashboard");
        return;
      }

      const [schoolResult, classroomResult, learnerResult, staffResult] = await Promise.all([
        supabase.from("schools").select("*").eq("id", schoolId).single(),
        supabase.from("classrooms").select("*").eq("school_id", schoolId).order("classroom_name"),
        supabase.from("learners").select("*").eq("school_id", schoolId).or("is_deleted.is.null,is_deleted.eq.false").order("name"),
        supabase.from("profiles").select("*").eq("school_id", schoolId).order("full_name"),
      ]);

      const firstError = [schoolResult.error, classroomResult.error, learnerResult.error, staffResult.error].find(Boolean);
      if (firstError) alert(firstError.message);
      setSchool((schoolResult.data as SchoolRow | null) || null);
      setClassrooms((classroomResult.data || []) as ClassroomRow[]);
      setLearners((learnerResult.data || []) as LearnerRow[]);
      const staff = (staffResult.data || []) as ProfileRow[];
      setPractitioners(staff.filter((item) => ["teacher", "practitioner", "educator"].includes(String(item.role).toLowerCase())));
      setApprovers(staff.filter((item) => ["principal", "admin", "master"].includes(String(item.role).toLowerCase())));
      setLoading(false);
    }

    void loadPage();
  }, [router]);

  useEffect(() => {
    if (!profile?.school_id || tab === "nominate") return;
    let cancelled = false;
    void fetchAwards(Number(profile.school_id)).then((result) => {
      if (cancelled || !result) return;
      setAwards(result.awards);
      setTotalAwards(result.total);
      setReprintCounts(result.reprintCounts);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchAwards, profile?.school_id, tab]);

  async function refreshAwards(schoolId: number) {
    const result = await fetchAwards(schoolId);
    if (!result) return;
    setAwards(result.awards);
    setTotalAwards(result.total);
    setReprintCounts(result.reprintCounts);
  }

  function resetNomination() {
    setLearnerId("");
    setAwardName("");
    setSelectedReason("");
    setCustomReason("");
    setPreviewOpen(false);
  }

  function validateNomination() {
    if (!isPractitioner) {
      alert("Only practitioners can create award nominations.");
      return false;
    }
    if (!practitionerClassroomId) {
      alert("Your principal must assign you to a classroom before you can nominate a learner.");
      return false;
    }
    if (!learnerId || !selectedClassroomId || !awardName || !reason) {
      alert("Please complete the learner, award and reason fields.");
      return false;
    }
    return true;
  }

  async function submitNomination() {
    if (!validateNomination() || !profile?.school_id || !selectedClassroomId) return;
    setSaving(true);
    const payload = {
      school_id: Number(profile.school_id),
      learner_id: learnerId,
      classroom_id: Number(selectedClassroomId),
      teacher_id: profile.id,
      report_period_id: null,
      award_name: awardName,
      award_category: definition?.category || "General",
      award_reason: reason,
      teacher_name: selectedPractitioner?.full_name || selectedPractitioner?.name || profile.full_name || profile.name || "Practitioner",
      principal_name: null,
      award_year: CURRENT_YEAR,
      academic_year: CURRENT_YEAR,
      workflow_status: "nominated",
      nominated_by: profile.id,
      approved_by: null,
      issued_at: null,
      certificate_generated: false,
    };
    const { error } = await supabase.from("achievement_awards").insert([payload]);
    setSaving(false);
    if (error) return alert(error.message);
    alert("Nomination submitted for principal approval.");
    resetNomination();
    setTab("nominations");
  }

  async function approveNomination(item: AwardRow) {
    if (!canReview || !profile?.school_id) return;
    const { error } = await supabase
      .from("achievement_awards")
      .update({
        workflow_status: "issued",
        approved_by: profile.id,
        approved_at: new Date().toISOString(),
        principal_name: profile.full_name || profile.name || "Principal",
        issued_at: new Date().toISOString(),
        certificate_generated: true,
        decline_reason: null,
        declined_at: null,
        declined_by: null,
      })
      .eq("id", item.id);
    if (error) return alert(error.message);
    await refreshAwards(Number(profile.school_id));
    alert("Nomination approved and annual certificate issued.");
  }

  async function declineNomination(item: AwardRow) {
    if (!canReview || !profile?.school_id) return;
    const reasonText = prompt("Reason for declining this nomination:");
    if (!reasonText?.trim()) return;
    const { error } = await supabase
      .from("achievement_awards")
      .update({
        workflow_status: "declined",
        decline_reason: reasonText.trim(),
        declined_by: profile.id,
        declined_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    if (error) return alert(error.message);
    await refreshAwards(Number(profile.school_id));
    alert("Nomination declined. The practitioner can now see your reason.");
  }

  async function revokeAward(item: AwardRow) {
    if (!canReview || !profile?.id || !profile.school_id) return;
    const reasonText = prompt("Reason for revoking this certificate:");
    if (!reasonText?.trim()) return;
    const { error } = await supabase
      .from("achievement_awards")
      .update({
        workflow_status: "revoked",
        deleted_at: new Date().toISOString(),
        revoked_at: new Date().toISOString(),
        revoked_by: profile.id,
        revoke_reason: reasonText.trim(),
      })
      .eq("id", item.id);
    if (error) return alert(error.message);
    await refreshAwards(Number(profile.school_id));
    alert("Certificate revoked.");
  }

  async function downloadCertificate(item: AwardRow) {
    if (!profile?.id) return;
    setSelectedCertificate(item);
    requestAnimationFrame(async () => {
      const element = document.querySelector(".award-certificate-document") as HTMLElement | null;
      if (!element) return;
      try {
        const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: "#fff" });
        const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 297, 210);
        await supabase.from("certificate_reprints").insert([{
          certificate_id: item.id,
          school_id: item.school_id,
          // Learner primary keys are UUIDs. The legacy bigint learner_id in
          // this audit table remains optional for historic records only.
          learner_uuid: item.learner_id,
          action: "download",
          performed_by: profile.id,
        }]);
        pdf.save(`${learnerName(item.learner_id).replace(/\s+/g, "_")}_Certificate.pdf`);
      } catch (error) {
        console.error(error);
        alert("Certificate download failed.");
      }
    });
  }

  function learnerName(id: Identifier) {
    const item = learners.find((learner) => String(learner.id) === String(id));
    return item?.legal_name || item?.name || "Learner";
  }

  function classroomName(id: Identifier) {
    return classrooms.find((item) => String(item.id) === String(id))?.classroom_name || "Class not recorded";
  }

  function practitionerName(id: Identifier, snapshot?: string | null) {
    const item = practitioners.find((practitioner) => String(practitioner.id) === String(id));
    return snapshot || item?.full_name || item?.name || "Practitioner";
  }

  if (loading) return <p>Loading achievement awards...</p>;

  const tabs: Array<[AwardTab, string]> = isPractitioner
    ? [["nominate", "Nominate Learner"], ["nominations", "My Nominations"]]
    : [["nominations", "Nominations for Approval"], ["issued", "Annual Awards"], ["reprints", "Reprint History"]];

  return (
    <div>
      <div className="db-soft-card" style={cardStyle}>
        <h1 className="db-page-title">Achievement Awards</h1>
        <p className="db-page-subtitle">
          {isPractitioner
            ? `Nominate learners from your assigned classroom for the ${CURRENT_YEAR} annual awards.`
            : `Review practitioner nominations and issue ${CURRENT_YEAR} annual achievement certificates.`}
        </p>
      </div>

      <div className="db-card" style={{ ...cardStyle, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 8 }}>
        {tabs.map(([value, label]) => (
          <button
            key={value}
            className="db-button-primary"
            style={tab === value ? tabActive : tabInactive}
            onClick={() => { setTab(value); setPage(1); }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "nominate" ? (
        <div className="db-card db-card-yellow" style={cardStyle}>
          <h3 style={sectionTitle}>Nominate a Learner</h3>
          <p className="db-helper">Your classroom and practitioner details are recorded automatically. Each nomination is reviewed by the principal before a certificate is issued.</p>
          {!practitionerClassroomId ? <p style={noticeStyle}>A classroom assignment is needed before you can nominate learners. Please ask the principal to assign your class.</p> : null}
          <div style={formGrid}>
            <Field label="Learner">
              <select className="db-input" value={learnerId} disabled={!practitionerClassroomId} onChange={(event) => setLearnerId(event.target.value)}>
                <option value="">Select learner</option>
                {nominableLearners.map((item) => <option key={item.id} value={item.id}>{item.legal_name || item.name}</option>)}
              </select>
            </Field>
            <Field label="Class"><input className="db-input" readOnly value={classroomName(selectedClassroomId || practitionerClassroomId)} /></Field>
            <Field label="Practitioner"><input className="db-input" readOnly value={practitionerName(profile?.id, profile?.full_name || profile?.name)} /></Field>
            <Field label="Award Year"><input className="db-input" readOnly value={`${CURRENT_YEAR} annual awards`} /></Field>
            <Field label="Award">
              <select className="db-input" value={awardName} onChange={(event) => { setAwardName(event.target.value); setSelectedReason(""); setCustomReason(""); }}>
                <option value="">Select award</option>
                {awardDefinitions.map((item) => <option key={item.name} value={item.name}>{item.name} · {item.category}</option>)}
              </select>
            </Field>
            <Field label="Suggested Reason">
              <select className="db-input" value={selectedReason} disabled={!definition} onChange={(event) => setSelectedReason(event.target.value)}>
                <option value="">Select a reason</option>
                {(definition?.reasons || []).map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </Field>
            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="Additional Evidence or Reason (optional)">
                <textarea className="db-input" value={customReason} onChange={(event) => setCustomReason(event.target.value)} placeholder="Use this instead of, or add to, the suggested reason" style={{ minHeight: 78 }} />
              </Field>
            </div>
          </div>
          <div style={actionRow}>
            <button className="db-button-primary" disabled={!practitionerClassroomId} onClick={() => validateNomination() && setPreviewOpen(true)}>Preview</button>
            <button className="db-button-primary" disabled={saving || !practitionerClassroomId} onClick={submitNomination}>{saving ? "Submitting..." : "Submit Nomination"}</button>
          </div>
        </div>
      ) : null}

      {tab !== "nominate" ? (
        <div className="db-card db-card-lavender" style={cardStyle}>
          <div style={formGrid}>
            <select className="db-input" value={filterLearner} onChange={(event) => { setFilterLearner(event.target.value); setPage(1); }}><option value="">All learners</option>{learners.map((item) => <option key={item.id} value={item.id}>{item.legal_name || item.name}</option>)}</select>
            <select className="db-input" value={filterClassroom} onChange={(event) => { setFilterClassroom(event.target.value); setPage(1); }}><option value="">All classrooms</option>{classrooms.map((item) => <option key={item.id} value={item.id}>{item.classroom_name}</option>)}</select>
            <select className="db-input" value={filterCategory} onChange={(event) => { setFilterCategory(event.target.value); setPage(1); }}><option value="">All categories</option>{awardCategories.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <select className="db-input" value={filterAwardName} onChange={(event) => { setFilterAwardName(event.target.value); setPage(1); }}><option value="">All award types</option>{awardDefinitions.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select>
            <select className="db-input" value={filterYear} onChange={(event) => { setFilterYear(event.target.value); setPage(1); }}><option value="">All annual years</option>{awardYears.map((year) => <option key={year} value={String(year)}>{year}</option>)}</select>
            {!isPractitioner ? <select className="db-input" value={filterIssuedBy} onChange={(event) => { setFilterIssuedBy(event.target.value); setPage(1); }}><option value="">All approving principals</option>{approvers.map((item) => <option key={item.id} value={item.id}>{item.full_name || item.name || item.email}</option>)}</select> : null}
          </div>
          <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
            {awards.length === 0 ? <p className="db-helper">No awards found.</p> : awards.map((item) => (
              <div key={item.id} className="db-list-card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <strong>{learnerName(item.learner_id)}</strong>
                    <p style={textStyle}>{item.award_name} · {item.award_category || "General"}</p>
                    <p style={textStyle}>{classroomName(item.classroom_id)} · {item.academic_year || item.award_year || CURRENT_YEAR} annual award</p>
                    <p style={smallText}>Nominated by: {practitionerName(item.teacher_id, item.teacher_name)}</p>
                    <p style={smallText}>{item.award_reason}</p>
                    {tab === "nominations" ? <span style={statusPill(item.workflow_status)}>{awardStatusLabel(item.workflow_status)}</span> : null}
                    {item.workflow_status === "declined" ? <p style={declineStyle}><strong>Nomination declined:</strong> {item.decline_reason || "The principal did not record a reason."}</p> : null}
                    {tab === "reprints" ? <span style={pill}>{reprintCounts[String(item.id)] || 0} downloads</span> : null}
                  </div>
                  <div style={actionRow}>
                    {tab === "nominations" && canReview ? <><button className="db-button-primary" onClick={() => approveNomination(item)}>Approve & Issue</button><button className="db-button-primary" style={secondaryDangerButton} onClick={() => declineNomination(item)}>Decline</button></> : null}
                    {item.workflow_status === "issued" ? <><button className="db-button-primary" onClick={() => setSelectedCertificate(item)}>View</button><button className="db-button-primary" onClick={() => downloadCertificate(item)}>Download</button>{canReview ? <button className="db-button-primary" style={dangerButton} onClick={() => revokeAward(item)}>Revoke</button> : null}</> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={actionRow}>
            <button className="db-button-primary" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
            <span style={smallText}>Page {page} of {Math.max(1, Math.ceil(totalAwards / PAGE_SIZE))}</span>
            <button className="db-button-primary" disabled={page * PAGE_SIZE >= totalAwards} onClick={() => setPage((value) => value + 1)}>Next</button>
          </div>
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
            academicYear={selectedCertificate?.academic_year || selectedCertificate?.award_year || CURRENT_YEAR}
            teacherName={practitionerName(selectedCertificate?.teacher_id || profile?.id, selectedCertificate?.teacher_name || profile?.full_name || profile?.name)}
            principalName={selectedCertificate?.principal_name || (isPractitioner ? "Principal Approval Pending" : profile?.full_name || profile?.name || "Principal")}
            preview={!selectedCertificate}
          />
          <div style={actionRow}>
            <button className="db-button-primary" style={secondaryDangerButton} onClick={() => { setPreviewOpen(false); setSelectedCertificate(null); }}>Close</button>
            {previewOpen ? <button className="db-button-primary" disabled={saving} onClick={submitNomination}>{saving ? "Saving..." : "Submit Nomination"}</button> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label style={{ display: "grid", gap: 6, color: "var(--db-text)", fontSize: 13, fontWeight: 800 }}>{label}{children}</label>;
}

function classroomForLearner(learner: LearnerRow | undefined, classrooms: ClassroomRow[]) {
  if (!learner) return "";
  if (learner.classroom_id) return String(learner.classroom_id);
  const learnerClassNames = [learner.class, learner.classroom, learner.classroom_name, learner.class_name, learner.assigned_classroom, learner.assigned_classroom_name]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());
  return String(classrooms.find((item) => learnerClassNames.includes(String(item.classroom_name || "").trim().toLowerCase()))?.id || "");
}

function learnerIsInClassroom(learner: LearnerRow, classroomId: string, classrooms: ClassroomRow[]) {
  return Boolean(classroomId) && classroomForLearner(learner, classrooms) === classroomId;
}

function normalizeClassroomName(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function awardStatusLabel(status?: string | null) {
  const normalized = String(status || "nominated");
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const cardStyle = { padding: 20, marginBottom: 18 };
const formGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 };
const actionRow = { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" as const, marginTop: 14 };
const sectionTitle = { margin: "0 0 8px", color: "var(--db-text)", fontSize: 22, fontWeight: 800 };
const textStyle = { margin: "5px 0", color: "var(--db-text-soft)" };
const smallText = { margin: "5px 0", color: "var(--db-text-soft)", fontSize: 12 };
const pill = { display: "inline-block", padding: "5px 9px", borderRadius: 999, background: "#eef8ff", color: "#32617d", fontSize: 12, fontWeight: 800 };
const noticeStyle = { margin: "12px 0", padding: "10px 12px", borderRadius: 10, background: "#fff3db", color: "#7a4f11", fontWeight: 700 };
const declineStyle = { margin: "10px 0 0", padding: "9px 11px", borderRadius: 10, background: "#fff0f0", color: "#a43838", fontSize: 13 };
const tabActive = { minHeight: 42, borderRadius: 12, background: "linear-gradient(135deg,#72c8ee,#8ed8f4)", color: "#17324d" };
const tabInactive = { minHeight: 42, borderRadius: 12, background: "#fff", color: "#5e5570", border: "1px solid #e5dced" };
const secondaryDangerButton = { background: "#777" };
const dangerButton = { background: "#c94b4b" };

function statusPill(status?: string | null) {
  if (status === "declined") return { ...pill, background: "#fff0f0", color: "#a43838" };
  if (status === "issued") return { ...pill, background: "#e9f8ee", color: "#287146" };
  return pill;
}
