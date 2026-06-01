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
  status?: string | null;
  deleted_at?: string | null;
  package_name?: string | null;
  wageflow_enabled?: boolean | null;
  emis_number?: string | null;
  contact_number?: string | null;
  province?: string | null;
  district?: string | null;
  centre_type?: string | null;
  registration_status?: string | null;
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
  schoolsNeedingSetup: number;
  pendingSignupRequests: number;
};

const provinces = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "Western Cape",
];

const districtsByProvince: Record<string, string[]> = {
  "Eastern Cape": [
    "Alfred Nzo",
    "Amathole",
    "Buffalo City",
    "Chris Hani",
    "Joe Gqabi",
    "Nelson Mandela Bay",
    "OR Tambo",
    "Sarah Baartman",
  ],
  "Free State": [
    "Fezile Dabi",
    "Lejweleputswa",
    "Mangaung",
    "Thabo Mofutsanyana",
    "Xhariep",
  ],
  Gauteng: [
    "City of Johannesburg",
    "City of Tshwane",
    "Ekurhuleni",
    "Sedibeng",
    "West Rand",
  ],
  "KwaZulu-Natal": [
    "Amajuba",
    "eThekwini",
    "Harry Gwala",
    "iLembe",
    "King Cetshwayo",
    "Ugu",
    "uMgungundlovu",
    "uMkhanyakude",
    "uMzinyathi",
    "uThukela",
    "Zululand",
  ],
  Limpopo: ["Capricorn", "Mopani", "Sekhukhune", "Vhembe", "Waterberg"],
  Mpumalanga: ["Ehlanzeni", "Gert Sibande", "Nkangala"],
  "North West": [
    "Bojanala Platinum",
    "Dr Kenneth Kaunda",
    "Dr Ruth Segomotsi Mompati",
    "Ngaka Modiri Molema",
  ],
  "Northern Cape": [
    "Frances Baard",
    "John Taolo Gaetsewe",
    "Namakwa",
    "Pixley ka Seme",
    "ZF Mgcawu",
  ],
  "Western Cape": [
    "Cape Town",
    "Cape Winelands",
    "Central Karoo",
    "Garden Route",
    "Overberg",
    "West Coast",
  ],
};

const centreTypes = [
  "Independent ECD Centre",
  "Community-Based Centre",
  "School-Based ECD Centre",
  "Home-Based ECD",
  "Partial Care Facility",
  "Grade R Centre",
];

const registrationStatuses = [
  "Registered",
  "Conditionally Registered",
  "Registration In Progress",
  "Unregistered",
];

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
  const [packageName, setPackageName] = useState("Bloom");
  const [wageflowEnabled, setWageflowEnabled] = useState(false);
  const [emisNumber, setEmisNumber] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [centreType, setCentreType] = useState("");
  const [registrationStatus, setRegistrationStatus] = useState("");

  const [principalFullName, setPrincipalFullName] = useState("");
  const [principalEmail, setPrincipalEmail] = useState("");

  const [selectedSignupRequest, setSelectedSignupRequest] =
    useState<SignupRequestItem | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingSchool, setSavingSchool] = useState(false);
  const [approvingSignup, setApprovingSignup] = useState(false);
  const [updatingSchoolId, setUpdatingSchoolId] = useState<number | null>(null);

  const [showManageSchools, setShowManageSchools] = useState(false);
  const [manualSetupOpen, setManualSetupOpen] = useState(false);
  const [schoolSearch, setSchoolSearch] = useState("");
  const [visibleSchoolCount, setVisibleSchoolCount] = useState(5);

  const [stats, setStats] = useState<MasterStats>({
    totalSchools: 0,
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
      .select(
        "id, school_name, primary_color, secondary_color, logo_url, status, deleted_at, package_name, wageflow_enabled, emis_number, contact_number, province, district, centre_type, registration_status"
      )
      .is("deleted_at", null)
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

    setPrincipals((data || []) as PrincipalItem[]);
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
    if (!schoolName.trim() || !principalFullName.trim() || !principalEmail.trim()) {
      alert("Please complete school name, principal name, and principal email.");
      return;
    }

    setSavingSchool(true);

    const { data: schoolData, error } = await supabase
      .from("schools")
      .insert([
        {
          school_name: schoolName.trim(),
          emis_number: emisNumber.trim() || null,
          contact_number: contactNumber.trim() || null,
          province: province || null,
          district: district || null,
          centre_type: centreType || null,
          registration_status: registrationStatus || null,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          logo_url: logoUrl || null,
          package_name: packageName,
          wageflow_enabled:
            packageName === "Bloom Elite" ? true : wageflowEnabled,
        },
      ])
      .select("id")
      .single();

    if (error) {
      alert(error.message);
      setSavingSchool(false);
      return;
    }

    const inviteResponse = await fetch("/api/invite-principal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        full_name: principalFullName.trim(),
        email: principalEmail.trim(),
        school_id: Number(schoolData.id),
      }),
    });

    const inviteResult = await inviteResponse.json();

    if (!inviteResponse.ok) {
      alert(
        `School created, but principal invite failed: ${
          inviteResult.error || "Unknown error"
        }`
      );
      setSavingSchool(false);
      return;
    }

    setSchoolName("");
    setPrimaryColor("#7CCCF3");
    setSecondaryColor("#FFD76A");
    setLogoUrl("");
    setPackageName("Bloom");
    setWageflowEnabled(false);
    setEmisNumber("");
    setContactNumber("");
    setProvince("");
    setDistrict("");
    setCentreType("");
    setRegistrationStatus("");
    setPrincipalFullName("");
    setPrincipalEmail("");

    await Promise.all([fetchSchools(), fetchPrincipals(), fetchSignupRequests()]);
    setSavingSchool(false);
    alert("School created and principal invite sent successfully.");
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    if (!file) return;

    const fileName = `school-logo-${Date.now()}-${file.name}`;

    const { error } = await supabase.storage
      .from("school-logos")
      .upload(fileName, file);

    if (error) {
      alert("Logo upload failed.");
      return;
    }

    const { data } = supabase.storage
      .from("school-logos")
      .getPublicUrl(fileName);

    setLogoUrl(data.publicUrl);
  }

  async function updateSchoolStatus(schoolId: number, nextStatus: string) {
    setUpdatingSchoolId(schoolId);

    const { error } = await supabase
      .from("schools")
      .update({ status: nextStatus })
      .eq("id", schoolId);

    if (error) {
      alert(error.message);
      setUpdatingSchoolId(null);
      return;
    }

    const emailResponse = await fetch("/api/school-status-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schoolId,
        status: nextStatus,
      }),
    });

    const emailResult = await emailResponse.json();

    await fetchSchools();
    setUpdatingSchoolId(null);

    if (!emailResponse.ok) {
      alert(
        `School marked as ${nextStatus}, but email was not sent: ${
          emailResult.error || "Unknown email error"
        }`
      );
      return;
    }

    alert(`School marked as ${nextStatus}. Principal email sent.`);
  }

  async function toggleWageFlowAddOn(
    schoolId: number,
    currentValue: boolean,
    packageName?: string | null
  ) {
    if (packageName === "Bloom Elite") {
      alert("Bloom Elite already includes WageFlow.");
      return;
    }

    setUpdatingSchoolId(schoolId);

    const { error } = await supabase
      .from("schools")
      .update({
        wageflow_enabled: !currentValue,
      })
      .eq("id", schoolId);

    if (error) {
      alert(error.message);
      setUpdatingSchoolId(null);
      return;
    }

    await fetchSchools();
    setUpdatingSchoolId(null);

    alert(
      !currentValue
        ? "WageFlow add-on enabled."
        : "WageFlow add-on disabled."
    );
  }

  async function softDeleteSchool(schoolId: number, schoolName?: string | null) {
    const confirmed = window.confirm(
      `Soft delete ${schoolName || "this school"}?\n\nThis will hide the school but keep its records.`
    );

    if (!confirmed) return;

    setUpdatingSchoolId(schoolId);

    const { error } = await supabase
      .from("schools")
      .update({
        status: "inactive",
        deleted_at: new Date().toISOString(),
      })
      .eq("id", schoolId);

    if (error) {
      alert(error.message);
      setUpdatingSchoolId(null);
      return;
    }

    await fetchSchools();
    setUpdatingSchoolId(null);
    alert("School soft deleted.");
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
      `School approved and principal invite sent.\n\nTemporary password: ${result.tempPassword}`
    );

    router.push(`/master/school/${result.schoolId}`);
  }

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

  const filteredSchools = useMemo(() => {
    return schools.filter((school) =>
      String(school.school_name || "")
        .toLowerCase()
        .includes(schoolSearch.toLowerCase())
    );
  }, [schools, schoolSearch]);

  const visibleSchools = filteredSchools.slice(0, visibleSchoolCount);

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

        <Link href="/billing" style={{ textDecoration: "none" }}>
          <div
            style={{
              background: "#FFF7D9",
              border: "1px solid #F3E4A3",
              borderRadius: "18px",
              padding: "14px",
              boxShadow: "0 6px 14px rgba(45, 42, 62, 0.05)",
              cursor: "pointer",
            }}
          >
            <p
              style={{
                margin: 0,
                color: "#5B5675",
                fontSize: "13px",
                fontWeight: 700,
              }}
            >
              Billing
            </p>

            <h2
              style={{
                margin: "6px 0 0 0",
                color: "#2D2A3E",
                fontSize: "22px",
                fontWeight: 800,
              }}
            >
              Subscriptions
            </h2>

            <p
              style={{
                margin: "6px 0 0 0",
                color: "#6D6888",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              Manage DailyBloom billing
            </p>
          </div>
        </Link>
      </div>

      {currentView === "manage-schools" && (
        <SectionCard title="Manage Schools">
          <button
            type="button"
            onClick={() => setShowManageSchools(!showManageSchools)}
            style={secondaryButton}
          >
            {showManageSchools ? "Hide Managed Schools" : "Show Managed Schools"}
          </button>

          {showManageSchools && (
            <div style={{ marginTop: "16px" }}>
              <input
                className="db-input"
                placeholder="Search school..."
                value={schoolSearch}
                onChange={(e) => {
                  setSchoolSearch(e.target.value);
                  setVisibleSchoolCount(5);
                }}
              />

              {filteredSchools.length === 0 ? (
                <p style={helperText}>No schools found.</p>
              ) : (
                <>
                  <div style={{ display: "grid", gap: "12px", marginTop: "14px" }}>
                    {visibleSchools.map((school) => {
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
                      if (!school.emis_number) missingItems.push("NPO / registration number");
                      if (!school.province) missingItems.push("province");
                      if (!school.district) missingItems.push("district");
                      if (!school.centre_type) missingItems.push("centre type");
                      if (!school.registration_status) missingItems.push("registration status");
                      if (!hasApprovedPrincipal) missingItems.push("approved principal");

                      const schoolStatus = String(school.status || "active").toLowerCase();

                      return (
                        <div key={school.id} style={schoolListCard}>
                          <div style={{ flex: 1, minWidth: "220px" }}>
                            <strong style={listTitle}>
                              {school.school_name || "Unnamed school"}
                            </strong>

                            <p style={helperText}>
                              Package: {school.package_name || "Bloom"}
                            </p>

                            <p style={helperText}>
                              NPO / Registration: {school.emis_number || "Not added"}
                            </p>

                            <p style={helperText}>
                              Contact: {school.contact_number || "Not added"}
                            </p>

                            <p style={helperText}>
                              Province / District: {school.province || "Not added"}{" "}
                              {school.district ? `- ${school.district}` : ""}
                            </p>

                            <p style={helperText}>
                              Centre Type: {school.centre_type || "Not added"}
                            </p>

                            <p style={helperText}>
                              Registration: {school.registration_status || "Not added"}
                            </p>

                            <p style={helperText}>
                              WageFlow:{" "}
                              {school.package_name === "Bloom Elite" ||
                              school.wageflow_enabled
                                ? "Enabled"
                                : "Disabled"}
                            </p>

                            <div style={{ marginTop: "12px" }}>
                              <button
                                type="button"
                                style={statusButton}
                                onClick={() =>
                                  toggleWageFlowAddOn(
                                    school.id,
                                    Boolean(school.wageflow_enabled),
                                    school.package_name
                                  )
                                }
                                disabled={
                                  updatingSchoolId === school.id ||
                                  school.package_name === "Bloom Elite"
                                }
                              >
                                {school.package_name === "Bloom Elite"
                                  ? "Included in Elite"
                                  : school.wageflow_enabled
                                    ? "Disable WageFlow"
                                    : "Enable WageFlow"}
                              </button>
                            </div>

                            <p style={helperText}>
                              Status:{" "}
                              <span style={statusBadge(schoolStatus)}>
                                {schoolStatus}
                              </span>
                            </p>

                            <p style={helperText}>
                              Missing:{" "}
                              {missingItems.length ? missingItems.join(", ") : "none"}
                            </p>
                          </div>

                          <div style={buttonWrap}>
                            <Link
                              href={`/master/school/${school.id}`}
                              style={smallLinkButton}
                            >
                              Open School Overview
                            </Link>

                            <button
                              type="button"
                              style={statusButton}
                              onClick={() => updateSchoolStatus(school.id, "active")}
                              disabled={updatingSchoolId === school.id}
                            >
                              Activate
                            </button>

                            <button
                              type="button"
                              style={statusButton}
                              onClick={() => updateSchoolStatus(school.id, "suspended")}
                              disabled={updatingSchoolId === school.id}
                            >
                              Suspend
                            </button>

                            <button
                              type="button"
                              style={statusButton}
                              onClick={() => updateSchoolStatus(school.id, "inactive")}
                              disabled={updatingSchoolId === school.id}
                            >
                              Inactive
                            </button>

                            <button
                              type="button"
                              style={dangerButton}
                              onClick={() =>
                                softDeleteSchool(school.id, school.school_name)
                              }
                              disabled={updatingSchoolId === school.id}
                            >
                              Soft Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {visibleSchoolCount < filteredSchools.length && (
                    <button
                      type="button"
                      style={{ ...secondaryButton, marginTop: "14px" }}
                      onClick={() =>
                        setVisibleSchoolCount((current) => current + 5)
                      }
                    >
                      Show Next 5
                    </button>
                  )}
                </>
              )}
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

                      <p style={helperText}>Status: {request.status || "pending"}</p>

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
                  {approvingSignup ? "Approving..." : "Approve and Create School"}
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

                  <p style={helperText}>
                    Package: {school.package_name || "Bloom"}
                  </p>

                  <p style={helperText}>
                    NPO / Registration: {school.emis_number || "Not added"}
                  </p>

                  <p style={helperText}>
                    Contact: {school.contact_number || "Not added"}
                  </p>

                  <p style={helperText}>
                    Province / District: {school.province || "Not added"}{" "}
                    {school.district ? `- ${school.district}` : ""}
                  </p>

                  <p style={helperText}>
                    Centre Type: {school.centre_type || "Not added"}
                  </p>

                  <p style={helperText}>
                    Registration: {school.registration_status || "Not added"}
                  </p>

                  <p style={helperText}>
                    WageFlow:{" "}
                    {school.package_name === "Bloom Elite" ||
                    school.wageflow_enabled
                      ? "Enabled"
                      : "Disabled"}
                  </p>

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

      <SectionCard title="Manual School Setup">
        <button
          type="button"
          onClick={() => setManualSetupOpen((prev) => !prev)}
          style={secondaryButton}
        >
          {manualSetupOpen ? "Hide Manual Setup" : "Open Manual Setup"}
        </button>

        {manualSetupOpen && (
          <div style={{ marginTop: "16px" }}>
            <p style={helperText}>
              Create a school and send the principal invite from one place.
            </p>

            <input
              className="db-input"
              placeholder="School Name"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
            />

            <input
              className="db-input"
              placeholder="School Contact Number"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
            />

            <input
              className="db-input"
              placeholder="NPO / Registration Number"
              value={emisNumber}
              onChange={(e) => setEmisNumber(e.target.value)}
            />

            <select
              className="db-input"
              value={province}
              onChange={(e) => {
                const selectedProvince = e.target.value;
                setProvince(selectedProvince);
                setDistrict("");
              }}
            >
              <option value="">Select Province</option>
              {provinces.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              className="db-input"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              disabled={!province}
            >
              <option value="">
                {province ? "Select District" : "Select Province First"}
              </option>
              {(districtsByProvince[province] || []).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              className="db-input"
              value={centreType}
              onChange={(e) => setCentreType(e.target.value)}
            >
              <option value="">Select Centre Type</option>
              {centreTypes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              className="db-input"
              value={registrationStatus}
              onChange={(e) => setRegistrationStatus(e.target.value)}
            >
              <option value="">Select Registration Status</option>
              {registrationStatuses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

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

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#5B5675",
                }}
              >
                School Logo
              </label>

              <input
                type="file"
                accept="image/*"
                className="db-input"
                onChange={handleLogoUpload}
                style={{
                  paddingTop: 12,
                  paddingBottom: 12,
                  background: "#fff",
                  cursor: "pointer",
                }}
              />

              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="School Logo Preview"
                  style={{
                    width: 80,
                    height: 80,
                    objectFit: "cover",
                    borderRadius: 12,
                    border: "1px solid #E5E7EB",
                    marginTop: 6,
                  }}
                />
              )}
            </div>

            <select
              className="db-input"
              value={packageName}
              onChange={(e) => {
                const nextPackage = e.target.value;
                setPackageName(nextPackage);

                if (nextPackage === "Bloom Elite") {
                  setWageflowEnabled(true);
                }
              }}
            >
              <option value="Bloom">Bloom</option>
              <option value="Bloom Pro">Bloom Pro</option>
              <option value="Bloom Elite">Bloom Elite</option>
            </select>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "18px",
                color: "#5B5675",
                fontWeight: 600,
              }}
            >
              <input
                type="checkbox"
                checked={packageName === "Bloom Elite" ? true : wageflowEnabled}
                onChange={(e) => setWageflowEnabled(e.target.checked)}
                disabled={packageName === "Bloom Elite"}
              />
              Enable WageFlow Add-on
            </label>

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

            <button
              type="button"
              className="db-button-primary"
              style={{ width: "100%" }}
              onClick={createSchool}
              disabled={savingSchool}
            >
              {savingSchool ? "Saving..." : "Create School and Principal Login"}
            </button>
          </div>
        )}
      </SectionCard>
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

function statusBadge(status: string) {
  const base = {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 800,
    textTransform: "capitalize" as const,
  };

  if (status === "active") {
    return {
      ...base,
      background: "#EEF9EE",
      color: "#2E6B35",
      border: "1px solid #D3EDD4",
    };
  }

  if (status === "suspended") {
    return {
      ...base,
      background: "#FFF7D9",
      color: "#8A6500",
      border: "1px solid #F3E4A3",
    };
  }

  return {
    ...base,
    background: "#F8E8F0",
    color: "#8A3F5C",
    border: "1px solid #EBC9D8",
  };
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

const buttonWrap = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap" as const,
  justifyContent: "flex-end",
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

const statusButton = {
  border: "1px solid #E3D9CD",
  background: "#FFFFFF",
  color: "#5B5675",
  borderRadius: "12px",
  padding: "10px 12px",
  fontWeight: 700,
  cursor: "pointer",
};

const dangerButton = {
  border: "1px solid #EBC9D8",
  background: "#F8E8F0",
  color: "#8A3F5C",
  borderRadius: "12px",
  padding: "10px 12px",
  fontWeight: 800,
  cursor: "pointer",
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