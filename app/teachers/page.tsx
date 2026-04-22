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
  date_of_birth?: string | null;
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

type TeacherOverview = {
  learnersCount: number;
  eventsToday: number;
  birthdaysToday: number;
  activitiesToday: number;
};

export default function TeacherDashboardPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [school, setSchool] = useState<School | null>(null);

  const [todayEvents, setTodayEvents] = useState<EventItem[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<EventItem[]>([]);
  const [birthdaysToday, setBirthdaysToday] = useState<LearnerItem[]>([]);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<UpcomingBirthdayItem[]>([]);
  const [todayActivities, setTodayActivities] = useState<ActivityItem[]>([]);

  const [overview, setOverview] = useState<TeacherOverview>({
    learnersCount: 0,
    eventsToday: 0,
    birthdaysToday: 0,
    activitiesToday: 0,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTeacherDashboard();
  }, []);

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

    await fetchTeacherView(currentSchoolId, currentProfile.classroom_name || null);

    setLoading(false);
  }

  async function fetchTeacherView(schoolId: number, classroomName: string | null) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const todayDate = `${yyyy}-${mm}-${dd}`;
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();

    const learnersRes = classroomName
      ? await supabase
          .from("learners")
          .select("id, name, class, date_of_birth")
          .eq("school_id", schoolId)
          .eq("class", classroomName)
          .order("name", { ascending: true })
      : await supabase
          .from("learners")
          .select("id, name, class, date_of_birth")
          .eq("school_id", schoolId)
          .order("name", { ascending: true });

    const eventsRes = await supabase
      .from("events")
      .select("id, title, event_date")
      .eq("school_id", schoolId)
      .gte("event_date", todayDate)
      .order("event_date", { ascending: true })
      .order("title", { ascending: true });

    const activitiesRes = classroomName
      ? await supabase
          .from("activities")
          .select("id, activity_date, classroom, subject, activity_note")
          .eq("school_id", schoolId)
          .eq("activity_date", todayDate)
          .eq("classroom", classroomName)
          .order("created_at", { ascending: false })
      : await supabase
          .from("activities")
          .select("id, activity_date, classroom, subject, activity_note")
          .eq("school_id", schoolId)
          .eq("activity_date", todayDate)
          .order("created_at", { ascending: false });

    const learners = (learnersRes.data || []) as LearnerItem[];
    const allEvents = (eventsRes.data || []) as EventItem[];
    const activities = (activitiesRes.data || []) as ActivityItem[];

    const todaysEvents = allEvents.filter(
      (event) => String(event.event_date || "") === todayDate
    );

    const nextUpcomingEvents = allEvents
      .filter((event) => String(event.event_date || "") > todayDate)
      .slice(0, 2);

    const birthdays = learners.filter((learner) => {
      if (!learner.date_of_birth) return false;
      const dob = new Date(learner.date_of_birth);
      return dob.getMonth() + 1 === todayMonth && dob.getDate() === todayDay;
    });

    const computedUpcomingBirthdays: UpcomingBirthdayItem[] = learners
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
    setBirthdaysToday(birthdays);
    setUpcomingBirthdays(computedUpcomingBirthdays);
    setTodayActivities(activities.slice(0, 2));

    setOverview({
      learnersCount: learners.length,
      eventsToday: todaysEvents.length,
      birthdaysToday: birthdays.length,
      activitiesToday: activities.length,
    });
  }

  if (loading) {
    return <p>Loading teacher dashboard...</p>;
  }

  if (!profile || !school) {
    return <p>Teacher dashboard unavailable.</p>;
  }

  const classroomLabel = profile.classroom_name || "Assigned school";

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
          href="/events"
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
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "14px",
          marginBottom: "24px",
        }}
      >
        <OverviewCard
          label="Learners"
          value={overview.learnersCount}
          helper="My class or school scope"
          background="#EAF7FD"
          border="#CBEAF7"
        />
        <OverviewCard
          label="Events Today"
          value={overview.eventsToday}
          helper="Scheduled for today"
          background="#FFF7D9"
          border="#F3E4A3"
        />
        <OverviewCard
          label="Birthdays Today"
          value={overview.birthdaysToday}
          helper="Today’s celebrations"
          background="#F8E8F0"
          border="#EBC9D8"
        />
        <OverviewCard
          label="Activities Today"
          value={overview.activitiesToday}
          helper="Planned learning activities"
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "14px",
          }}
        >
          <QuickActionCard
            title="Take Attendance"
            description="Open attendance for daily marking."
            href="/attendance"
            background="#EAF7FD"
            border="#CBEAF7"
          />
          <QuickActionCard
            title="Write Summary"
            description="Open summaries ready to save."
            href="/summaries?action=add"
            background="#F8E8F0"
            border="#EBC9D8"
          />
          <QuickActionCard
            title="View Learners"
            description="Open learners list."
            href="/children"
            background="#FFF7D9"
            border="#F3E4A3"
          />
          <QuickActionCard
            title="View Activities"
            description="Open planned daily activities."
            href="/activities"
            background="#EEF9EE"
            border="#D3EDD4"
          />
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