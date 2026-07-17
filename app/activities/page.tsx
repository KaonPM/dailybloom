"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  support_learner_ids?: string[] | null;
  support_learner_names?: string[] | null;
  support_notes?: string | null;
  repeat_group_id?: string | null;
  created_at?: string | null;
};

type LibraryRow = {
  id: number;
  school_id: number;
  developmental_area: string;
  activity_name: string;
  description: string | null;
  created_by?: string | null;
  created_at?: string | null;
};

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

export default function ActivitiesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolParam = searchParams.get("school");

  const today = new Date().toISOString().split("T")[0];

  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [role, setRole] = useState("");
  const [classroomName, setClassroomName] = useState("");

  const normalizedRole = role.toLowerCase();
  const isTeacher = normalizedRole === "teacher";
  const isPrincipal = normalizedRole === "principal" || normalizedRole === "admin";
  const isMaster = normalizedRole === "master";
  const canManageLibrary = isPrincipal || isMaster;

  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [learners, setLearners] = useState<any[]>([]);
  const [selectedClassName, setSelectedClassName] = useState("");

  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [library, setLibrary] = useState<LibraryRow[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<ActivityRow | null>(null);

  const [showLibraryForm, setShowLibraryForm] = useState(false);
  const [editingLibraryId, setEditingLibraryId] = useState<number | null>(null);

  const [libraryArea, setLibraryArea] = useState("");
  const [libraryName, setLibraryName] = useState("");
  const [libraryDescription, setLibraryDescription] = useState("");

  const [activityDate, setActivityDate] = useState(today);
  const [developmentalArea, setDevelopmentalArea] = useState("");
  const [selectedLibraryId, setSelectedLibraryId] = useState("");
  const [description, setDescription] = useState("");
  const [repeatWeeks, setRepeatWeeks] = useState("1");

  const [supportLearnerIds, setSupportLearnerIds] = useState<string[]>([]);
  const [supportNotes, setSupportNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingActivity, setSavingActivity] = useState(false);
  const [savingLibrary, setSavingLibrary] = useState(false);

  const filteredLibrary = useMemo(() => {
    if (!developmentalArea) return [];
    return library.filter((item) => item.developmental_area === developmentalArea);
  }, [library, developmentalArea]);

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    if (schoolId) {
      fetchLearners(schoolId);
    }
  }, [selectedClassName, schoolId]);

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
    const currentRoleLower = currentRole.toLowerCase();

    const teacherClass =
      currentRoleLower === "teacher" && profile?.classroom_name
        ? String(profile.classroom_name)
        : "";

    setRole(currentRole);
    setSchoolId(context.schoolId);
    setClassroomName(teacherClass);
    setSelectedClassName(teacherClass);

    await fetchClassrooms(context.schoolId);
    await fetchLibrary(context.schoolId);
    await fetchLearners(context.schoolId, teacherClass);
    await fetchActivities(context.schoolId, currentRole, teacherClass);

    setLoading(false);
  }

  async function fetchClassrooms(currentSchoolId: number) {
    const { data } = await supabase
      .from("classrooms")
      .select("*")
      .eq("school_id", currentSchoolId)
      .order("classroom_name", { ascending: true });

    setClassrooms(data || []);
  }

  async function fetchLearners(currentSchoolId: number, classNameOverride?: string) {
    const classToUse = classNameOverride ?? selectedClassName;

    let query = supabase
      .from("learners")
      .select("*")
      .eq("school_id", currentSchoolId)
      .order("name", { ascending: true });

    if (classToUse && classToUse !== "all") {
      query = query.eq("class", classToUse);
    }

    const { data, error } = await query;

    if (error) {
      alert(error.message);
      return;
    }

    setLearners(data || []);
  }

  async function fetchLibrary(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("activity_library")
      .select("*")
      .eq("school_id", currentSchoolId)
      .order("developmental_area", { ascending: true })
      .order("activity_name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setLibrary((data || []) as LibraryRow[]);
  }

  async function fetchActivities(
    currentSchoolId: number,
    currentRole = role,
    teacherClass = classroomName
  ) {
    const roleLower = currentRole.toLowerCase();

    let query = supabase
      .from("activities")
      .select("*")
      .eq("school_id", currentSchoolId)
      .gte("activity_date", today)
      .order("activity_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (roleLower === "teacher" && teacherClass) {
      query = query.eq("class_name", teacherClass);
    }

    const { data, error } = await query;

    if (error) {
      alert(error.message);
      return;
    }

    setActivities((data || []) as ActivityRow[]);
  }

  function resetLibraryForm() {
    setEditingLibraryId(null);
    setLibraryArea("");
    setLibraryName("");
    setLibraryDescription("");
  }

  function startEditLibrary(item: LibraryRow) {
    setEditingLibraryId(item.id);
    setLibraryArea(item.developmental_area);
    setLibraryName(item.activity_name);
    setLibraryDescription(item.description || "");
    setShowLibraryForm(true);
  }

  async function saveLibraryItem() {
    if (!schoolId) return;

    if (!canManageLibrary) {
      alert("Only the principal or master can manage the activity library.");
      return;
    }

    if (!libraryArea || !libraryName || !libraryDescription) {
      alert("Please complete developmental area, activity name and description.");
      return;
    }

    setSavingLibrary(true);

    if (editingLibraryId) {
      const { error } = await supabase
        .from("activity_library")
        .update({
          developmental_area: libraryArea,
          activity_name: libraryName,
          description: libraryDescription,
        })
        .eq("id", editingLibraryId)
        .eq("school_id", schoolId);

      if (error) {
        alert(error.message);
        setSavingLibrary(false);
        return;
      }
    } else {
      const { error } = await supabase.from("activity_library").insert([
        {
          school_id: schoolId,
          developmental_area: libraryArea,
          activity_name: libraryName,
          description: libraryDescription,
          created_by: role || null,
        },
      ]);

      if (error) {
        alert(error.message);
        setSavingLibrary(false);
        return;
      }
    }

    const wasEditing = Boolean(editingLibraryId);

    resetLibraryForm();
    setShowLibraryForm(false);
    await fetchLibrary(schoolId);

    setSavingLibrary(false);
    alert(wasEditing ? "Activity library item updated." : "Activity library item added.");
  }

  async function deleteLibraryItem(itemId: number) {
    if (!schoolId) return;

    if (!canManageLibrary) {
      alert("Only the principal or master can delete library items.");
      return;
    }

    const confirmed = confirm("Delete this activity from the library?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("activity_library")
      .delete()
      .eq("id", itemId)
      .eq("school_id", schoolId);

    if (error) {
      alert(error.message);
      return;
    }

    await fetchLibrary(schoolId);
    alert("Activity library item deleted.");
  }

  function addWeeks(dateValue: string, weeks: number) {
    const date = new Date(dateValue);
    date.setDate(date.getDate() + weeks * 7);

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");

    return `${yyyy}-${mm}-${dd}`;
  }

  function handleLibrarySelection(id: string) {
    setSelectedLibraryId(id);

    const match = library.find((item) => String(item.id) === id);

    if (!match) {
      setDescription("");
      return;
    }

    setDescription(match.description || "");
  }

  function toggleSupportLearner(learnerId: string) {
    setSupportLearnerIds((current) => {
      if (current.includes(learnerId)) {
        return current.filter((id) => id !== learnerId);
      }

      return [...current, learnerId];
    });
  }

  async function saveDailyActivity() {
    if (!schoolId) return;

    const selectedLibraryItem = library.find(
      (item) => String(item.id) === String(selectedLibraryId)
    );

    if (!activityDate || !developmentalArea || !selectedLibraryItem || !description) {
      alert("Please complete date, developmental area, activity and description.");
      return;
    }

    if (!isTeacher && (!selectedClassName || selectedClassName === "all")) {
      alert("Please select one class when saving an activity with learner support.");
      return;
    }

    setSavingActivity(true);

    const repeatCount = Math.max(Number(repeatWeeks) || 1, 1);

    const repeatGroupId =
      repeatCount > 1
        ? `repeat-${Date.now()}-${Math.random().toString(36).slice(2)}`
        : null;

    const classNameToSave = isTeacher ? classroomName || null : selectedClassName;

    const selectedSupportLearners = learners.filter((learner) =>
      supportLearnerIds.includes(String(learner.id))
    );

    const supportNames = selectedSupportLearners.map((learner) => String(learner.name));

    const rows = Array.from({ length: repeatCount }).map((_, index) => ({
      school_id: schoolId,
      class_name: classNameToSave,
      activity_date: addWeeks(activityDate, index),
      subject: developmentalArea,
      title: selectedLibraryItem.activity_name,
      description,
      support_learner_ids: supportLearnerIds,
      support_learner_names: supportNames,
      support_notes: supportNotes || null,
      repeat_group_id: repeatGroupId,
    }));

    const { error } = await supabase.from("activities").insert(rows);

    if (error) {
      alert(error.message);
      setSavingActivity(false);
      return;
    }

    setActivityDate(today);
    setDevelopmentalArea("");
    setSelectedLibraryId("");
    setDescription("");
    setRepeatWeeks("1");
    setSupportLearnerIds([]);
    setSupportNotes("");

    await fetchActivities(schoolId);

    setSavingActivity(false);
    alert(repeatCount > 1 ? "Weekly activities saved." : "Activity saved.");
  }

  async function deleteActivity(activityId: number) {
    if (!canManageLibrary) {
      alert("Only the principal or master can delete saved activities.");
      return;
    }

    const confirmed = confirm("Delete this saved activity?");
    if (!confirmed) return;

    const { error } = await supabase.from("activities").delete().eq("id", activityId);

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

    alert("Saved activity deleted.");
  }

  if (loading) {
    return <p>Loading activities...</p>;
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: 18, marginBottom: 18 }}>
        <h2 className="db-page-title">Activities</h2>
        <p className="db-page-subtitle">
          Teachers capture daily activities. Principals manage the activity library and view support needs.
        </p>

        {schoolParam && schoolId ? (
          <Link href={`/master/school/${schoolId}`} className="db-main-pill" style={backButton}>
            Back to School Overview
          </Link>
        ) : null}

        {isTeacher && classroomName ? (
          <p style={smallText}>Teacher view: {classroomName}</p>
        ) : canManageLibrary ? (
          <p style={smallText}>Principal view: activity library and school activities</p>
        ) : null}
      </div>

      {canManageLibrary ? (
        <div className="db-card db-card-yellow" style={{ padding: 16, marginBottom: 18 }}>
          <div style={topRow}>
            <div>
              <h3 style={sectionTitle}>Activity Library</h3>
              <p style={smallText}>
                Add, edit, or delete the activities teachers can select.
              </p>
            </div>

            <button
              type="button"
              className="db-button-primary"
              onClick={() => {
                resetLibraryForm();
                setShowLibraryForm((prev) => !prev);
              }}
            >
              {showLibraryForm ? "Close" : "Add Activity"}
            </button>
          </div>

          {showLibraryForm ? (
            <div style={{ marginBottom: 16 }}>
              <select
                className="db-input"
                value={libraryArea}
                onChange={(e) => setLibraryArea(e.target.value)}
              >
                <option value="">Select developmental area</option>
                {developmentalAreas.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>

              <input
                className="db-input"
                placeholder="Activity name"
                value={libraryName}
                onChange={(e) => setLibraryName(e.target.value)}
              />

              <textarea
                className="db-input"
                rows={3}
                placeholder="Description that will auto-fill for teachers"
                value={libraryDescription}
                onChange={(e) => setLibraryDescription(e.target.value)}
                style={{ width: "100%", resize: "vertical" }}
              />

              <button
                type="button"
                className="db-button-primary"
                onClick={saveLibraryItem}
                disabled={savingLibrary}
                style={{ width: "100%" }}
              >
                {savingLibrary
                  ? "Saving..."
                  : editingLibraryId
                  ? "Update Activity"
                  : "Save Activity"}
              </button>
            </div>
          ) : null}

          {library.length === 0 ? (
            <p className="db-helper">No library activities added yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {library.map((item) => (
                <div key={item.id} className="db-list-card">
                  <strong>{item.activity_name}</strong>
                  <p style={smallText}>{item.developmental_area}</p>
                  <p style={detailText}>{item.description}</p>

                  <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="db-button-secondary"
                      onClick={() => startEditLibrary(item)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="db-button-secondary"
                      onClick={() => deleteLibraryItem(item.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div className="db-card db-card-blue" style={{ padding: 16, marginBottom: 18 }}>
        <h3 style={sectionTitle}>
          {isTeacher ? "Capture Daily Activity" : "Capture Activity for a Class"}
        </h3>

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

          {!isTeacher ? (
            <div>
              <p style={labelText}>Class</p>
              <select
                className="db-input"
                value={selectedClassName}
                onChange={(e) => {
                  setSelectedClassName(e.target.value);
                  setSupportLearnerIds([]);
                }}
              >
                <option value="">Select class</option>
                {classrooms.map((classroom) => (
                  <option key={classroom.id} value={classroom.classroom_name}>
                    {classroom.classroom_name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <p style={labelText}>Developmental Area</p>
        <select
          className="db-input"
          value={developmentalArea}
          onChange={(e) => {
            setDevelopmentalArea(e.target.value);
            setSelectedLibraryId("");
            setDescription("");
          }}
        >
          <option value="">Select developmental area</option>
          {developmentalAreas.map((area) => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </select>

        <p style={labelText}>Activity</p>
        <select
          className="db-input"
          value={selectedLibraryId}
          onChange={(e) => handleLibrarySelection(e.target.value)}
          disabled={!developmentalArea}
        >
          <option value="">Select activity</option>
          {filteredLibrary.map((item) => (
            <option key={item.id} value={item.id}>
              {item.activity_name}
            </option>
          ))}
        </select>

        <p style={labelText}>Auto-filled Description</p>
        <textarea
          className="db-input"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ width: "100%", resize: "vertical" }}
        />

        <div style={{ marginTop: 12 }}>
          <p style={labelText}>Learners Needing Support</p>

          {learners.length === 0 ? (
            <p className="db-helper">
              No learners found for this class.
            </p>
          ) : (
            <div style={learnerGrid}>
              {learners.map((learner) => {
                const learnerId = String(learner.id);
                const checked = supportLearnerIds.includes(learnerId);

                return (
                  <label key={learner.id} style={learnerCheckCard}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSupportLearner(learnerId)}
                    />
                    <span>{learner.name}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <p style={labelText}>Support Notes</p>
        <textarea
          className="db-input"
          rows={3}
          placeholder="Add notes for learners needing support"
          value={supportNotes}
          onChange={(e) => setSupportNotes(e.target.value)}
          style={{ width: "100%", resize: "vertical" }}
        />

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

        <button
          type="button"
          className="db-button-primary"
          onClick={saveDailyActivity}
          disabled={savingActivity}
          style={{ width: "100%", marginTop: 12 }}
        >
          {savingActivity ? "Saving..." : "Save Activity"}
        </button>
      </div>

      <div className="db-card db-card-green" style={{ padding: 16 }}>
        <h3 style={sectionTitle}>
          {isTeacher ? "My Upcoming Activities" : "School Activities"} ({activities.length})
        </h3>

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
                    <strong>{item.title || item.subject || "No activity"}</strong>
                    <span style={pillNeutral}>{item.class_name || "No class"}</span>
                  </button>

                  {active ? (
                    <div className="db-list-card" style={{ marginTop: 8 }}>
                      <p style={smallText}>Developmental Area</p>
                      <strong>{item.subject || "No area"}</strong>

                      <p style={{ ...smallText, marginTop: 10 }}>Activity</p>
                      <p style={detailText}>{item.title || "Untitled Activity"}</p>

                      <p style={{ ...smallText, marginTop: 10 }}>Description</p>
                      <p style={detailText}>{item.description || "No description"}</p>

                      <p style={{ ...smallText, marginTop: 10 }}>Learners Needing Support</p>
                      {item.support_learner_names && item.support_learner_names.length > 0 ? (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {item.support_learner_names.map((name) => (
                            <span key={name} style={pillNeutral}>
                              {name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p style={detailText}>No learners marked for support.</p>
                      )}

                      <p style={{ ...smallText, marginTop: 10 }}>Support Notes</p>
                      <p style={detailText}>{item.support_notes || "No support notes added."}</p>

                      {item.repeat_group_id ? (
                        <p style={{ ...smallText, marginTop: 10 }}>
                          Weekly repeat activity
                        </p>
                      ) : null}

                      {canManageLibrary ? (
                        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                          <button
                            type="button"
                            className="db-button-secondary"
                            onClick={() => deleteActivity(item.id)}
                          >
                            Delete Saved Activity
                          </button>
                        </div>
                      ) : null}
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

const topRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap" as const,
  marginBottom: 12,
};

const sectionTitle = {
  margin: "0 0 10px 0",
  color: "#2D2A3E",
  fontSize: 20,
  fontWeight: 700 as const,
};

const labelText = {
  margin: "10px 0 8px 0",
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

const learnerGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 8,
};

const learnerCheckCard = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: 12,
  padding: "10px 12px",
  color: "#2D2A3E",
  fontSize: 14,
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

const backButton = {
  display: "inline-block",
  marginTop: 12,
  textDecoration: "none",
  background: "#FFFFFF",
  color: "#2D2A3E",
  border: "1px solid #E3D9CD",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 700,
  fontSize: 13,
};
