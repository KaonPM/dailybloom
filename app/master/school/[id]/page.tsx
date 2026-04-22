"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();

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

  const [principalFullName, setPrincipalFullName] = useState(
    searchParams.get("principalName") || ""
  );
  const [principalEmail, setPrincipalEmail] = useState(
    searchParams.get("principalEmail") || ""
  );
  const [principalLoading, setPrincipalLoading] = useState(false);

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

  async function sendPrincipalInvite() {
    if (!principalFullName.trim() || !principalEmail.trim()) {
      alert("Please enter principal name and email.");
      return;
    }

    setPrincipalLoading(true);

    const response = await fetch("/api/invite-principal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        full_name: principalFullName.trim(),
        email: principalEmail.trim(),
        school_id: schoolId,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "Could not send principal invite.");
      setPrincipalLoading(false);
      return;
    }

    await fetchPrincipalCount(schoolId);
    setPrincipalLoading(false);
    alert("Principal invite sent successfully.");
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
        label: "At least one classroom created",
        complete: stats.classrooms > 0,
        href: `/children?school=${school.id}`,
        helper: "Classroom setup supports learner grouping.",
      },
      {
        label: "At least one learner added",
        complete: stats.learners > 0,
        href: `/children?school=${school.id}`,
        helper: "Learners should be added after school setup.",
      },
      {
        label: "At least one teacher added",
        complete: stats.teachers > 0,
        href: `/teachers?school=${school.id}`,
        helper: "Teachers are part of the operational setup.",
      },
      {
        label: "At least one event added",
        complete: stats.events > 0,
        href: `/events?school=${school.id}`,
        helper: "School calendar should start with at least one event.",
      },
    ];
  }, [school, principalCount, stats]);

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
          School Setup Overview
        </p>

        <h1
          style={{
            margin: "8px 0 0 0",
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
          Complete this school’s onboarding and open the linked management pages from here.
        </p>

        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
            marginTop: "16px",
          }}
        >
          <Link
            href="/master?view=manage-schools"
            style={topButton}
          >
            Back to Master Dashboard
          </Link>

          <Link
            href={`/children?school=${school.id}`}
            style={topButtonBlue}
          >
            Open Learners
          </Link>

          <Link
            href={`/events?school=${school.id}`}
            style={topButtonBlue}
          >
            Open Events
          </Link>

          <Link
            href={`/summaries?school=${school.id}`}
            style={topButtonBlue}
          >
            Open Summaries
          </Link>

          <Link
            href={`/broadcasts?school=${school.id}`}
            style={topButtonBlue}
          >
            Open Broadcasts
          </Link>

          <Link
            href={`/payments?school=${school.id}`}
            style={topButtonBlue}
          >
            Open Payments
          </Link>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
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
        <StatCard label="Principals" value={principalCount} />
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
        <h3 style={sectionTitle}>Continue Principal Setup</h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "12px",
            marginBottom: "14px",
          }}
        >
          <input
            className="db-input"
            placeholder="Principal Full Name"
            value={principalFullName}
            onChange={(e) => setPrincipalFullName(e.target.value)}
          />

          <input
            className="db-input"
            placeholder="Principal Email"
            value={principalEmail}
            onChange={(e) => setPrincipalEmail(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="db-button-primary"
          onClick={sendPrincipalInvite}
          disabled={principalLoading}
        >
          {principalLoading ? "Sending..." : "Send Principal Invite"}
        </button>
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
        <h3 style={sectionTitle}>Setup Checklist</h3>

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
                alignItems: "flex-start",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: "240px" }}>
                <strong
                  style={{
                    display: "block",
                    color: "#2D2A3E",
                    fontSize: "16px",
                  }}
                >
                  {item.label}
                </strong>
                <p style={helperText}>{item.helper}</p>
              </div>

              <div style={{ flexShrink: 0 }}>
                <Link
                  href={item.href}
                  style={{
                    textDecoration: "none",
                    background: item.complete ? "#FFFFFF" : "#7CCCF3",
                    color: "#2D2A3E",
                    padding: "10px 14px",
                    borderRadius: "12px",
                    border: item.complete
                      ? "1px solid #D3EDD4"
                      : "1px solid #CBEAF7",
                    fontWeight: 600,
                    display: "inline-block",
                  }}
                >
                  {item.complete ? "Review" : "Complete"}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
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

const sectionTitle = {
  marginTop: 0,
  marginBottom: "14px",
  color: "#2D2A3E",
  fontSize: "22px",
  fontWeight: 800 as const,
};

const helperText = {
  margin: "6px 0 0 0",
  color: "#6D6888",
  fontSize: "14px",
  lineHeight: 1.6,
};

const topButton = {
  textDecoration: "none",
  background: "#FFFFFF",
  color: "#2D2A3E",
  padding: "10px 14px",
  borderRadius: "12px",
  border: "1px solid #E3D9CD",
  fontWeight: 600,
  display: "inline-block",
};

const topButtonBlue = {
  textDecoration: "none",
  background: "#7CCCF3",
  color: "#2D2A3E",
  padding: "10px 14px",
  borderRadius: "12px",
  border: "1px solid #CBEAF7",
  fontWeight: 600,
  display: "inline-block",
};