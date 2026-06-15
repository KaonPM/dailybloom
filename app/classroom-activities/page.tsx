"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";
import { resolveSchoolContext } from "../lib/school-context";
import { defaultActivityLibrary } from "../lib/default-activity-library";

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

const dayTypes = [
  { value: "teaching_day", label: "Teaching Day" },
  { value: "public_holiday", label: "Public Holiday" },
  { value: "school_closed", label: "School Closed" },
];

const PAGE_SIZE = 10;

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
  day_type?: string | null;
  plan_group_id?: string | null;
};

type PlannerActivitySelection = {
  activity_library_id: string;
  activity_name: string;
  description: string;
};

type PlannerRow = {
  dayLabel: string;
  activity_date: string;
  developmental_area: string;
  theme: string;
  day_type: string;
  activities: PlannerActivitySelection[];
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
  support_status?: string | null;
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
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);

  const [selectedTodayPlanId, setSelectedTodayPlanId] = useState<number | null>(null);
  const [supportLearnerIds, setSupportLearnerIds] = useState<string[]>([]);
  const [supportLearnerStatuses, setSupportLearnerStatuses] = useState<Record<string, string>>({});
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

  const [isTodayOpen, setIsTodayOpen] = useState(false);
  const [isTrackerOpen, setIsTrackerOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  const [todayVisibleCount, setTodayVisibleCount] = useState(PAGE_SIZE);
  const [nextVisibleCount, setNextVisibleCount] = useState(PAGE_SIZE);
  const [learnerVisibleCount, setLearnerVisibleCount] = useState(PAGE_SIZE);
  const [supportVisibleCount, setSupportVisibleCount] = useState(PAGE_SIZE);
  const [libraryVisibleCount, setLibraryVisibleCount] = useState(PAGE_SIZE);

  const role = String(profile?.role || "").toLowerCase();
  const isTeacher = role === "teacher";
  const isPrincipal = role === "principal" || role === "admin";
  const isMaster = role === "master";

  const canManageLibrary = isPrincipal || isMaster;
  const canPlanWeek = isTeacher || isPrincipal || isMaster;
  const canViewTracker = isPrincipal || isMaster;

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
        plan.activity_date === todayDate &&
        isTeachingDay(plan.day_type) &&
        Boolean(plan.activity_library_id)
      );
    });
  }, [weeklyPlans, activeClassroomId, todayDate]);

  const nextTeachingPlans = useMemo(() => {
    return weeklyPlans
      .filter((plan) => {
        return (
          String(plan.classroom_id) === String(activeClassroomId) &&
          plan.activity_date > todayDate &&
          isTeachingDay(plan.day_type) &&
          Boolean(plan.activity_library_id)
        );
      })
      .sort((a, b) => String(a.activity_date).localeCompare(String(b.activity_date)));
  }, [weeklyPlans, activeClassroomId, todayDate]);

  const selectedTodayPlan = useMemo(() => {
    if (!selectedTodayPlanId) return null;

    return todaysPlans.find((plan) => plan.id === selectedTodayPlanId) || null;
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

  const dashboardStats = useMemo(() => {
    const planned = currentWeekPlans.filter(
      (item) => isTeachingDay(item.day_type) && Boolean(item.activity_library_id)
    ).length;

    const completed = currentWeekPlans.filter(
      (item) => isTeachingDay(item.day_type) && item.completed
    ).length;

    const plannedOrClosedDates = new Set(
      currentWeekPlans
        .filter((item) => !isTeachingDay(item.day_type) || Boolean(item.activity_library_id))
        .map((item) => item.activity_date)
    ).size;

    return {
      weekPlanned: plannedOrClosedDates >= 5,
      planned,
      completed,
    };
  }, [currentWeekPlans]);

  const supportTrackerRows = useMemo(() => {
    return latestOutcomes.filter((item) => {
      if (item.outcome_status !== "needs_support") return false;

      const matchesClassroom = trackerClassroomId
        ? String(item.classroom_id) === String(trackerClassroomId)
        : true;

      const matchesArea = trackerArea
        ? item.developmental_area === trackerArea
        : true;

      const matchesStatus = trackerStatus
        ? supportStatusValue(item) === trackerStatus
        : supportStatusValue(item) !== "resolved";

      return matchesClassroom && matchesArea && matchesStatus;
    });
  }, [latestOutcomes, trackerClassroomId, trackerArea, trackerStatus]);

  const visibleTodaysPlans = useMemo(() => {
    return todaysPlans.slice(0, todayVisibleCount);
  }, [todaysPlans, todayVisibleCount]);

  const visibleNextTeachingPlans = useMemo(() => {
    return nextTeachingPlans.slice(0, nextVisibleCount);
  }, [nextTeachingPlans, nextVisibleCount]);

  const visibleLearners = useMemo(() => {
    return learners.slice(0, learnerVisibleCount);
  }, [learners, learnerVisibleCount]);

  const visibleSupportTrackerRows = useMemo(() => {
    return supportTrackerRows.slice(0, supportVisibleCount);
  }, [supportTrackerRows, supportVisibleCount]);

  const visibleActivityLibrary = useMemo(() => {
    return activityLibrary.slice(0, libraryVisibleCount);
  }, [activityLibrary, libraryVisibleCount]);

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    if (!schoolId || !activeClassroomId) return;

    buildPlannerRows();
    fetchLearners(Number(activeClassroomId));
  }, [schoolId, activeClassroomId, weekStart, weeklyPlans, activityLibrary]);

  useEffect(() => {
    if (!selectedTodayPlanId) return;

    const stillExists = todaysPlans.some((plan) => plan.id === selectedTodayPlanId);

    if (!stillExists) {
      setSelectedTodayPlanId(null);
    }
  }, [todaysPlans, selectedTodayPlanId]);

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

    const { error: insertError } = await supabase.from("activity_library").insert(rows);

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
      const existingPlans = weeklyPlans.filter((plan) => {
        return (
          String(plan.classroom_id) === String(activeClassroomId) &&
          plan.activity_date === day.date
        );
      });

      const firstExisting = existingPlans[0];

      const fallbackArea = "Language and Communication";
      const fallbackTheme =
        themesForArea(firstExisting?.developmental_area || fallbackArea)[0] || "";

      const existingActivities = existingPlans
        .filter((plan) => isTeachingDay(plan.day_type) && Boolean(plan.activity_library_id))
        .map((plan) => ({
          activity_library_id: plan.activity_library_id
            ? String(plan.activity_library_id)
            : "",
          activity_name: plan.activity_name || "",
          description: plan.description || "",
        }));

      return {
        dayLabel: day.label,
        activity_date: day.date,
        developmental_area: firstExisting?.developmental_area || fallbackArea,
        theme: firstExisting?.theme || fallbackTheme,
        day_type: firstExisting?.day_type || "teaching_day",
        activities:
          existingActivities.length > 0
            ? existingActivities
            : [
                {
                  activity_library_id: "",
                  activity_name: "",
                  description: "",
                },
              ],
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

        if (updates.day_type && updates.day_type !== "teaching_day") {
          updated = {
            ...updated,
            activities: [],
          };
        }

        if (updates.day_type === "teaching_day" && row.activities.length === 0) {
          updated = {
            ...updated,
            activities: [
              {
                activity_library_id: "",
                activity_name: "",
                description: "",
              },
            ],
          };
        }

        if (updates.developmental_area) {
          const availableThemes = themesForArea(updates.developmental_area);
          const firstTheme = availableThemes[0] || "";

          updated = {
            ...updated,
            theme: firstTheme,
            activities: [
              {
                activity_library_id: "",
                activity_name: "",
                description: "",
              },
            ],
          };
        }

        if (updates.theme) {
          updated = {
            ...updated,
            activities: [
              {
                activity_library_id: "",
                activity_name: "",
                description: "",
              },
            ],
          };
        }

        return updated;
      })
    );
  }

  function selectPlannerActivity(
    rowIndex: number,
    activityIndex: number,
    libraryId: string
  ) {
    const selected = activityLibrary.find(
      (item) => String(item.id) === String(libraryId)
    );

    setPlannerRows((current) =>
      current.map((row, index) => {
        if (index !== rowIndex) return row;

        const activities = row.activities.map((activity, currentActivityIndex) => {
          if (currentActivityIndex !== activityIndex) return activity;

          return {
            activity_library_id: libraryId,
            activity_name: selected?.activity_name || "",
            description: selected?.description || "",
          };
        });

        return {
          ...row,
          activities,
        };
      })
    );
  }

  function addPlannerActivity(rowIndex: number) {
    setPlannerRows((current) =>
      current.map((row, index) => {
        if (index !== rowIndex) return row;

        if (!isTeachingDay(row.day_type)) return row;

        if (row.activities.length >= 3) {
          alert("You can select up to 3 activities per day.");
          return row;
        }

        return {
          ...row,
          activities: [
            ...row.activities,
            {
              activity_library_id: "",
              activity_name: "",
              description: "",
            },
          ],
        };
      })
    );
  }

  function removePlannerActivity(rowIndex: number, activityIndex: number) {
    setPlannerRows((current) =>
      current.map((row, index) => {
        if (index !== rowIndex) return row;

        const activities = row.activities.filter(
          (_, currentActivityIndex) => currentActivityIndex !== activityIndex
        );

        return {
          ...row,
          activities:
            activities.length > 0
              ? activities
              : [
                  {
                    activity_library_id: "",
                    activity_name: "",
                    description: "",
                  },
                ],
        };
      })
    );
  }

  async function saveWeeklyPlan() {
    if (!schoolId || !activeClassroomId) {
      alert("Please select a classroom.");
      return;
    }

    const rowsToSave = plannerRows.flatMap((row) => {
      if (!isTeachingDay(row.day_type)) {
        return [
          {
            ...row,
            activity_library_id: "",
            activity_name: dayTypeLabel(row.day_type),
            description: "",
          },
        ];
      }

      return row.activities
        .filter((activity) => Boolean(activity.activity_library_id))
        .map((activity) => ({
          ...row,
          activity_library_id: activity.activity_library_id,
          activity_name: activity.activity_name,
          description: activity.description,
        }));
    });

    if (rowsToSave.length === 0) {
      alert("Please select at least one activity or mark a day as a public holiday or school closed.");
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
      activity_library_id: row.activity_library_id
        ? Number(row.activity_library_id)
        : null,
      activity_name: isTeachingDay(row.day_type)
        ? row.activity_name
        : dayTypeLabel(row.day_type),
      description: isTeachingDay(row.day_type) ? row.description || null : null,
      day_type: row.day_type || "teaching_day",
      plan_group_id: `${schoolId}-${activeClassroomId}-${row.activity_date}`,
      planned_by: profile?.id || null,
    }));

    const { error: insertError } = await supabase.from("weekly_activity_plans").insert(insertRows);

    if (insertError) {
      alert(insertError.message);
      setSaving(false);
      return;
    }

    await fetchWeeklyPlans(schoolId);
    setIsPlannerOpen(false);
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
        day_type: plan.day_type || "teaching_day",
        plan_group_id: `${schoolId}-${activeClassroomId}-${newDate}`,
        planned_by: profile?.id || null,
      };
    });

    const { error: insertError } = await supabase.from("weekly_activity_plans").insert(rows);

    if (insertError) {
      alert(insertError.message);
      setSaving(false);
      return;
    }

    await fetchWeeklyPlans(schoolId);
    setIsPlannerOpen(false);
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

  await supabase
    .from("learner_activity_outcomes")
    .delete()
    .eq("weekly_plan_id", selectedTodayPlan.id);

  const validLearnerIds = supportLearnerIds.filter(
    (learnerId) =>
      learnerId !== null &&
      learnerId !== undefined &&
      String(learnerId).trim() !== "" &&
      !Number.isNaN(Number(learnerId)) &&
      Number(learnerId) > 0
  );

  const rowsToInsert: any[] = [];

  for (const learnerId of validLearnerIds) {
    const openSupport = getOpenSupportOutcome(
      Number(learnerId),
      selectedTodayPlan.developmental_area,
      selectedTodayPlan.id
    );

    const nextStatus = supportLearnerStatuses[String(learnerId)] || "new";

    if (openSupport) {
      const { error: updateError } = await supabase
        .from("learner_activity_outcomes")
        .update({
          weekly_plan_id: selectedTodayPlan.id,
          classroom_id: selectedTodayPlan.classroom_id,
          theme: selectedTodayPlan.theme,
          activity_date: selectedTodayPlan.activity_date,
          activity_name: selectedTodayPlan.activity_name,
          support_status: nextStatus,
          observation: observation || openSupport.observation || null,
          recorded_by: profile?.id || null,
        })
        .eq("id", openSupport.id)
        .eq("school_id", schoolId);

      if (updateError) {
        alert(updateError.message);
        setSaving(false);
        return;
      }
    } else {
      rowsToInsert.push({
        school_id: schoolId,
        classroom_id: selectedTodayPlan.classroom_id,
        learner_id: Number(learnerId),
        weekly_plan_id: selectedTodayPlan.id,
        developmental_area: selectedTodayPlan.developmental_area,
        theme: selectedTodayPlan.theme,
        activity_date: selectedTodayPlan.activity_date,
        activity_name: selectedTodayPlan.activity_name,
        outcome_status: "needs_support",
        support_status: nextStatus,
        observation: observation || null,
        recorded_by: profile?.id || null,
      });
    }
  }

  if (rowsToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("learner_activity_outcomes")
      .insert(rowsToInsert);

    if (insertError) {
      alert(insertError.message);
      setSaving(false);
      return;
    }
  }

  setSupportLearnerIds([]);
  setSupportLearnerStatuses({});
  setObservation("");
  setSelectedTodayPlanId(null);

  setIsPlannerOpen(false);
  setIsTodayOpen(false);
  setIsTrackerOpen(false);
  setIsLibraryOpen(false);

  setTodayVisibleCount(PAGE_SIZE);
  setNextVisibleCount(PAGE_SIZE);
  setLearnerVisibleCount(PAGE_SIZE);
  setSupportVisibleCount(PAGE_SIZE);
  setLibraryVisibleCount(PAGE_SIZE);

  await fetchWeeklyPlans(schoolId);
  await fetchOutcomes(schoolId);

  setSaving(false);

  alert(
    validLearnerIds.length > 0
      ? "Activity completed and learner support cases updated."
      : "Activity completed. Learners not selected are treated as meeting expectations."
  );
}

  function toggleSupportLearner(learnerId: string) {
    setSupportLearnerIds((current) => {
      if (current.includes(learnerId)) {
        setSupportLearnerStatuses((statuses) => {
          const next = { ...statuses };
          delete next[learnerId];
          return next;
        });

        return current.filter((id) => id !== learnerId);
      }

      const openSupport = selectedTodayPlan
  ? getOpenSupportOutcome(
      Number(learnerId),
      selectedTodayPlan.developmental_area,
      selectedTodayPlan.id
    )
  : null;

   setSupportLearnerStatuses((statuses) => ({
  ...statuses,
  [learnerId]: openSupport ? supportStatusValue(openSupport) : "new",
   }));
      return [...current, learnerId];
    });
  }

  function updateSelectedSupportStatus(learnerId: string, nextStatus: string) {
    setSupportLearnerStatuses((current) => ({
      ...current,
      [learnerId]: nextStatus,
    }));
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

  function getPreviousOutcome(learnerId: number, area: string, currentPlanId?: number) {
    return outcomes.find((item) => {
      return (
        Number(item.learner_id) === Number(learnerId) &&
        item.developmental_area === area &&
        item.weekly_plan_id !== currentPlanId
      );
    });
  }

function getOpenSupportOutcome(
  learnerId: number,
  area: string,
  currentPlanId?: number
) {
  return outcomes.find((item) => {
    return (
      Number(item.learner_id) === Number(learnerId) &&
      item.developmental_area === area &&
      item.outcome_status === "needs_support" &&
      item.weekly_plan_id !== currentPlanId &&
      supportStatusValue(item) !== "resolved"
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
          Plan the week, complete today's activity, and track learner support.
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
            <label style={labelStyle}>
              Week: {formatDisplayDate(weekStart)} to {formatDisplayDate(weekEnd)}
            </label>
            <input
              className="db-input"
              type="date"
              value={weekStart}
              onChange={(e) => {
                setWeekStart(getMonday(new Date(`${e.target.value}T00:00:00`)));
                setIsPlannerOpen(true);
              }}
            />
          </div>
        </div>
      </div>

      <div style={compactGrid}>
        <StatCard
          title="Week Planned"
          value={dashboardStats.weekPlanned ? "Yes" : "No"}
          note={dashboardStats.weekPlanned ? "Monday to Friday ready" : "Week incomplete"}
        />
        <StatCard
          title="Planned"
          value={dashboardStats.planned}
          note="Teaching activities"
        />
        <StatCard
          title="Completed"
          value={dashboardStats.completed}
          note="Completed this week"
        />
      </div>

      {canPlanWeek ? (
        <details
          className="db-card db-card-blue"
          style={cardStyle}
          open={isPlannerOpen}
          onToggle={(e) => setIsPlannerOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary style={summaryStyle}>
            Weekly Planner {dashboardStats.weekPlanned ? "Planned" : "Incomplete"}
          </summary>

          <div style={{ marginTop: "12px" }}>
            <div style={sectionHeader}>
              <div>
                <h3 style={sectionTitle}>Weekly Planner</h3>
                <p style={smallHint}>
                  Select up to 3 activities for each teaching day. Mark public holidays or school closure days where needed.
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
                    <strong style={{ minWidth: "92px" }}>
                      {row.dayLabel}
                      <span style={smallHint}>{formatDisplayDate(row.activity_date)}</span>
                    </strong>

                    <select className="db-input" value={row.day_type} onChange={(e) => updatePlannerRow(index, { day_type: e.target.value })}>
                      {dayTypes.map((type) => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>

                    {isTeachingDay(row.day_type) ? (
                      <>
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

                        <div style={activitySelectGroup}>
                          {row.activities.map((activity, activityIndex) => (
                            <div key={`${row.activity_date}-${activityIndex}`} style={activitySelectRow}>
                              <select
                                className="db-input"
                                value={activity.activity_library_id}
                                onChange={(e) => selectPlannerActivity(index, activityIndex, e.target.value)}
                                disabled={!row.theme}
                              >
                                <option value="">No activity selected</option>
                                {rowLibrary.map((item) => (
                                  <option key={item.id} value={item.id}>{item.activity_name}</option>
                                ))}
                              </select>

                              {row.activities.length > 1 ? (
                                <button
                                  type="button"
                                  className="db-button-primary"
                                  style={smallButton}
                                  onClick={() => removePlannerActivity(index, activityIndex)}
                                >
                                  Remove
                                </button>
                              ) : null}
                            </div>
                          ))}

                          <button
                            type="button"
                            className="db-button-primary"
                            style={smallButton}
                            onClick={() => addPlannerActivity(index)}
                            disabled={row.activities.length >= 3 || !row.theme}
                          >
                            Add Activity
                          </button>
                        </div>
                      </>
                    ) : (
                      <p style={textStyle}>{dayTypeLabel(row.day_type)}. No activity required.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </details>
      ) : null}

      <details
        className="db-card db-card-green"
        style={cardStyle}
        open={isTodayOpen}
        onToggle={(e) => setIsTodayOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary style={summaryStyle}>
          Today's Planned Activities
        </summary>
        <p style={smallHint}>This pulls from the weekly planner. Public holidays and school closure days are excluded.</p>

        {todaysPlans.length === 0 ? (
          <p className="db-helper">No activity planned for today.</p>
        ) : (
          <div style={{ display: "grid", gap: "10px", marginTop: "10px" }}>
            {visibleTodaysPlans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => {
                  setSelectedTodayPlanId(plan.id);
                  setSupportLearnerIds([]);
                  setSupportLearnerStatuses({});
                  setObservation("");
                }}
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

        {todaysPlans.length > todayVisibleCount ? (
          <button
            type="button"
            className="db-button-primary"
            style={{ ...smallButton, marginTop: "10px" }}
            onClick={() => setTodayVisibleCount((current) => current + PAGE_SIZE)}
          >
            Add Next 10
          </button>
        ) : null}

        {nextTeachingPlans.length > 0 ? (
          <div style={{ marginTop: "14px" }}>
            <h4 style={subTitle}>Next Teaching Activities</h4>

            <div style={{ display: "grid", gap: "10px" }}>
              {visibleNextTeachingPlans.map((plan) => (
                <div key={plan.id} style={todayPlanButton}>
                  <strong>{plan.activity_name}</strong>
                  <span style={smallHint}>{formatDisplayDate(plan.activity_date)}</span>
                  <span style={smallHint}>{plan.developmental_area} | {plan.theme}</span>
                  <span style={smallHint}>{plan.completed ? "Completed" : "Not completed yet"}</span>
                </div>
              ))}
            </div>

            {nextTeachingPlans.length > nextVisibleCount ? (
              <button
                type="button"
                className="db-button-primary"
                style={{ ...smallButton, marginTop: "10px" }}
                onClick={() => setNextVisibleCount((current) => current + PAGE_SIZE)}
              >
                Add Next 10
              </button>
            ) : null}
          </div>
        ) : null}

        {selectedTodayPlan ? (
          <div style={completionBox}>
            <h4 style={subTitle}>Complete Activity</h4>
            <p style={textStyle}>{selectedTodayPlan.description || "No description added."}</p>
            <p style={smallHint}>
              Development area is automatically captured from this activity: {selectedTodayPlan.developmental_area}.
            </p>

            <label style={labelStyle}>Select Learners Needing Support</label>
            <p style={smallHint}>
              Select only learners who need support. Everyone not selected is treated as meeting expectations.
            </p>

            {learners.length === 0 ? (
              <p className="db-helper">No learners found for this classroom.</p>
            ) : (
              <div style={learnerGrid}>
                {visibleLearners.map((learner) => {
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
                          Previous: {supportStatusLabel(supportStatusValue(previous))} on {previous.activity_date || formatShortDate(previous.created_at || "")}
                        </p>
                      ) : null}

                      {selected ? (
                        <>
                          <label style={labelStyle}>Support Status</label>
                          <select
                            className="db-input"
                            value={supportLearnerStatuses[learnerId] || "new"}
                            onChange={(e) => updateSelectedSupportStatus(learnerId, e.target.value)}
                          >
                            {supportStatuses.map((status) => (
                              <option key={status.value} value={status.value}>
                                {status.label}
                              </option>
                            ))}
                          </select>
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            {learners.length > learnerVisibleCount ? (
              <button
                type="button"
                className="db-button-primary"
                style={{ ...smallButton, marginTop: "10px" }}
                onClick={() => setLearnerVisibleCount((current) => current + PAGE_SIZE)}
              >
                Add Next 10 Learners
              </button>
            ) : null}

            <label style={labelStyle}>Teacher Notes</label>
            <textarea className="db-input" value={observation} onChange={(e) => setObservation(e.target.value)} placeholder="Optional note for the selected learners needing support" style={{ minHeight: "72px" }} />

            <button type="button" className="db-button-primary" style={{ width: "100%", marginTop: "10px" }} onClick={markComplete} disabled={saving}>
              {saving ? "Saving..." : "Mark Complete"}
            </button>
          </div>
        ) : null}
      </details>


      {canViewTracker ? (
        <details
          className="db-card db-card-lavender"
          style={cardStyle}
          open={isTrackerOpen}
          onToggle={(e) => setIsTrackerOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary style={summaryStyle}>Learner Support Tracker ({supportTrackerRows.length})</summary>
          <p style={smallHint}>Learners selected for support during completed activities. Resolved cases are hidden by default.</p>

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
              <option value="">Open cases</option>
              {supportStatuses.map((status) => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </div>

          {supportTrackerRows.length === 0 ? (
            <p className="db-helper" style={{ marginTop: "12px" }}>No learner support records yet.</p>
          ) : (
            <div style={{ display: "grid", gap: "8px", marginTop: "12px" }}>
              {visibleSupportTrackerRows.map((item) => (
                <div key={item.id} className="db-list-card">
                  <strong>{learnerName(item.learner_id)}</strong>
                  <p style={textStyle}>{classroomName(item.classroom_id)} | {item.developmental_area}</p>
                  <p style={textStyle}>Activity: {item.activity_name || "Activity not recorded"}</p>
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

          {supportTrackerRows.length > supportVisibleCount ? (
            <button
              type="button"
              className="db-button-primary"
              style={{ ...smallButton, marginTop: "10px" }}
              onClick={() => setSupportVisibleCount((current) => current + PAGE_SIZE)}
            >
              Add Next 10
            </button>
          ) : null}
        </details>
      ) : null}

      {canManageLibrary ? (
        <details
          className="db-card db-card-yellow"
          style={cardStyle}
          open={isLibraryOpen}
          onToggle={(e) => setIsLibraryOpen((e.target as HTMLDetailsElement).open)}
        >
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
            {visibleActivityLibrary.map((item) => (
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

          {activityLibrary.length > libraryVisibleCount ? (
            <button
              type="button"
              className="db-button-primary"
              style={{ ...smallButton, marginTop: "10px" }}
              onClick={() => setLibraryVisibleCount((current) => current + PAGE_SIZE)}
            >
              Add Next 10
            </button>
          ) : null}
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

function isTeachingDay(value?: string | null) {
  return !value || value === "teaching_day";
}

function dayTypeLabel(value?: string | null) {
  if (value === "public_holiday") return "Public Holiday";
  if (value === "school_closed") return "School Closed";
  return "Teaching Day";
}

function formatDisplayDate(value: string) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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
  gridTemplateColumns: "110px minmax(150px, 0.8fr) minmax(170px, 1fr) minmax(170px, 1fr) minmax(230px, 1.4fr)",
  gap: "8px",
  alignItems: "start",
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: "12px",
  padding: "8px",
};

const activitySelectGroup = {
  display: "grid",
  gap: "8px",
};

const activitySelectRow = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: "8px",
  alignItems: "center",
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