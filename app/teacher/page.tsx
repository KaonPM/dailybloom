"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";

type School = {
  id: number;
  school_name: string;
  logo_url?: string | null;
};

type TeacherProfile = {
  id?: string;
  full_name?: string | null;
  role?: string | null;
  school_id?: number | null;
  classroom_id?: number | null;
  classroom_name?: string | null;
};

type EventItem = {
  id: number;
  title?: string | null;
  event_date?: string | null;
};

type LearnerItem = {
  id: number;
  name?: string | null;
  class?: string | null;
  classroom_id?: number | null;
  date_of_birth?: string | null;
};

type ClassroomItem = {
  id: number;
  classroom_name?: string | null;
};

type ActivityItem = {
  id: number;
  activity_date?: string | null;
  classroom_id?: number | null;
  developmental_area?: string | null;
  theme?: string | null;
  activity_name?: string | null;
  description?: string | null;
  completed?: boolean | null;
};

type SummaryItem = {
  id: number;
  learner_name?: string | null;
  created_at?: string | null;
};

type AttendanceItem = {
  id: number;
  learner_name?: string | null;
  attendance_date?: string | null;
  status?: string | null;
};

type UpcomingBirthdayItem = {
  id: number;
  name?: string | null;
  nextBirthdayLabel: string;
  daysUntil: number;
};

type TeacherOverview = {
  learners: number;
  attendanceToday: number;
  summariesToday: number;
  activitiesToday: number;
};

type OutstandingRequirementItem = {
  learnerId: number;
  learnerName: string;
  missingItems: string[];
};

export default function TeacherDashboardPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [classroomLabel, setClassroomLabel] = useState("No classroom assigned");

  const [todayEvents, setTodayEvents] = useState<EventItem[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<EventItem[]>([]);
  const [birthdaysToday, setBirthdaysToday] = useState<LearnerItem[]>([]);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<
    UpcomingBirthdayItem[]
  >([]);
  const [todayActivities, setTodayActivities] = useState<ActivityItem[]>([]);
  const [outstandingRequirements, setOutstandingRequirements] = useState<
    OutstandingRequirementItem[]
  >([]);

  const [overview, setOverview] = useState<TeacherOverview>({
    learners: 0,
    attendanceToday: 0,
    summariesToday: 0,
    activitiesToday: 0,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTeacherDashboard();
  }, []);

  function getTodayString() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function formatDate(date: Date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function normalizeText(value: string | null | undefined) {
    return String(value || "").trim().toLowerCase();
  }

  async function loadTeacherDashboard() {
    const { profile: currentProfile, error } = await getCurrentProfile();

    if (error || !currentProfile) {
      router.push("/login");
      return;
    }

    if (currentProfile.role === "master") {
      router.push("/master?view=manage-schools");
      return;
    }

    if (currentProfile.role === "principal") {
      router.push("/dashboard");
      return;
    }

    if (currentProfile.role !== "teacher") {
      router.push("/login");
      return;
    }

    if (!currentProfile.school_id) {
      router.push("/login");
      return;
    }

    setProfile(currentProfile);

    const currentSchoolId = Number(currentProfile.school_id);

    const { data: schoolData, error: schoolError } = await supabase
      .from("schools")
      .select("id, school_name, logo_url")
      .eq("id", currentSchoolId)
      .single();

    if (schoolError || !schoolData) {
      router.push("/login");
      return;
    }

    setSchool(schoolData);

    const resolvedClassroom = await resolveTeacherClassroom(
      currentSchoolId,
      currentProfile
    );

    setClassroomLabel(
      resolvedClassroom?.classroom_name ||
        currentProfile.classroom_name ||
        "No classroom assigned"
    );

    await fetchTeacherDashboardData(
      currentSchoolId,
      resolvedClassroom?.id || null,
      resolvedClassroom?.classroom_name || currentProfile.classroom_name || null
    );

    setLoading(false);
  }

  async function resolveTeacherClassroom(
    schoolId: number,
    currentProfile: TeacherProfile
  ) {
    const { data, error } = await supabase
      .from("classrooms")
      .select("id, classroom_name")
      .eq("school_id", schoolId)
      .order("classroom_name", { ascending: true });

    if (error) {
      alert(error.message);
      return null;
    }

    const classrooms = (data || []) as ClassroomItem[];

    const classroomById = classrooms.find(
      (classroom) =>
        String(classroom.id) === String(currentProfile.classroom_id)
    );

    if (classroomById) return classroomById;

    const classroomByName = classrooms.find(
      (classroom) =>
        normalizeText(classroom.classroom_name) ===
        normalizeText(currentProfile.classroom_name)
    );

    if (classroomByName) return classroomByName;

    return null;
  }

  async function fetchTeacherDashboardData(
    schoolId: number,
    classroomId: number | null,
    classroomName: string | null
  ) {
    const today = new Date();
    const todayDate = getTodayString();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();

    let activitiesQuery = supabase
      .from("weekly_activity_plans")
      .select(
        "id, activity_date, classroom_id, developmental_area, theme, activity_name, description, completed"
      )
      .eq("school_id", schoolId)
      .eq("activity_date", todayDate)
      .order("activity_name", { ascending: true });

    if (classroomId) {
      activitiesQuery = activitiesQuery.eq("classroom_id", classroomId);
    }

    const [
      learnersRes,
      eventsRes,
      activitiesRes,
      summariesRes,
      attendanceRes,
    ] = await Promise.all([
      supabase
        .from("learners")
        .select("id, name, class, classroom_id, date_of_birth")
        .eq("school_id", schoolId)
        .order("name", { ascending: true }),

      supabase
        .from("events")
        .select("id, title, event_date")
        .eq("school_id", schoolId)
        .gte("event_date", todayDate)
        .order("event_date", { ascending: true })
        .order("title", { ascending: true }),

      activitiesQuery,

      supabase
        .from("summaries")
        .select("id, learner_name, created_at")
        .eq("school_id", schoolId)
        .gte("created_at", `${todayDate} 00:00:00`)
        .lt("created_at", `${todayDate} 23:59:59`),

      supabase
        .from("attendance")
        .select("id, learner_name, attendance_date, status")
        .eq("school_id", schoolId)
        .eq("attendance_date", todayDate),
    ]);

    if (learnersRes.error) {
      alert(learnersRes.error.message);
      return;
    }

    if (eventsRes.error) {
      alert(eventsRes.error.message);
      return;
    }

    if (activitiesRes.error) {
      alert(activitiesRes.error.message);
      return;
    }

    if (summariesRes.error) {
      alert(summariesRes.error.message);
      return;
    }

    if (attendanceRes.error) {
      alert(attendanceRes.error.message);
      return;
    }

    const allLearners = (learnersRes.data || []) as LearnerItem[];
    const events = (eventsRes.data || []) as EventItem[];
    const activities = (activitiesRes.data || []) as ActivityItem[];
    const summaries = (summariesRes.data || []) as SummaryItem[];
    const attendance = (attendanceRes.data || []) as AttendanceItem[];

    const learners =
      classroomId || classroomName
        ? allLearners.filter((learner) => {
            return (
              Number(learner.classroom_id) === Number(classroomId) ||
              normalizeText(learner.class) === normalizeText(classroomName)
            );
          })
        : [];

    const classroomLearnerNames = new Set(
      learners.map((learner) => normalizeText(learner.name)).filter(Boolean)
    );

    const filteredSummaries = summaries.filter((summary) =>
      classroomLearnerNames.has(normalizeText(summary.learner_name))
    );

    const filteredAttendance = attendance.filter((item) =>
      classroomLearnerNames.has(normalizeText(item.learner_name))
    );

    const todaysEvents = events.filter(
      (event) => String(event.event_date || "") === todayDate
    );

    const nextUpcomingEvents = events
      .filter((event) => String(event.event_date || "") > todayDate)
      .slice(0, 2);

    const todaysBirthdays = learners.filter((learner) => {
      if (!learner.date_of_birth) return false;

      const dob = new Date(learner.date_of_birth);

      return dob.getMonth() + 1 === todayMonth && dob.getDate() === todayDay;
    });

    const computedUpcomingBirthdays: UpcomingBirthdayItem[] = learners
      .filter((learner) => Boolean(learner.date_of_birth))
      .map((learner) => {
        const dob = new Date(String(learner.date_of_birth));

        const birthdayThisYear = new Date(
          today.getFullYear(),
          dob.getMonth(),
          dob.getDate()
        );

        let nextBirthday = birthdayThisYear;

        const todayOnly = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate()
        );

        if (birthdayThisYear < todayOnly) {
          nextBirthday = new Date(
            today.getFullYear() + 1,
            dob.getMonth(),
            dob.getDate()
          );
        }

        const diffMs =
          new Date(
            nextBirthday.getFullYear(),
            nextBirthday.getMonth(),
            nextBirthday.getDate()
          ).getTime() - todayOnly.getTime();

        const daysUntil = Math.round(diffMs / (1000 * 60 * 60 * 24));

        return {
          id: learner.id,
          name: learner.name,
          nextBirthdayLabel: formatDate(nextBirthday),
          daysUntil,
        };
      })
      .filter((item) => item.daysUntil > 0)
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 2);

    await fetchOutstandingRequirements(schoolId, learners);

    setTodayEvents(todaysEvents);
    setUpcomingEvents(nextUpcomingEvents);
    setBirthdaysToday(todaysBirthdays);
    setUpcomingBirthdays(computedUpcomingBirthdays);
    setTodayActivities(activities.slice(0, 2));

    setOverview({
      learners: learners.length,
      attendanceToday: filteredAttendance.length,
      summariesToday: filteredSummaries.length,
      activitiesToday: activities.length,
    });
  }

  async function fetchOutstandingRequirements(
    schoolId: number,
    learners: LearnerItem[]
  ) {
    if (learners.length === 0) {
      setOutstandingRequirements([]);
      return;
    }

    const learnerIds = learners.map((learner) => learner.id);
    const learnerMap = new Map<number, LearnerItem>();

    learners.forEach((learner) => {
      learnerMap.set(Number(learner.id), learner);
    });

    const [stationeryRes, otherRequirementsRes] = await Promise.all([
      supabase
        .from("learner_stationery_checklist")
        .select("learner_id, item_name, received")
        .eq("school_id", schoolId)
        .in("learner_id", learnerIds),

      supabase
        .from("learner_other_requirements")
        .select("learner_id, requirement_name, completed")
        .eq("school_id", schoolId)
        .in("learner_id", learnerIds),
    ]);

    if (stationeryRes.error) {
      alert(stationeryRes.error.message);
      return;
    }

    if (otherRequirementsRes.error) {
      alert(otherRequirementsRes.error.message);
      return;
    }

    const missingByLearner = new Map<number, string[]>();

    (stationeryRes.data || []).forEach((item: any) => {
      if (item.received === true) return;

      const learnerId = Number(item.learner_id);
      const currentItems = missingByLearner.get(learnerId) || [];

      currentItems.push(item.item_name || "Unnamed item");

      missingByLearner.set(learnerId, currentItems);
    });

    (otherRequirementsRes.data || []).forEach((item: any) => {
      if (item.completed === true) return;

      const learnerId = Number(item.learner_id);
      const currentItems = missingByLearner.get(learnerId) || [];

      currentItems.push(item.requirement_name || "Unnamed requirement");

      missingByLearner.set(learnerId, currentItems);
    });

    const outstanding = Array.from(missingByLearner.entries())
      .map(([learnerId, missingItems]) => {
        const learner = learnerMap.get(learnerId);

        return {
          learnerId,
          learnerName: learner?.name || "Unnamed learner",
          missingItems,
        };
      })
      .filter((item) => item.missingItems.length > 0)
      .slice(0, 6);

    setOutstandingRequirements(outstanding);
  }

  if (loading) {
    return <p>Loading teacher dashboard...</p>;
  }

  if (!profile || !school) {
    return <p>Teacher dashboard unavailable.</p>;
  }

  return (
    <div
      style={{
        minHeight: "100%",
        background: "#FFF8F2",
        paddingBottom: "24px",
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #F8E8F0 0%, #FFF8F2 100%)",
          border: "1px solid #EBC9D8",
          borderRadius: "28px",
          padding: "24px",
          marginBottom: "20px",
          boxShadow: "0 10px 24px rgba(45, 42, 62, 0.06)",
        }}
      >
        <p
          style={{
            margin: 0,
            color: "#6D6888",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          Teacher Dashboard
        </p>

        <h1
          style={{
            margin: "8px 0 0 0",
            fontSize: "34px",
            fontWeight: 700,
            color: "#2D2A3E",
          }}
        >
          {school.school_name}
        </h1>

        <p
          style={{
            marginTop: "10px",
            marginBottom: 0,
            color: "#5B5675",
            fontSize: "15px",
            lineHeight: 1.6,
          }}
        >
          Classroom view: {classroomLabel}
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "14px",
          marginBottom: "24px",
        }}
      >
        <OverviewCard
          label="Learners"
          value={overview.learners}
          helper="Learners in your class"
          href="/children"
          background="#EAF7FD"
          border="#CBEAF7"
        />

        <OverviewCard
          label="Attendance Today"
          value={overview.attendanceToday}
          helper="Marked today"
          href="/attendance"
          background="#EEF9EE"
          border="#D3EDD4"
        />

        <OverviewCard
          label="Summaries Today"
          value={overview.summariesToday}
          helper="Saved today"
          href="/summaries"
          background="#F8E8F0"
          border="#EBC9D8"
        />

        <OverviewCard
          label="Activities Today"
          value={overview.activitiesToday}
          helper="Planned for today"
          href="/classroom-activities"
          background="#FFF7D9"
          border="#F3E4A3"
        />

        <OverviewCard
          label="Progress Reports"
          value={overview.learners}
          helper="Developmental and Grade RR reports"
          href="/progress-reports"
          background="#F3EAFD"
          border="#D8C4F1"
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <CompactHighlightCard
          title="Today’s Events"
          subtitle="Today and what’s next"
          href="/events"
          accentBackground="#FFF7D9"
          accentBorder="#F3E4A3"
          footerText="Open events"
        >
          <div style={{ display: "grid", gap: "8px" }}>
            {todayEvents.length > 0 ? (
              todayEvents.slice(0, 2).map((event) => (
                <div key={`today-event-${event.id}`} style={compactMiniCard}>
                  <strong style={compactMiniTitle}>
                    {event.title || "Untitled event"}
                  </strong>
                </div>
              ))
            ) : (
              <CompactEmptyText text="No events today." />
            )}

            {upcomingEvents.length > 0 ? (
              <>
                <p style={compactSectionLabel}>Upcoming Events</p>

                {upcomingEvents.map((event) => (
                  <div
                    key={`upcoming-event-${event.id}`}
                    style={compactMiniCard}
                  >
                    <strong style={compactMiniTitle}>
                      {event.title || "Untitled event"}
                    </strong>

                    <p style={compactMiniMeta}>
                      {event.event_date || "No date"}
                    </p>
                  </div>
                ))}
              </>
            ) : null}
          </div>
        </CompactHighlightCard>

        <CompactHighlightCard
          title="Birthdays Today"
          subtitle="Today and upcoming"
          href="/children?filter=birthdays-today"
          accentBackground="#F8E8F0"
          accentBorder="#EBC9D8"
          footerText="Open birthdays"
        >
          <div style={{ display: "grid", gap: "8px" }}>
            {birthdaysToday.length > 0 ? (
              birthdaysToday.slice(0, 2).map((learner) => (
                <div
                  key={`today-birthday-${learner.id}`}
                  style={compactMiniCard}
                >
                  <strong style={compactMiniTitle}>
                    {learner.name || "Unnamed learner"}
                  </strong>
                </div>
              ))
            ) : (
              <CompactEmptyText text="No birthdays today." />
            )}

            {upcomingBirthdays.length > 0 ? (
              <>
                <p style={compactSectionLabel}>Upcoming Birthdays</p>

                {upcomingBirthdays.map((learner) => (
                  <div
                    key={`upcoming-birthday-${learner.id}`}
                    style={compactMiniCard}
                  >
                    <strong style={compactMiniTitle}>
                      {learner.name || "Unnamed learner"}
                    </strong>

                    <p style={compactMiniMeta}>
                      {learner.nextBirthdayLabel}
                    </p>
                  </div>
                ))}
              </>
            ) : null}
          </div>
        </CompactHighlightCard>

        <CompactHighlightCard
          title="Today’s Planned Activities"
          subtitle="Pulled from Weekly Planner"
          href="/classroom-activities"
          accentBackground="#EAF7FD"
          accentBorder="#CBEAF7"
          footerText="Open classroom activities"
        >
          <div style={{ display: "grid", gap: "8px" }}>
            {todayActivities.length > 0 ? (
              todayActivities.map((activity) => (
                <div key={activity.id} style={compactMiniCard}>
                  <strong style={compactMiniTitle}>
                    {activity.activity_name || "Untitled activity"}
                  </strong>

                  <p style={compactMiniText}>
                    {activity.developmental_area || "No area"} |{" "}
                    {activity.theme || "No theme"}
                  </p>

                  <p style={compactMiniMeta}>
                    {activity.completed ? "Completed" : "Not completed yet"}
                  </p>
                </div>
              ))
            ) : (
              <CompactEmptyText text="No activities planned for today." />
            )}
          </div>
        </CompactHighlightCard>
      </div>

      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #F0E3D8",
          borderRadius: "24px",
          padding: "20px",
          boxShadow: "0 8px 20px rgba(45, 42, 62, 0.05)",
        }}
      >
        <h3
          style={{
            marginTop: 0,
            marginBottom: "8px",
            color: "#2D2A3E",
            fontSize: "22px",
            fontWeight: 700,
          }}
        >
          Outstanding Learner Requirements
        </h3>

        <p
          style={{
            marginTop: 0,
            marginBottom: "16px",
            color: "#6D6888",
            fontSize: "14px",
            lineHeight: 1.6,
          }}
        >
          Learners in your classroom with missing documents, stationery,
          hygiene or other requirements.
        </p>

        {outstandingRequirements.length === 0 ? (
          <p
            style={{
              margin: 0,
              color: "#6D6888",
              fontSize: "14px",
            }}
          >
            No outstanding learner requirements found for your classroom.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {outstandingRequirements.map((item) => (
              <div
                key={item.learnerId}
                style={{
                  background: "#FFFDFB",
                  border: "1px solid #F0E3D8",
                  borderRadius: "16px",
                  padding: "14px",
                }}
              >
                <strong
                  style={{
                    display: "block",
                    color: "#2D2A3E",
                    fontSize: "15px",
                    marginBottom: "6px",
                  }}
                >
                  {item.learnerName}
                </strong>

                <p
                  style={{
                    margin: "0 0 10px 0",
                    color: "#6D6888",
                    fontSize: "13px",
                    lineHeight: 1.5,
                  }}
                >
                  Missing: {item.missingItems.slice(0, 4).join(", ")}
                  {item.missingItems.length > 4 ? " and more" : ""}
                </p>

                <Link
                  href={`/learner-requirements?learner=${item.learnerId}`}
                  className="db-button-primary"
                  style={{
                    display: "inline-block",
                    textDecoration: "none",
                    padding: "9px 12px",
                    fontSize: "13px",
                  }}
                >
                  View Checklist
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CompactHighlightCard({
  title,
  subtitle,
  href,
  accentBackground,
  accentBorder,
  footerText,
  children,
}: {
  title: string;
  subtitle: string;
  href: string;
  accentBackground: string;
  accentBorder: string;
  footerText: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #F0E3D8",
          borderRadius: "22px",
          padding: "14px",
          boxShadow: "0 8px 18px rgba(45, 42, 62, 0.05)",
          cursor: "pointer",
          minHeight: "220px",
          height: "100%",
        }}
      >
        <div
          style={{
            background: accentBackground,
            border: `1px solid ${accentBorder}`,
            borderRadius: "14px",
            padding: "10px 12px",
            marginBottom: "10px",
          }}
        >
          <h3
            style={{
              margin: 0,
              color: "#2D2A3E",
              fontSize: "16px",
              fontWeight: 700,
            }}
          >
            {title}
          </h3>

          <p
            style={{
              margin: "4px 0 0 0",
              color: "#6D6888",
              fontSize: "12px",
              lineHeight: 1.4,
            }}
          >
            {subtitle}
          </p>
        </div>

        <div>{children}</div>

        <p
          style={{
            margin: "10px 0 0 0",
            color: "#6D6888",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          {footerText}
        </p>
      </div>
    </Link>
  );
}

function CompactEmptyText({ text }: { text: string }) {
  return (
    <p
      style={{
        margin: 0,
        color: "#6D6888",
        fontSize: "13px",
      }}
    >
      {text}
    </p>
  );
}

function OverviewCard({
  label,
  value,
  helper,
  href,
  background,
  border,
}: {
  label: string;
  value: number;
  helper: string;
  href: string;
  background: string;
  border: string;
}) {
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      <div
        style={{
          background,
          border: `1px solid ${border}`,
          borderRadius: "22px",
          padding: "18px",
          boxShadow: "0 8px 18px rgba(45, 42, 62, 0.05)",
          cursor: "pointer",
        }}
      >
        <p
          style={{
            margin: 0,
            color: "#5B5675",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          {label}
        </p>

        <h2
          style={{
            margin: "8px 0 0 0",
            color: "#2D2A3E",
            fontSize: "30px",
            fontWeight: 700,
          }}
        >
          {value}
        </h2>

        <p
          style={{
            margin: "8px 0 0 0",
            color: "#6D6888",
            fontSize: "13px",
            lineHeight: 1.5,
          }}
        >
          {helper}
        </p>
      </div>
    </Link>
  );
}

const compactMiniCard = {
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: "12px",
  padding: "10px",
};

const compactMiniTitle = {
  display: "block",
  color: "#2D2A3E",
  fontSize: "13px",
  fontWeight: 600,
};

const compactMiniText = {
  margin: "4px 0 0 0",
  color: "#5B5675",
  fontSize: "12px",
  lineHeight: 1.4,
};

const compactMiniMeta = {
  margin: "4px 0 0 0",
  color: "#8A84A3",
  fontSize: "11px",
};

const compactSectionLabel = {
  margin: "2px 0 0 0",
  color: "#6D6888",
  fontSize: "12px",
  fontWeight: 600,
};