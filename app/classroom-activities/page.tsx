"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";
import { resolveSchoolContext } from "../lib/school-context";
import { useRouter, useSearchParams } from "next/navigation";

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

const themes = [
  "My Family",
  "My Body",
  "Animals",
  "Transport",
  "Seasons",
  "Weather",
  "Healthy Living",
  "Community Helpers",
  "Colours and Shapes",
  "Numbers",
  "Home and School",
  "Plants and Nature",
];

const defaultActivityLibrary = [
  {
    developmental_area: "Language and Communication",
    theme: "My Family",
    activity_name: "Family Picture Talk",
    description: "Learners talk about family members using pictures and simple sentences.",
  },
  {
    developmental_area: "Language and Communication",
    theme: "Animals",
    activity_name: "Animal Sound Story",
    description: "Learners listen to a short animal story and copy animal sounds.",
  },
  {
    developmental_area: "Early Mathematics",
    theme: "Numbers",
    activity_name: "Counting Objects",
    description: "Learners count classroom objects and match the total to number cards.",
  },
  {
    developmental_area: "Early Mathematics",
    theme: "Colours and Shapes",
    activity_name: "Shape Sorting",
    description: "Learners sort shapes by colour, size and type while naming each shape.",
  },
  {
    developmental_area: "Fine Motor Development",
    theme: "Colours and Shapes",
    activity_name: "Threading Beads",
    description: "Learners thread beads to strengthen hand control and coordination.",
  },
  {
    developmental_area: "Fine Motor Development",
    theme: "My Body",
    activity_name: "Cutting Practice",
    description: "Learners practise cutting along straight and curved lines.",
  },
  {
    developmental_area: "Gross Motor Development",
    theme: "Healthy Living",
    activity_name: "Obstacle Course",
    description: "Learners move through a simple obstacle course using crawling, jumping and balancing.",
  },
  {
    developmental_area: "Creative Development",
    theme: "My Family",
    activity_name: "Draw My Family",
    description: "Learners draw their family and describe who is in the picture.",
  },
  {
    developmental_area: "Social and Emotional Development",
    theme: "My Family",
    activity_name: "Feelings Circle",
    description: "Learners identify emotions and share how they feel using picture prompts.",
  },
  {
    developmental_area: "Life Skills",
    theme: "Healthy Living",
    activity_name: "Handwashing Routine",
    description: "Learners practise washing hands correctly and explain when hands should be washed.",
  },
  {
    developmental_area: "Sensory Development",
    theme: "Plants and Nature",
    activity_name: "Texture Exploration",
    description: "Learners touch and describe different textures such as soft, rough, smooth and bumpy.",
  },
  {
    developmental_area: "Outdoor Play",
    theme: "Plants and Nature",
    activity_name: "Nature Walk",
    description: "Learners walk outside and identify leaves, stones, flowers and insects.",
  },
  {
    developmental_area: "Music and Movement",
    theme: "My Body",
    activity_name: "Action Songs",
    description: "Learners sing action songs and follow movements such as clapping, jumping and turning.",
  },
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

type ActivityLibraryItem = {
  id: number;
  school_id: number;
  developmental_area: string;
  theme: string | null;
  activity_name: string;
  description: string | null;
  created_by?: string | null;
};

export default function ClassroomActivitiesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolParam = searchParams.get("school");

  const [profile, setProfile] = useState<any>(null);
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [activityLibrary, setActivityLibrary] = useState<ActivityLibraryItem[]>([]);
  const [learnersByClassroom, setLearnersByClassroom] = useState<Record<string, any[]>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [showLibraryForm, setShowLibraryForm] = useState(false);

  const [editingLibraryId, setEditingLibraryId] = useState<number | null>(null);
  const [libraryArea, setLibraryArea] = useState("");
  const [libraryTheme, setLibraryTheme] = useState("");
  const [libraryActivityName, setLibraryActivityName] = useState("");
  const [libraryDescription, setLibraryDescription] = useState("");

  const [classroomId, setClassroomId] = useState("");
  const [activityDate, setActivityDate] = useState(today());
  const [developmentalArea, setDevelopmentalArea] = useState("Language and Communication");
  const [theme, setTheme] = useState("My Family");
  const [selectedLibraryId, setSelectedLibraryId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [bulkClassroomId, setBulkClassroomId] = useState("");
  const [bulkDate, setBulkDate] = useState(today());
  const [bulkArea, setBulkArea] = useState("");
  const [bulkTheme, setBulkTheme] = useState("");

  const [loading, setLoading] = useState(false);

  const [filterClassroomId, setFilterClassroomId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterTheme, setFilterTheme] = useState("");
  const [filterDate, setFilterDate] = useState(today());

  const [repeatDates, setRepeatDates] = useState<Record<number, string>>({});

  const role = String(profile?.role || "").toLowerCase();
  const isTeacher = role === "teacher";
  const isPrincipal = role === "principal" || role === "admin";
  const isMaster = role === "master";
  const canManageLibrary = isPrincipal || isMaster;
  const canDeleteActivities = isPrincipal || isMaster;

  const availableClassrooms = useMemo(() => {
    if (!isTeacher) return classrooms;

    return classrooms.filter((item) => {
      const teacherClassName = String(profile?.classroom_name || "");
      const teacherClassId = String(profile?.classroom_id || "");

      return (
        String(item.classroom_name) === teacherClassName ||
        String(item.id) === teacherClassId
      );
    });
  }, [classrooms, isTeacher, profile]);

  const filteredLibrary = useMemo(() => {
    return activityLibrary.filter((item) => {
      const matchesArea = item.developmental_area === developmentalArea;
      const matchesTheme = theme ? item.theme === theme : true;

      return matchesArea && matchesTheme;
    });
  }, [activityLibrary, developmentalArea, theme]);

  const bulkLibrary = useMemo(() => {
    return activityLibrary.filter((item) => {
      const matchesArea = bulkArea ? item.developmental_area === bulkArea : true;
      const matchesTheme = bulkTheme ? item.theme === bulkTheme : true;

      return matchesArea && matchesTheme;
    });
  }, [activityLibrary, bulkArea, bulkTheme]);

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

    await fetchClassrooms(context.schoolId, currentProfile);
    await seedDefaultLibrary(context.schoolId, currentProfile);
    await fetchActivityLibrary(context.schoolId);
    await fetchActivities(context.schoolId, currentProfile);
  }

  async function seedDefaultLibrary(currentSchoolId: number, currentProfile: any) {
    const { data, error } = await supabase
      .from("activity_library")
      .select("developmental_area, theme, activity_name")
      .eq("school_id", currentSchoolId);

    if (error) {
      alert(error.message);
      return;
    }

    const existing = new Set(
      (data || []).map(
        (item: any) =>
          `${item.developmental_area}|||${item.theme || ""}|||${item.activity_name}`
      )
    );

    const missingItems = defaultActivityLibrary.filter(
      (item) =>
        !existing.has(`${item.developmental_area}|||${item.theme}|||${item.activity_name}`)
    );

    if (missingItems.length === 0) return;

    const rows = missingItems.map((item) => ({
      school_id: currentSchoolId,
      developmental_area: item.developmental_area,
      theme: item.theme,
      activity_name: item.activity_name,
      description: item.description,
      created_by: currentProfile?.id || null,
    }));

    const { error: insertError } = await supabase
      .from("activity_library")
      .insert(rows);

    if (insertError) {
      alert(insertError.message);
    }
  }

  async function fetchClassrooms(currentSchoolId: number, currentProfile?: any) {
    const { data, error } = await supabase
      .from("classrooms")
      .select("*")
      .eq("school_id", currentSchoolId)
      .order("classroom_name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    const rows = data || [];
    setClassrooms(rows);

    const currentRole = String(currentProfile?.role || "").toLowerCase();

    if (currentRole === "teacher") {
      const teacherClassId = currentProfile?.classroom_id
        ? String(currentProfile.classroom_id)
        : "";

      const teacherClassName = currentProfile?.classroom_name
        ? String(currentProfile.classroom_name)
        : "";

      const matchedClassroom = rows.find((item) => {
        return (
          String(item.id) === teacherClassId ||
          String(item.classroom_name) === teacherClassName
        );
      });

      if (matchedClassroom) {
        setClassroomId(String(matchedClassroom.id));
        setFilterClassroomId(String(matchedClassroom.id));
      }
    }
  }

  async function fetchActivityLibrary(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("activity_library")
      .select("*")
      .eq("school_id", currentSchoolId)
      .order("developmental_area", { ascending: true })
      .order("theme", { ascending: true })
      .order("activity_name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setActivityLibrary(data || []);
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

  async function fetchActivities(currentSchoolId: number, currentProfile?: any) {
    const currentRole = String(currentProfile?.role || profile?.role || "").toLowerCase();

    let query = supabase
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

    if (currentRole === "teacher") {
      const teacherClassId = currentProfile?.classroom_id;

      if (teacherClassId) {
        query = query.eq("classroom_id", Number(teacherClassId));
      }
    }

    const { data, error } = await query;

    if (error) {
      alert(error.message);
      return;
    }

    setActivities(data || []);
  }

  function resetLibraryForm() {
    setEditingLibraryId(null);
    setLibraryArea("");
    setLibraryTheme("");
    setLibraryActivityName("");
    setLibraryDescription("");
  }

  function startEditLibrary(item: ActivityLibraryItem) {
    setEditingLibraryId(item.id);
    setLibraryArea(item.developmental_area);
    setLibraryTheme(item.theme || "");
    setLibraryActivityName(item.activity_name);
    setLibraryDescription(item.description || "");
    setShowLibraryForm(true);
  }

  async function saveLibraryItem() {
    if (!schoolId) return;

    if (!canManageLibrary) {
      alert("Only the principal or master can manage the activity library.");
      return;
    }

    if (!libraryArea || !libraryTheme || !libraryActivityName.trim() || !libraryDescription.trim()) {
      alert("Please complete developmental area, theme, activity name and description.");
      return;
    }

    setLoading(true);

    if (editingLibraryId) {
      const { error } = await supabase
        .from("activity_library")
        .update({
          developmental_area: libraryArea,
          theme: libraryTheme,
          activity_name: libraryActivityName.trim(),
          description: libraryDescription.trim(),
        })
        .eq("id", editingLibraryId)
        .eq("school_id", schoolId);

      if (error) {
        alert(error.message);
        setLoading(false);
        return;
      }
    } else {
      const { error } = await supabase.from("activity_library").insert([
        {
          school_id: schoolId,
          developmental_area: libraryArea,
          theme: libraryTheme,
          activity_name: libraryActivityName.trim(),
          description: libraryDescription.trim(),
          created_by: profile?.id || null,
        },
      ]);

      if (error) {
        alert(error.message);
        setLoading(false);
        return;
      }
    }

    resetLibraryForm();
    setShowLibraryForm(false);
    await fetchActivityLibrary(schoolId);

    setLoading(false);
    alert("Activity library saved.");
  }

  async function deleteLibraryItem(itemId: number) {
    if (!schoolId) return;

    if (!canManageLibrary) {
      alert("Only the principal or master can delete library activities.");
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

    await fetchActivityLibrary(schoolId);
    alert("Activity deleted from library.");
  }

  function handleLibrarySelect(id: string) {
    setSelectedLibraryId(id);

    const selected = activityLibrary.find((item) => String(item.id) === String(id));

    if (!selected) {
      setTitle("");
      setDescription("");
      return;
    }

    setTitle(selected.activity_name);
    setDescription(selected.description || "");
  }

  async function createActivity() {
    if (!schoolId || !title.trim() || !classroomId || !activityDate || !developmentalArea || !theme) {
      alert("Please complete class, date, developmental area, theme and activity.");
      return;
    }

    if (isTeacher) {
      const allowed = availableClassrooms.some(
        (item) => String(item.id) === String(classroomId)
      );

      if (!allowed) {
        alert("Teachers can only add activities for their own class.");
        return;
      }
    }

    setLoading(true);

    const { error } = await supabase.from("classroom_activities").insert([
      {
        school_id: schoolId,
        classroom_id: Number(classroomId),
        activity_date: activityDate,
        title: title.trim(),
        category: developmentalArea,
        theme,
        description: description.trim() || null,
        status: "planned",
        created_by: profile?.id || null,
        assigned_teacher_id: isTeacher ? profile?.id : null,
        follow_up: "none",
      },
    ]);

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setSelectedLibraryId("");
    setTitle("");
    setClassroomId(isTeacher ? classroomId : "");
    setActivityDate(today());
    setDevelopmentalArea("Language and Communication");
    setTheme("My Family");
    setDescription("");
    setShowAddForm(false);

    await fetchActivities(schoolId, profile);
    setLoading(false);
    alert("Classroom activity added successfully.");
  }

  async function addAllLibraryToClassroom() {
    if (!schoolId || !bulkClassroomId || !bulkDate) {
      alert("Please select a classroom and date.");
      return;
    }

    if (bulkLibrary.length === 0) {
      alert("No library activities found to add.");
      return;
    }

    const confirmed = confirm(
      `Add ${bulkLibrary.length} activities to the selected classroom?`
    );

    if (!confirmed) return;

    setLoading(true);

    const rows = bulkLibrary.map((item) => ({
      school_id: schoolId,
      classroom_id: Number(bulkClassroomId),
      activity_date: bulkDate,
      title: item.activity_name,
      category: item.developmental_area,
      theme: item.theme || null,
      description: item.description || null,
      status: "planned",
      created_by: profile?.id || null,
      assigned_teacher_id: null,
      follow_up: "none",
    }));

    const { error } = await supabase
      .from("classroom_activities")
      .insert(rows);

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    await fetchActivities(schoolId, profile);
    setLoading(false);
    alert("Library activities added to classroom.");
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

    if (schoolId) await fetchActivities(schoolId, profile);
  }

  async function deleteActivity(activityId: number) {
    if (!canDeleteActivities) {
      alert("Only the principal or master can delete classroom activities.");
      return;
    }

    const confirmed = confirm("Delete this classroom activity?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("classroom_activities")
      .delete()
      .eq("id", activityId);

    if (error) {
      alert(error.message);
      return;
    }

    if (expandedId === activityId) {
      setExpandedId(null);
    }

    if (schoolId) await fetchActivities(schoolId, profile);
    alert("Classroom activity deleted.");
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
        theme: activity.theme || null,
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

    await fetchActivities(schoolId, profile);
    alert("Activity repeated successfully.");
  }

  const filteredActivities = useMemo(() => {
    return activities.filter((item) => {
      const matchesClass = filterClassroomId
        ? Number(item.classroom_id) === Number(filterClassroomId)
        : true;

      const matchesStatus = filterStatus ? item.status === filterStatus : true;
      const matchesCategory = filterCategory ? item.category === filterCategory : true;
      const matchesTheme = filterTheme ? item.theme === filterTheme : true;
      const matchesDate = filterDate ? item.activity_date === filterDate : true;

      return matchesClass && matchesStatus && matchesCategory && matchesTheme && matchesDate;
    });
  }, [activities, filterClassroomId, filterStatus, filterCategory, filterTheme, filterDate]);

  const teacherTodayActivities = useMemo(() => {
    return activities.filter((item) => item.activity_date === today());
  }, [activities]);

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
          Principals manage themes and activities. Teachers work from today’s classroom flow.
        </p>

        {schoolParam && schoolId ? (
          <Link href={`/master/school/${schoolId}`} style={backButton}>
            Back to School Overview
          </Link>
        ) : null}

        <p style={smallHint}>
          {isTeacher
            ? "Teacher view: select today’s activity, mark progress and create follow-up."
            : "Principal view: preloaded library, classroom assignment and activity monitoring."}
        </p>
      </div>

      <div className="db-grid-3" style={{ marginBottom: "20px" }}>
        <StatCard title="Today" value={stats.todayTotal} note="Activities planned" />
        <StatCard title="Completed" value={stats.todayCompleted} note="Completed today" />
        <StatCard title="Needs Support" value={stats.weeklySupport} note="Weekly support flags" />
      </div>

      {canManageLibrary && (
        <details className="db-card db-card-yellow" style={{ padding: "18px", marginBottom: "20px" }}>
          <summary style={summaryStyle}>Preloaded Activity Library ({activityLibrary.length})</summary>

          <div style={{ marginTop: "16px" }}>
            <div style={topRow}>
              <p style={smallHint}>
                Activities are automatically loaded for each school. You can add, edit or delete them.
              </p>

              <button
                type="button"
                className="db-button-primary"
                onClick={() => {
                  resetLibraryForm();
                  setShowLibraryForm(!showLibraryForm);
                }}
              >
                {showLibraryForm ? "Close" : "Add Library Activity"}
              </button>
            </div>

            {showLibraryForm && (
              <div style={{ marginTop: "16px" }}>
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

                <select
                  className="db-input"
                  value={libraryTheme}
                  onChange={(e) => setLibraryTheme(e.target.value)}
                >
                  <option value="">Select theme</option>
                  {themes.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>

                <input
                  className="db-input"
                  placeholder="Activity name"
                  value={libraryActivityName}
                  onChange={(e) => setLibraryActivityName(e.target.value)}
                />

                <textarea
                  className="db-input"
                  placeholder="Auto-filled description for teachers"
                  value={libraryDescription}
                  onChange={(e) => setLibraryDescription(e.target.value)}
                  style={{ minHeight: "80px" }}
                />

                <button
                  className="db-button-primary"
                  style={{ width: "100%" }}
                  onClick={saveLibraryItem}
                  disabled={loading}
                >
                  {loading
                    ? "Saving..."
                    : editingLibraryId
                    ? "Update Library Activity"
                    : "Save Library Activity"}
                </button>
              </div>
            )}

            <div style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
              {activityLibrary.length === 0 ? (
                <p className="db-helper">No library activities added yet.</p>
              ) : (
                activityLibrary.map((item) => (
                  <div key={item.id} className="db-list-card">
                    <strong>{item.activity_name}</strong>
                    <p style={textStyle}>{item.developmental_area} | {item.theme || "No theme"}</p>
                    <p style={textStyle}>{item.description}</p>

                    <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                      <button
                        type="button"
                        className="db-button-primary"
                        style={miniButton}
                        onClick={() => startEditLibrary(item)}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="db-button-primary"
                        style={miniButton}
                        onClick={() => deleteLibraryItem(item.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </details>
      )}

      {canManageLibrary && (
        <div className="db-card db-card-blue" style={{ padding: "18px", marginBottom: "20px" }}>
          <h3 style={sectionTitle}>Add Library Activities to Classroom</h3>
          <p style={smallHint}>
            Select a classroom and date, then add all activities or filter by developmental area and theme.
          </p>

          <select
            className="db-input"
            value={bulkClassroomId}
            onChange={(e) => setBulkClassroomId(e.target.value)}
          >
            <option value="">Select classroom</option>
            {classrooms.map((classroom) => (
              <option key={classroom.id} value={classroom.id}>
                {classroom.classroom_name}
              </option>
            ))}
          </select>

          <input
            className="db-input"
            type="date"
            value={bulkDate}
            onChange={(e) => setBulkDate(e.target.value)}
          />

          <select
            className="db-input"
            value={bulkArea}
            onChange={(e) => setBulkArea(e.target.value)}
          >
            <option value="">All developmental areas</option>
            {developmentalAreas.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>

          <select
            className="db-input"
            value={bulkTheme}
            onChange={(e) => setBulkTheme(e.target.value)}
          >
            <option value="">All themes</option>
            {themes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="db-button-primary"
            style={{ width: "100%" }}
            onClick={addAllLibraryToClassroom}
            disabled={loading}
          >
            {loading ? "Adding..." : `Add ${bulkLibrary.length} Activities to Classroom`}
          </button>
        </div>
      )}

      <div className="db-card db-card-blue" style={{ padding: "18px", marginBottom: "20px" }}>
        <button
          type="button"
          className="db-button-primary"
          style={{ width: "100%" }}
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? "Close Today’s Activity" : isTeacher ? "Select Today’s Activity" : "Add Single Classroom Activity"}
        </button>

        {showAddForm && (
          <div style={{ marginTop: "16px" }}>
            <select
              className="db-input"
              value={classroomId}
              onChange={(e) => setClassroomId(e.target.value)}
              disabled={isTeacher}
            >
              <option value="">Select class</option>
              {availableClassrooms.map((classroom) => (
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
              value={developmentalArea}
              onChange={(e) => {
                setDevelopmentalArea(e.target.value);
                setSelectedLibraryId("");
                setTitle("");
                setDescription("");
              }}
            >
              {developmentalAreas.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              className="db-input"
              value={theme}
              onChange={(e) => {
                setTheme(e.target.value);
                setSelectedLibraryId("");
                setTitle("");
                setDescription("");
              }}
            >
              {themes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              className="db-input"
              value={selectedLibraryId}
              onChange={(e) => handleLibrarySelect(e.target.value)}
            >
              <option value="">Select activity</option>
              {filteredLibrary.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.activity_name}
                </option>
              ))}
            </select>

            <textarea
              className="db-input"
              placeholder="Auto-filled description"
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
              {loading ? "Saving..." : isTeacher ? "Save Today’s Activity" : "Save Single Activity"}
            </button>
          </div>
        )}
      </div>

      {!isTeacher && (
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
              {availableClassrooms.map((classroom) => (
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
              <option value="">All developmental areas</option>
              {developmentalAreas.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              className="db-input"
              value={filterTheme}
              onChange={(e) => setFilterTheme(e.target.value)}
            >
              <option value="">All themes</option>
              {themes.map((item) => (
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
              setFilterTheme("");
            }}
          >
            Clear Filters
          </button>
        </details>
      )}

      <details className="db-card db-card-green" style={{ padding: "18px", marginBottom: "20px" }} open>
        <summary style={summaryStyle}>
          {isTeacher
            ? `Today’s Activities (${teacherTodayActivities.length})`
            : `Selected Activities (${filteredActivities.length})`}
        </summary>

        <ActivityList
          activities={isTeacher ? teacherTodayActivities : filteredActivities}
          learnersByClassroom={learnersByClassroom}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          fetchLearners={fetchLearners}
          updateActivity={updateActivity}
          deleteActivity={deleteActivity}
          repeatActivity={repeatActivity}
          repeatDates={repeatDates}
          setRepeatDates={setRepeatDates}
          canDeleteActivities={canDeleteActivities}
        />
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
  deleteActivity,
  repeatActivity,
  repeatDates,
  setRepeatDates,
  canDeleteActivities,
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
                  {activity.classrooms?.classroom_name || "Class"} | {activity.activity_date}
                </p>
                <p style={textStyle}>
                  {activity.category} | {activity.theme || "No theme"}
                </p>
                <p style={textStyle}>Status: {statusLabel(activity.status)}</p>
                <p style={smallHint}>Tap card to open learner participation and follow-up.</p>
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
                    placeholder="Example: Repeat using picture cards tomorrow"
                    defaultValue={activity.follow_up_note || ""}
                    onBlur={(e) =>
                      updateActivity(activity.id, { follow_up_note: e.target.value })
                    }
                    style={{ minHeight: "70px" }}
                  />

                  <div style={repeatBox}>
                    <h4 style={subTitle}>Create Tomorrow or Follow-Up Activity</h4>
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
                      Create Activity
                    </button>
                  </div>

                  {canDeleteActivities && (
                    <button
                      type="button"
                      className="db-button-primary"
                      style={{ width: "100%", marginTop: "12px" }}
                      onClick={() => deleteActivity(activity.id)}
                    >
                      Delete Activity
                    </button>
                  )}
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
      <select className="db-input" value={value} onChange={(e) => onChange(e.target.value)}>
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

const topRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
  flexWrap: "wrap" as const,
};

const sectionTitle = {
  margin: 0,
  color: "var(--db-text)",
  fontSize: "18px",
  fontWeight: 800,
};

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