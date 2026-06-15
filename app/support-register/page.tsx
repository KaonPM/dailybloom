"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";
import { resolveSchoolContext } from "../lib/school-context";

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
  learner_id: number;
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

export default function SupportRegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolParam = searchParams.get("school");

  const [profile, setProfile] = useState<any>(null);
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [learners, setLearners] = useState<any[]>([]);
  const [outcomes, setOutcomes] = useState<OutcomeRow[]>([]);

  const [classroomFilter, setClassroomFilter] = useState("");
  const [learnerFilter, setLearnerFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const role = String(profile?.role || "").toLowerCase();
  const isTeacher = role === "teacher";
  const isMaster = role === "master";

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

  async function updateSupportStatus(outcomeId: number, nextStatus: string) {
    if (!schoolId) return;

    setSaving(true);

    const { error } = await supabase
      .from("learner_activity_outcomes")
      .update({ support_status: nextStatus })
      .eq("id", outcomeId)
      .eq("school_id", schoolId);

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    await fetchOutcomes(schoolId);
    setSaving(false);
  }

  function learnerName(learnerId: number) {
    const learner = learners.find((item) => Number(item.id) === Number(learnerId));
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
                {item.observation ? <p style={textStyle}>Teacher notes: {item.observation}</p> : null}
                <p style={smallHint}>Date identified: {item.activity_date || formatShortDate(item.created_at || "")}</p>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
                  {supportStatuses.map((status) => (
                    <button
                      key={status.value}
                      type="button"
                      className="db-button-primary"
                      style={smallButton}
                      onClick={() => updateSupportStatus(item.id, status.value)}
                      disabled={saving || supportStatusValue(item) === status.value}
                    >
                      {status.label}
                    </button>
                  ))}
                </div>
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

function StatCard({ title, value, note }: any) {
  return (
    <div className="db-card" style={{ padding: "12px" }}>
      <p style={{ margin: 0, color: "var(--db-text-soft)", fontSize: "12px" }}>{title}</p>
      <h2 style={{ margin: "4px 0", color: "var(--db-text)", fontSize: "22px" }}>{value}</h2>
      <p style={{ margin: 0, color: "var(--db-text-soft)", fontSize: "12px" }}>{note}</p>
    </div>
  );
}

function supportStatusValue(item: any) {
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

const backButton = {
  display: "inline-block",
  marginTop: "10px",
  color: "var(--db-text)",
  fontWeight: 700,
  textDecoration: "none",
} as const;
