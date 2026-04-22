"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { resolveSchoolContext } from "../lib/school-context";

type ActivityItem = {
  id: number;
  school_id: number;
  activity_date?: string | null;
  classroom?: string | null;
  subject?: string | null;
  activity_note?: string | null;
  created_at?: string | null;
};

type ClassroomItem = {
  id: number;
  classroom_name?: string | null;
};

export default function ActivitiesPage() {
  const router = useRouter();

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayString = `${yyyy}-${mm}-${dd}`;

  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [activityDate, setActivityDate] = useState(todayString);
  const [classroom, setClassroom] = useState("");
  const [subject, setSubject] = useState("");
  const [activityNote, setActivityNote] = useState("");

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    const searchParams = new URLSearchParams(window.location.search);
    const schoolParam = searchParams.get("school");

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
      fetchActivities(context.schoolId),
      fetchClassrooms(context.schoolId),
    ]);

    setLoading(false);
  }

  async function fetchActivities(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("activities")
      .select("*")
      .eq("school_id", currentSchoolId)
      .order("activity_date", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setActivities((data || []) as ActivityItem[]);
  }

  async function fetchClassrooms(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("classrooms")
      .select("id, classroom_name")
      .eq("school_id", currentSchoolId)
      .order("classroom_name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setClassrooms((data || []) as ClassroomItem[]);
  }

  async function saveActivity() {
    if (!schoolId) {
      alert("School context is missing.");
      return;
    }

    if (!activityDate || !classroom || !subject.trim() || !activityNote.trim()) {
      alert("Please complete date, class, subject, and activity note.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("activities").insert([
      {
        school_id: Number(schoolId),
        activity_date: activityDate,
        classroom,
        subject: subject.trim(),
        activity_note: activityNote.trim(),
      },
    ]);

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    setActivityDate(todayString);
    setClassroom("");
    setSubject("");
    setActivityNote("");

    await fetchActivities(Number(schoolId));
    setSaving(false);
  }

  const weekActivities = useMemo(() => {
    const start = new Date(today);
    const day = start.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diffToMonday);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    return activities.filter((activity) => {
      if (!activity.activity_date) return false;
      const date = new Date(activity.activity_date);
      return date >= start && date <= end;
    });
  }, [activities]);

  if (loading) {
    return <p>Loading activities...</p>;
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: "20px 22px", marginBottom: "24px" }}>
        <h2 className="db-page-title">Today’s Activities</h2>
        <p className="db-page-subtitle">
          Plan class activities for today or ahead of the week.
        </p>
      </div>

      <div className="db-card db-card-blue" style={{ padding: "20px", marginBottom: "24px" }}>
        <h3 style={sectionTitle}>Add Activity</h3>

        <input
          className="db-input"
          type="date"
          value={activityDate}
          onChange={(e) => setActivityDate(e.target.value)}
        />

        <select
          className="db-input"
          value={classroom}
          onChange={(e) => setClassroom(e.target.value)}
        >
          <option value="">Select Class</option>
          {classrooms.map((item) => (
            <option key={item.id} value={item.classroom_name || ""}>
              {item.classroom_name}
            </option>
          ))}
        </select>

        <input
          className="db-input"
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />

        <textarea
          className="db-input"
          placeholder="What are you doing?"
          value={activityNote}
          onChange={(e) => setActivityNote(e.target.value)}
          rows={3}
          style={{
            width: "100%",
            minHeight: "95px",
            resize: "vertical",
          }}
        />

        <button
          className="db-button-primary"
          style={{ width: "100%" }}
          onClick={saveActivity}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Activity"}
        </button>
      </div>

      <div className="db-card db-card-yellow" style={{ padding: "20px", marginBottom: "24px" }}>
        <h3 style={sectionTitle}>This Week’s Activities ({weekActivities.length})</h3>

        {weekActivities.length === 0 ? (
          <p className="db-page-subtitle" style={{ marginTop: 0 }}>
            No activities planned for this week yet.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {weekActivities.map((activity) => (
              <div key={activity.id} className="db-list-card">
                <strong style={{ fontSize: "17px" }}>
                  {activity.subject || "No subject"}
                </strong>
                <p style={textStyle}>Date: {activity.activity_date || "No date"}</p>
                <p style={textStyle}>Class: {activity.classroom || "No class"}</p>
                <p style={textStyle}>
                  Activity: {activity.activity_note || "No activity note"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="db-card db-card-lavender" style={{ padding: "20px" }}>
        <h3 style={sectionTitle}>All Saved Activities ({activities.length})</h3>

        {activities.length === 0 ? (
          <p className="db-page-subtitle" style={{ marginTop: 0 }}>
            No activities saved yet.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {activities.map((activity) => (
              <div key={activity.id} className="db-list-card">
                <strong style={{ fontSize: "17px" }}>
                  {activity.subject || "No subject"}
                </strong>
                <p style={textStyle}>Date: {activity.activity_date || "No date"}</p>
                <p style={textStyle}>Class: {activity.classroom || "No class"}</p>
                <p style={textStyle}>
                  Activity: {activity.activity_note || "No activity note"}
                </p>
                <p style={metaTextStyle}>
                  {activity.created_at
                    ? new Date(activity.created_at).toLocaleString()
                    : "No timestamp"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const sectionTitle = {
  marginTop: 0,
  marginBottom: "14px",
  color: "var(--db-text)",
  fontSize: "22px",
  fontWeight: 700 as const,
};

const textStyle = {
  margin: "6px 0 0 0",
  color: "var(--db-text-soft)",
  lineHeight: 1.6,
};

const metaTextStyle = {
  margin: "10px 0 0 0",
  color: "8A84A3",
  fontSize: "12px",
};