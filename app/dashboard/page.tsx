"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";
import LearnerSupportWidget from "../components/LearnerSupportWidget";

type School = {
  id: number;
  school_name: string;
  logo_url?: string | null;
};

type DashboardStats = {
  learners: number;
  teachers: number;
  classrooms: number;
  events: number;
  summaries: number;
  incidentReports: number;
};

type EventItem = {
  id: number;
  title?: string | null;
  event_date?: string | null;
};

type LearnerItem = {
  id: number;
  name?: string | null;
  date_of_birth?: string | null;
};

type AttendanceItem = {
  id: number;
  learner_name?: string | null;
  status?: string | null;
  attendance_date?: string | null;
};

type TeacherAttendanceItem = {
  id: string;
  teacher_id?: string | null;
  teacher_name?: string | null;
  status?: string | null;
  attendance_date?: string | null;
};

type PaymentItem = {
  id: number;
  learner_name?: string | null;
  payment_month?: number | null;
  payment_year?: number | null;
  status?: string | null;
};

type ActivityItem = {
  id: number;
  activity_date?: string | null;
  classroom?: string | null;
  subject?: string | null;
  activity_note?: string | null;
};

type UpcomingBirthdayItem = {
  id: number;
  name?: string | null;
  date_of_birth?: string | null;
  nextBirthdayLabel: string;
  daysUntil: number;
};

type ConsolidatedOverview = {
  presentToday: number;
  absentToday: number;
  teachersPresentToday: number;
  teachersAbsentToday: number;
  paymentsThisMonth: number;
  unpaidThisMonth: number;
};

export default function PrincipalDashboardPage() {
  const router = useRouter();

  const [school, setSchool] = useState<School | null>(null);
  const [schoolId, setSchoolId] = useState<number | null>(null);

  const [stats, setStats] = useState<DashboardStats>({
    learners: 0,
    teachers: 0,
    classrooms: 0,
    events: 0,
    summaries: 0,
    incidentReports: 0,
  });

  const [todayEvents, setTodayEvents] = useState<EventItem[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<EventItem[]>([]);
  const [birthdaysToday, setBirthdaysToday] = useState<LearnerItem[]>([]);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<
    UpcomingBirthdayItem[]
  >([]);
  const [todayActivities, setTodayActivities] = useState<ActivityItem[]>([]);

  const [consolidated, setConsolidated] = useState<ConsolidatedOverview>({
    presentToday: 0,
    absentToday: 0,
    teachersPresentToday: 0,
    teachersAbsentToday: 0,
    paymentsThisMonth: 0,
    unpaidThisMonth: 0,
  });

  const [dailyHighlightsOpen, setDailyHighlightsOpen] = useState(true);
  const [schoolRecordsOpen, setSchoolRecordsOpen] = useState(true);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    const { profile, error } = await getCurrentProfile();

    if (error || !profile) {
      router.push("/login");
      return;
    }

    if (profile.role === "master") {
      router.push("/master?view=manage-schools");
      return;
    }

    if (profile.role === "teacher") {
      router.push("/teacher");
      return;
    }

    if (!profile.school_id) {
      router.push("/login");
      return;
    }

    const currentSchoolId = Number(profile.school_id);
    setSchoolId(currentSchoolId);

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

    await Promise.all([
      fetchStats(currentSchoolId),
      fetchTopRowContent(currentSchoolId),
      fetchConsolidatedOverview(currentSchoolId),
    ]);

    setLoading(false);
  }

  async function fetchStats(currentSchoolId: number) {
    const today = new Date();
    const currentYear = today.getFullYear();
    const yearStart = `${currentYear}-01-01`;
    const yearEnd = `${currentYear}-12-31`;

    const [
      learnersResult,
      teachersResponse,
      classroomsResult,
      eventsResult,
      summariesResult,
      incidentReportsResult,
    ] = await Promise.all([
      supabase
        .from("learners")
        .select("*", { count: "exact", head: true })
        .eq("school_id", currentSchoolId)
        .or("is_deleted.is.null,is_deleted.eq.false"),

      fetch("/api/list-teachers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          school_id: currentSchoolId,
        }),
      }),

      supabase
        .from("classrooms")
        .select("*", { count: "exact", head: true })
        .eq("school_id", currentSchoolId),

      supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("school_id", currentSchoolId)
        .gte("event_date", yearStart)
        .lte("event_date", yearEnd),

      supabase
        .from("summaries")
        .select("*", { count: "exact", head: true })
        .eq("school_id", currentSchoolId)
        .gte("created_at", `${yearStart} 00:00:00`)
        .lte("created_at", `${yearEnd} 23:59:59`),

      supabase
        .from("incident_reports")
        .select("*", { count: "exact", head: true })
        .eq("school_id", currentSchoolId)
        .gte("incident_date", yearStart)
        .lte("incident_date", yearEnd),
    ]);

    const teachersPayload = teachersResponse.ok
      ? await teachersResponse.json()
      : { teachers: [] };

    setStats({
      learners: learnersResult.count || 0,
      teachers: teachersPayload.teachers?.length || 0,
      classrooms: classroomsResult.count || 0,
      events: eventsResult.count || 0,
      summaries: summariesResult.count || 0,
      incidentReports: incidentReportsResult.count || 0,
    });
  }

  async function fetchTopRowContent(currentSchoolId: number) {
    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();
    const yyyy = today.getFullYear();
    const mm = String(todayMonth).padStart(2, "0");
    const dd = String(todayDay).padStart(2, "0");
    const todayDate = `${yyyy}-${mm}-${dd}`;

    const [eventsRes, learnersRes, activitiesRes] = await Promise.all([
      supabase
        .from("events")
        .select("id, title, event_date")
        .eq("school_id", currentSchoolId)
        .gte("event_date", todayDate)
        .order("event_date", { ascending: true })
        .order("title", { ascending: true }),

      supabase
        .from("learners")
        .select("id, name, date_of_birth")
        .eq("school_id", currentSchoolId)
        .or("is_deleted.is.null,is_deleted.eq.false")
        .order("name", { ascending: true }),

      supabase
        .from("activities")
        .select("id, activity_date, classroom, subject, activity_note")
        .eq("school_id", currentSchoolId)
        .eq("activity_date", todayDate)
        .order("created_at", { ascending: false }),
    ]);

    const allEvents = (eventsRes.data || []) as EventItem[];
    const allLearners = (learnersRes.data || []) as LearnerItem[];
    const allTodayActivities = (activitiesRes.data || []) as ActivityItem[];

    const todaysEvents = allEvents.filter(
      (event) => String(event.event_date || "") === todayDate
    );

    const nextUpcomingEvents = allEvents
      .filter((event) => String(event.event_date || "") > todayDate)
      .slice(0, 2);

    const todaysBirthdays = allLearners.filter((learner) => {
      if (!learner.date_of_birth) return false;
      const dob = new Date(learner.date_of_birth);
      return dob.getMonth() + 1 === todayMonth && dob.getDate() === todayDay;
    });

    const computedUpcomingBirthdays: UpcomingBirthdayItem[] = allLearners
      .filter((learner) => Boolean(learner.date_of_birth))
      .map((learner) => {
        const dob = new Date(String(learner.date_of_birth));
        const birthdayThisYear = new Date(
          today.getFullYear(),
          dob.getMonth(),
          dob.getDate()
        );

        let nextBirthday = birthdayThisYear;

        if (
          birthdayThisYear <
          new Date(today.getFullYear(), today.getMonth(), today.getDate())
        ) {
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
          ).getTime() -
          new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate()
          ).getTime();

        const daysUntil = Math.round(diffMs / (1000 * 60 * 60 * 24));

        return {
          id: learner.id,
          name: learner.name,
          date_of_birth: learner.date_of_birth,
          nextBirthdayLabel: nextBirthday.toLocaleDateString(),
          daysUntil,
        };
      })
      .filter((item) => item.daysUntil > 0)
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 2);

    setTodayEvents(todaysEvents);
    setUpcomingEvents(nextUpcomingEvents);
    setBirthdaysToday(todaysBirthdays);
    setUpcomingBirthdays(computedUpcomingBirthdays);
    setTodayActivities(allTodayActivities.slice(0, 2));
  }

  async function fetchConsolidatedOverview(currentSchoolId: number) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const todayDate = `${yyyy}-${mm}-${dd}`;
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    const [learnersRes, attendanceRes, teacherAttendanceRes, paymentsRes] =
      await Promise.all([
        supabase
          .from("learners")
          .select("id, name, date_of_birth")
          .eq("school_id", currentSchoolId)
          .or("is_deleted.is.null,is_deleted.eq.false"),

        supabase
          .from("attendance")
          .select("id, learner_name, status, attendance_date")
          .eq("school_id", currentSchoolId)
          .eq("attendance_date", todayDate),

        supabase
          .from("teacher_attendance")
          .select("id, teacher_id, teacher_name, status, attendance_date")
          .eq("school_id", currentSchoolId)
          .eq("attendance_date", todayDate),

        supabase
          .from("payments")
          .select("id, learner_name, payment_month, payment_year, status")
          .eq("school_id", currentSchoolId)
          .eq("payment_month", currentMonth)
          .eq("payment_year", currentYear),
      ]);

    const learners = (learnersRes.data || []) as LearnerItem[];
    const attendance = (attendanceRes.data || []) as AttendanceItem[];
    const teacherAttendance =
      (teacherAttendanceRes.data || []) as TeacherAttendanceItem[];
    const payments = (paymentsRes.data || []) as PaymentItem[];

    const learnerNames = learners
      .map((learner) => String(learner.name || "").trim().toLowerCase())
      .filter(Boolean);

    const presentToday = attendance.filter(
      (item) => String(item.status || "").toLowerCase() === "present"
    ).length;

    const absentToday = attendance.filter(
      (item) => String(item.status || "").toLowerCase() === "absent"
    ).length;

    const teachersPresentToday = teacherAttendance.filter(
      (item) => String(item.status || "").toLowerCase() === "present"
    ).length;

    const teachersAbsentToday = teacherAttendance.filter(
      (item) => String(item.status || "").toLowerCase() === "absent"
    ).length;

    const paidLearners = new Set(
      payments
        .filter((item) => String(item.status || "").toLowerCase() === "paid")
        .map((item) => String(item.learner_name || "").trim().toLowerCase())
        .filter(Boolean)
    );

    setConsolidated({
      presentToday,
      absentToday,
      teachersPresentToday,
      teachersAbsentToday,
      paymentsThisMonth: payments.filter(
        (item) => String(item.status || "").toLowerCase() === "paid"
      ).length,
      unpaidThisMonth: Math.max(learnerNames.length - paidLearners.size, 0),
    });
  }

  if (loading) {
    return <p>Loading dashboard...</p>;
  }

  if (!school || !schoolId) {
    return <p>School not found.</p>;
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
          borderRadius: "24px",
          padding: "18px",
          marginBottom: "16px",
          boxShadow: "0 8px 18px rgba(45, 42, 62, 0.05)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            flexWrap: "wrap",
          }}
        >
          {school.logo_url ? (
            <img
              src={school.logo_url}
              alt={`${school.school_name} logo`}
              style={{
                width: "68px",
                height: "68px",
                objectFit: "cover",
                borderRadius: "18px",
                border: "1px solid #F0E3D8",
                background: "#FFFFFF",
              }}
            />
          ) : (
            <div
              style={{
                width: "68px",
                height: "68px",
                borderRadius: "18px",
                border: "1px solid #F0E3D8",
                background: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#8A84A3",
                fontWeight: 700,
                fontSize: "24px",
              }}
            >
              {school.school_name?.charAt(0)?.toUpperCase() || "S"}
            </div>
          )}

          <div>
            <p style={eyebrowText}>Principal Dashboard</p>

            <h1
              style={{
                margin: "6px 0 0 0",
                fontSize: "28px",
                fontWeight: 700,
                color: "#2D2A3E",
              }}
            >
              {school.school_name}
            </h1>

            <p
              style={{
                marginTop: "8px",
                marginBottom: 0,
                color: "#5B5675",
                fontSize: "14px",
                lineHeight: 1.5,
              }}
            >
              Daily operations, attendance, events, activities and school records
              in one clean view.
            </p>
          </div>
        </div>
      </div>

      <div
        id="today-activities"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "10px",
          marginBottom: "16px",
          scrollMarginTop: "110px",
        }}
      >
        <CompactHighlightCard
          title="Today’s Events"
          subtitle="Today and what’s next"
          href="/events?filter=today"
          accentBackground="#FFF7D9"
          accentBorder="#F3E4A3"
          footerText="Open events"
        >
          <div style={{ display: "grid", gap: "7px" }}>
            {todayEvents.length > 0 ? (
              todayEvents.slice(0, 2).map((event) => (
                <div key={`today-${event.id}`} style={compactMiniCard}>
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
                  <div key={`upcoming-${event.id}`} style={compactMiniCard}>
                    <strong style={compactMiniTitle}>
                      {event.title || "Untitled event"}
                    </strong>
                    <p style={compactMiniMeta}>{event.event_date || "No date"}</p>
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
          <div style={{ display: "grid", gap: "7px" }}>
            {birthdaysToday.length > 0 ? (
              birthdaysToday.slice(0, 2).map((learner) => (
                <div key={`today-birthday-${learner.id}`} style={compactMiniCard}>
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
                    <p style={compactMiniMeta}>{learner.nextBirthdayLabel}</p>
                  </div>
                ))}
              </>
            ) : null}
          </div>
        </CompactHighlightCard>

        <CompactHighlightCard
          title="Today’s Activities"
          subtitle="Planned for today"
          href="/activities"
          accentBackground="#EAF7FD"
          accentBorder="#CBEAF7"
          footerText="Open activities"
        >
          <div style={{ display: "grid", gap: "7px" }}>
            {todayActivities.length > 0 ? (
              todayActivities.map((activity) => (
                <div key={activity.id} style={compactMiniCard}>
                  <strong style={compactMiniTitle}>
                    {activity.subject || "No subject"}
                  </strong>
                  <p style={compactMiniText}>
                    {activity.classroom || "No class"}:{" "}
                    {activity.activity_note || "No activity note"}
                  </p>
                </div>
              ))
            ) : (
              <CompactEmptyText text="No activities planned for today." />
            )}
          </div>
        </CompactHighlightCard>
      </div>

      <CollapsibleSection
        title="Daily Highlights"
        description="Operational and payment indicators for today and this month."
        isOpen={dailyHighlightsOpen}
        onToggle={() => setDailyHighlightsOpen((current) => !current)}
      >
        <div style={compactGrid}>
          <OverviewCard
            label="Present Today"
            value={consolidated.presentToday}
            helper="Learners marked present"
            background="#EAF7FD"
            border="#CBEAF7"
          />

          <OverviewCard
            label="Absent Today"
            value={consolidated.absentToday}
            helper="Learners marked absent"
            background="#F8E8F0"
            border="#EBC9D8"
          />

          <OverviewCard
            label="Teachers Present Today"
            value={consolidated.teachersPresentToday}
            helper="Staff marked present"
            background="#EEF9EE"
            border="#D3EDD4"
          />

          <OverviewCard
            label="Teachers Absent Today"
            value={consolidated.teachersAbsentToday}
            helper="Staff marked absent"
            background="#FFF7D9"
            border="#F3E4A3"
          />

          <OverviewCard
            label="Payments This Month"
            value={consolidated.paymentsThisMonth}
            helper="Paid records this month"
            background="#EEF9EE"
            border="#D3EDD4"
          />

          <OverviewCard
            label="Unpaid This Month"
            value={consolidated.unpaidThisMonth}
            helper="Learners still unpaid"
            background="#EAF7FD"
            border="#CBEAF7"
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="School Records"
        description="Full records saved for the current school year."
        isOpen={schoolRecordsOpen}
        onToggle={() => setSchoolRecordsOpen((current) => !current)}
      >
        <div style={compactGrid}>
          <StatLinkCard
            label="Learners"
            value={stats.learners}
            href="/children"
            background="#EAF7FD"
            border="#CBEAF7"
          />

          <StatLinkCard
            label="Teachers"
            value={stats.teachers}
            href="/teachers"
            background="#EEF9EE"
            border="#D3EDD4"
          />

          <StatLinkCard
            label="Classrooms"
            value={stats.classrooms}
            href="/classrooms"
            background="#F8E8F0"
            border="#EBC9D8"
          />

          <StatLinkCard
            label="Events"
            value={stats.events}
            href="/events"
            background="#FFF7D9"
            border="#F3E4A3"
          />

          <StatLinkCard
            label="Incident Reports"
            value={stats.incidentReports}
            href="/incident-reports"
            background="#F8E8F0"
            border="#EBC9D8"
          />
        </div>
      </CollapsibleSection>
    </div>
  );
}

function CollapsibleSection({
  title,
  description,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  description: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #F0E3D8",
        borderRadius: "20px",
        padding: "16px",
        boxShadow: "0 6px 16px rgba(45, 42, 62, 0.04)",
        marginBottom: "16px",
      }}
    >
      <button type="button" onClick={onToggle} style={sectionButton}>
        <div>
          <h3
            style={{
              marginTop: 0,
              marginBottom: "6px",
              color: "#2D2A3E",
              fontSize: "19px",
              fontWeight: 700,
            }}
          >
            {title}
          </h3>

          <p
            style={{
              marginTop: 0,
              marginBottom: 0,
              color: "#6D6888",
              fontSize: "13px",
              lineHeight: 1.5,
            }}
          >
            {description}
          </p>
        </div>

        <span style={togglePill}>{isOpen ? "Hide" : "Open"}</span>
      </button>

      {isOpen && <div style={{ marginTop: "12px" }}>{children}</div>}
    </div>
  );
}

function OverviewCard({
  label,
  value,
  helper,
  background,
  border,
}: {
  label: string;
  value: number;
  helper: string;
  background: string;
  border: string;
}) {
  return (
    <div style={smallCard(background, border)}>
      <p style={cardLabel}>{label}</p>
      <h2 style={cardValue}>{value}</h2>
      <p style={cardHelper}>{helper}</p>
    </div>
  );
}

function StatLinkCard({
  label,
  value,
  href,
  background,
  border,
}: {
  label: string;
  value: number;
  href: string;
  background: string;
  border: string;
}) {
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      <div style={smallCard(background, border)}>
        <p style={cardLabel}>{label}</p>
        <h2 style={cardValue}>{value}</h2>
        <p style={cardHelper}>Open {label.toLowerCase()}</p>
      </div>
    </Link>
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
          borderRadius: "20px",
          padding: "12px",
          boxShadow: "0 6px 16px rgba(45, 42, 62, 0.04)",
          cursor: "pointer",
          minHeight: "170px",
          height: "100%",
        }}
      >
        <div
          style={{
            background: accentBackground,
            border: `1px solid ${accentBorder}`,
            borderRadius: "14px",
            padding: "9px 11px",
            marginBottom: "9px",
          }}
        >
          <h3
            style={{
              margin: 0,
              color: "#2D2A3E",
              fontSize: "15px",
              fontWeight: 700,
            }}
          >
            {title}
          </h3>

          <p
            style={{
              margin: "3px 0 0 0",
              color: "#6D6888",
              fontSize: "12px",
              lineHeight: 1.35,
            }}
          >
            {subtitle}
          </p>
        </div>

        <div>{children}</div>

        <p
          style={{
            margin: "9px 0 0 0",
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
  return <p style={compactEmptyText}>{text}</p>;
}

const compactGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: "10px",
};

const eyebrowText = {
  margin: 0,
  color: "#6D6888",
  fontSize: "13px",
  fontWeight: 600,
};

const sectionButton = {
  width: "100%",
  background: "transparent",
  border: "none",
  padding: 0,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  cursor: "pointer",
  textAlign: "left" as const,
};

const togglePill = {
  background: "#FFF7D9",
  border: "1px solid #F3E4A3",
  borderRadius: "999px",
  padding: "7px 11px",
  color: "#2D2A3E",
  fontSize: "12px",
  fontWeight: 700,
  whiteSpace: "nowrap" as const,
};

function smallCard(background: string, border: string) {
  return {
    background,
    border: `1px solid ${border}`,
    borderRadius: "18px",
    padding: "14px",
    boxShadow: "0 6px 14px rgba(45, 42, 62, 0.04)",
    cursor: "pointer",
    minHeight: "105px",
  };
}

const cardLabel = {
  margin: 0,
  color: "#5B5675",
  fontSize: "13px",
  fontWeight: 700,
};

const cardValue = {
  margin: "6px 0 0 0",
  color: "#2D2A3E",
  fontSize: "26px",
  fontWeight: 800,
};

const cardHelper = {
  margin: "6px 0 0 0",
  color: "#6D6888",
  fontSize: "12px",
  lineHeight: 1.4,
};

const compactMiniCard = {
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: "12px",
  padding: "9px",
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

const compactEmptyText = {
  margin: 0,
  color: "#6D6888",
  fontSize: "13px",
};
