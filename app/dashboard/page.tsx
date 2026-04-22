"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";

type School = {
  id: number;
  school_name: string;
  primary_color?: string | null;
  secondary_color?: string | null;
  logo_url?: string | null;
};

type DashboardStats = {
  learners: number;
  teachers: number;
  classrooms: number;
  events: number;
  summaries: number;
  payments: number;
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
  summariesToday: number;
  missingSummariesToday: number;
  eventsToday: number;
  birthdaysToday: number;
  paymentsThisMonth: number;
  unpaidThisMonth: number;
  flaggedIncidentsToday: number;
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
    payments: 0,
  });

  const [todayEvents, setTodayEvents] = useState<EventItem[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<EventItem[]>([]);
  const [birthdaysToday, setBirthdaysToday] = useState<LearnerItem[]>([]);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<UpcomingBirthdayItem[]>([]);
  const [todayActivities, setTodayActivities] = useState<ActivityItem[]>([]);

  const [consolidated, setConsolidated] = useState<ConsolidatedOverview>({
    presentToday: 0,
    absentToday: 0,
    summariesToday: 0,
    missingSummariesToday: 0,
    eventsToday: 0,
    birthdaysToday: 0,
    paymentsThisMonth: 0,
    unpaidThisMonth: 0,
    flaggedIncidentsToday: 0,
  });

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
      .select("*")
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
    const [
      learnersResult,
      teachersResult,
      classroomsResult,
      eventsResult,
      summariesResult,
      paymentsResult,
    ] = await Promise.all([
      supabase
        .from("learners")
        .select("*", { count: "exact", head: true })
        .eq("school_id", currentSchoolId),

      supabase
        .from("teachers")
        .select("*", { count: "exact", head: true })
        .eq("school_id", currentSchoolId),

      supabase
        .from("classrooms")
        .select("*", { count: "exact", head: true })
        .eq("school_id", currentSchoolId),

      supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("school_id", currentSchoolId),

      supabase
        .from("summaries")
        .select("*", { count: "exact", head: true })
        .eq("school_id", currentSchoolId),

      supabase
        .from("payments")
        .select("*", { count: "exact", head: true })
        .eq("school_id", currentSchoolId),
    ]);

    setStats({
      learners: learnersResult.count || 0,
      teachers: teachersResult.count || 0,
      classrooms: classroomsResult.count || 0,
      events: eventsResult.count || 0,
      summaries: summariesResult.count || 0,
      payments: paymentsResult.count || 0,
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
        const birthdayThisYear = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());

        let nextBirthday = birthdayThisYear;
        if (birthdayThisYear < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
          nextBirthday = new Date(today.getFullYear() + 1, dob.getMonth(), dob.getDate());
        }

        const diffMs =
          new Date(nextBirthday.getFullYear(), nextBirthday.getMonth(), nextBirthday.getDate()).getTime() -
          new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

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

    const [learnersRes, attendanceRes, summariesRes, eventsRes, paymentsRes] =
      await Promise.all([
        supabase
          .from("learners")
          .select("id, name, date_of_birth")
          .eq("school_id", currentSchoolId),

        supabase
          .from("attendance")
          .select("id, learner_name, status, attendance_date")
          .eq("school_id", currentSchoolId)
          .eq("attendance_date", todayDate),

        supabase
          .from("summaries")
          .select("id, learner_name, created_at, health_safety")
          .eq("school_id", currentSchoolId)
          .gte("created_at", `${todayDate} 00:00:00`)
          .lt("created_at", `${todayDate} 23:59:59`),

        supabase
          .from("events")
          .select("id, event_date")
          .eq("school_id", currentSchoolId)
          .eq("event_date", todayDate),

        supabase
          .from("payments")
          .select("id, learner_name, payment_month, payment_year, status")
          .eq("school_id", currentSchoolId)
          .eq("payment_month", currentMonth)
          .eq("payment_year", currentYear),
      ]);

    const learners = (learnersRes.data || []) as LearnerItem[];
    const attendance = (attendanceRes.data || []) as AttendanceItem[];
    const summaries = (summariesRes.data || []) as any[];
    const events = (eventsRes.data || []) as EventItem[];
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

    const summaryLearners = new Set(
      summaries
        .map((item) => String(item.learner_name || "").trim().toLowerCase())
        .filter(Boolean)
    );

    const paidLearners = new Set(
      payments
        .filter((item) => String(item.status || "").toLowerCase() === "paid")
        .map((item) => String(item.learner_name || "").trim().toLowerCase())
        .filter(Boolean)
    );

    const birthdaysTodayCount = learners.filter((learner) => {
      if (!learner.date_of_birth) return false;
      const dob = new Date(learner.date_of_birth);
      return dob.getMonth() + 1 === today.getMonth() + 1 && dob.getDate() === today.getDate();
    }).length;

    const flaggedIncidentsToday = summaries.filter((item) => {
      const value = String(item.health_safety || "").trim().toLowerCase();
      return value && value !== "no incident";
    }).length;

    setConsolidated({
      presentToday,
      absentToday,
      summariesToday: summaries.length,
      missingSummariesToday: Math.max(learnerNames.length - summaryLearners.size, 0),
      eventsToday: events.length,
      birthdaysToday: birthdaysTodayCount,
      paymentsThisMonth: payments.filter(
        (item) => String(item.status || "").toLowerCase() === "paid"
      ).length,
      unpaidThisMonth: Math.max(learnerNames.length - paidLearners.size, 0),
      flaggedIncidentsToday,
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
          borderRadius: "28px",
          padding: "24px",
          marginBottom: "20px",
          boxShadow: "0 10px 24px rgba(45, 42, 62, 0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          {school.logo_url ? (
            <img
              src={school.logo_url}
              alt={`${school.school_name} logo`}
              style={{
                width: "84px",
                height: "84px",
                objectFit: "cover",
                borderRadius: "20px",
                border: "1px solid #F0E3D8",
                background: "#FFFFFF",
                boxShadow: "0 8px 18px rgba(45, 42, 62, 0.06)",
              }}
            />
          ) : (
            <div
              style={{
                width: "84px",
                height: "84px",
                borderRadius: "20px",
                border: "1px solid #F0E3D8",
                background: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#8A84A3",
                fontWeight: 700,
                fontSize: "28px",
                boxShadow: "0 8px 18px rgba(45, 42, 62, 0.06)",
              }}
            >
              {school.school_name?.charAt(0)?.toUpperCase() || "S"}
            </div>
          )}

          <div>
            <p
              style={{
                margin: 0,
                color: "#6D6888",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              Principal Dashboard
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
              Run the school day smoothly, keep track of classes and teachers, and stay on top of daily activity.
            </p>
          </div>
        </div>
      </div>

      <div
        id="today-activities"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "12px",
          marginBottom: "20px",
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
          <div style={{ display: "grid", gap: "8px" }}>
            {todayEvents.length > 0 ? (
              todayEvents.slice(0, 2).map((event) => (
                <div key={`today-${event.id}`} style={compactMiniCard}>
                  <strong style={compactMiniTitle}>{event.title || "Untitled event"}</strong>
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
                    <strong style={compactMiniTitle}>{event.title || "Untitled event"}</strong>
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
          <div style={{ display: "grid", gap: "8px" }}>
            {birthdaysToday.length > 0 ? (
              birthdaysToday.slice(0, 2).map((learner) => (
                <div key={`today-birthday-${learner.id}`} style={compactMiniCard}>
                  <strong style={compactMiniTitle}>{learner.name || "Unnamed learner"}</strong>
                </div>
              ))
            ) : (
              <CompactEmptyText text="No birthdays today." />
            )}

            {upcomingBirthdays.length > 0 ? (
              <>
                <p style={compactSectionLabel}>Upcoming Birthdays</p>
                {upcomingBirthdays.map((learner) => (
                  <div key={`upcoming-birthday-${learner.id}`} style={compactMiniCard}>
                    <strong style={compactMiniTitle}>{learner.name || "Unnamed learner"}</strong>
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
          <div style={{ display: "grid", gap: "8px" }}>
            {todayActivities.length > 0 ? (
              todayActivities.map((activity) => (
                <div key={activity.id} style={compactMiniCard}>
                  <strong style={compactMiniTitle}>{activity.subject || "No subject"}</strong>
                  <p style={compactMiniText}>
                    {activity.classroom || "No class"}: {activity.activity_note || "No activity note"}
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
          marginBottom: "24px",
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
          Consolidated School Overview
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
          A whole-school view for today and this month, so you can monitor operations without going into each class.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "14px",
          }}
        >
          <OverviewCard
            label="Present Today"
            value={consolidated.presentToday}
            helper="Whole school attendance"
            background="#EAF7FD"
            border="#CBEAF7"
          />
          <OverviewCard
            label="Absent Today"
            value={consolidated.absentToday}
            helper="Whole school attendance"
            background="#F8E8F0"
            border="#EBC9D8"
          />
          <OverviewCard
            label="Summaries Today"
            value={consolidated.summariesToday}
            helper="Learners with saved summaries"
            background="#EEF9EE"
            border="#D3EDD4"
          />
          <OverviewCard
            label="Missing Summaries"
            value={consolidated.missingSummariesToday}
            helper="Learners still needing summaries"
            background="#FFF7D9"
            border="#F3E4A3"
          />
          <OverviewCard
            label="Events Today"
            value={consolidated.eventsToday}
            helper="School-wide events today"
            background="#FFF7D9"
            border="#F3E4A3"
          />
          <OverviewCard
            label="Birthdays Today"
            value={consolidated.birthdaysToday}
            helper="School-wide birthdays today"
            background="#F8E8F0"
            border="#EBC9D8"
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
          <OverviewCard
            label="Health & Safety Flags"
            value={consolidated.flaggedIncidentsToday}
            helper="Non-routine incidents today"
            background="#F8E8F0"
            border="#EBC9D8"
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "14px",
          marginBottom: "24px",
        }}
      >
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
          label="Summaries"
          value={stats.summaries}
          href="/summaries"
          background="#EAF7FD"
          border="#CBEAF7"
        />
        <StatLinkCard
          label="Payments"
          value={stats.payments}
          href="/payments"
          background="#EEF9EE"
          border="#D3EDD4"
        />
      </div>

      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #F0E3D8",
          borderRadius: "24px",
          padding: "20px",
          boxShadow: "0 8px 20px rgba(45, 42, 62, 0.05)",
          marginBottom: "24px",
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
          Quick Actions
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
          Jump straight into the main workflows for this school.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "14px",
          }}
        >
          <QuickActionCard
            title="Add Learner"
            description="Open learners with the add form ready."
            href="/children?action=add&returnTo=dashboard"
            background="#EAF7FD"
            border="#CBEAF7"
          />

          <QuickActionCard
            title="Add Event"
            description="Open events with the add form ready."
            href="/events?action=add&returnTo=dashboard"
            background="#FFF7D9"
            border="#F3E4A3"
          />

          <QuickActionCard
            title="Create Broadcast"
            description="Open broadcasts ready to create."
            href="/broadcasts?action=create&returnTo=dashboard"
            background="#F8E8F0"
            border="#EBC9D8"
          />

          <QuickActionCard
            title="Record Payment"
            description="Open payments ready to record."
            href="/payments?action=record&returnTo=dashboard"
            background="#EEF9EE"
            border="#D3EDD4"
          />
        </div>
      </div>

      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #F0E3D8",
          borderRadius: "24px",
          padding: "22px",
          boxShadow: "0 8px 20px rgba(45, 42, 62, 0.05)",
        }}
      >
        <h3
          style={{
            marginTop: 0,
            marginBottom: "8px",
            color: "#2D2A3E",
            fontSize: "24px",
            fontWeight: 700,
          }}
        >
          School Management
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
          Open the areas you need for school operations.
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <Link href="/children" style={primaryButton}>
            Learners
          </Link>

          <Link href="/teachers" style={secondaryButton}>
            Teachers
          </Link>

          <Link href="/classrooms" style={secondaryButton}>
            Classrooms
          </Link>

          <Link href="/events" style={secondaryButton}>
            Events
          </Link>

          <Link href="/attendance" style={secondaryButton}>
            Attendance
          </Link>

          <Link href="/summaries" style={secondaryButton}>
            Daily Summaries
          </Link>

          <Link href="/broadcasts" style={secondaryButton}>
            Broadcasts
          </Link>

          <Link href="/payments" style={secondaryButton}>
            Payments
          </Link>

          <Link href="/activities" style={secondaryButton}>
            Activities
          </Link>
        </div>
      </div>
    </div>
  );
}

function QuickActionCard({
  title,
  description,
  href,
  background,
  border,
}: {
  title: string;
  description: string;
  href: string;
  background: string;
  border: string;
}) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div
        style={{
          background,
          border: `1px solid ${border}`,
          borderRadius: "20px",
          padding: "18px",
          boxShadow: "0 8px 18px rgba(45, 42, 62, 0.05)",
          cursor: "pointer",
          minHeight: "120px",
        }}
      >
        <h4
          style={{
            margin: 0,
            color: "#2D2A3E",
            fontSize: "18px",
            fontWeight: 700,
          }}
        >
          {title}
        </h4>

        <p
          style={{
            margin: "8px 0 0 0",
            color: "#5B5675",
            fontSize: "14px",
            lineHeight: 1.6,
          }}
        >
          {description}
        </p>

        <p
          style={{
            margin: "12px 0 0 0",
            color: "#6D6888",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          Open action
        </p>
      </div>
    </Link>
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
    <div
      style={{
        background,
        border: `1px solid ${border}`,
        borderRadius: "22px",
        padding: "18px",
        boxShadow: "0 8px 18px rgba(45, 42, 62, 0.05)",
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
    <Link
      href={href}
      style={{
        textDecoration: "none",
        color: "inherit",
      }}
    >
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
            fontWeight: 600,
          }}
        >
          Open {label.toLowerCase()}
        </p>
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
    <Link
      href={href}
      style={{
        textDecoration: "none",
        color: "inherit",
      }}
    >
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

const primaryButton = {
  background: "#7CCCF3",
  color: "#2D2A3E",
  textDecoration: "none",
  padding: "12px 16px",
  borderRadius: "12px",
  fontWeight: 600,
  fontSize: "14px",
};

const secondaryButton = {
  background: "#FFF3C4",
  color: "#2D2A3E",
  textDecoration: "none",
  padding: "12px 16px",
  borderRadius: "12px",
  fontWeight: 600,
  fontSize: "14px",
};