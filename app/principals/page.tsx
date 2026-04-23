"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";

type School = {
  id: number;
  school_name: string;
  is_active?: boolean | null;
};

type PrincipalProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  school_id: number | null;
  is_active?: boolean | null;
  created_at?: string | null;
  schools?: {
    school_name?: string | null;
    is_active?: boolean | null;
  } | null;
};

export default function PrincipalsPage() {
  const router = useRouter();

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [schools, setSchools] = useState<School[]>([]);
  const [principals, setPrincipals] = useState<PrincipalProfile[]>([]);

  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

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

    setCheckingAccess(false);
    await Promise.all([fetchSchools(), fetchPrincipals()]);
    setLoading(false);
  }

  async function fetchSchools() {
    const { data, error } = await supabase
      .from("schools")
      .select("id, school_name, is_active")
      .order("school_name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setSchools(data || []);
  }

  async function fetchPrincipals() {
    const { data, error } = await supabase
      .from("profiles")
      .select(`
        id,
        full_name,
        email,
        role,
        school_id,
        is_active,
        created_at,
        schools (
          school_name,
          is_active
        )
      `)
      .eq("role", "principal")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setPrincipals((data ?? []) as PrincipalProfile[]);
  }

  const filteredPrincipals = useMemo(() => {
    return principals.filter((principal) => {
      const matchesSchool =
        selectedSchoolId === "all" ||
        String(principal.school_id || "") === selectedSchoolId;

      const schoolIsActive = principal.schools?.is_active !== false;
      const principalIsActive = principal.is_active !== false;

      const effectiveStatus =
        principalIsActive && schoolIsActive ? "active" : "inactive";

      const matchesStatus =
        selectedStatus === "all" || selectedStatus === effectiveStatus;

      const search = searchTerm.trim().toLowerCase();

      const matchesSearch =
        !search ||
        (principal.full_name || "").toLowerCase().includes(search) ||
        (principal.email || "").toLowerCase().includes(search) ||
        (principal.schools?.school_name || "").toLowerCase().includes(search);

      return matchesSchool && matchesStatus && matchesSearch;
    });
  }, [principals, selectedSchoolId, selectedStatus, searchTerm]);

  async function deactivateSchoolAccess(principal: PrincipalProfile) {
    if (!principal.school_id) {
      alert("This principal is not linked to a school.");
      return;
    }

    const confirmed = window.confirm(
      "Deactivate this principal and the whole school? This will also deactivate all teachers linked to that school."
    );

    if (!confirmed) return;

    setActionLoadingId(principal.id);

    const { error: schoolError } = await supabase
      .from("schools")
      .update({ is_active: false })
      .eq("id", principal.school_id);

    if (schoolError) {
      alert(schoolError.message);
      setActionLoadingId(null);
      return;
    }

    const { error: profilesError } = await supabase
      .from("profiles")
      .update({ is_active: false })
      .eq("school_id", principal.school_id)
      .in("role", ["principal", "teacher"]);

    if (profilesError) {
      alert(profilesError.message);
      setActionLoadingId(null);
      return;
    }

    await Promise.all([fetchSchools(), fetchPrincipals()]);
    setActionLoadingId(null);
    alert("School access has been deactivated for the principal and all teachers.");
  }

  async function reactivateSchoolAccess(principal: PrincipalProfile) {
    if (!principal.school_id) {
      alert("This principal is not linked to a school.");
      return;
    }

    const confirmed = window.confirm(
      "Reactivate this school? This will reactivate the principal and all teachers linked to the school."
    );

    if (!confirmed) return;

    setActionLoadingId(principal.id);

    const { error: schoolError } = await supabase
      .from("schools")
      .update({ is_active: true })
      .eq("id", principal.school_id);

    if (schoolError) {
      alert(schoolError.message);
      setActionLoadingId(null);
      return;
    }

    const { error: profilesError } = await supabase
      .from("profiles")
      .update({ is_active: true })
      .eq("school_id", principal.school_id)
      .in("role", ["principal", "teacher"]);

    if (profilesError) {
      alert(profilesError.message);
      setActionLoadingId(null);
      return;
    }

    await Promise.all([fetchSchools(), fetchPrincipals()]);
    setActionLoadingId(null);
    alert("School access has been reactivated for the principal and all teachers.");
  }

  async function removePrincipalFromSchool(principalId: string) {
    const confirmed = window.confirm(
      "Remove this principal from the school? Their account will remain, but it will no longer be linked to that school."
    );

    if (!confirmed) return;

    setActionLoadingId(principalId);

    const { error } = await supabase
      .from("profiles")
      .update({
        school_id: null,
        is_active: false,
      })
      .eq("id", principalId);

    if (error) {
      alert(error.message);
      setActionLoadingId(null);
      return;
    }

    await fetchPrincipals();
    setActionLoadingId(null);
    alert("Principal removed from school.");
  }

  if (checkingAccess) {
    return <p>Loading...</p>;
  }

  return (
    <div>
      <div
        className="db-soft-card"
        style={{ padding: "20px 22px", marginBottom: "24px" }}
      >
        <h1 className="db-page-title">Principal Management</h1>
        <p className="db-page-subtitle">
          Manage school principal access and school-wide activation status.
        </p>
      </div>

      <div className="db-grid-2" style={{ marginBottom: "24px" }}>
        <div className="db-card db-card-blue" style={{ padding: "20px" }}>
          <h3 style={sectionTitle}>Filters</h3>

          <input
            className="db-input"
            placeholder="Search by principal, email, or school"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select
            className="db-input"
            value={selectedSchoolId}
            onChange={(e) => setSelectedSchoolId(e.target.value)}
          >
            <option value="all">All Schools</option>
            {schools.map((school) => (
              <option key={school.id} value={String(school.id)}>
                {school.school_name}
              </option>
            ))}
          </select>

          <select
            className="db-input"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Schools</option>
            <option value="inactive">Inactive Schools</option>
          </select>
        </div>

        <div className="db-card db-card-green" style={{ padding: "20px" }}>
          <h3 style={sectionTitle}>Actions</h3>

          <p className="db-helper" style={{ marginBottom: "14px" }}>
            School-level deactivation also affects all teachers linked to that school.
          </p>

          <button
            className="db-button-primary"
            style={{ width: "100%" }}
            onClick={() => router.push("/master")}
          >
            Create Principal Login
          </button>
        </div>
      </div>

      <div
        className="db-card db-card-lavender"
        style={{ padding: "20px", marginBottom: "24px" }}
      >
        <h3 style={sectionTitle}>
          Principals ({loading ? "..." : filteredPrincipals.length})
        </h3>

        {loading ? (
          <p className="db-helper">Loading principals...</p>
        ) : filteredPrincipals.length === 0 ? (
          <p className="db-helper">No principals found.</p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {filteredPrincipals.map((principal) => {
              const schoolIsActive = principal.schools?.is_active !== false;
              const principalIsActive = principal.is_active !== false;
              const effectiveActive = schoolIsActive && principalIsActive;
              const isBusy = actionLoadingId === principal.id;

              return (
                <div key={principal.id} className="db-list-card">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "17px" }}>
                        {principal.full_name || "Unnamed Principal"}
                      </strong>
                      <p style={textStyle}>Email: {principal.email || "No email"}</p>
                      <p style={textStyle}>
                        School: {principal.schools?.school_name || "Not linked"}
                      </p>
                      <p style={textStyle}>
                        Principal Status: {principalIsActive ? "Active" : "Inactive"}
                      </p>
                      <p style={textStyle}>
                        School Status: {schoolIsActive ? "Active" : "Inactive"}
                      </p>
                      <p style={textStyle}>
                        Effective Access: {effectiveActive ? "Active" : "Blocked"}
                      </p>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "10px",
                      }}
                    >
                      {effectiveActive ? (
                        <button
                          type="button"
                          className="db-button-primary"
                          style={smallButton}
                          onClick={() => deactivateSchoolAccess(principal)}
                          disabled={isBusy}
                        >
                          {isBusy ? "Working..." : "Deactivate School Access"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="db-button-primary"
                          style={smallButton}
                          onClick={() => reactivateSchoolAccess(principal)}
                          disabled={isBusy}
                        >
                          {isBusy ? "Working..." : "Reactivate School Access"}
                        </button>
                      )}

                      <button
                        type="button"
                        className="db-button-primary"
                        style={smallButton}
                        onClick={() => removePrincipalFromSchool(principal.id)}
                        disabled={isBusy}
                      >
                        {isBusy ? "Working..." : "Remove From School"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const sectionTitle = {
  marginTop: 0,
  marginBottom: "14px",
  color: "var(--db-text)",
  fontSize: "22px",
  fontWeight: 800 as const,
};

const textStyle = {
  margin: "6px 0 0 0",
  color: "var(--db-text-soft)",
};

const smallButton = {
  minHeight: "40px",
  padding: "10px 14px",
} as const;