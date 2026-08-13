"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";
import { resolveSchoolContext } from "../lib/school-context";
import { authenticatedFetch } from "../lib/authenticated-fetch";
import { supportSuggestionsFor } from "./support-suggestions";

const PAGE_SIZE = 10;

const developmentalAreas = [
  "Language and Communication",
  "Early Mathematics",
  "Fine Motor Development",
  "Gross Motor Development",
  "Creative Development",
  "Social and Emotional Development",
  "Life Skills",
  "Sensory Development",
  "Outdoor Play",
  "Music and Movement",
];

const supportStatuses = [
  { value: "new", label: "New" },
  { value: "active", label: "Active" },
  { value: "improving", label: "Improving" },
  { value: "monitoring", label: "Monitoring" },
  { value: "resolved", label: "Resolved" },
];

type OutcomeRow = {
  id: number;
  school_id: number;
  classroom_id: number;
  learner_id: string;
  weekly_plan_id: number | null;
  developmental_area: string | null;
  theme: string | null;
  activity_date: string | null;
  activity_name: string | null;
  outcome_status: string | null;
  support_status?: string | null;
  observation: string | null;
  recorded_by?: string | null;
  created_at?: string | null;
};

type ProfileRow = {
  role?: string | null;
  classroom_id?: number | null;
  classroom_name?: string | null;
};

type ClassroomRow = { id: number; classroom_name?: string | null };
type LearnerRow = { id: string; name?: string | null; classroom_id?: number | null };
type SupportUpdateRow = {
  id: number;
  outcome_id: number;
  support_status: string;
  support_identified: string | null;
  intervention: string | null;
  progress_note: string | null;
  parent_summary: string | null;
  next_review_date: string | null;
  recorded_by_name: string | null;
  recorded_at: string;
};

export default function SupportRegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolParam = searchParams.get("school");

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);
  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [outcomes, setOutcomes] = useState<OutcomeRow[]>([]);

  const [classroomFilter, setClassroomFilter] = useState("");
  const [learnerFilter, setLearnerFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [selectedLearnerId, setSelectedLearnerId] = useState("");
  const [profileOutcomes, setProfileOutcomes] = useState<OutcomeRow[]>([]);
  const [supportUpdates, setSupportUpdates] = useState<SupportUpdateRow[]>([]);
  const [supportDaysAbsent, setSupportDaysAbsent] = useState<number | null>(null);
  const [supportAttendanceFrom, setSupportAttendanceFrom] = useState("");
  const [updateOutcomeId, setUpdateOutcomeId] = useState("");
  const [updateStatus, setUpdateStatus] = useState("active");
  const [supportIdentified, setSupportIdentified] = useState("");
  const [customSupportIdentified, setCustomSupportIdentified] = useState("");
  const [interventionSuggestion, setInterventionSuggestion] = useState("");
  const [intervention, setIntervention] = useState("");
  const [progressNote, setProgressNote] = useState("");
  const [parentSummary, setParentSummary] = useState("");
  const [nextReviewDate, setNextReviewDate] = useState("");

  const role = String(profile?.role || "").toLowerCase();
  const isTeacher = role === "teacher";
  const isMaster = role === "master";

  const selectedUpdateOutcome = useMemo(
    () => profileOutcomes.find((item) => String(item.id) === updateOutcomeId) || null,
    [profileOutcomes, updateOutcomeId]
  );
  const supportNeedSuggestions = useMemo(
    () => supportSuggestionsFor(selectedUpdateOutcome?.developmental_area, selectedUpdateOutcome?.activity_name),
    [selectedUpdateOutcome]
  );
  const selectedSupportNeed = useMemo(
    () => supportNeedSuggestions.find((item) => item.label === supportIdentified) || null,
    [supportNeedSuggestions, supportIdentified]
  );

  useEffect(() => {
    loadPage();
  }, []);

  const teacherClassroomId = useMemo(() => {
    if (!isTeacher) return "";

    if (profile?.classroom_id) return String(profile.classroom_id);

    const classroomName = profile?.classroom_name ? String(profile.classroom_name) : "";
    const match = classrooms.find((item) => String(item.classroom_name) === classroomName);

    return match ? String(match.id) : "";
  }, [isTeacher, profile, classrooms]);

  const latestOutcomes = useMemo(() => {
    const latest = new Map<string, OutcomeRow>();

    outcomes.forEach((item) => {
      if (!item.learner_id || !item.developmental_area) return;
      if (item.outcome_status !== "needs_support") return;

      const key = `${item.learner_id}-${item.developmental_area}`;
      const existing = latest.get(key);

      if (!existing) {
        latest.set(key, item);
        return;
      }

      const existingDate = new Date(existing.created_at || existing.activity_date || "");
      const itemDate = new Date(item.created_at || item.activity_date || "");

      if (itemDate > existingDate) {
        latest.set(key, item);
      }
    });

    return Array.from(latest.values());
  }, [outcomes]);

  const filteredRows = useMemo(() => {
    return latestOutcomes.filter((item) => {
      const teacherMatch = isTeacher && teacherClassroomId
        ? String(item.classroom_id) === teacherClassroomId
        : true;

      const classroomMatch = classroomFilter
        ? String(item.classroom_id) === classroomFilter
        : true;

      const learnerMatch = learnerFilter
        ? String(item.learner_id) === learnerFilter
        : true;

      const areaMatch = areaFilter
        ? item.developmental_area === areaFilter
        : true;

      const statusMatch = statusFilter
        ? supportStatusValue(item) === statusFilter
        : supportStatusValue(item) !== "resolved";

      const monthMatch = monthFilter
        ? String(item.activity_date || item.created_at || "").slice(0, 7) === monthFilter
        : true;

      return teacherMatch && classroomMatch && learnerMatch && areaMatch && statusMatch && monthMatch;
    });
  }, [latestOutcomes, isTeacher, teacherClassroomId, classroomFilter, learnerFilter, areaFilter, statusFilter, monthFilter]);

  const visibleRows = useMemo(() => {
    return filteredRows.slice(0, visibleCount);
  }, [filteredRows, visibleCount]);

  const stats = useMemo(() => {
    const relevantRows = latestOutcomes.filter((item) => {
      if (isTeacher && teacherClassroomId) {
        return String(item.classroom_id) === teacherClassroomId;
      }

      return true;
    });

    return {
      open: relevantRows.filter((item) => ["new", "active", "improving"].includes(supportStatusValue(item))).length,
      monitoring: relevantRows.filter((item) => supportStatusValue(item) === "monitoring").length,
      resolved: relevantRows.filter((item) => supportStatusValue(item) === "resolved").length,
    };
  }, [latestOutcomes, isTeacher, teacherClassroomId]);

  async function loadPage() {
    const { profile: currentProfile, error } = await getCurrentProfile();

    if (error || !currentProfile) {
      router.push("/login");
      return;
    }

    setProfile(currentProfile);

    const context = await resolveSchoolContext(schoolParam);

    if (context.error) {
      router.push("/login");
      return;
    }

    if (context.shouldReturnToMaster || !context.schoolId) {
      router.push("/master");
      return;
    }

    setSchoolId(context.schoolId);

    await Promise.all([
      fetchClassrooms(context.schoolId),
      fetchLearners(context.schoolId),
      fetchOutcomes(context.schoolId),
    ]);

    setLoading(false);
  }

  async function fetchClassrooms(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("classrooms")
      .select("*")
      .eq("school_id", currentSchoolId)
      .order("classroom_name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setClassrooms(data || []);
  }

  async function fetchLearners(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("learners")
      .select("*")
      .eq("school_id", currentSchoolId)
      .order("name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setLearners(data || []);
  }

  async function fetchOutcomes(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("learner_activity_outcomes")
      .select("*")
      .eq("school_id", currentSchoolId)
      .eq("outcome_status", "needs_support")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setOutcomes(data || []);
  }

  async function openSupportProfile(learnerId: string) {
    if (!schoolId) return;
    setProfileLoading(true);
    setSelectedLearnerId(String(learnerId));
    setLearnerFilter(String(learnerId));
    try {
      const response = await authenticatedFetch(
        `/api/classroom-support?school_id=${schoolId}&learner_id=${learnerId}`
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Support profile could not be loaded.");
      const nextOutcomes = (payload.outcomes || []) as OutcomeRow[];
      setProfileOutcomes(nextOutcomes);
      setSupportUpdates((payload.updates || []) as SupportUpdateRow[]);
      const learner = learners.find((item) => String(item.id) === String(learnerId));
      const firstSupportDate = nextOutcomes
        .map((item) => item.activity_date || item.created_at?.slice(0, 10) || "")
        .filter(Boolean)
        .sort()[0] || "";
      setSupportAttendanceFrom(firstSupportDate);
      setSupportDaysAbsent(null);
      if (learner?.name) {
        let attendanceQuery = supabase
          .from("attendance")
          .select("id", { count: "exact", head: true })
          .eq("school_id", schoolId)
          .eq("learner_name", learner.name)
          .eq("status", "absent");
        if (firstSupportDate) attendanceQuery = attendanceQuery.gte("attendance_date", firstSupportDate);
        const { count, error: attendanceError } = await attendanceQuery;
        if (attendanceError) {
          console.error("Could not load support attendance context", attendanceError);
          setSupportDaysAbsent(0);
        } else {
          setSupportDaysAbsent(count || 0);
        }
      } else {
        setSupportDaysAbsent(0);
      }
      const firstOpen = nextOutcomes.find((item) => supportStatusValue(item) !== "resolved") || nextOutcomes[0];
      setUpdateOutcomeId(firstOpen ? String(firstOpen.id) : "");
      setUpdateStatus(firstOpen ? supportStatusValue(firstOpen) : "active");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Support profile could not be loaded.");
      setSelectedLearnerId("");
    } finally {
      setProfileLoading(false);
    }
  }

  async function saveSupportUpdate() {
    if (!schoolId || !selectedLearnerId || !updateOutcomeId) return;
    const savedSupportIdentified = supportIdentified === "Other support need"
      ? customSupportIdentified.trim()
      : supportIdentified;
    const savedIntervention = [
      interventionSuggestion === "Other intervention" ? "" : interventionSuggestion,
      intervention.trim(),
    ].filter(Boolean).join(" · ");
    if (!savedSupportIdentified) {
      alert("Select the support identified, or describe another support need.");
      return;
    }
    if (!savedIntervention) {
      alert("Select an intervention suggestion, or add your own intervention.");
      return;
    }
    setSaving(true);
    try {
      const response = await authenticatedFetch("/api/classroom-support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school_id: schoolId,
          learner_id: selectedLearnerId,
          outcome_id: Number(updateOutcomeId),
          support_status: updateStatus,
          support_identified: savedSupportIdentified,
          intervention: savedIntervention,
          progress_note: progressNote,
          parent_summary: parentSummary,
          next_review_date: nextReviewDate || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Support update could not be saved.");
      setSupportIdentified("");
      setCustomSupportIdentified("");
      setInterventionSuggestion("");
      setIntervention("");
      setProgressNote("");
      setParentSummary("");
      setNextReviewDate("");
      await Promise.all([fetchOutcomes(schoolId), openSupportProfile(selectedLearnerId)]);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Support update could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  function learnerName(learnerId: string) {
    const learner = learners.find((item) => String(item.id) === String(learnerId));
    return learner?.name || "Learner";
  }

  function classroomName(classroomId: number) {
    const classroom = classrooms.find((item) => Number(item.id) === Number(classroomId));
    return classroom?.classroom_name || "Classroom";
  }

  function resetFilters() {
    setClassroomFilter("");
    setLearnerFilter("");
    setAreaFilter("");
    setStatusFilter("");
    setMonthFilter("");
    setVisibleCount(PAGE_SIZE);
  }

  function closeSupportProfile() {
    setSelectedLearnerId("");
    setProfileOutcomes([]);
    setSupportUpdates([]);
    setSupportDaysAbsent(null);
    setSupportAttendanceFrom("");
    setUpdateOutcomeId("");
    setSupportIdentified("");
    setCustomSupportIdentified("");
    setInterventionSuggestion("");
    setIntervention("");
  }

  if (loading) {
    return <p>Loading support register...</p>;
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: "18px 20px", marginBottom: "16px" }}>
        <h1 className="db-page-title">Learner Support Register</h1>
        <p className="db-page-subtitle">
          {isTeacher
            ? "View and update support cases for learners in your class."
            : "Track learner support cases across classrooms."}
        </p>

        <Link
          href={isMaster && schoolId ? `/classroom-activities?school=${schoolId}` : "/classroom-activities"}
          style={backButton}
        >
          Back to Classroom Activities
        </Link>
      </div>

      <div style={compactGrid}>
        <StatCard title="Open Cases" value={stats.open} note="New, active or improving" />
        <StatCard title="Monitoring" value={stats.monitoring} note="Being watched" />
        <StatCard title="Resolved" value={stats.resolved} note="Closed support cases" />
      </div>

      <div className="db-card db-card-blue" style={cardStyle}>
        <h3 style={sectionTitle}>Filters</h3>

        <div style={filterGrid}>
          <select
            className="db-input"
            value={classroomFilter}
            onChange={(e) => {
              setClassroomFilter(e.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            disabled={isTeacher}
          >
            <option value="">All classrooms</option>
            {classrooms.map((classroom) => (
              <option key={classroom.id} value={classroom.id}>{classroom.classroom_name}</option>
            ))}
          </select>

          <select
            className="db-input"
            value={learnerFilter}
            onChange={(e) => {
              setLearnerFilter(e.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
          >
            <option value="">All learners</option>
            {learners
              .filter((learner) => {
                if (isTeacher && teacherClassroomId) {
                  return String(learner.classroom_id) === teacherClassroomId;
                }

                if (classroomFilter) {
                  return String(learner.classroom_id) === classroomFilter;
                }

                return true;
              })
              .map((learner) => (
                <option key={learner.id} value={learner.id}>{learner.name}</option>
              ))}
          </select>

          <select
            className="db-input"
            value={areaFilter}
            onChange={(e) => {
              setAreaFilter(e.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
          >
            <option value="">All areas</option>
            {developmentalAreas.map((area) => (
              <option key={area} value={area}>{area}</option>
            ))}
          </select>

          <select
            className="db-input"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
          >
            <option value="">Open cases</option>
            {supportStatuses.map((status) => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>

          <input
            className="db-input"
            type="month"
            value={monthFilter}
            onChange={(e) => {
              setMonthFilter(e.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
          />
        </div>

        <button type="button" className="db-button-primary" style={{ ...smallButton, marginTop: "10px" }} onClick={resetFilters}>
          Reset Filters
        </button>
      </div>

      {selectedLearnerId ? (
        <section className="db-card db-card-blue support-print-summary" style={cardStyle}>
          <div className="support-no-print" style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
            <div>
              <h2 style={sectionTitle}>Learner Support Profile</h2>
              <p style={textStyle}>A complete working history for parent meetings and classroom follow-up.</p>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button type="button" className="db-button-primary" style={smallButton} onClick={() => window.print()}>
                Print Support Summary
              </button>
              <button type="button" className="db-button-secondary" style={smallButton} onClick={closeSupportProfile}>
                Close
              </button>
            </div>
          </div>

          {profileLoading ? <p className="db-helper">Loading learner support profile...</p> : (
            <>
              <div className="support-print-heading">
                <p style={{ margin: 0, color: "var(--db-text-soft)", fontWeight: 800 }}>DailyBloom Learner Support Summary</p>
                <h1 style={{ margin: "6px 0", color: "var(--db-text)", fontSize: "28px" }}>
                  {learnerName(selectedLearnerId)}
                </h1>
                <p style={textStyle}>
                  {classroomName(Number(profileOutcomes[0]?.classroom_id || 0))} · Printed {formatShortDate(new Date().toISOString())}
                </p>
              </div>

              <div style={{ ...compactGrid, marginTop: "16px" }}>
                <StatCard title="Support Areas" value={new Set(profileOutcomes.map((item) => item.developmental_area).filter(Boolean)).size} note="Areas identified" />
                <StatCard title="Open Cases" value={profileOutcomes.filter((item) => supportStatusValue(item) !== "resolved").length} note="Currently receiving support" />
                <StatCard title="Recorded Updates" value={supportUpdates.length} note="Interventions and reviews" />
          <StatCard
            title="Days Absent"
            value={supportDaysAbsent ?? 0}
            note={
              supportDaysAbsent === null
                ? "Calculating attendance context"
                : supportAttendanceFrom
                  ? `Since ${formatShortDate(supportAttendanceFrom)}`
                  : "During support history"
            }
          />
              </div>

              <div className="support-no-print db-soft-card" style={{ padding: "16px", marginBottom: "16px" }}>
                <h3 style={sectionTitle}>Record Intervention or Progress</h3>
                <div style={filterGrid}>
                  <label style={fieldLabel}>
                    Support area
                    <select className="db-input" value={updateOutcomeId} onChange={(event) => {
                      const nextId = event.target.value;
                      setUpdateOutcomeId(nextId);
                      const selected = profileOutcomes.find((item) => String(item.id) === nextId);
                      if (selected) setUpdateStatus(supportStatusValue(selected));
                      setSupportIdentified("");
                      setCustomSupportIdentified("");
                      setInterventionSuggestion("");
                      setIntervention("");
                    }}>
                      <option value="">Select support area</option>
                      {profileOutcomes.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.developmental_area || "Support area"} · {supportStatusLabel(supportStatusValue(item))}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={fieldLabel}>
                    Current status
                    <select className="db-input" value={updateStatus} onChange={(event) => setUpdateStatus(event.target.value)}>
                      {supportStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                    </select>
                  </label>
                  <label style={fieldLabel}>
                    Next review date
                    <input className="db-input" type="date" value={nextReviewDate} onChange={(event) => setNextReviewDate(event.target.value)} />
                  </label>
                </div>
                <label style={fieldLabel}>
                  Support identified
                  <select className="db-input" value={supportIdentified} onChange={(event) => {
                    setSupportIdentified(event.target.value);
                    setCustomSupportIdentified("");
                    setInterventionSuggestion("");
                  }}>
                    <option value="">Select what was observed</option>
                    {supportNeedSuggestions.map((item) => (
                      <option key={item.label} value={item.label}>{item.label}</option>
                    ))}
                  </select>
                </label>
                {supportIdentified === "Other support need" ? (
                  <label style={fieldLabel}>
                    Describe the support identified
                    <input className="db-input" value={customSupportIdentified} onChange={(event) => setCustomSupportIdentified(event.target.value)} placeholder="Describe what was observed without diagnosing the learner" />
                  </label>
                ) : null}
                <label style={fieldLabel}>
                  Suggested intervention
                  <select className="db-input" value={interventionSuggestion} onChange={(event) => setInterventionSuggestion(event.target.value)} disabled={!selectedSupportNeed}>
                    <option value="">{selectedSupportNeed ? "Select an intervention" : "Select the support identified first"}</option>
                    {(selectedSupportNeed?.interventions || []).map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label style={fieldLabel}>
                  {interventionSuggestion === "Other intervention" ? "Describe the intervention used" : "Additional intervention detail (optional)"}
                  <textarea className="db-input" rows={3} value={intervention} onChange={(event) => setIntervention(event.target.value)} placeholder="Add any adaptation or learner-specific support provided" />
                </label>
                <label style={fieldLabel}>
                  Detailed progress note
                  <textarea className="db-input" rows={3} value={progressNote} onChange={(event) => setProgressNote(event.target.value)} placeholder="What changed, what remains difficult and what should happen next?" />
                </label>
                <label style={fieldLabel}>
                  Parent meeting summary and suggested home support
                  <textarea className="db-input" rows={3} value={parentSummary} onChange={(event) => setParentSummary(event.target.value)} placeholder="Summarise progress in plain language and suggest a simple way the family can support the learner at home." />
                </label>
                <button type="button" className="db-button-primary" onClick={saveSupportUpdate} disabled={saving || !updateOutcomeId}>
                  {saving ? "Saving..." : "Save Support Update"}
                </button>
              </div>

              <h3 style={sectionTitle}>Support Areas</h3>
              <div style={{ display: "grid", gap: "10px", marginBottom: "18px" }}>
                {profileOutcomes.map((item) => (
                  <div key={item.id} className="db-list-card">
                    <strong>{item.developmental_area || "Support area"}</strong>
                    <p style={textStyle}>Status: {supportStatusLabel(supportStatusValue(item))}</p>
                    <p style={textStyle}>Identified through: {item.activity_name || "Classroom observation"}</p>
                    {item.observation ? <p style={textStyle}>Initial observation: {item.observation}</p> : null}
                    <p style={smallHint}>Date identified: {item.activity_date || formatShortDate(item.created_at || "")}</p>
                  </div>
                ))}
              </div>

              <h3 style={sectionTitle}>Intervention and Progress History</h3>
              {supportUpdates.length === 0 ? (
                <p className="db-helper">No follow-up updates recorded yet. Initial classroom observations appear above.</p>
              ) : (
                <div style={{ display: "grid", gap: "10px" }}>
                  {supportUpdates.map((update) => {
                    const outcome = profileOutcomes.find((item) => item.id === update.outcome_id);
                    return (
                      <div key={update.id} className="db-list-card">
                        <strong>{outcome?.developmental_area || "Support area"} · {supportStatusLabel(update.support_status)}</strong>
                        {update.support_identified ? <p style={textStyle}><b>Support identified:</b> {update.support_identified}</p> : null}
                        {update.intervention ? <p style={textStyle}><b>Intervention:</b> {update.intervention}</p> : null}
                        {update.progress_note ? <p style={textStyle}><b>Progress since the previous review:</b> {update.progress_note}</p> : null}
                        {update.parent_summary ? <p style={textStyle}><b>Parent summary and home support:</b> {update.parent_summary}</p> : null}
                        {update.next_review_date ? <p style={textStyle}><b>Next review:</b> {formatShortDate(update.next_review_date)}</p> : null}
                        <p style={smallHint}>{formatShortDate(update.recorded_at)}{update.recorded_by_name ? ` · ${update.recorded_by_name}` : ""}</p>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="support-print-footer">This summary supports discussion between the preschool and parent/guardian. It is not a medical diagnosis.</p>
            </>
          )}
        </section>
      ) : null}

      <div className="db-card db-card-lavender" style={cardStyle}>
        <h3 style={sectionTitle}>Support Cases ({filteredRows.length})</h3>

        {filteredRows.length === 0 ? (
          <p className="db-helper">No learner support cases found.</p>
        ) : (
          <div style={{ display: "grid", gap: "10px", marginTop: "12px" }}>
            {visibleRows.map((item) => (
              <div key={item.id} className="db-list-card">
                <strong>{learnerName(item.learner_id)}</strong>
                <p style={textStyle}>{classroomName(item.classroom_id)} | {item.developmental_area}</p>
                <p style={textStyle}>Activity: {item.activity_name || "Activity not recorded"}</p>
                <p style={textStyle}>Theme: {item.theme || "Not recorded"}</p>
                <p style={textStyle}>Status: {supportStatusLabel(supportStatusValue(item))}</p>
                {item.observation ? <p style={textStyle}>Practitioner notes: {item.observation}</p> : null}
                <p style={smallHint}>Date identified: {item.activity_date || formatShortDate(item.created_at || "")}</p>

                <button type="button" className="db-button-primary" style={{ ...smallButton, marginTop: "10px" }} onClick={() => openSupportProfile(item.learner_id)}>
                  View Support Profile
                </button>
              </div>
            ))}
          </div>
        )}

        {filteredRows.length > visibleCount ? (
          <button
            type="button"
            className="db-button-primary"
            style={{ ...smallButton, marginTop: "10px" }}
            onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
          >
            Add Next 10
          </button>
        ) : null}
      </div>
    </div>
  );
}

function StatCard({ title, value, note }: { title: string; value: number; note: string }) {
  return (
    <div className="db-card" style={{ padding: "12px" }}>
      <p style={{ margin: 0, color: "var(--db-text-soft)", fontSize: "12px" }}>{title}</p>
      <h2 style={{ margin: "4px 0", color: "var(--db-text)", fontSize: "22px" }}>{value}</h2>
      <p style={{ margin: 0, color: "var(--db-text-soft)", fontSize: "12px" }}>{note}</p>
    </div>
  );
}

function supportStatusValue(item: OutcomeRow) {
  if (item?.support_status) return item.support_status;
  if (item?.outcome_status === "improving") return "improving";
  if (item?.outcome_status === "meeting_expectations") return "resolved";
  return "new";
}

function supportStatusLabel(value: string) {
  if (value === "new") return "New";
  if (value === "active") return "Active";
  if (value === "improving") return "Improving";
  if (value === "monitoring") return "Monitoring";
  if (value === "resolved") return "Resolved";
  return "New";
}

function formatShortDate(value: string) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const cardStyle = {
  padding: "18px",
  marginBottom: "16px",
} as const;

const compactGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "12px",
  marginBottom: "16px",
} as const;

const filterGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "10px",
} as const;

const sectionTitle = {
  marginTop: 0,
  marginBottom: "10px",
  color: "var(--db-text)",
  fontSize: "20px",
  fontWeight: 800,
} as const;

const textStyle = {
  margin: "6px 0 0 0",
  color: "var(--db-text-soft)",
} as const;

const smallHint = {
  display: "block",
  marginTop: "4px",
  color: "var(--db-text-soft)",
  fontSize: "12px",
} as const;

const smallButton = {
  minHeight: "36px",
  padding: "8px 12px",
} as const;

const fieldLabel = {
  display: "grid",
  gap: "6px",
  marginBottom: "12px",
  color: "var(--db-text)",
  fontWeight: 700,
} as const;

const backButton = {
  display: "inline-block",
  marginTop: "10px",
  color: "var(--db-text)",
  fontWeight: 700,
  textDecoration: "none",
} as const;
