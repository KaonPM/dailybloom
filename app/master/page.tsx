"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";

type SchoolItem = {
  id: number;
  school_name?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  logo_url?: string | null;
};

type PrincipalItem = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  school_id?: number | null;
  approval_status?: string | null;
};

type SignupRequestItem = {
  id: number;
  school_name?: string | null;
  principal_full_name?: string | null;
  principal_email?: string | null;
  status?: string | null;
  created_at?: string | null;
  school_id?: number | null;
};

type MasterStats = {
  totalSchools: number;
  activePrincipals: number;
  schoolsNeedingSetup: number;
  pendingSignupRequests: number;
};

export default function MasterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [principals, setPrincipals] = useState<PrincipalItem[]>([]);
  const [signupRequests, setSignupRequests] = useState<SignupRequestItem[]>([]);

  const [schoolName, setSchoolName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#7CCCF3");
  const [secondaryColor, setSecondaryColor] = useState("#FFD76A");
  const [logoUrl, setLogoUrl] = useState("");

  const [principalFullName, setPrincipalFullName] = useState("");
  const [principalEmail, setPrincipalEmail] = useState("");
  const [selectedSchoolId, setSelectedSchoolId] = useState("");

  const [selectedSignupRequest, setSelectedSignupRequest] =
    useState<SignupRequestItem | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingSchool, setSavingSchool] = useState(false);
  const [savingPrincipal, setSavingPrincipal] = useState(false);
  const [approvingSignup, setApprovingSignup] = useState(false);

  const [stats, setStats] = useState<MasterStats>({
    totalSchools: 0,
    activePrincipals: 0,
    schoolsNeedingSetup: 0,
    pendingSignupRequests: 0,
  });

  useEffect(() => {
    loadMasterPage();
  }, []);

  async function loadMasterPage() {
    const { profile, error } = await getCurrentProfile();

    if (error || !profile) {
      router.push("/login");
      return;
    }

    if (profile.role !== "master") {
      router.push("/dashboard");
      return;
    }

    await Promise.all([fetchSchools(), fetchPrincipals(), fetchSignupRequests()]);
    setLoading(false);
  }

  async function fetchSchools() {
    const { data, error } = await supabase
      .from("schools")
      .select("id, school_name, primary_color, secondary_color, logo_url")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    const rows = (data || []) as SchoolItem[];
    setSchools(rows);

    setStats((prev) => ({
      ...prev,
      totalSchools: rows.length,
    }));
  }

  async function fetchPrincipals() {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, school_id, approval_status")
      .eq("role", "principal");

    if (error) {
      alert(error.message);
      return;
    }

    const rows = (data || []) as PrincipalItem[];
    setPrincipals(rows);

    const activeCount = rows.filter((item) => {
      const status = String(item.approval_status || "").toLowerCase();
      return status === "approved" || status === "";
    }).length;

    setStats((prev) => ({
      ...prev,
      activePrincipals: activeCount,
    }));
  }

  async function fetchSignupRequests() {
    const { data, error } = await supabase
      .from("school_signup_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    const rows = (data || []) as SignupRequestItem[];
    setSignupRequests(rows);

    const pendingCount = rows.filter(
      (item) => String(item.status || "").toLowerCase() === "pending"
    ).length;

    setStats((prev) => ({
      ...prev,
      pendingSignupRequests: pendingCount,
    }));

    setSelectedSignupRequest((current) => {
      if (!current) return current;
      const refreshed = rows.find((item) => item.id === current.id);
      return refreshed || null;
    });
  }

  async function createSchool() {
    if (!schoolName.trim()) {
      alert("Please enter a school name.");
      return;
    }

    setSavingSchool(true);

    const { error } = await supabase.from("schools").insert([
      {
        school_name: schoolName.trim(),
        primary_color: primaryColor || "#7CCCF3",
        secondary_color: secondaryColor || "#FFD76A",
        logo_url: logoUrl.trim() || null,
      },
    ]);

    if (error) {
      alert(error.message);
      setSavingSchool(false);
      return;
    }

    setSchoolName("");
    setPrimaryColor("#7CCCF3");
    setSecondaryColor("#FFD76A");
    setLogoUrl("");

    await fetchSchools();
    setSavingSchool(false);
    alert("School created successfully.");
  }

  async function createPrincipalLogin() {
    if (!principalFullName.trim() || !principalEmail.trim() || !selectedSchoolId) {
      alert("Please complete principal name, email, and school.");
      return;
    }

    setSavingPrincipal(true);

    const response = await fetch("/api/invite-principal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        full_name: principalFullName.trim(),
        email: principalEmail.trim(),
        school_id: Number(selectedSchoolId),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "Could not send principal invite.");
      setSavingPrincipal(false);
      return;
    }

    setPrincipalFullName("");
    setPrincipalEmail("");
    setSelectedSchoolId("");

    await Promise.all([fetchPrincipals(), fetchSignupRequests()]);
    setSavingPrincipal(false);
    alert("Principal invite email sent successfully.");
  }

  async function approveSignupRequest(request: SignupRequestItem) {
    if (!request.school_name || !request.principal_full_name || !request.principal_email) {
      alert("This sign-up request is missing school or principal details.");
      return;
    }

    setApprovingSignup(true);

    const response = await fetch("/api/approve-signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requestId: request.id,
        schoolName: request.school_name,
        principalFullName: request.principal_full_name,
        principalEmail: request.principal_email,
        primaryColor: "#7CCCF3",
        secondaryColor: "#FFD76A",
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "Could not approve sign-up request.");
      setApprovingSignup(false);
      return;
    }

    await Promise.all([fetchSchools(), fetchPrincipals(), fetchSignupRequests()]);

    setApprovingSignup(false);

    alert(
      `School approved and principal login created.\n\nTemporary password: ${result.tempPassword}`
    );

    router.push(`/master/school/${result.schoolId}`);
  }

  const approvedPrincipals = useMemo(() => {
    return principals.filter((item) => {
      const status = String(item.approval_status || "").toLowerCase();
      return status === "approved" || status === "";
    });
  }, [principals]);

  const pendingSignupRequests = useMemo(() => {
    return signupRequests.filter(
      (item) => String(item.status || "").toLowerCase() === "pending"
    );
  }, [signupRequests]);

  const schoolsNeedingSetup = useMemo(() => {
    return schools.filter((school) => {
      const linkedPrincipals = principals.filter(
        (principal) => Number(principal.school_id) === Number(school.id)
      );

      const hasApprovedPrincipal = linkedPrincipals.some((principal) => {
        const status = String(principal.approval_status || "").toLowerCase();
        return status === "approved" || status === "";
      });

      return !hasApprovedPrincipal || !school.logo_url;
    });
  }, [schools, principals]);

  useEffect(() => {
    setStats((prev) => ({
      ...prev,
      schoolsNeedingSetup: schoolsNeedingSetup.length,
    }));
  }, [schoolsNeedingSetup]);

  const currentView = searchParams.get("view") || "manage-schools";

  if (loading) {
    return <p>Loading master dashboard...</p>;
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
        <p style={eyebrow}>Master Dashboard</p>

        <h1
          style={{
            margin: "8px 0 0 0",
            fontSize: "34px",
            fontWeight: 800,
            color: "#2D2A3E",
          }}
        >
          DailyBloom Platform Management
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
          Manage schools, setup status, sign-ups, and platform access from one place.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "14px",
          marginBottom: "24px",
        }}
      >
        <StatLinkCard
          label="Total Schools"
          value={stats.totalSchools}
          href="/master?view=manage-schools"
          background="#EAF7FD"
          border="#CBEAF7"
        />
        <StatLinkCard
          label="Active Principals"
          value={stats.activePrincipals}
          href="/master?view=active-principals"
          background="#EEF9EE"
          border="#D3EDD4"
        />
        <StatLinkCard
          label="Schools Needing Setup"
          value={stats.schoolsNeedingSetup}
          href="/master?view=schools-needing-setup"
          background="#FFF7D9"
          border="#F3E4A3"
        />
        <StatLinkCard
          label="Pending Signups"
          value={stats.pendingSignupRequests}
          href="/master?view=pending-signups"
          background="#EAF7FD"
          border="#CBEAF7"
        />
      </div>

      {currentView === "manage-schools" && (
        <SectionCard title="Manage Schools">
          {schools.length === 0 ? (
            <p style={helperText}>No schools created yet.</p>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {schools.map((school) => {
                const linkedPrincipals = principals.filter(
                  (principal) => Number(principal.school_id) === Number(school.id)
                );

                const hasApprovedPrincipal = linkedPrincipals.some((principal) => {
                  const status = String(principal.approval_status || "").toLowerCase();
                  return status === "approved" || status === "";
                });

                const missingItems: string[] = [];

                if (!school.logo_url) missingItems.push("logo");
                if (!school.primary_color) missingItems.push("primary colour");
                if (!school.secondary_color) missingItems.push("secondary colour");
                if (!hasApprovedPrincipal) missingItems.push("approved principal");

                return (
                  <div key={school.id} style={schoolListCard}>
                    <div style={{ flex: 1, minWidth: "220px" }}>
                      <strong style={listTitle}>
                        {school.school_name || "Unnamed school"}
                      </strong>

                      <p style={helperText}>
                        Missing: {missingItems.length ? missingItems.join(", ") : "none"}
                      </p>
                    </div>

                    <Link href={`/master/school/${school.id}`} style={smallLinkButton}>
                      Open School Overview
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      )}

      {currentView === "pending-signups" && (
        <>
          <SectionCard title="Pending School Sign-Up Requests">
            {pendingSignupRequests.length === 0 ? (
              <p style={helperText}>No pending school sign-up requests.</p>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {pendingSignupRequests.map((request) => {
                  const isSelected = selectedSignupRequest?.id === request.id;

                  return (
                    <button
                      key={request.id}
                      type="button"
                      onClick={() => setSelectedSignupRequest(request)}
                      style={{
                        ...listCard,
                        textAlign: "left",
                        cursor: "pointer",
                        width: "100%",
                        background: isSelected ? "#F4FBFF" : "#FFFDFB",
                        border: isSelected
                          ? "2px solid #7CCCF3"
                          : "1px solid #F0E3D8",
                      }}
                    >
                      <strong style={listTitle}>
                        {request.school_name || "Unnamed school"}
                      </strong>
                      <p style={helperText}>
                        Principal: {request.principal_full_name || "Not added"}
                      </p>
                      <p style={helperText}>
                        Email: {request.principal_email || "Not added"}
                      </p>
                      <p style={helperText}>
                        Status: {request.status || "pending"}
                      </p>
                      <p style={helperText}>
                        Submitted:{" "}
                        {request.created_at
                          ? new Date(request.created_at).toLocaleString()
                          : "No timestamp"}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {selectedSignupRequest ? (
            <SectionCard title="School Sign-Up Setup">
              <p style={helperText}>
                School: {selectedSignupRequest.school_name || "Not added"}
              </p>
              <p style={helperText}>
                Principal: {selectedSignupRequest.principal_full_name || "Not added"}
              </p>
              <p style={helperText}>
                Email: {selectedSignupRequest.principal_email || "Not added"}
              </p>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                  marginTop: "14px",
                }}
              >
                <button
                  type="button"
                  className="db-button-primary"
                  onClick={() => approveSignupRequest(selectedSignupRequest)}
                  disabled={approvingSignup}
                >
                  {approvingSignup ? "Approving..." : "Approve and Create Principal Login"}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedSignupRequest(null)}
                  style={secondaryButton}
                >
                  Clear Selection
                </button>
              </div>
            </SectionCard>
          ) : null}
        </>
      )}

      {currentView === "active-principals" && (
        <SectionCard title="Active Principals">
          {approvedPrincipals.length === 0 ? (
            <p style={helperText}>No active principals yet.</p>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {approvedPrincipals.map((principal) => (
                <div key={principal.id} style={listCard}>
                  <strong style={listTitle}>
                    {principal.full_name || "Unnamed principal"}
                  </strong>
                  <p style={helperText}>Email: {principal.email || "Not added"}</p>
                  <p style={helperText}>
                    School ID: {principal.school_id || "Not linked"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {currentView === "schools-needing-setup" && (
        <SectionCard title="Schools Needing Setup">
          {schoolsNeedingSetup.length === 0 ? (
            <p style={helperText}>All schools look set up.</p>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {schoolsNeedingSetup.map((school) => (
                <div key={school.id} style={listCard}>
                  <strong style={listTitle}>
                    {school.school_name || "Unnamed school"}
                  </strong>

                  <div style={{ marginTop: "10px" }}>
                    <Link
                      href={`/master/school/${school.id}`}
                      className="db-button-primary"
                      style={{ textDecoration: "none" }}
                    >
                      Open School Overview
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "14px",
        }}
      >
        <div style={formCard}>
          <h3 style={sectionTitle}>Create School</h3>

          <input
            className="db-input"
            placeholder="School Name"
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
          />

          <input
            className="db-input"
            placeholder="Primary Colour"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
          />

          <input
            className="db-input"
            placeholder="Secondary Colour"
            value={secondaryColor}
            onChange={(e) => setSecondaryColor(e.target.value)}
          />

          <input
            className="db-input"
            placeholder="School Logo URL"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
          />

          <button
            type="button"
            className="db-button-primary"
            style={{ width: "100%" }}
            onClick={createSchool}
            disabled={savingSchool}
          >
            {savingSchool ? "Saving..." : "Create School"}
          </button>
        </div>

        <div style={formCard}>
          <h3 style={sectionTitle}>Create Principal Login</h3>

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

          <select
            className="db-input"
            value={selectedSchoolId}
            onChange={(e) => setSelectedSchoolId(e.target.value)}
          >
            <option value="">Select School</option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.school_name}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="db-button-primary"
            style={{ width: "100%" }}
            onClick={createPrincipalLogin}
            disabled={savingPrincipal}
          >
            {savingPrincipal ? "Saving..." : "Send Principal Invite"}
          </button>
        </div>
      </div>
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
        <p style={statLabel}>{label}</p>
        <h2 style={statValue}>{value}</h2>
        <p style={statHelper}>Open {label.toLowerCase()}</p>
      </div>
    </Link>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={sectionCard}>
      <h3 style={sectionTitle}>{title}</h3>
      {children}
    </div>
  );
}

const eyebrow = {
  margin: 0,
  color: "#6D6888",
  fontSize: "13px",
  fontWeight: 700,
};

const sectionCard = {
  background: "#FFFFFF",
  border: "1px solid #F0E3D8",
  borderRadius: "24px",
  padding: "20px",
  boxShadow: "0 8px 20px rgba(45, 42, 62, 0.05)",
  marginBottom: "24px",
};

const formCard = {
  background: "#FFFFFF",
  border: "1px solid #F0E3D8",
  borderRadius: "24px",
  padding: "20px",
  boxShadow: "0 8px 20px rgba(45, 42, 62, 0.05)",
};

const sectionTitle = {
  marginTop: 0,
  marginBottom: "14px",
  color: "#2D2A3E",
  fontSize: "22px",
  fontWeight: 800,
};

const helperText = {
  margin: "6px 0 0 0",
  color: "#6D6888",
  fontSize: "14px",
  lineHeight: 1.6,
};

const listCard = {
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: "18px",
  padding: "16px",
};

const schoolListCard = {
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: "18px",
  padding: "16px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  flexWrap: "wrap" as const,
};

const listTitle = {
  display: "block",
  fontSize: "17px",
  color: "#2D2A3E",
  fontWeight: 700,
};

const smallLinkButton = {
  textDecoration: "none",
  background: "#7CCCF3",
  color: "#2D2A3E",
  padding: "10px 14px",
  borderRadius: "12px",
  fontWeight: 600,
  border: "1px solid #CBEAF7",
  whiteSpace: "nowrap" as const,
  display: "inline-block",
};

const secondaryButton = {
  border: "1px solid #E3D9CD",
  background: "#FFFFFF",
  color: "#5B5675",
  borderRadius: "12px",
  padding: "10px 14px",
  fontWeight: 600,
  cursor: "pointer",
};

const statLabel = {
  margin: 0,
  color: "#5B5675",
  fontSize: "14px",
  fontWeight: 700,
};

const statValue = {
  margin: "8px 0 0 0",
  color: "#2D2A3E",
  fontSize: "30px",
  fontWeight: 800,
};

const statHelper = {
  margin: "8px 0 0 0",
  color: "#6D6888",
  fontSize: "13px",
  fontWeight: 600,
};