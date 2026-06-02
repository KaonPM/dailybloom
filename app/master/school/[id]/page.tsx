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
  activities: number;
  summaries: number;
  payments: number;
};

type SetupItem = {
  label: string;
  complete: boolean;
  href: string;
  helper: string;
};

const colourPresets = [
  { name: "DailyBloom Sky", primary: "#7CCCF3", secondary: "#FFD76A" },
  { name: "Soft Rose", primary: "#F8BBD0", secondary: "#FFF3B0" },
  { name: "Mint Garden", primary: "#A8E6CF", secondary: "#FFD3B6" },
  { name: "Lavender Calm", primary: "#CDB4DB", secondary: "#BDE0FE" },
  { name: "Peach Glow", primary: "#FFB5A7", secondary: "#FCD5CE" },
  { name: "Fresh Green", primary: "#B7E4C7", secondary: "#FFF1A8" },
];

export default function MasterSchoolOverviewPage() {
  const router = useRouter();
  const params = useParams();

  const [school, setSchool] = useState<School | null>(null);
  const [stats, setStats] = useState<SchoolStats>({
    learners: 0,
    teachers: 0,
    classrooms: 0,
    events: 0,
    activities: 0,
    summaries: 0,
    payments: 0,
  });

  const [principalCount, setPrincipalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [primaryColor, setPrimaryColor] = useState("#7CCCF3");
  const [secondaryColor, setSecondaryColor] = useState("#FFD76A");
  const [savingLogo, setSavingLogo] = useState(false);
  const [savingColours, setSavingColours] = useState(false);
  const [openSetupPanel, setOpenSetupPanel] = useState<
    "logo" | "colours" | null
  >(null);

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
    setPrimaryColor(schoolData.primary_color || "#7CCCF3");
    setSecondaryColor(schoolData.secondary_color || "#FFD76A");

    await Promise.all([
      fetchSchoolStats(schoolId),
      fetchPrincipalCount(schoolId),
    ]);

    setLoading(false);
  }

  async function fetchSchoolStats(currentSchoolId: number) {
    const [
      learnersResult,
      teachersTableResult,
      teacherProfilesResult,
      classroomsResult,
      eventsResult,
      activitiesResult,
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
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("school_id", currentSchoolId)
        .eq("role", "teacher"),

      supabase
        .from("classrooms")
        .select("*", { count: "exact", head: true })
        .eq("school_id", currentSchoolId),

      supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("school_id", currentSchoolId),

      supabase
        .from("classroom_activities")
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

    const teacherCount = Math.max(
      teachersTableResult.count || 0,
      teacherProfilesResult.count || 0
    );

    setStats({
      learners: learnersResult.count || 0,
      teachers: teacherCount,
      classrooms: classroomsResult.count || 0,
      events: eventsResult.count || 0,
      activities: activitiesResult.count || 0,
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

  async function uploadSchoolLogo() {
    if (!school || !logoFile) {
      alert("Please select a logo first.");
      return;
    }

    setSavingLogo(true);

    const fileExtension = logoFile.name.split(".").pop();
    const filePath = `school-${school.id}/logo-${Date.now()}.${fileExtension}`;

    const { error: uploadError } = await supabase.storage
      .from("school-logos")
      .upload(filePath, logoFile, { upsert: true });

    if (uploadError) {
      alert(uploadError.message);
      setSavingLogo(false);
      return;
    }

    const { data } = supabase.storage
      .from("school-logos")
      .getPublicUrl(filePath);

    const { error: updateError } = await supabase
      .from("schools")
      .update({ logo_url: data.publicUrl })
      .eq("id", school.id);

    if (updateError) {
      alert(updateError.message);
      setSavingLogo(false);
      return;
    }

    setSchool({ ...school, logo_url: data.publicUrl });
    setLogoFile(null);
    setSavingLogo(false);
    setOpenSetupPanel(null);
    alert("School logo updated.");
  }

  async function saveSchoolColours() {
    if (!school) return;

    setSavingColours(true);

    const { error } = await supabase
      .from("schools")
      .update({
        primary_color: primaryColor,
        secondary_color: secondaryColor,
      })
      .eq("id", school.id);

    if (error) {
      alert(error.message);
      setSavingColours(false);
      return;
    }

    setSchool({
      ...school,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
    });

    setSavingColours(false);
    setOpenSetupPanel(null);
    alert("School colours updated.");
  }

  const setupItems = useMemo<SetupItem[]>(() => {
    if (!school) return [];

    return [
      {
        label: "Principal assigned",
        complete: principalCount > 0,
        href: "/principals",
        helper: "A school should have at least one principal account.",
      },
      {
        label: "At least one classroom created",
        complete: stats.classrooms > 0,
        href: `/classrooms?school=${school.id}`,
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
      {
        label: "At least one classroom activity added",
        complete: stats.activities > 0,
        href: `/classroom-activities?school=${school.id}`,
        helper: "Activities help track classroom learning and teacher execution.",
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
          School Overview
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
          Review this school’s records and open linked management pages from here.
        </p>

        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
            marginTop: "16px",
          }}
        >
          <Link href="/master?view=manage-schools" style={topButton}>
            Back to Master Dashboard
          </Link>

          <Link href="/onboarding" style={topButton}>
            Open Onboarding Pipeline
          </Link>

          <Link href={`/classrooms?school=${school.id}`} style={topButtonBlue}>
            Open Classrooms
          </Link>

          <Link href={`/children?school=${school.id}`} style={topButtonBlue}>
            Open Learners
          </Link>

          <Link href={`/events?school=${school.id}`} style={topButtonBlue}>
            Open Events
          </Link>

          <Link
            href={`/classroom-activities?school=${school.id}`}
            style={topButtonBlue}
          >
            Open Classroom Activities
          </Link>

          <Link href={`/summaries?school=${school.id}`} style={topButtonBlue}>
            Open Summaries
          </Link>

          <Link href={`/broadcasts?school=${school.id}`} style={topButtonBlue}>
            Open Broadcasts
          </Link>

          <Link href={`/payments?school=${school.id}`} style={topButtonBlue}>
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
        <StatCard label="Activities" value={stats.activities} />
        <StatCard label="Summaries" value={stats.summaries} />
        <StatCard label="Payments" value={stats.payments} />
        <StatCard label="Principals" value={principalCount} />
      </div>

      <div style={mainCard}>
        <h3 style={sectionTitle}>School Readiness Checklist</h3>

        <div style={{ display: "grid", gap: "12px" }}>
          <div style={readinessCard(Boolean(school.logo_url))}>
            <div style={{ flex: 1, minWidth: "240px" }}>
              <strong style={readinessTitle}>School logo added</strong>
              <p style={helperText}>
                Upload or review the school logo directly here.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setOpenSetupPanel(openSetupPanel === "logo" ? null : "logo")
              }
              style={reviewButton(Boolean(school.logo_url))}
            >
              {school.logo_url ? "Review" : "Complete"}
            </button>

            {openSetupPanel === "logo" && (
              <div style={inlinePanel}>
                {school.logo_url && (
                  <img
                    src={school.logo_url}
                    alt={`${school.school_name} logo`}
                    style={{
                      width: "110px",
                      height: "110px",
                      objectFit: "cover",
                      borderRadius: "18px",
                      border: "1px solid #F0E3D8",
                      display: "block",
                    }}
                  />
                )}

                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    setLogoFile(event.target.files?.[0] || null)
                  }
                />

                <button
                  onClick={uploadSchoolLogo}
                  disabled={savingLogo}
                  style={actionButton}
                >
                  {savingLogo
                    ? "Uploading..."
                    : school.logo_url
                    ? "Change Logo"
                    : "Save Logo"}
                </button>
              </div>
            )}
          </div>

          <div
            style={readinessCard(
              Boolean(school.primary_color && school.secondary_color)
            )}
          >
            <div style={{ flex: 1, minWidth: "240px" }}>
              <strong style={readinessTitle}>School colours added</strong>
              <p style={helperText}>
                Choose a colour set or select your own colours directly here.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setOpenSetupPanel(
                  openSetupPanel === "colours" ? null : "colours"
                )
              }
              style={reviewButton(
                Boolean(school.primary_color && school.secondary_color)
              )}
            >
              {school.primary_color && school.secondary_color
                ? "Review"
                : "Complete"}
            </button>

            {openSetupPanel === "colours" && (
              <div style={inlinePanel}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(150px, 1fr))",
                    gap: "10px",
                  }}
                >
                  {colourPresets.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setPrimaryColor(preset.primary);
                        setSecondaryColor(preset.secondary);
                      }}
                      style={presetButton}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          marginBottom: "8px",
                        }}
                      >
                        <span style={colourSwatch(preset.primary)} />
                        <span style={colourSwatch(preset.secondary)} />
                      </div>

                      <strong style={{ color: "#2D2A3E" }}>
                        {preset.name}
                      </strong>
                    </button>
                  ))}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "12px",
                  }}
                >
                  <label style={labelStyle}>
                    Primary Colour
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(event) =>
                        setPrimaryColor(event.target.value)
                      }
                      style={colourInput}
                    />
                  </label>

                  <label style={labelStyle}>
                    Secondary Colour
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(event) =>
                        setSecondaryColor(event.target.value)
                      }
                      style={colourInput}
                    />
                  </label>
                </div>

                <button
                  onClick={saveSchoolColours}
                  disabled={savingColours}
                  style={actionButton}
                >
                  {savingColours ? "Saving..." : "Save Colours"}
                </button>
              </div>
            )}
          </div>

          {setupItems.map((item) => (
            <div key={item.label} style={readinessCard(item.complete)}>
              <div style={{ flex: 1, minWidth: "240px" }}>
                <strong style={readinessTitle}>{item.label}</strong>
                <p style={helperText}>{item.helper}</p>
              </div>

              <div style={{ flexShrink: 0 }}>
                <Link href={item.href} style={reviewButton(item.complete)}>
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={statCard}>
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

const readinessCard = (complete: boolean) => ({
  background: complete ? "#EEF9EE" : "#FFFDFB",
  border: complete ? "1px solid #D3EDD4" : "1px solid #F0E3D8",
  borderRadius: "18px",
  padding: "16px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  flexWrap: "wrap" as const,
});

const readinessTitle = {
  display: "block",
  color: "#2D2A3E",
  fontSize: "16px",
};

const inlinePanel = {
  width: "100%",
  marginTop: "12px",
  paddingTop: "14px",
  borderTop: "1px solid #F0E3D8",
  display: "grid",
  gap: "14px",
};

const mainCard = {
  background: "#FFFFFF",
  border: "1px solid #F0E3D8",
  borderRadius: "24px",
  padding: "20px",
  boxShadow: "0 8px 20px rgba(45, 42, 62, 0.05)",
};

const statCard = {
  background: "#FFFFFF",
  border: "1px solid #F0E3D8",
  borderRadius: "22px",
  padding: "18px",
  boxShadow: "0 8px 18px rgba(45, 42, 62, 0.05)",
};

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

const actionButton = {
  background: "#7CCCF3",
  color: "#2D2A3E",
  border: "1px solid #CBEAF7",
  borderRadius: "12px",
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
  width: "fit-content",
};

const presetButton = {
  border: "1px solid #F0E3D8",
  borderRadius: "16px",
  background: "#FFFFFF",
  padding: "12px",
  cursor: "pointer",
  textAlign: "left" as const,
};

const colourSwatch = (colour: string) => ({
  width: "34px",
  height: "34px",
  borderRadius: "10px",
  background: colour,
  border: "1px solid #E3D9CD",
  display: "inline-block",
});

const labelStyle = {
  display: "grid",
  gap: "8px",
  color: "#2D2A3E",
  fontSize: "14px",
  fontWeight: 700,
};

const colourInput = {
  width: "100%",
  height: "46px",
  border: "1px solid #F0E3D8",
  borderRadius: "12px",
  background: "#FFFFFF",
  padding: "4px",
};

const reviewButton = (complete: boolean) => ({
  textDecoration: "none",
  background: complete ? "#FFFFFF" : "#7CCCF3",
  color: "#2D2A3E",
  padding: "10px 14px",
  borderRadius: "12px",
  border: complete ? "1px solid #D3EDD4" : "1px solid #CBEAF7",
  fontWeight: 600,
  display: "inline-block",
  cursor: "pointer",
});