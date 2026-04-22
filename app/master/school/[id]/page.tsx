"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { getCurrentProfile } from "../../../lib/auth";

type School = {
  id: number;
  school_name: string;
  primary_color?: string | null;
  secondary_color?: string | null;
  logo_url?: string | null;
};

type SchoolStats = {
  learners: number;
  teachers: number;
  classrooms: number;
  events: number;
  summaries: number;
  payments: number;
};

type SetupItem = {
  label: string;
  complete: boolean;
  href: string;
  helper: string;
};

export default function MasterSchoolOverviewPage() {
  const router = useRouter();
  const params = useParams();

  const [school, setSchool] = useState<School | null>(null);
  const [stats, setStats] = useState<SchoolStats>({
    learners: 0,
    teachers: 0,
    classrooms: 0,
    events: 0,
    summaries: 0,
    payments: 0,
  });
  const [principalCount, setPrincipalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const schoolId = Number(params?.id);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    const { profile, error } = await getCurrentProfile();

    if (error || !profile) {
      router.push("/login");
      return;
    }

    if (profile.role !== "master") {
      router.push("/dashboard");
      return;
    }

    if (!schoolId || Number.isNaN(schoolId)) {
      router.push("/master?view=manage-schools");
      return;
    }

    const { data: schoolData, error: schoolError } = await supabase
      .from("schools")
      .select("*")
      .eq("id", schoolId)
      .single();

    if (schoolError || !schoolData) {
      router.push("/master?view=manage-schools");
      return;
    }

    setSchool(schoolData);
    await Promise.all([fetchSchoolStats(schoolId), fetchPrincipalCount(schoolId)]);
    setLoading(false);
  }

  async function fetchSchoolStats(currentSchoolId: number) {
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

  async function fetchPrincipalCount(currentSchoolId: number) {
    const { count } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("school_id", currentSchoolId)
      .eq("role", "principal");

    setPrincipalCount(count || 0);
  }

  const setupItems = useMemo<SetupItem[]>(() => {
    if (!school) return [];

    return [
      {
        label: "School logo added",
        complete: Boolean(school.logo_url),
        href: "/master?view=manage-schools",
        helper: "Branding helps the school feel ready and identifiable.",
      },
      {
        label: "Primary colour added",
        complete: Boolean(school.primary_color),
        href: "/master?view=manage-schools",
        helper: "Brand colour is part of the school setup.",
      },
      {
        label: "Secondary colour added",
        complete: Boolean(school.secondary_color),
        href: "/master?view=manage-schools",
        helper: "Secondary colour completes the school theme.",
      },
      {
        label: "Principal assigned",
        complete: principalCount > 0,
        href: "/master?view=active-principals",
        helper: "A school should have at least one principal account.",
      },
      {
        label: "Classrooms created",
        complete: stats.classrooms > 0,
        href: `/classrooms?school=${school.id}`,
        helper: "Create at least one classroom to organise learners.",
      },
      {
        label: "Teachers added",
        complete: stats.teachers > 0,
        href: `/teachers?school=${school.id}`,
        helper: "Teachers are needed for daily operations.",
      },
      {
        label: "Learners added",
        complete: stats.learners > 0,
        href: `/children?school=${school.id}`,
        helper: "Add learners before attendance and summaries can begin.",
      },
      {
        label: "First event added",
        complete: stats.events > 0,
        href: `/events?school=${school.id}`,
        helper: "Add at least one event to start the school calendar.",
      },
      {
        label: "First summary submitted",
        complete: stats.summaries > 0,
        href: `/summaries?school=${school.id}`,
        helper: "A submitted summary shows the daily reporting flow is working.",
      },
      {
        label: "First payment recorded",
        complete: stats.payments > 0,
        href: `/payments?school=${school.id}`,
        helper: "A payment record shows finance tracking is active.",
      },
    ];
  }, [school, principalCount, stats]);

  const completedCount = setupItems.filter((item) => item.complete).length;
  const totalCount = setupItems.length;
  const progressPercent = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  if (loading) {
    return <p>Loading school overview...</p>;
  }

  if (!school) {
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
          marginBottom: "24px",
          boxShadow: "0 10px 24px rgba(45, 42, 62, 0.06)",
        }}
      >
        <p
          style={{
            margin: 0,
            color: "#6D6888",
            fontSize: "13px",
            fontWeight: 700,
          }}
        >
          Master / School Overview
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginTop: "14px",
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
                fontWeight: 800,
                fontSize: "28px",
                boxShadow: "0 8px 18px rgba(45, 42, 62, 0.06)",
              }}
            >
              {school.school_name?.charAt(0)?.toUpperCase() || "S"}
            </div>
          )}

          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "34px",
                fontWeight: 800,
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
              Manage this school directly from the master dashboard.
            </p>
          </div>
        </div>
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: "14px",
          }}
        >
          <div>
            <h3
              style={{
                marginTop: 0,
                marginBottom: "8px",
                color: "#2D2A3E",
                fontSize: "22px",
                fontWeight: 800,
              }}
            >
              School Setup Progress
            </h3>

            <p
              style={{
                margin: 0,
                color: "#6D6888",
                fontSize: "14px",
                lineHeight: 1.6,
              }}
            >
              Track whether this school is ready for daily operations.
            </p>
          </div>

          <div
            style={{
              minWidth: "140px",
              background: "#FFF7D9",
              border: "1px solid #F3E4A3",
              borderRadius: "18px",
              padding: "14px 16px",
              textAlign: "center",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                color: "#6D6888",
                fontWeight: 700,
              }}
            >
              Readiness
            </p>
            <h2
              style={{
                margin: "6px 0 0 0",
                fontSize: "28px",
                color: "#2D2A3E",
                fontWeight: 800,
              }}
            >
              {progressPercent}%
            </h2>
          </div>
        </div>

        <div
          style={{
            width: "100%",
            height: "12px",
            background: "#F7EEE7",
            borderRadius: "999px",
            overflow: "hidden",
            marginBottom: "18px",
          }}
        >
          <div
            style={{
              width: `${progressPercent}%`,
              height: "100%",
              background: "#7CCCF3",
              borderRadius: "999px",
            }}
          />
        </div>

        <div style={{ display: "grid", gap: "12px" }}>
          {setupItems.map((item) => (
            <div
              key={item.label}
              style={{
                background: item.complete ? "#EEF9EE" : "#FFFDFB",
                border: item.complete ? "1px solid #D3EDD4" : "1px solid #F0E3D8",
                borderRadius: "18px",
                padding: "16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <strong
                  style={{
                    display: "block",
                    color: "#2D2A3E",
                    fontSize: "16px",
                  }}
                >
                  {item.label}
                </strong>
                <p
                  style={{
                    margin: "6px 0 0 0",
                    color: "#6D6888",
                    fontSize: "13px",
                    lineHeight: 1.5,
                  }}
                >
                  {item.helper}
                </p>
              </div>

              {item.complete ? (
                <span
                  style={{
                    background: "#DFF3E0",
                    color: "#2D2A3E",
                    borderRadius: "999px",
                    padding: "8px 12px",
                    fontSize: "13px",
                    fontWeight: 700,
                    border: "1px solid #CBE8CD",
                  }}
                >
                  Complete
                </span>
              ) : (
                <Link
                  href={item.href}
                  style={{
                    textDecoration: "none",
                    background: "#7CCCF3",
                    color: "#2D2A3E",
                    borderRadius: "12px",
                    padding: "10px 14px",
                    fontSize: "13px",
                    fontWeight: 700,
                  }}
                >
                  Complete Setup
                </Link>
              )}
            </div>
          ))}
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
        <StatCard label="Learners" value={stats.learners} />
        <StatCard label="Teachers" value={stats.teachers} />
        <StatCard label="Classrooms" value={stats.classrooms} />
        <StatCard label="Events" value={stats.events} />
        <StatCard label="Summaries" value={stats.summaries} />
        <StatCard label="Payments" value={stats.payments} />
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
            fontWeight: 800,
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
            title="Add Learner"
            description="Open learners with the add form ready."
            href={`/children?school=${school.id}&action=add&returnTo=school-overview`}
            background="#EAF7FD"
            border="#CBEAF7"
          />

          <QuickActionCard
            title="Add Event"
            description="Open events with the add form ready."
            href={`/events?school=${school.id}&action=add&returnTo=school-overview`}
            background="#FFF7D9"
            border="#F3E4A3"
          />

          <QuickActionCard
            title="Create Broadcast"
            description="Open broadcasts ready to create."
            href={`/broadcasts?school=${school.id}&action=create&returnTo=school-overview`}
            background="#F8E8F0"
            border="#EBC9D8"
          />

          <QuickActionCard
            title="Record Payment"
            description="Open payments ready to record."
            href={`/payments?school=${school.id}&action=record&returnTo=school-overview`}
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
            fontWeight: 800,
          }}
        >
          Manage School
        </h3>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <Link href={`/children?school=${school.id}`} style={primaryButton}>
            Learners
          </Link>

          <Link href={`/teachers?school=${school.id}`} style={secondaryButton}>
            Teachers
          </Link>

          <Link href={`/classrooms?school=${school.id}`} style={secondaryButton}>
            Classrooms
          </Link>

          <Link href={`/events?school=${school.id}`} style={secondaryButton}>
            Events
          </Link>

          <Link href={`/attendance?school=${school.id}`} style={secondaryButton}>
            Attendance
          </Link>

          <Link href={`/summaries?school=${school.id}`} style={secondaryButton}>
            Summaries
          </Link>

          <Link href={`/broadcasts?school=${school.id}`} style={secondaryButton}>
            Broadcasts
          </Link>

          <Link href={`/payments?school=${school.id}`} style={secondaryButton}>
            Payments
          </Link>

          <Link href="/master?view=manage-schools" style={backButton}>
            Back to Master Dashboard
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
            fontWeight: 800,
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
            fontWeight: 700,
          }}
        >
          Open action
        </p>
      </div>
    </Link>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #F0E3D8",
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
          fontWeight: 700,
        }}
      >
        {label}
      </p>
      <h2
        style={{
          margin: "8px 0 0 0",
          color: "#2D2A3E",
          fontSize: "30px",
          fontWeight: 800,
        }}
      >
        {value}
      </h2>
    </div>
  );
}

const primaryButton = {
  background: "#7CCCF3",
  color: "#2D2A3E",
  textDecoration: "none",
  padding: "12px 16px",
  borderRadius: "12px",
  fontWeight: 700,
  fontSize: "14px",
};

const secondaryButton = {
  background: "#FFF3C4",
  color: "#2D2A3E",
  textDecoration: "none",
  padding: "12px 16px",
  borderRadius: "12px",
  fontWeight: 700,
  fontSize: "14px",
};

const backButton = {
  background: "#F8E8F0",
  color: "#2D2A3E",
  textDecoration: "none",
  padding: "12px 16px",
  borderRadius: "12px",
  fontWeight: 700,
  fontSize: "14px",
};