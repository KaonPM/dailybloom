"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";
import { resolveSchoolContext } from "../lib/school-context";

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

const defaultActivityLibrary = [
  { developmental_area: "Language and Communication", theme: "My Family", activity_name: "Family Picture Talk", description: "Learners talk about family members using pictures and simple sentences." },
  { developmental_area: "Language and Communication", theme: "My Family", activity_name: "Family Role Play", description: "Learners act out family roles and practise speaking in short sentences." },
  { developmental_area: "Language and Communication", theme: "Animals", activity_name: "Animal Sound Story", description: "Learners listen to a short animal story and copy animal sounds." },
  { developmental_area: "Language and Communication", theme: "Transport", activity_name: "Vehicle Picture Talk", description: "Learners describe vehicles and say where each one is used." },
  { developmental_area: "Language and Communication", theme: "Community Helpers", activity_name: "Occupation Matching", description: "Learners match helpers to tools and describe what each helper does." },
  { developmental_area: "Language and Communication", theme: "Seasons and Weather", activity_name: "Daily Weather Chart", description: "Learners describe today's weather and choose the matching picture." },
  { developmental_area: "Language and Communication", theme: "Languages Around Us", activity_name: "Greeting in Different Languages", description: "Learners practise simple greetings in different South African languages." },

  { developmental_area: "Early Mathematics", theme: "Numbers", activity_name: "Counting Objects", description: "Learners count classroom objects and match the total to number cards." },
  { developmental_area: "Early Mathematics", theme: "Numbers", activity_name: "Number Matching", description: "Learners match number symbols to groups of objects." },
  { developmental_area: "Early Mathematics", theme: "Shapes", activity_name: "Shape Sorting", description: "Learners sort shapes by colour, size and type while naming each shape." },
  { developmental_area: "Early Mathematics", theme: "Patterns", activity_name: "Bead Pattern Making", description: "Learners create simple repeating patterns using beads or blocks." },
  { developmental_area: "Early Mathematics", theme: "Measurement", activity_name: "Long and Short Comparison", description: "Learners compare objects and identify which are long or short." },
  { developmental_area: "Early Mathematics", theme: "Sorting and Classification", activity_name: "Colour Sorting", description: "Learners sort objects into groups according to colour." },
  { developmental_area: "Early Mathematics", theme: "Days of the Week", activity_name: "Ordering the Days", description: "Learners place the days of the week in the correct order." },
  { developmental_area: "Early Mathematics", theme: "Months of the Year", activity_name: "Months of the Year Song", description: "Learners sing the months of the year and identify familiar months." },
  { developmental_area: "Early Mathematics", theme: "Calendar Time", activity_name: "Daily Calendar Discussion", description: "Learners identify today's date, day, month and special events." },

  { developmental_area: "Fine Motor Development", theme: "Pencil Control", activity_name: "Tracing Lines", description: "Learners trace straight, curved and zigzag lines to build pencil control." },
  { developmental_area: "Fine Motor Development", theme: "Cutting Skills", activity_name: "Straight Line Cutting", description: "Learners practise cutting safely along straight lines." },
  { developmental_area: "Fine Motor Development", theme: "Hand Strength", activity_name: "Threading Beads", description: "Learners thread beads to strengthen hand control and coordination." },
  { developmental_area: "Fine Motor Development", theme: "Creative Crafts", activity_name: "Tearing and Pasting", description: "Learners tear paper pieces and paste them into a picture." },

  { developmental_area: "Gross Motor Development", theme: "Movement Skills", activity_name: "Obstacle Course", description: "Learners move through a simple obstacle course using crawling, jumping and balancing." },
  { developmental_area: "Gross Motor Development", theme: "Ball Skills", activity_name: "Throw and Catch", description: "Learners practise throwing and catching a ball with control." },
  { developmental_area: "Gross Motor Development", theme: "Coordination", activity_name: "Follow the Leader", description: "Learners follow movement instructions and copy body actions." },
  { developmental_area: "Gross Motor Development", theme: "Outdoor Fitness", activity_name: "Relay Races", description: "Learners participate in short relay activities using safe movement." },

  { developmental_area: "Creative Development", theme: "Art and Drawing", activity_name: "Draw My Family", description: "Learners draw their family and describe who is in the picture." },
  { developmental_area: "Creative Development", theme: "Music Exploration", activity_name: "Rhythm Practice", description: "Learners copy simple rhythms using claps, taps or instruments." },
  { developmental_area: "Creative Development", theme: "Drama and Role Play", activity_name: "Puppet Show", description: "Learners use puppets to act out a simple story." },
  { developmental_area: "Creative Development", theme: "Creative Construction", activity_name: "Block Building", description: "Learners build simple structures using blocks and describe them." },

  { developmental_area: "Social and Emotional Development", theme: "Feelings", activity_name: "Feelings Circle", description: "Learners identify emotions and share how they feel using picture prompts." },
  { developmental_area: "Social and Emotional Development", theme: "Relationships", activity_name: "Sharing Games", description: "Learners practise sharing materials and taking turns." },
  { developmental_area: "Social and Emotional Development", theme: "Self-Awareness", activity_name: "All About Me", description: "Learners talk about their likes, strengths and personal features." },
  { developmental_area: "Social and Emotional Development", theme: "Conflict Resolution", activity_name: "Taking Turns Practice", description: "Learners practise waiting, listening and taking turns during play." },

  { developmental_area: "Life Skills", theme: "My Family", activity_name: "Helping at Home", description: "Learners discuss simple ways they can help at home." },
  { developmental_area: "Life Skills", theme: "Healthy Living", activity_name: "Handwashing Routine", description: "Learners practise washing hands correctly and explain when hands should be washed." },
  { developmental_area: "Life Skills", theme: "Safety", activity_name: "Road Safety", description: "Learners identify safe ways to cross the road and follow road rules." },
  { developmental_area: "Life Skills", theme: "Daily Routines", activity_name: "Packing Away", description: "Learners practise sorting and packing classroom materials correctly." },
  { developmental_area: "Life Skills", theme: "My Community", activity_name: "Places in Our Community", description: "Learners identify familiar places in their community and discuss what happens there." },
  { developmental_area: "Life Skills", theme: "South Africa", activity_name: "South African Flag Activity", description: "Learners identify the South African flag and discuss simple national symbols." },
  { developmental_area: "Life Skills", theme: "Our Province", activity_name: "My Province Discussion", description: "Learners talk about the province they live in and familiar places around them." },
  { developmental_area: "Life Skills", theme: "Maps and Directions", activity_name: "Classroom Map", description: "Learners create or follow a simple classroom map using direction words." },

  { developmental_area: "Sensory Development", theme: "Touch", activity_name: "Texture Exploration", description: "Learners touch and describe textures such as soft, rough, smooth and bumpy." },
  { developmental_area: "Sensory Development", theme: "Sound", activity_name: "Sound Matching", description: "Learners match sounds to objects or picture cards." },
  { developmental_area: "Sensory Development", theme: "Sight", activity_name: "Colour Discovery", description: "Learners identify and group objects by colour." },
  { developmental_area: "Sensory Development", theme: "Smell and Taste", activity_name: "Fruit Tasting", description: "Learners taste fruit and describe simple tastes." },

  { developmental_area: "Outdoor Play", theme: "Nature Exploration", activity_name: "Nature Walk", description: "Learners walk outside and identify leaves, stones, flowers and insects." },
  { developmental_area: "Outdoor Play", theme: "Physical Play", activity_name: "Free Play Stations", description: "Learners rotate through safe outdoor play stations." },
  { developmental_area: "Outdoor Play", theme: "Environmental Awareness", activity_name: "Caring for Plants", description: "Learners water or care for plants and discuss why plants matter." },

  { developmental_area: "Music and Movement", theme: "Singing", activity_name: "Action Songs", description: "Learners sing action songs and follow movements such as clapping, jumping and turning." },
  { developmental_area: "Music and Movement", theme: "Rhythm", activity_name: "Clapping Patterns", description: "Learners copy simple clapping patterns." },
  { developmental_area: "Music and Movement", theme: "Dance", activity_name: "Freeze Dance", description: "Learners move to music and freeze when the music stops." },
  { developmental_area: "Music and Movement", theme: "Movement Games", activity_name: "Simon Says", description: "Learners listen carefully and follow movement instructions." },
];

const outcomeStatuses = [
  { value: "needs_support", label: "Needs Support" },
  { value: "improving", label: "Improving" },
  { value: "meeting_expectations", label: "Meeting Expectations" },
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

type WeeklyPlan = {
  id: number;
  school_id: number;
  classroom_id: number;
  activity_date: string;
  developmental_area: string;
  theme: string;
  activity_library_id: number | null;
  activity_name: string;
  description: string | null;
  planned_by?: string | null;
  completed?: boolean | null;
  completed_at?: string | null;
  completed_by?: string | null;
  created_at?: string | null;
};

type PlannerRow = {
  dayLabel: string;
  activity_date: string;
  developmental_area: string;
  theme: string;
  activity_library_id: string;
  activity_name: string;
  description: string;
};

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
  observation: string | null;
  recorded_by?: string | null;
  created_at?: string | null;
};

export default function ClassroomActivitiesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolParam = searchParams.get("school");

  const [profile, setProfile] = useState<any>(null);
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [learners, setLearners] = useState<any[]>([]);
  const [allLearners, setAllLearners] = useState<any[]>([]);
  const [activityLibrary, setActivityLibrary] = useState<ActivityLibraryItem[]>([]);
  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlan[]>([]);
  const [outcomes, setOutcomes] = useState<OutcomeRow[]>([]);

  const [activeClassroomId, setActiveClassroomId] = useState("");
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [plannerRows, setPlannerRows] = useState<PlannerRow[]>([]);

  const [selectedTodayPlanId, setSelectedTodayPlanId] = useState<number | null>(null);
  const [outstandingLearnerId, setOutstandingLearnerId] = useState("");
  const [supportLearnerIds, setSupportLearnerIds] = useState<string[]>([]);
  const [supportStatuses, setSupportStatuses] = useState<Record<string, string>>({});
  const [observation, setObservation] = useState("");

  const [showLibraryForm, setShowLibraryForm] = useState(false);
  const [editingLibraryId, setEditingLibraryId] = useState<number | null>(null);
  const [libraryArea, setLibraryArea] = useState("");
  const [libraryTheme, setLibraryTheme] = useState("");
  const [libraryActivityName, setLibraryActivityName] = useState("");
  const [libraryDescription, setLibraryDescription] = useState("");

  const [trackerClassroomId, setTrackerClassroomId] = useState("");
  const [trackerArea, setTrackerArea] = useState("");
  const [trackerStatus, setTrackerStatus] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const role = String(profile?.role || "").toLowerCase();
  const isTeacher = role === "teacher";
  const isPrincipal = role === "principal" || role === "admin";
  const isMaster = role === "master";

  const canManageLibrary = isPrincipal || isMaster;
  const canPlanWeek = isTeacher || isPrincipal || isMaster;
  const canViewTracker = isPrincipal || isMaster;

  const activeClassroom = classrooms.find(
    (item) => String(item.id) === String(activeClassroomId)
  );

  const todayDate = today();

  const weekEnd = useMemo(() => addDays(weekStart, 4), [weekStart]);

  const currentWeekPlans = useMemo(() => {
    return weeklyPlans.filter((plan) => {
      return (
        String(plan.classroom_id) === String(activeClassroomId) &&
        plan.activity_date >= weekStart &&
        plan.activity_date <= weekEnd
      );
    });
  }, [weeklyPlans, activeClassroomId, weekStart, weekEnd]);

  const todaysPlans = useMemo(() => {
    return weeklyPlans.filter((plan) => {
      return (
        String(plan.classroom_id) === String(activeClassroomId) &&
        plan.activity_date === todayDate
      );
    });
  }, [weeklyPlans, activeClassroomId, todayDate]);

  const selectedTodayPlan = useMemo(() => {
    return todaysPlans.find((plan) => plan.id === selectedTodayPlanId) || todaysPlans[0] || null;
  }, [todaysPlans, selectedTodayPlanId]);

  const latestOutcomes = useMemo(() => {
    const latest = new Map<string, OutcomeRow>();

    outcomes.forEach((item) => {
      if (!item.learner_id || !item.developmental_area) return;

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

  const weeklyOutcomeRows = useMemo(() => {
    return outcomes.filter((item) => {
      if (!item.activity_date) return false;
      return item.activity_date >= weekStart && item.activity_date <= weekEnd;
    });
  }, [outcomes, weekStart, weekEnd]);

  const dashboardStats = useMemo(() => {
    const planned = currentWeekPlans.length;
    const completed = currentWeekPlans.filter((item) => item.completed).length;

    const weekdaysFilled = new Set(
      currentWeekPlans.map((item) => item.activity_date)
    ).size;

    return {
      weekPlanned: weekdaysFilled >= 5,
      planned,
      completed,
      needsSupport: weeklyOutcomeRows.filter(
        (item) => item.outcome_status === "needs_support"
      ).length,
      improving: weeklyOutcomeRows.filter(
        (item) => item.outcome_status === "improving"
      ).length,
      meeting: weeklyOutcomeRows.filter(
        (item) => item.outcome_status === "meeting_expectations"
      ).length,
    };
  }, [currentWeekPlans, weeklyOutcomeRows]);

  const supportTrackerRows = useMemo(() => {
    return latestOutcomes.filter((item) => {
      const matchesClassroom = trackerClassroomId
        ? String(item.classroom_id) === String(trackerClassroomId)
        : true;

      const matchesArea = trackerArea
        ? item.developmental_area === trackerArea
        : true;

      const matchesStatus = trackerStatus
        ? item.outcome_status === trackerStatus
        : true;

      return matchesClassroom && matchesArea && matchesStatus;
    });
  }, [latestOutcomes, trackerClassroomId, trackerArea, trackerStatus]);

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    if (!schoolId || !activeClassroomId) return;

    buildPlannerRows();
    fetchLearners(Number(activeClassroomId));
  }, [schoolId, activeClassroomId, weekStart, weeklyPlans, activityLibrary]);

  useEffect(() => {
    if (selectedTodayPlan) {
      setSelectedTodayPlanId(selectedTodayPlan.id);
    }
  }, [selectedTodayPlan?.id]);

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

    const classroomRows = await fetchClassrooms(context.schoolId);
    await seedDefaultLibrary(context.schoolId, currentProfile);
    await fetchActivityLibrary(context.schoolId);
    await fetchWeeklyPlans(context.schoolId);
    await fetchOutcomes(context.schoolId);
    await fetchAllLearners(context.schoolId);

    const teacherClassroom = getTeacherClassroom(classroomRows, currentProfile);
    const firstClassroom = classroomRows[0];

    if (teacherClassroom) {
      setActiveClassroomId(String(teacherClassroom.id));
    } else if (firstClassroom) {
      setActiveClassroomId(String(firstClassroom.id));
    }

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
      return [];
    }

    setClassrooms(data || []);
    return data || [];
  }

  function getTeacherClassroom(classroomRows: any[], currentProfile: any) {
    const currentRole = String(currentProfile?.role || "").toLowerCase();

    if (currentRole !== "teacher") return null;

    const teacherClassId = currentProfile?.classroom_id
      ? String(currentProfile.classroom_id)
      : "";

    const teacherClassName = currentProfile?.classroom_name
      ? String(currentProfile.classroom_name)
      : "";

    return classroomRows.find((item) => {
      return (
        String(item.id) === teacherClassId ||
        String(item.classroom_name) === teacherClassName
      );
    });
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

  async function fetchWeeklyPlans(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("weekly_activity_plans")
      .select("*")
      .eq("school_id", currentSchoolId)
      .order("activity_date", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setWeeklyPlans(data || []);
  }

  async function fetchOutcomes(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("learner_activity_outcomes")
      .select("*")
      .eq("school_id", currentSchoolId)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setOutcomes(data || []);
  }

  async function fetchLearners(currentClassroomId: number) {
    if (!schoolId) return;

    const { data, error } = await supabase
      .from("learners")
      .select("*")
      .eq("school_id", schoolId)
      .eq("classroom_id", currentClassroomId)
      .order("name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setLearners(data || []);
  }

  async function fetchAllLearners(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("learners")
      .select("*")
      .eq("school_id", currentSchoolId)
      .order("name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setAllLearners(data || []);
  }

  function themesForArea(area: string) {
    const themeSet = new Set<string>();

    activityLibrary.forEach((item) => {
      if (item.developmental_area === area && item.theme) {
        themeSet.add(item.theme);
      }
    });

    return Array.from(themeSet).sort();
  }

  function activitiesForAreaAndTheme(area: string, selectedTheme: string) {
    return activityLibrary.filter((item) => {
      return item.developmental_area === area && item.theme === selectedTheme;
    });
  }

  function buildPlannerRows() {
    const rows = weekdaysFromMonday(weekStart).map((day) => {
      const existing = weeklyPlans.find((plan) => {
        return (
          String(plan.classroom_id) === String(activeClassroomId) &&
          plan.activity_date === day.date
        );
      });

      const fallbackArea = "Language and Communication";
      const fallbackTheme = themesForArea(existing?.developmental_area || fallbackArea)[0] || "";

      return {
        dayLabel: day.label,
        activity_date: day.date,
        developmental_area: existing?.developmental_area || fallbackArea,
        theme: existing?.theme || fallbackTheme,
        activity_library_id: existing?.activity_library_id
          ? String(existing.activity_library_id)
          : "",
        activity_name: existing?.activity_name || "",
        description: existing?.description || "",
      };
    });

    setPlannerRows(rows);
  }

  function updatePlannerRow(index: number, updates: Partial<PlannerRow>) {
    setPlannerRows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row;

        let updated = {
          ...row,
          ...updates,
        };

        if (updates.developmental_area) {
          const availableThemes = themesForArea(updates.developmental_area);
          const firstTheme = availableThemes[0] || "";

          updated = {
            ...updated,
            theme: firstTheme,
            activity_library_id: "",
            activity_name: "",
            description: "",
          };
        }

        if (updates.theme) {
          updated = {
            ...updated,
            activity_library_id: "",
            activity_name: "",
            description: "",
          };
        }

        return updated;
      })
    );
  }

  function selectPlannerActivity(index: number, libraryId: string) {
    const selected = activityLibrary.find(
      (item) => String(item.id) === String(libraryId)
    );

    setPlannerRows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row;

        return {
          ...row,
          activity_library_id: libraryId,
          activity_name: selected?.activity_name || "",
          description: selected?.description || "",
        };
      })
    );
  }

  async function saveWeeklyPlan() {
    if (!schoolId || !activeClassroomId) {
      alert("Please select a classroom.");
      return;
    }

    const rowsToSave = plannerRows.filter((row) => row.activity_library_id);

    if (rowsToSave.length === 0) {
      alert("Please select at least one activity for the week.");
      return;
    }

    setSaving(true);

    const dates = plannerRows.map((row) => row.activity_date);

    const { error: deleteError } = await supabase
      .from("weekly_activity_plans")
      .delete()
      .eq("school_id", schoolId)
      .eq("classroom_id", Number(activeClassroomId))
      .in("activity_date", dates);

    if (deleteError) {
      alert(deleteError.message);
      setSaving(false);
      return;
    }

    const insertRows = rowsToSave.map((row) => ({
      school_id: schoolId,
      classroom_id: Number(activeClassroomId),
      activity_date: row.activity_date,
      developmental_area: row.developmental_area,
      theme: row.theme,
      activity_library_id: Number(row.activity_library_id),
      activity_name: row.activity_name,
      description: row.description || null,
      planned_by: profile?.id || null,
    }));

    const { error: insertError } = await supabase
      .from("weekly_activity_plans")
      .insert(insertRows);

    if (insertError) {
      alert(insertError.message);
      setSaving(false);
      return;
    }

    await fetchWeeklyPlans(schoolId);
    setSaving(false);
    alert("Weekly activity plan saved.");
  }

  async function copyPreviousWeek() {
    if (!schoolId || !activeClassroomId) {
      alert("Please select a classroom.");
      return;
    }

    const previousStart = addDays(weekStart, -7);
    const previousEnd = addDays(previousStart, 4);

    const previousPlans = weeklyPlans.filter((plan) => {
      return (
        String(plan.classroom_id) === String(activeClassroomId) &&
        plan.activity_date >= previousStart &&
        plan.activity_date <= previousEnd
      );
    });

    if (previousPlans.length === 0) {
      alert("No previous week plan found.");
      return;
    }

    const confirmed = confirm("Copy the previous week plan into this week?");
    if (!confirmed) return;

    setSaving(true);

    const currentDates = weekdaysFromMonday(weekStart).map((item) => item.date);

    const { error: deleteError } = await supabase
      .from("weekly_activity_plans")
      .delete()
      .eq("school_id", schoolId)
      .eq("classroom_id", Number(activeClassroomId))
      .in("activity_date", currentDates);

    if (deleteError) {
      alert(deleteError.message);
      setSaving(false);
      return;
    }

    const rows = previousPlans.map((plan) => {
      const oldDate = new Date(`${plan.activity_date}T00:00:00`);
      const dayOffset = (oldDate.getDay() + 6) % 7;
      const newDate = addDays(weekStart, dayOffset);

      return {
        school_id: schoolId,
        classroom_id: Number(activeClassroomId),
        activity_date: newDate,
        developmental_area: plan.developmental_area,
        theme: plan.theme,
        activity_library_id: plan.activity_library_id,
        activity_name: plan.activity_name,
        description: plan.description || null,
        planned_by: profile?.id || null,
      };
    });

    const { error: insertError } = await supabase
      .from("weekly_activity_plans")
      .insert(rows);

    if (insertError) {
      alert(insertError.message);
      setSaving(false);
      return;
    }

    await fetchWeeklyPlans(schoolId);
    setSaving(false);
    alert("Previous week copied.");
  }

  async function markComplete() {
    if (!schoolId || !selectedTodayPlan) return;

    setSaving(true);

    const { error } = await supabase
      .from("weekly_activity_plans")
      .update({
        completed: true,
        completed_at: new Date().toISOString(),
        completed_by: profile?.id || null,
      })
      .eq("id", selectedTodayPlan.id);

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    const outcomeRows: any[] = [];

    if (outstandingLearnerId) {
      outcomeRows.push({
        school_id: schoolId,
        classroom_id: selectedTodayPlan.classroom_id,
        learner_id: Number(outstandingLearnerId),
        weekly_plan_id: selectedTodayPlan.id,
        developmental_area: selectedTodayPlan.developmental_area,
        theme: selectedTodayPlan.theme,
        activity_date: selectedTodayPlan.activity_date,
        activity_name: selectedTodayPlan.activity_name,
        outcome_status: "meeting_expectations",
        observation: observation ? `Outstanding learner. ${observation}` : "Outstanding learner.",
        recorded_by: profile?.id || null,
      });
    }

    supportLearnerIds.forEach((learnerId) => {
      outcomeRows.push({
        school_id: schoolId,
        classroom_id: selectedTodayPlan.classroom_id,
        learner_id: Number(learnerId),
        weekly_plan_id: selectedTodayPlan.id,
        developmental_area: selectedTodayPlan.developmental_area,
        theme: selectedTodayPlan.theme,
        activity_date: selectedTodayPlan.activity_date,
        activity_name: selectedTodayPlan.activity_name,
        outcome_status: supportStatuses[learnerId] || "needs_support",
        observation: observation || null,
        recorded_by: profile?.id || null,
      });
    });

    await supabase
      .from("learner_activity_outcomes")
      .delete()
      .eq("weekly_plan_id", selectedTodayPlan.id);

    if (outcomeRows.length > 0) {
      const { error: outcomeError } = await supabase
        .from("learner_activity_outcomes")
        .insert(outcomeRows);

      if (outcomeError) {
        alert(outcomeError.message);
        setSaving(false);
        return;
      }
    }

    setOutstandingLearnerId("");
    setSupportLearnerIds([]);
    setSupportStatuses({});
    setObservation("");

    await fetchWeeklyPlans(schoolId);
    await fetchOutcomes(schoolId);

    setSaving(false);
    alert("Activity completed and learner outcomes saved.");
  }

  function toggleSupportLearner(learnerId: string) {
    setSupportLearnerIds((current) => {
      if (current.includes(learnerId)) {
        const next = current.filter((id) => id !== learnerId);

        setSupportStatuses((statuses) => {
          const copy = { ...statuses };
          delete copy[learnerId];
          return copy;
        });

        return next;
      }

      setSupportStatuses((statuses) => ({
        ...statuses,
        [learnerId]: "needs_support",
      }));

      return [...current, learnerId];
    });
  }

  function getPreviousOutcome(learnerId: number, area: string, currentPlanId?: number) {
    return outcomes.find((item) => {
      return (
        Number(item.learner_id) === Number(learnerId) &&
        item.developmental_area === area &&
        item.weekly_plan_id !== currentPlanId
      );
    });
  }

  function learnerName(learnerId: number) {
    const learner = allLearners.find((item) => Number(item.id) === Number(learnerId));
    return learner?.name || "Learner";
  }

  function classroomName(classroomId: number) {
    const classroom = classrooms.find((item) => Number(item.id) === Number(classroomId));
    return classroom?.classroom_name || "Classroom";
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

    setSaving(true);

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
        setSaving(false);
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
        setSaving(false);
        return;
      }
    }

    resetLibraryForm();
    setShowLibraryForm(false);
    await fetchActivityLibrary(schoolId);

    setSaving(false);
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

  if (loading) {
    return <p>Loading classroom activities...</p>;
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: "18px 20px", marginBottom: "16px" }}>
        <h1 className="db-page-title">Classroom Activities</h1>
        <p className="db-page-subtitle">
          Plan the week, complete today’s activity, and track learner support.
        </p>

        {schoolParam && schoolId ? (
          <Link href={`/master/school/${schoolId}`} style={backButton}>
            Back to School Overview
          </Link>
        ) : null}

        <div style={topControls}>
          <div>
            <label style={labelStyle}>Classroom</label>
            <select
              className="db-input"
              value={activeClassroomId}
              onChange={(e) => setActiveClassroomId(e.target.value)}
              disabled={isTeacher}
            >
              <option value="">Select classroom</option>
              {classrooms.map((classroom) => (
                <option key={classroom.id} value={classroom.id}>
                  {classroom.classroom_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Week Starting</label>
            <input
              className="db-input"
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(getMonday(new Date(`${e.target.value}T00:00:00`)))}
            />
          </div>
        </div>
      </div>

      <div style={compactGrid}>
        <StatCard title="Week Planned" value={dashboardStats.weekPlanned ? "Yes" : "No"} note={dashboardStats.weekPlanned ? "Monday to Friday ready" : "Week incomplete"} />
        <StatCard title="Planned" value={dashboardStats.planned} note="Activities this week" />
        <StatCard title="Completed" value={dashboardStats.completed} note="Completed this week" />
        <StatCard title="Needs Support" value={dashboardStats.needsSupport} note="This week" />
        <StatCard title="Improving" value={dashboardStats.improving} note="This week" />
        <StatCard title="Meeting" value={dashboardStats.meeting} note="Expectations" />
      </div>

      {canPlanWeek ? (
        <div className="db-card db-card-blue" style={cardStyle}>
          <div style={sectionHeader}>
            <div>
              <h3 style={sectionTitle}>Weekly Planner</h3>
              <p style={smallHint}>
                Select a developmental area, then choose a matching theme and activity.
              </p>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button type="button" className="db-button-primary" style={smallButton} onClick={copyPreviousWeek} disabled={saving}>
                Copy Previous Week
              </button>

              <button type="button" className="db-button-primary" style={smallButton} onClick={saveWeeklyPlan} disabled={saving}>
                {saving ? "Saving..." : "Save Week Plan"}
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gap: "8px" }}>
            {plannerRows.map((row, index) => {
              const rowThemes = themesForArea(row.developmental_area);
              const rowLibrary = activitiesForAreaAndTheme(row.developmental_area, row.theme);

              return (
                <div key={row.activity_date} style={plannerRowStyle}>
                  <strong style={{ minWidth: "92px" }}>{row.dayLabel}</strong>

                  <select className="db-input" value={row.developmental_area} onChange={(e) => updatePlannerRow(index, { developmental_area: e.target.value })}>
                    {developmentalAreas.map((area) => (
                      <option key={area} value={area}>{area}</option>
                    ))}
                  </select>

                  <select className="db-input" value={row.theme} onChange={(e) => updatePlannerRow(index, { theme: e.target.value })}>
                    <option value="">Select theme</option>
                    {rowThemes.map((themeItem) => (
                      <option key={themeItem} value={themeItem}>{themeItem}</option>
                    ))}
                  </select>

                  <select className="db-input" value={row.activity_library_id} onChange={(e) => selectPlannerActivity(index, e.target.value)} disabled={!row.theme}>
                    <option value="">No activity selected</option>
                    {rowLibrary.map((item) => (
                      <option key={item.id} value={item.id}>{item.activity_name}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="db-card db-card-green" style={cardStyle}>
        <h3 style={sectionTitle}>Today’s Planned Activity</h3>
        <p style={smallHint}>Only activities planned for today are shown here.</p>

        {todaysPlans.length === 0 ? (
          <p className="db-helper">No activity planned for today.</p>
        ) : (
          <div style={{ display: "grid", gap: "10px", marginTop: "10px" }}>
            {todaysPlans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedTodayPlanId(plan.id)}
                style={{
                  ...todayPlanButton,
                  border: selectedTodayPlan?.id === plan.id ? "2px solid #7CCCF3" : "1px solid #E3D9CD",
                }}
              >
                <strong>{plan.activity_name}</strong>
                <span style={smallHint}>{plan.developmental_area} | {plan.theme}</span>
                <span style={smallHint}>{plan.completed ? "Completed" : "Not completed yet"}</span>
              </button>
            ))}
          </div>
        )}

        {selectedTodayPlan ? (
          <div style={completionBox}>
            <h4 style={subTitle}>Complete Activity</h4>
            <p style={textStyle}>{selectedTodayPlan.description || "No description added."}</p>

            <label style={labelStyle}>Outstanding Learner</label>
            <select className="db-input" value={outstandingLearnerId} onChange={(e) => setOutstandingLearnerId(e.target.value)}>
              <option value="">Select learner</option>
              {learners.map((learner) => (
                <option key={learner.id} value={learner.id}>{learner.name}</option>
              ))}
            </select>

            <label style={labelStyle}>Learners Requiring Support</label>
            {learners.length === 0 ? (
              <p className="db-helper">No learners found for this classroom.</p>
            ) : (
              <div style={learnerGrid}>
                {learners.map((learner) => {
                  const learnerId = String(learner.id);
                  const selected = supportLearnerIds.includes(learnerId);
                  const previous = getPreviousOutcome(Number(learner.id), selectedTodayPlan.developmental_area, selectedTodayPlan.id);

                  return (
                    <div key={learner.id} style={learnerCard}>
                      <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <input type="checkbox" checked={selected} onChange={() => toggleSupportLearner(learnerId)} />
                        <strong>{learner.name}</strong>
                      </label>

                      {previous ? (
                        <p style={smallHint}>
                          Previous: {outcomeLabel(previous.outcome_status || "")} on {previous.activity_date || formatShortDate(previous.created_at || "")}
                        </p>
                      ) : null}

                      {selected ? (
                        <select className="db-input" value={supportStatuses[learnerId] || "needs_support"} onChange={(e) => setSupportStatuses((current) => ({ ...current, [learnerId]: e.target.value }))}>
                          {outcomeStatuses.map((status) => (
                            <option key={status.value} value={status.value}>{status.label}</option>
                          ))}
                        </select>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            <label style={labelStyle}>Observation</label>
            <textarea className="db-input" value={observation} onChange={(e) => setObservation(e.target.value)} placeholder="Add a short observation for today’s activity" style={{ minHeight: "72px" }} />

            <button type="button" className="db-button-primary" style={{ width: "100%", marginTop: "10px" }} onClick={markComplete} disabled={saving}>
              {saving ? "Saving..." : "Mark Complete"}
            </button>
          </div>
        ) : null}
      </div>

      {canViewTracker ? (
        <div className="db-card db-card-lavender" style={cardStyle}>
          <h3 style={sectionTitle}>Learner Support Tracker</h3>
          <p style={smallHint}>Latest learner outcome per developmental area.</p>

          <div style={filterGrid}>
            <select className="db-input" value={trackerClassroomId} onChange={(e) => setTrackerClassroomId(e.target.value)}>
              <option value="">All classrooms</option>
              {classrooms.map((classroom) => (
                <option key={classroom.id} value={classroom.id}>{classroom.classroom_name}</option>
              ))}
            </select>

            <select className="db-input" value={trackerArea} onChange={(e) => setTrackerArea(e.target.value)}>
              <option value="">All areas</option>
              {developmentalAreas.map((area) => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>

            <select className="db-input" value={trackerStatus} onChange={(e) => setTrackerStatus(e.target.value)}>
              <option value="">All statuses</option>
              {outcomeStatuses.map((status) => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </div>

          {supportTrackerRows.length === 0 ? (
            <p className="db-helper" style={{ marginTop: "12px" }}>No learner support records yet.</p>
          ) : (
            <div style={{ display: "grid", gap: "8px", marginTop: "12px" }}>
              {supportTrackerRows.map((item) => (
                <div key={item.id} className="db-list-card">
                  <strong>{learnerName(item.learner_id)}</strong>
                  <p style={textStyle}>{classroomName(item.classroom_id)} | {item.developmental_area}</p>
                  <p style={textStyle}>Status: {outcomeLabel(item.outcome_status || "")}</p>
                  <p style={smallHint}>Last updated: {item.activity_date || formatShortDate(item.created_at || "")}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {canManageLibrary ? (
        <details className="db-card db-card-yellow" style={cardStyle}>
          <summary style={summaryStyle}>Activity Library ({activityLibrary.length})</summary>

          <p style={smallHint}>Principals manage themes and activities. Teachers use the planner dropdowns only.</p>

          <div style={{ marginTop: "12px" }}>
            <button type="button" className="db-button-primary" style={{ width: "100%" }} onClick={() => { resetLibraryForm(); setShowLibraryForm((current) => !current); }}>
              {showLibraryForm ? "Close Library Form" : "Add Library Activity"}
            </button>

            {showLibraryForm ? (
              <div style={{ marginTop: "12px" }}>
                <select className="db-input" value={libraryArea} onChange={(e) => setLibraryArea(e.target.value)}>
                  <option value="">Select developmental area</option>
                  {developmentalAreas.map((area) => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>

                <input className="db-input" value={libraryTheme} onChange={(e) => setLibraryTheme(e.target.value)} placeholder="Theme, for example South Africa, Numbers, My Family" />

                <input className="db-input" value={libraryActivityName} onChange={(e) => setLibraryActivityName(e.target.value)} placeholder="Activity name" />

                <textarea className="db-input" value={libraryDescription} onChange={(e) => setLibraryDescription(e.target.value)} placeholder="Description" style={{ minHeight: "72px" }} />

                <button type="button" className="db-button-primary" style={{ width: "100%" }} onClick={saveLibraryItem} disabled={saving}>
                  {saving ? "Saving..." : editingLibraryId ? "Update Library Activity" : "Save Library Activity"}
                </button>
              </div>
            ) : null}
          </div>

          <div style={{ display: "grid", gap: "8px", marginTop: "12px" }}>
            {activityLibrary.map((item) => (
              <div key={item.id} className="db-list-card">
                <strong>{item.activity_name}</strong>
                <p style={textStyle}>{item.developmental_area} | {item.theme || "No theme"}</p>
                <p style={smallHint}>{item.description}</p>

                <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                  <button type="button" className="db-button-primary" style={smallButton} onClick={() => startEditLibrary(item)}>Edit</button>
                  <button type="button" className="db-button-primary" style={smallButton} onClick={() => deleteLibraryItem(item.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : null}
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

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return formatDate(d);
}

function addDays(dateValue: string, days: number) {
  const d = new Date(`${dateValue}T00:00:00`);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

function weekdaysFromMonday(mondayDate: string) {
  const labels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  return labels.map((label, index) => ({
    label,
    date: addDays(mondayDate, index),
  }));
}

function outcomeLabel(value: string) {
  if (value === "needs_support") return "Needs Support";
  if (value === "improving") return "Improving";
  if (value === "meeting_expectations") return "Meeting Expectations";
  return "Not recorded";
}

function formatShortDate(value: string) {
  if (!value) return "Not recorded";
  return value.slice(0, 10);
}

const cardStyle = {
  padding: "16px",
  marginBottom: "16px",
};

const compactGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: "10px",
  marginBottom: "16px",
};

const topControls = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "10px",
  marginTop: "12px",
};

const sectionHeader = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
  flexWrap: "wrap" as const,
  marginBottom: "12px",
};

const sectionTitle = {
  margin: 0,
  color: "var(--db-text)",
  fontSize: "18px",
  fontWeight: 800,
};

const subTitle = {
  margin: "0 0 8px 0",
  color: "var(--db-text)",
  fontSize: "16px",
  fontWeight: 800,
};

const smallHint = {
  margin: "4px 0 0 0",
  color: "var(--db-text-soft)",
  fontSize: "12px",
};

const textStyle = {
  margin: "6px 0 0 0",
  color: "var(--db-text-soft)",
  fontSize: "13px",
};

const labelStyle = {
  display: "block",
  margin: "8px 0 5px",
  fontWeight: 700,
  color: "var(--db-text)",
  fontSize: "13px",
};

const smallButton = {
  minHeight: "34px",
  padding: "8px 12px",
  fontSize: "12px",
};

const plannerRowStyle = {
  display: "grid",
  gridTemplateColumns: "110px repeat(3, minmax(150px, 1fr))",
  gap: "8px",
  alignItems: "center",
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: "12px",
  padding: "8px",
};

const todayPlanButton = {
  display: "grid",
  gap: "4px",
  textAlign: "left" as const,
  background: "#FFFDFB",
  borderRadius: "12px",
  padding: "12px",
  cursor: "pointer",
  color: "var(--db-text)",
};

const completionBox = {
  marginTop: "12px",
  padding: "12px",
  borderRadius: "14px",
  border: "1px solid #E3D9CD",
  background: "#FFFFFF",
};

const learnerGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "8px",
};

const learnerCard = {
  padding: "10px",
  borderRadius: "12px",
  border: "1px solid #E3D9CD",
  background: "#FFFDFB",
};

const filterGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "8px",
  marginTop: "10px",
};

const summaryStyle = {
  cursor: "pointer",
  fontSize: "18px",
  fontWeight: 800,
  color: "var(--db-text)",
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