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
  { value: "repeat_activity", label: "Repeat activity" },
  { value: "different_method", label: "Try different method" },
  { value: "monitor_learner", label: "Monitor learner" },
  { value: "discuss_with_parent", label: "Discuss with parent" },
  { value: "escalate_to_principal", label: "Escalate to principal" },
];

export default function ClassroomActivitiesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolParam = searchParams.get("school");

  const [profile, setProfile] = useState<any>(null);
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [learnersByClassroom, setLearnersByClassroom] = useState<Record<string, any[]>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState("");
  const [classroomId, setClassroomId] = useState("");
  const [activityDate, setActivityDate] = useState(today());
  const [category, setCategory] = useState("Language Development");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const [filterClassroomId, setFilterClassroomId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterDate, setFilterDate] = useState(today());

  const [repeatDates, setRepeatDates] = useState<Record<number, string>>({});

  useEffect(() => {
    loadPage();
  }, []);

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
    await fetchActivities(context.schoolId);
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

  async function fetchLearners(currentClassroomId: number | string) {
    if (!schoolId || !currentClassroomId) return;

    const key = String(currentClassroomId);

    if (learnersByClassroom[key]) return;

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

    setLearnersByClassroom((prev) => ({
      ...prev,
      [key]: data || [],
    }));
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
    if (!schoolId || !title.trim() || !classroomId || !activityDate || !category) {
      alert("Please complete activity title, class, date and category.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("classroom_activities").insert([
      {
        school_id: schoolId,
        classroom_id: Number(classroomId),
        activity_date: activityDate,
        title: title.trim(),
        category,
        description: description.trim() || null,
        status: "planned",
        created_by: profile?.id || null,
        assigned_teacher_id: profile?.role === "teacher" ? profile?.id : null,
        follow_up: "none",
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
    setShowAddForm(false);

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

  async function repeatActivity(activity: any) {
    if (!schoolId) return;

    const selectedDate = repeatDates[activity.id];

    if (!selectedDate) {
      alert("Please select a repeat date.");
      return;
    }

    const { error } = await supabase.from("classroom_activities").insert([
      {
        school_id: activity.school_id,
        classroom_id: activity.classroom_id,
        activity_date: selectedDate,
        title: activity.title,
        category: activity.category,
        description: activity.description || null,
        status: "planned",
        created_by: profile?.id || null,
        assigned_teacher_id: activity.assigned_teacher_id || null,
        follow_up: "none",
      },
    ]);

    if (error) {
      alert(error.message);
      return;
    }

    setRepeatDates((prev) => ({
      ...prev,
      [activity.id]: "",
    }));

    await fetchActivities(schoolId);
    alert("Activity repeated successfully");
  }

  const filteredActivities = useMemo(() => {
    return activities.filter((item) => {
      const matchesClass = filterClassroomId
        ? Number(item.classroom_id) === Number(filterClassroomId)
        : true;

      const matchesStatus = filterStatus ? item.status === filterStatus : true;
      const matchesCategory = filterCategory ? item.category === filterCategory : true;
      const matchesDate = filterDate ? item.activity_date === filterDate : true;

      return matchesClass && matchesStatus && matchesCategory && matchesDate;
    });
  }, [activities, filterClassroomId, filterStatus, filterCategory, filterDate]);

  const todayActivities = useMemo(() => {
    return activities.filter((item) => item.activity_date === today());
  }, [activities]);

  const weeklyActivities = useMemo(() => {
    const start = startOfWeek(new Date());
    const end = endOfWeek(new Date());

    return activities.filter((item) => {
      const date = new Date(item.activity_date);
      return date >= start && date <= end;
    });
  }, [activities]);

  const stats = useMemo(() => {
    return {
      todayTotal: todayActivities.length,
      todayCompleted: todayActivities.filter((item) => item.status === "completed").length,
      todayPending: todayActivities.filter((item) => item.status === "planned").length,
      weeklyTotal: weeklyActivities.length,
      weeklyCompleted: weeklyActivities.filter((item) => item.status === "completed").length,
      weeklySupport: weeklyActivities.filter(
        (item) => Array.isArray(item.needs_support_ids) && item.needs_support_ids.length > 0
      ).length,
    };
  }, [todayActivities, weeklyActivities]);

  return (
    <div>
      <div className="db-soft-card" style={{ padding: "20px 22px", marginBottom: "20px" }}>
        <h1 className="db-page-title">Classroom Activities</h1>
        <p className="db-page-subtitle">
          Plan activities, mark completion, track learner participation and manage follow-ups.
        </p>
      </div>

      <div className="db-grid-3" style={{ marginBottom: "20px" }}>
        <StatCard title="Today" value={stats.todayTotal} note="Activities planned" />
        <StatCard title="Completed" value={stats.todayCompleted} note="Completed today" />
        <StatCard title="Needs Support" value={stats.weeklySupport} note="Weekly support flags" />
      </div>

      <div className="db-card db-card-blue" style={{ padding: "18px", marginBottom: "20px" }}>
        <button
          type="button"
          className="db-button-primary"
          style={{ width: "100%" }}
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? "Close Add Classroom Activity" : "Add Classroom Activity"}
        </button>

        {showAddForm && (
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
              onChange={(e) => setClassroomId(e.target.value)}
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
              style={{ minHeight: "80px" }}
            />

            <button
              className="db-button-primary"
              style={{ width: "100%" }}
              onClick={createActivity}
              disabled={loading}
            >
              {loading ? "Saving..." : "Save Activity"}
            </button>
          </div>
        )}
      </div>

      <details className="db-card db-card-lavender" style={{ padding: "18px", marginBottom: "20px" }} open>
        <summary style={summaryStyle}>Filters & Date Selection</summary>

        <div className="db-grid-2" style={{ marginTop: "16px" }}>
          <input
            className="db-input"
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />

          <select
            className="db-input"
            value={filterClassroomId}
            onChange={(e) => setFilterClassroomId(e.target.value)}
          >
            <option value="">All classes</option>
            {classrooms.map((classroom) => (
              <option key={classroom.id} value={classroom.id}>
                {classroom.classroom_name}
              </option>
            ))}
          </select>

          <select
            className="db-input"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {statuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>

          <select
            className="db-input"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="db-button-primary"
          style={{ width: "100%", marginTop: "10px" }}
          onClick={() => {
            setFilterDate("");
            setFilterClassroomId("");
            setFilterStatus("");
            setFilterCategory("");
          }}
        >
          Clear Filters
        </button>
      </details>

      <details className="db-card db-card-green" style={{ padding: "18px", marginBottom: "20px" }} open>
        <summary style={summaryStyle}>Selected Activities ({filteredActivities.length})</summary>

        <ActivityList
          activities={filteredActivities}
          learnersByClassroom={learnersByClassroom}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          fetchLearners={fetchLearners}
          updateActivity={updateActivity}
          repeatActivity={repeatActivity}
          repeatDates={repeatDates}
          setRepeatDates={setRepeatDates}
        />
      </details>

      <details className="db-card db-card-yellow" style={{ padding: "18px", marginBottom: "20px" }}>
        <summary style={summaryStyle}>Today’s Classroom Activities ({todayActivities.length})</summary>

        <ActivityList
          activities={todayActivities}
          learnersByClassroom={learnersByClassroom}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          fetchLearners={fetchLearners}
          updateActivity={updateActivity}
          repeatActivity={repeatActivity}
          repeatDates={repeatDates}
          setRepeatDates={setRepeatDates}
        />
      </details>

      <details className="db-card db-card-lavender" style={{ padding: "18px" }}>
        <summary style={summaryStyle}>Weekly Tracking ({weeklyActivities.length})</summary>

        <div style={{ marginTop: "16px" }}>
          <div className="db-grid-3" style={{ marginBottom: "16px" }}>
            <StatCard title="This Week" value={stats.weeklyTotal} note="Total activities" />
            <StatCard title="Completed" value={stats.weeklyCompleted} note="Completed this week" />
            <StatCard title="Pending Today" value={stats.todayPending} note="Still planned today" />
          </div>

          <ActivityList
            activities={weeklyActivities}
            learnersByClassroom={learnersByClassroom}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            fetchLearners={fetchLearners}
            updateActivity={updateActivity}
            repeatActivity={repeatActivity}
            repeatDates={repeatDates}
            setRepeatDates={setRepeatDates}
          />
        </div>
      </details>
    </div>
  );
}

function ActivityList({
  activities,
  learnersByClassroom,
  expandedId,
  setExpandedId,
  fetchLearners,
  updateActivity,
  repeatActivity,
  repeatDates,
  setRepeatDates,
}: any) {
  const [visibleCount, setVisibleCount] = useState(5);
  const visibleActivities = activities.slice(0, visibleCount);

  useEffect(() => {
    setVisibleCount(5);
  }, [activities.length]);

  if (!activities.length) {
    return <p className="db-helper" style={{ marginTop: "14px" }}>No activities found.</p>;
  }

  return (
    <div style={{ marginTop: "16px" }}>
      <div style={{ display: "grid", gap: "12px" }}>
        {visibleActivities.map((activity: any) => {
          const isOpen = expandedId === activity.id;
          const learners = learnersByClassroom[String(activity.classroom_id)] || [];

          return (
            <div key={activity.id} className="db-list-card">
              <div
                onClick={async () => {
                  setExpandedId(isOpen ? null : activity.id);
                  if (!isOpen) await fetchLearners(activity.classroom_id);
                }}
                style={{ cursor: "pointer" }}
              >
                <strong style={{ fontSize: "17px" }}>{activity.title}</strong>
                <p style={textStyle}>
                  {activity.classrooms?.classroom_name || "Class"} | {activity.activity_date} | {activity.category}
                </p>
                <p style={textStyle}>Status: {statusLabel(activity.status)}</p>
                <p style={smallHint}>Tap card to open Learner Participation & Follow-Up</p>
              </div>

              <button
                type="button"
                className="db-button-primary"
                style={miniButton}
                onClick={() => updateActivity(activity.id, { status: "completed" })}
              >
                Mark Completed
              </button>

              {isOpen && (
                <div style={{ marginTop: "14px", borderTop: "1px solid #e8e8e8", paddingTop: "14px" }}>
                  <h4 style={subTitle}>Learner Participation & Follow-Up</h4>

                  {activity.description && (
                    <p style={textStyle}>Description: {activity.description}</p>
                  )}

                  <label style={labelStyle}>Activity Status</label>
                  <select
                    className="db-input"
                    value={activity.status || "planned"}
                    onChange={(e) => updateActivity(activity.id, { status: e.target.value })}
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

                  <label style={labelStyle}>Teacher Notes</label>
                  <textarea
                    className="db-input"
                    placeholder="Add a short note about how the activity went"
                    defaultValue={activity.teacher_notes || ""}
                    onBlur={(e) =>
                      updateActivity(activity.id, { teacher_notes: e.target.value })
                    }
                    style={{ minHeight: "80px" }}
                  />

                  <label style={labelStyle}>Follow-Up Action</label>
                  <select
                    className="db-input"
                    value={activity.follow_up || "none"}
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

                  <label style={labelStyle}>Follow-Up Date</label>
                  <input
                    type="date"
                    className="db-input"
                    defaultValue={activity.follow_up_date || ""}
                    onChange={(e) =>
                      updateActivity(activity.id, {
                        follow_up_date: e.target.value || null,
                      })
                    }
                  />

                  <label style={labelStyle}>Follow-Up Note</label>
                  <textarea
                    className="db-input"
                    placeholder="Example: Repeat using picture cards next week"
                    defaultValue={activity.follow_up_note || ""}
                    onBlur={(e) =>
                      updateActivity(activity.id, { follow_up_note: e.target.value })
                    }
                    style={{ minHeight: "70px" }}
                  />

                  <div style={repeatBox}>
                    <h4 style={subTitle}>Repeat Activity</h4>
                    <p style={smallHint}>Choose a date to create a new copy of this activity.</p>

                    <input
                      type="date"
                      className="db-input"
                      value={repeatDates[activity.id] || ""}
                      onChange={(e) =>
                        setRepeatDates((prev: any) => ({
                          ...prev,
                          [activity.id]: e.target.value,
                        }))
                      }
                    />

                    <button
                      type="button"
                      className="db-button-primary"
                      style={{ width: "100%" }}
                      onClick={() => repeatActivity(activity)}
                    >
                      Create Repeat
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {activities.length > visibleCount && (
        <button
          type="button"
          className="db-button-primary"
          style={{ width: "100%", marginTop: "12px" }}
          onClick={() => setVisibleCount(visibleCount + 5)}
        >
          Load More Activities
        </button>
      )}
    </div>
  );
}

function LearnerSelect({ label, learners, value, onChange }: any) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <select
        className="db-input"
        value={value}
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

  useEffect(() => {
    setLocalIds(selectedIds || []);
  }, [selectedIds]);

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

      {learners.length === 0 ? (
        <p className="db-helper">No learners found for this class.</p>
      ) : (
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
      )}

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

const subTitle = {
  margin: "0 0 10px 0",
  color: "var(--db-text)",
  fontSize: "16px",
  fontWeight: 800,
};

const textStyle = {
  margin: "6px 0 0 0",
  color: "var(--db-text-soft)",
};

const smallHint = {
  margin: "6px 0 0 0",
  color: "var(--db-text-soft)",
  fontSize: "13px",
};

const labelStyle = {
  display: "block",
  margin: "12px 0 6px",
  fontWeight: 700,
  color: "var(--db-text)",
};

const miniButton = {
  marginTop: "10px",
  minHeight: "34px",
  padding: "8px 12px",
};

const repeatBox = {
  marginTop: "16px",
  padding: "14px",
  borderRadius: "16px",
  border: "1px solid #e8e8e8",
  background: "#ffffff",
};