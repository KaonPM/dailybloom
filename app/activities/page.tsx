"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";
import { resolveSchoolContext } from "../lib/school-context";

type ActivityRow = {
  id: number;
  school_id?: number;
  class_name?: string | null;
  activity_date?: string | null;
  subject?: string | null;
  title?: string | null;
  description?: string | null;
  materials?: string | null;
  repeat_group_id?: string | null;
  created_at?: string | null;
};

export default function ActivitiesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolParam = searchParams.get("school");

  const today = new Date().toISOString().split("T")[0];

  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [classroomName, setClassroomName] = useState("");
  const [role, setRole] = useState("");

  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<ActivityRow | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [activityDate, setActivityDate] = useState(today);
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [materials, setMaterials] = useState("");
  const [repeatWeeks, setRepeatWeeks] = useState("1");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    const context = await resolveSchoolContext(schoolParam);

    if (context.error) {
      router.push("/login");
      return;
    }

    if (context.shouldReturnToMaster || !context.schoolId) {
      router.push("/master");
      return;
    }

    const { profile } = await getCurrentProfile();

    const currentRole = String(profile?.role || "");
    const teacherClass =
      currentRole === "teacher" && profile?.classroom_name
        ? String(profile.classroom_name)
        : "";

    setRole(currentRole);
    setSchoolId(context.schoolId);
    setClassroomName(teacherClass);

    await fetchActivities(context.schoolId, currentRole, teacherClass);
    setLoading(false);
  }

  async function fetchActivities(
    currentSchoolId: number,
    currentRole = role,
    teacherClass = classroomName
  ) {
    let query = supabase
      .from("activities")
      .select("*")
      .eq("school_id", currentSchoolId)
      .gte("activity_date", today)
      .order("activity_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (currentRole === "teacher" && teacherClass) {
      query = query.eq("class_name", teacherClass);
    }

    const { data, error } = await query;

    if (error) {
      alert(error.message);
      return;
    }

    setActivities((data || []) as ActivityRow[]);
  }

  function resetForm() {
    setActivityDate(today);
    setSubject("");
    setTitle("");
    setDescription("");
    setMaterials("");
    setRepeatWeeks("1");
    setEditingId(null);
  }

  function startEdit(activity: ActivityRow) {
    setEditingId(activity.id);
    setActivityDate(activity.activity_date || today);
    setSubject(activity.subject || "");
    setTitle(activity.title || "");
    setDescription(activity.description || "");
    setMaterials(activity.materials || "");
    setRepeatWeeks("1");
    setShowForm(true);
    setSelectedActivity(activity);
  }

  function addWeeks(dateValue: string, weeks: number) {
    const date = new Date(dateValue);
    date.setDate(date.getDate() + weeks * 7);

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");

    return `${yyyy}-${mm}-${dd}`;
  }

  async function saveActivity() {
    if (!schoolId) return;

    if (!activityDate || !subject || !title || !description) {
      alert("Please complete date, subject, title and description.");
      return;
    }

    setSaving(true);

    if (editingId) {
      const { error } = await supabase
        .from("activities")
        .update({
          activity_date: activityDate,
          subject,
          title,
          description,
          materials: materials.trim() || null,
        })
        .eq("id", editingId);

      if (error) {
        alert(error.message);
        setSaving(false);
        return;
      }

      resetForm();
      setShowForm(false);
      await fetchActivities(schoolId);

      setSaving(false);
      alert("Activity updated.");
      return;
    }

    const repeatCount = Math.max(Number(repeatWeeks) || 1, 1);
    const repeatGroupId =
      repeatCount > 1 ? `repeat-${Date.now()}-${Math.random().toString(36).slice(2)}` : null;

    const rows = Array.from({ length: repeatCount }).map((_, index) => ({
      school_id: schoolId,
      class_name: classroomName || null,
      activity_date: addWeeks(activityDate, index),
      subject,
      title,
      description,
      materials: materials.trim() || null,
      repeat_group_id: repeatGroupId,
    }));

    const { error } = await supabase.from("activities").insert(rows);

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    resetForm();
    setShowForm(false);
    await fetchActivities(schoolId);

    setSaving(false);
    alert(repeatCount > 1 ? "Weekly activities saved." : "Activity saved.");
  }

  async function deleteActivity(activityId: number) {
    const confirmed = confirm("Delete this activity?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("activities")
      .delete()
      .eq("id", activityId);

    if (error) {
      alert(error.message);
      return;
    }

    if (selectedActivity?.id === activityId) {
      setSelectedActivity(null);
    }

    if (schoolId) {
      await fetchActivities(schoolId);
    }

    alert("Activity deleted.");
  }

  if (loading) {
    return <p>Loading activities...</p>;
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: 18, marginBottom: 18 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 className="db-page-title">Today’s Activities</h2>
            <p className="db-page-subtitle">
              Plan classroom activities, including weekly repeats.
            </p>

            {role === "teacher" && classroomName ? (
              <p style={smallText}>Classroom: {classroomName}</p>
            ) : (
              <p style={smallText}>Principal view: all classes</p>
            )}
          </div>

          <button
            type="button"
            className="db-button-primary"
            onClick={() => {
              resetForm();
              setShowForm((prev) => !prev);
            }}
          >
            {showForm ? "Close" : "Add Activity"}
          </button>
        </div>
      </div>

      {showForm ? (
        <div className="db-card db-card-blue" style={{ padding: 16, marginBottom: 18 }}>
          <h3 style={sectionTitle}>{editingId ? "Edit Activity" : "Add Activity"}</h3>

          <div style={grid2}>
            <div>
              <p style={labelText}>Date</p>
              <input
                type="date"
                className="db-input"
                value={activityDate}
                onChange={(e) => setActivityDate(e.target.value)}
              />
            </div>

            <div>
              <p style={labelText}>Subject / Theme</p>
              <input
                className="db-input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Numbers, Literacy, Art..."
              />
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <p style={labelText}>Activity Title</p>
            <input
              className="db-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Counting Objects"
            />
          </div>

          <div style={{ marginTop: 10 }}>
            <p style={labelText}>Short Description</p>
            <textarea
              className="db-input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Count buttons from 1 to 10."
              style={{ width: "100%", resize: "vertical" }}
            />
          </div>

          <div style={{ marginTop: 10 }}>
            <p style={labelText}>Materials Optional</p>
            <input
              className="db-input"
              value={materials}
              onChange={(e) => setMaterials(e.target.value)}
              placeholder="Buttons, trays, crayons..."
            />
          </div>

          {!editingId ? (
            <div style={{ marginTop: 10 }}>
              <p style={labelText}>Repeat Weekly</p>
              <select
                className="db-input"
                value={repeatWeeks}
                onChange={(e) => setRepeatWeeks(e.target.value)}
              >
                <option value="1">Do not repeat</option>
                <option value="2">Repeat for 2 weeks</option>
                <option value="3">Repeat for 3 weeks</option>
                <option value="4">Repeat for 4 weeks</option>
                <option value="5">Repeat for 5 weeks</option>
              </select>
            </div>
          ) : null}

          <button
            type="button"
            className="db-button-primary"
            onClick={saveActivity}
            disabled={saving}
            style={{ width: "100%", marginTop: 12 }}
          >
            {saving ? "Saving..." : editingId ? "Update Activity" : "Save Activity"}
          </button>
        </div>
      ) : null}

      <div className="db-card db-card-green" style={{ padding: 16 }}>
        <h3 style={sectionTitle}>Upcoming Activities ({activities.length})</h3>

        {activities.length === 0 ? (
          <p className="db-helper">No activities planned yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {activities.map((item) => {
              const active = selectedActivity?.id === item.id;

              return (
                <div key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedActivity(active ? null : item)}
                    style={{
                      width: "100%",
                      display: "grid",
                      gridTemplateColumns: "120px 1fr 120px",
                      gap: 8,
                      alignItems: "center",
                      background: active ? "#EAF7FD" : "#FFFDFB",
                      border: active ? "1px solid #CBEAF7" : "1px solid #F0E3D8",
                      borderRadius: 12,
                      padding: "10px 12px",
                      color: "#2D2A3E",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={pillBlue}>{item.activity_date || "No date"}</span>
                    <strong>{item.subject || "No subject"}</strong>
                    <span style={pillNeutral}>
                      {item.class_name || "All classes"}
                    </span>
                  </button>

                  {active ? (
                    <div
                      style={{
                        background: "#FFFDFB",
                        border: "1px solid #F0E3D8",
                        borderRadius: 12,
                        padding: 12,
                        marginTop: 8,
                      }}
                    >
                      <p style={smallText}>Title</p>
                      <strong>{item.title || "Untitled Activity"}</strong>

                      <p style={{ ...smallText, marginTop: 10 }}>Description</p>
                      <p style={detailText}>{item.description || "No description"}</p>

                      {item.materials ? (
                        <>
                          <p style={{ ...smallText, marginTop: 10 }}>Materials</p>
                          <p style={detailText}>{item.materials}</p>
                        </>
                      ) : null}

                      {item.repeat_group_id ? (
                        <p style={smallText}>Weekly repeat activity</p>
                      ) : null}

                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          flexWrap: "wrap",
                          marginTop: 12,
                        }}
                      >
                        <button
                          type="button"
                          className="db-button-secondary"
                          onClick={() => startEdit(item)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="db-button-secondary"
                          onClick={() => deleteActivity(item.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const sectionTitle = {
  margin: "0 0 10px 0",
  color: "#2D2A3E",
  fontSize: 20,
  fontWeight: 700 as const,
};

const labelText = {
  margin: "0 0 8px 0",
  color: "#6D6888",
  fontSize: 13,
  fontWeight: 800,
};

const smallText = {
  margin: "4px 0 0 0",
  color: "#6D6888",
  fontSize: 13,
};

const detailText = {
  margin: "4px 0 0 0",
  color: "#2D2A3E",
  fontSize: 14,
  lineHeight: 1.5,
};

const grid2 = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
};

const pillBlue = {
  background: "#EAF7FD",
  border: "1px solid #CBEAF7",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 12,
  color: "#2D2A3E",
  textAlign: "center" as const,
};

const pillNeutral = {
  background: "#F8F4FF",
  border: "1px solid #E7DFF8",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 12,
  color: "#2D2A3E",
  textAlign: "center" as const,
};