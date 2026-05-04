"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";
import { resolveSchoolContext } from "../lib/school-context";
import { useRouter, useSearchParams } from "next/navigation";

const categories = [
  "Language Development",
  "Numeracy",
  "Creative Arts",
  "Outdoor Play",
  "Life Skills",
  "Fine Motor Skills",
  "Gross Motor Skills",
  "Music and Movement",
  "Social Development",
  "Free Play",
  "Observation",
];

const statuses = [
  { value: "planned", label: "Planned" },
  { value: "completed", label: "Completed" },
  { value: "not_completed", label: "Not Completed" },
  { value: "rescheduled", label: "Rescheduled" },
];

const followUps = [
  { value: "none", label: "No follow-up needed" },
  { value: "repeat_next_week", label: "Repeat next week" },
  { value: "try_different_method", label: "Try different method" },
  { value: "monitor_learner", label: "Monitor learner" },
  { value: "rescheduled", label: "Moved to another day" },
];

export default function ClassroomActivitiesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolParam = searchParams.get("school");

  const [profile, setProfile] = useState<any>(null);
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [learners, setLearners] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [classroomId, setClassroomId] = useState("");
  const [activityDate, setActivityDate] = useState(today());
  const [category, setCategory] = useState("Language Development");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    if (schoolId) fetchActivities(schoolId);
  }, [schoolId]);

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
    await fetchClassrooms(context.schoolId);
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

  async function fetchLearners(currentClassroomId: string) {
    if (!schoolId || !currentClassroomId) {
      setLearners([]);
      return;
    }

    const { data, error } = await supabase
      .from("learners")
      .select("*")
      .eq("school_id", schoolId)
      .eq("classroom_id", Number(currentClassroomId))
      .order("name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setLearners(data || []);
  }

  async function fetchActivities(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("classroom_activities")
      .select(`
        *,
        classrooms (
          classroom_name
        )
      `)
      .eq("school_id", currentSchoolId)
      .order("activity_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setActivities(data || []);
  }

  async function createActivity() {
    if (!schoolId || !title || !classroomId || !activityDate || !category) {
      alert("Please complete activity title, class, date and category.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("classroom_activities").insert([
      {
        school_id: schoolId,
        classroom_id: Number(classroomId),
        activity_date: activityDate,
        title,
        category,
        description: description || null,
        created_by: profile?.id || null,
        assigned_teacher_id: profile?.role === "teacher" ? profile?.id : null,
      },
    ]);

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setTitle("");
    setClassroomId("");
    setActivityDate(today());
    setCategory("Language Development");
    setDescription("");
    setLearners([]);

    await fetchActivities(schoolId);
    setLoading(false);
    alert("Activity added successfully");
  }

  async function updateActivity(activityId: number, updates: any) {
    const { error } = await supabase
      .from("classroom_activities")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", activityId);

    if (error) {
      alert(error.message);
      return;
    }

    if (schoolId) await fetchActivities(schoolId);
  }

  const todayActivities = useMemo(() => {
    return activities.filter((item) => item.activity_date === today());
  }, [activities]);

  const weeklyActivities = useMemo(() => {
    const start = startOfWeek(new Date());
    const end = endOfWeek(new Date());

    return activities.filter((item) => {
      const d = new Date(item.activity_date);
      return d >= start && d <= end;
    });
  }, [activities]);

  const stats = useMemo(() => {
    return {
      todayTotal: todayActivities.length,
      todayCompleted: todayActivities.filter((a) => a.status === "completed").length,
      todayPending: todayActivities.filter((a) => a.status === "planned").length,
      weeklyTotal: weeklyActivities.length,
      weeklyCompleted: weeklyActivities.filter((a) => a.status === "completed").length,
      weeklySupport: weeklyActivities.filter(
        (a) => Array.isArray(a.needs_support_ids) && a.needs_support_ids.length > 0
      ).length,
    };
  }, [todayActivities, weeklyActivities]);

  return (
    <div>
      <div className="db-soft-card" style={{ padding: "20px 22px", marginBottom: "20px" }}>
        <h1 className="db-page-title">Classroom Activities</h1>
        <p className="db-page-subtitle">
          Plan activities, record completion, highlight learners and track weekly classroom flow.
        </p>
      </div>

      <div className="db-grid-3" style={{ marginBottom: "20px" }}>
        <StatCard title="Today" value={stats.todayTotal} note="Activities planned" />
        <StatCard title="Completed" value={stats.todayCompleted} note="Completed today" />
        <StatCard title="Needs Support" value={stats.weeklySupport} note="Weekly learner support flags" />
      </div>

      <details className="db-card db-card-blue" style={{ padding: "18px", marginBottom: "20px" }} open>
        <summary style={summaryStyle}>Add Classroom Activity</summary>

        <div style={{ marginTop: "16px" }}>
          <input
            className="db-input"
            placeholder="Activity title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <select
            className="db-input"
            value={classroomId}
            onChange={(e) => {
              setClassroomId(e.target.value);
              fetchLearners(e.target.value);
            }}
          >
            <option value="">Select class</option>
            {classrooms.map((classroom) => (
              <option key={classroom.id} value={classroom.id}>
                {classroom.classroom_name}
              </option>
            ))}
          </select>

          <input
            className="db-input"
            type="date"
            value={activityDate}
            onChange={(e) => setActivityDate(e.target.value)}
          />

          <select
            className="db-input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <textarea
            className="db-input"
            placeholder="Description or expected outcome"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ minHeight: "90px" }}
          />

          <button
            className="db-button-primary"
            style={{ width: "100%" }}
            onClick={createActivity}
            disabled={loading}
          >
            {loading ? "Saving..." : "Add Activity"}
          </button>
        </div>
      </details>

      <details className="db-card db-card-green" style={{ padding: "18px", marginBottom: "20px" }} open>
        <summary style={summaryStyle}>Today’s Classroom Activities</summary>

        <ActivityList
          activities={todayActivities}
          learners={learners}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          fetchLearners={fetchLearners}
          updateActivity={updateActivity}
        />
      </details>

      <details className="db-card db-card-lavender" style={{ padding: "18px", marginBottom: "20px" }}>
        <summary style={summaryStyle}>Weekly Tracking</summary>

        <div style={{ marginTop: "16px" }}>
          <div className="db-grid-3" style={{ marginBottom: "16px" }}>
            <StatCard title="This Week" value={stats.weeklyTotal} note="Total activities" />
            <StatCard title="Completed" value={stats.weeklyCompleted} note="Completed this week" />
            <StatCard title="Pending Today" value={stats.todayPending} note="Still planned today" />
          </div>

          <ActivityList
            activities={weeklyActivities}
            learners={learners}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            fetchLearners={fetchLearners}
            updateActivity={updateActivity}
          />
        </div>
      </details>

      <details className="db-card db-card-yellow" style={{ padding: "18px" }}>
        <summary style={summaryStyle}>All Activities</summary>

        <ActivityList
          activities={activities}
          learners={learners}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          fetchLearners={fetchLearners}
          updateActivity={updateActivity}
        />
      </details>
    </div>
  );
}

function ActivityList({
  activities,
  learners,
  expandedId,
  setExpandedId,
  fetchLearners,
  updateActivity,
}: any) {
  if (!activities.length) {
    return <p className="db-helper" style={{ marginTop: "14px" }}>No activities found.</p>;
  }

  return (
    <div style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
      {activities.map((activity: any) => {
        const isOpen = expandedId === activity.id;

        return (
          <div key={activity.id} className="db-list-card">
            <div
              onClick={async () => {
                setExpandedId(isOpen ? null : activity.id);
                if (!isOpen) await fetchLearners(String(activity.classroom_id));
              }}
              style={{ cursor: "pointer" }}
            >
              <strong style={{ fontSize: "17px" }}>{activity.title}</strong>
              <p style={textStyle}>
                {activity.classrooms?.classroom_name || "Class"} | {activity.activity_date} | {activity.category}
              </p>
              <p style={textStyle}>Status: {statusLabel(activity.status)}</p>
            </div>

            {isOpen && (
              <div style={{ marginTop: "14px" }}>
                {activity.description && (
                  <p style={textStyle}>Description: {activity.description}</p>
                )}

                <select
                  className="db-input"
                  defaultValue={activity.status}
                  onChange={(e) =>
                    updateActivity(activity.id, { status: e.target.value })
                  }
                >
                  {statuses.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>

                <LearnerSelect
                  label="Outstanding learner"
                  learners={learners}
                  value={activity.outstanding_learner_id || ""}
                  onChange={(value: string) =>
                    updateActivity(activity.id, {
                      outstanding_learner_id: value ? Number(value) : null,
                    })
                  }
                />

                <MultiLearnerSelect
                  label="Participated well"
                  learners={learners}
                  selectedIds={activity.participated_well_ids || []}
                  onSave={(ids: number[]) =>
                    updateActivity(activity.id, { participated_well_ids: ids })
                  }
                />

                <MultiLearnerSelect
                  label="Needs support"
                  learners={learners}
                  selectedIds={activity.needs_support_ids || []}
                  onSave={(ids: number[]) =>
                    updateActivity(activity.id, { needs_support_ids: ids })
                  }
                />

                <textarea
                  className="db-input"
                  placeholder="Teacher notes"
                  defaultValue={activity.teacher_notes || ""}
                  onBlur={(e) =>
                    updateActivity(activity.id, { teacher_notes: e.target.value })
                  }
                  style={{ minHeight: "80px" }}
                />

                <select
                  className="db-input"
                  defaultValue={activity.follow_up || "none"}
                  onChange={(e) =>
                    updateActivity(activity.id, { follow_up: e.target.value })
                  }
                >
                  {followUps.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>

                <textarea
                  className="db-input"
                  placeholder="Follow-up note"
                  defaultValue={activity.follow_up_note || ""}
                  onBlur={(e) =>
                    updateActivity(activity.id, { follow_up_note: e.target.value })
                  }
                  style={{ minHeight: "70px" }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LearnerSelect({ label, learners, value, onChange }: any) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <select
        className="db-input"
        defaultValue={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select learner</option>
        {learners.map((learner: any) => (
          <option key={learner.id} value={learner.id}>
            {learner.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function MultiLearnerSelect({ label, learners, selectedIds, onSave }: any) {
  const [localIds, setLocalIds] = useState<number[]>(selectedIds || []);

  function toggleLearner(id: number) {
    if (localIds.includes(id)) {
      setLocalIds(localIds.filter((item) => item !== id));
    } else {
      setLocalIds([...localIds, id]);
    }
  }

  return (
    <div style={{ marginBottom: "12px" }}>
      <label style={labelStyle}>{label}</label>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {learners.map((learner: any) => {
          const active = localIds.includes(Number(learner.id));

          return (
            <button
              key={learner.id}
              type="button"
              onClick={() => toggleLearner(Number(learner.id))}
              style={{
                border: "1px solid #d7dde8",
                borderRadius: "999px",
                padding: "8px 12px",
                cursor: "pointer",
                background: active ? "#102a43" : "#ffffff",
                color: active ? "#ffffff" : "#102a43",
              }}
            >
              {learner.name}
            </button>
          );
        })}
      </div>

      <button
        className="db-button-primary"
        style={{ marginTop: "10px", minHeight: "36px", padding: "8px 12px" }}
        onClick={() => onSave(localIds)}
      >
        Save {label}
      </button>
    </div>
  );
}

function StatCard({ title, value, note }: any) {
  return (
    <div className="db-card" style={{ padding: "16px" }}>
      <p style={{ margin: 0, color: "var(--db-text-soft)" }}>{title}</p>
      <h2 style={{ margin: "6px 0", color: "var(--db-text)" }}>{value}</h2>
      <p style={{ margin: 0, color: "var(--db-text-soft)" }}>{note}</p>
    </div>
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date: Date) {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function statusLabel(status: string) {
  if (status === "completed") return "Completed";
  if (status === "not_completed") return "Not Completed";
  if (status === "rescheduled") return "Rescheduled";
  return "Planned";
}

const summaryStyle = {
  cursor: "pointer",
  fontSize: "18px",
  fontWeight: 800,
  color: "var(--db-text)",
};

const textStyle = {
  margin: "6px 0 0 0",
  color: "var(--db-text-soft)",
};

const labelStyle = {
  display: "block",
  margin: "12px 0 6px",
  fontWeight: 700,
  color: "var(--db-text)",
};