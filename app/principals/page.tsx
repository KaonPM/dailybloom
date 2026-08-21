"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";
import { authenticatedFetch } from "../lib/authenticated-fetch";
import { PERMISSIONS } from "../lib/permissions";

type School = {
  id: number;
  school_name: string;
  status?: string | null;
  package_name?: string | null;
  wageflow_enabled?: boolean | null;
};

type PrincipalProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  school_id: number | null;
  is_active?: boolean | null;
  created_at?: string | null;
  last_login_at?: string | null;
};

export default function PrincipalsPage() {
  const router = useRouter();

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [schools, setSchools] = useState<School[]>([]);
  const [principals, setPrincipals] = useState<PrincipalProfile[]>([]);

  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [expandedPrincipalId, setExpandedPrincipalId] = useState<string | null>(
    null
  );
  const [editingPrincipalId, setEditingPrincipalId] = useState<string | null>(null);
  const [editingPrincipalEmail, setEditingPrincipalEmail] = useState("");
  const [visiblePrincipalCount, setVisiblePrincipalCount] = useState(5);
  const [canManageSchoolStatus, setCanManageSchoolStatus] = useState(false);
  const [canManagePrincipals, setCanManagePrincipals] = useState(false);

  const fetchSchools = useCallback(async (): Promise<string | null> => {
    const { data, error } = await supabase
      .from("schools")
      .select("id, school_name, status, package_name, wageflow_enabled")
      .order("school_name", { ascending: true });

    if (error) {
      return `Schools could not be loaded: ${error.message}`;
    }

    setSchools(data || []);
    return null;
  }, []);

  const fetchPrincipals = useCallback(async (): Promise<string | null> => {
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
        last_login_at
      `)
      .in("role", ["owner", "principal"])
      .order("created_at", { ascending: false });

    if (error) {
      return `Principals could not be loaded: ${error.message}`;
    }

    setPrincipals((data ?? []) as PrincipalProfile[]);
    return null;
  }, []);

  const loadPage = useCallback(async () => {
    const { profile, error } = await getCurrentProfile();

    if (error || !profile) {
      router.push("/login");
      return;
    }

    const delegatedPermissions = Array.isArray(profile.permissions) ? profile.permissions : [];
    if (
      profile.role !== "master" &&
      !(
        profile.role === "master_admin" &&
        (
          delegatedPermissions.includes(PERMISSIONS.PRINCIPAL_MANAGE) ||
          delegatedPermissions.includes(PERMISSIONS.SCHOOL_STATUS)
        )
      )
    ) {
      router.push(profile.role === "master_admin" ? "/master-admin" : "/dashboard");
      return;
    }

    setCanManageSchoolStatus(
      profile.role === "master" || delegatedPermissions.includes(PERMISSIONS.SCHOOL_STATUS)
    );
    setCanManagePrincipals(
      profile.role === "master" || delegatedPermissions.includes(PERMISSIONS.PRINCIPAL_MANAGE)
    );
    setCheckingAccess(false);
    const loadErrors = await Promise.all([fetchSchools(), fetchPrincipals()]);
    setLoadError(loadErrors.filter(Boolean).join(" "));
    setLoading(false);
  }, [fetchPrincipals, fetchSchools, router]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const schoolsById = useMemo(
    () => new Map(schools.map((school) => [school.id, school])),
    [schools]
  );

  const filteredPrincipals = useMemo(() => {
    return principals.filter((principal) => {
      const school = schoolsById.get(Number(principal.school_id));
      const matchesSchool =
        selectedSchoolId === "all" ||
        String(principal.school_id || "") === selectedSchoolId;

      const schoolIsActive = String(school?.status || "active").toLowerCase() === "active";
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
        (school?.school_name || "").toLowerCase().includes(search);

      return matchesSchool && matchesStatus && matchesSearch;
    });
  }, [principals, schoolsById, selectedSchoolId, selectedStatus, searchTerm]);

  const visiblePrincipals = filteredPrincipals.slice(0, visiblePrincipalCount);
  const hasMorePrincipals = visiblePrincipalCount < filteredPrincipals.length;

  async function runPlatformOperation(payload: Record<string, unknown>) {
    const response = await authenticatedFetch("/api/platform-operations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not update platform access.");
  }

  async function deactivateSchoolAccess(principal: PrincipalProfile) {
    if (!principal.school_id) {
      alert("This principal is not linked to a school.");
      return;
    }

    const confirmed = window.confirm(
      "Deactivate this principal and the whole school? This will also deactivate all practitioners linked to that school."
    );

    if (!confirmed) return;

    setActionLoadingId(principal.id);

    try {
      await runPlatformOperation({ action: "set_school_active", school_id: principal.school_id, is_active: false });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not deactivate school access.");
      setActionLoadingId(null);
      return;
    }

    await Promise.all([fetchSchools(), fetchPrincipals()]);
    setActionLoadingId(null);
    alert("School access has been deactivated for the principal and all practitioners.");
  }

  async function reactivateSchoolAccess(principal: PrincipalProfile) {
    if (!principal.school_id) {
      alert("This principal is not linked to a school.");
      return;
    }

    const confirmed = window.confirm(
      "Reactivate this school? This will reactivate the principal and all practitioners linked to the school."
    );

    if (!confirmed) return;

    setActionLoadingId(principal.id);

    try {
      await runPlatformOperation({ action: "set_school_active", school_id: principal.school_id, is_active: true });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not reactivate school access.");
      setActionLoadingId(null);
      return;
    }

    await Promise.all([fetchSchools(), fetchPrincipals()]);
    setActionLoadingId(null);
    alert("School access has been reactivated for the principal and all practitioners.");
  }

  async function removePrincipalFromSchool(principal: PrincipalProfile) {
    const confirmed = window.confirm(
      "Remove this principal from the school? Their account will remain, but it will no longer be linked to that school."
    );

    if (!confirmed) return;

    setActionLoadingId(principal.id);

    try {
      await runPlatformOperation({ action: "remove_principal", user_id: principal.id, school_id: principal.school_id });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not remove the principal.");
      setActionLoadingId(null);
      return;
    }

    await fetchPrincipals();
    setActionLoadingId(null);
    alert("Principal removed from school.");
  }

  async function sendPasswordReset(principal: PrincipalProfile) {
    if (!principal.email) {
      alert("This principal does not have an email address.");
      return;
    }

    setActionLoadingId(principal.id);

    const { error } = await supabase.auth.resetPasswordForEmail(principal.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      alert(error.message);
      setActionLoadingId(null);
      return;
    }

    setActionLoadingId(null);
    alert("Password reset email sent.");
  }

  async function resendPrincipalAccess(principal: PrincipalProfile) {
    if (!principal.email) {
      alert("This principal does not have an email address.");
      return;
    }

    if (!principal.school_id) {
      alert("This principal is not linked to a school.");
      return;
    }

    setActionLoadingId(principal.id);

    const response = await authenticatedFetch("/api/invite-principal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        full_name: principal.full_name || "Principal",
        email: principal.email,
        school_id: Number(principal.school_id),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "Could not resend principal invite.");
      setActionLoadingId(null);
      return;
    }

    setActionLoadingId(null);
    alert("Principal access email resent.");
  }

  async function updatePrincipalEmail(principal: PrincipalProfile) {
    if (!principal.school_id || !editingPrincipalEmail.trim()) {
      alert("Enter a valid principal email address.");
      return;
    }

    setActionLoadingId(principal.id);
    try {
      const response = await authenticatedFetch("/api/account-email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: principal.id,
          school_id: principal.school_id,
          role: principal.role || "principal",
          email: editingPrincipalEmail.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Could not update the principal email.");
      }
      setEditingPrincipalId(null);
      setEditingPrincipalEmail("");
      await fetchPrincipals();
      alert("Principal email updated. The new email is now used for sign in.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not update the principal email.");
    } finally {
      setActionLoadingId(null);
    }
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

      {loadError ? (
        <div className="db-card" role="alert" style={{ padding: "14px 16px", marginBottom: "24px", borderColor: "#EBC9D8", background: "#FFF6F8" }}>
          {loadError}
        </div>
      ) : null}

      <div className="db-card db-card-blue" style={{ padding: "20px", marginBottom: "24px" }}>
        <h3 style={sectionTitle}>Filters</h3>

        <input
          className="db-input"
          placeholder="Search by principal, email, or school"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setVisiblePrincipalCount(5);
            setExpandedPrincipalId(null);
          }}
        />

        <select
          className="db-input"
          value={selectedSchoolId}
          onChange={(e) => {
            setSelectedSchoolId(e.target.value);
            setVisiblePrincipalCount(5);
            setExpandedPrincipalId(null);
          }}
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
          onChange={(e) => {
            setSelectedStatus(e.target.value);
            setVisiblePrincipalCount(5);
            setExpandedPrincipalId(null);
          }}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active Schools</option>
          <option value="inactive">Inactive Schools</option>
        </select>
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
          <>
            <div style={{ display: "grid", gap: "12px" }}>
              {visiblePrincipals.map((principal) => {
                const school = schoolsById.get(Number(principal.school_id));
                const schoolIsActive = String(school?.status || "active").toLowerCase() === "active";
                const principalIsActive = principal.is_active !== false;
                const effectiveActive = schoolIsActive && principalIsActive;
                const isBusy = actionLoadingId === principal.id;

                const schoolPackage = school?.package_name || "Bloom";
                const hasWageFlow =
                  schoolPackage === "Bloom Elite" ||
                  school?.wageflow_enabled === true;

                const isExpanded = expandedPrincipalId === principal.id;

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
                      <div style={{ flex: 1, minWidth: "220px" }}>
                        <strong style={{ fontSize: "17px" }}>
                          {principal.full_name || "Unnamed Principal"}
                        </strong>

                        {isExpanded && (
                          <div style={detailsPanel}>
                            <p style={textStyle}>
                              Email: {principal.email || "No email"}
                            </p>
                            {editingPrincipalId === principal.id ? (
                              <div style={{ display: "grid", gap: "10px", marginTop: "12px" }}>
                                <label style={{ display: "grid", gap: "7px", fontWeight: 700 }}>
                                  Login email address
                                  <input
                                    className="db-input"
                                    type="email"
                                    value={editingPrincipalEmail}
                                    onChange={(event) => setEditingPrincipalEmail(event.target.value)}
                                    disabled={isBusy}
                                  />
                                </label>
                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                  <button
                                    type="button"
                                    className="db-button-primary"
                                    style={smallButton}
                                    onClick={() => updatePrincipalEmail(principal)}
                                    disabled={isBusy}
                                  >
                                    {isBusy ? "Saving..." : "Save Email"}
                                  </button>
                                  <button
                                    type="button"
                                    className="db-button-secondary"
                                    style={smallButton}
                                    onClick={() => {
                                      setEditingPrincipalId(null);
                                      setEditingPrincipalEmail("");
                                    }}
                                    disabled={isBusy}
                                  >
                                    Close
                                  </button>
                                </div>
                              </div>
                            ) : null}
                            <p style={textStyle}>
                              School: {school?.school_name || "Not linked"}
                            </p>
                            <p style={textStyle}>Package: {schoolPackage}</p>
                            <p style={textStyle}>
                              WageFlow: {hasWageFlow ? "Enabled" : "Disabled"}
                            </p>
                            <p style={textStyle}>
                              Principal Status:{" "}
                              {principalIsActive ? "Active" : "Inactive"}
                            </p>
                            <p style={textStyle}>
                              School Status: {schoolIsActive ? "Active" : "Inactive"}
                            </p>
                            <p style={textStyle}>
                              Effective Access:{" "}
                              {effectiveActive ? "Active" : "Blocked"}
                            </p>
                            <p style={textStyle}>
                              Last Login:{" "}
                              {principal.last_login_at
                                ? new Date(principal.last_login_at).toLocaleString()
                                : "Not tracked yet"}
                            </p>

                            {hasWageFlow && effectiveActive ? (
                              <a
                                href="https://wageflow.lesedismartsolutions.co.za/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="db-button-primary"
                                style={{
                                  ...smallButton,
                                  display: "inline-block",
                                  textDecoration: "none",
                                  marginTop: "12px",
                                }}
                              >
                                Open WageFlow
                              </a>
                            ) : null}
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "10px",
                        }}
                      >
                        <button
                          type="button"
                          className="db-button-primary"
                          style={smallButton}
                          onClick={() =>
                            setExpandedPrincipalId(isExpanded ? null : principal.id)
                          }
                        >
                          {isExpanded ? "Close" : "View"}
                        </button>

                        {canManageSchoolStatus && effectiveActive ? (
                          <button
                            type="button"
                            className="db-button-primary"
                            style={smallButton}
                            onClick={() => deactivateSchoolAccess(principal)}
                            disabled={isBusy}
                          >
                            {isBusy ? "Working..." : "Deactivate School Access"}
                          </button>
                        ) : canManageSchoolStatus ? (
                          <button
                            type="button"
                            className="db-button-primary"
                            style={smallButton}
                            onClick={() => reactivateSchoolAccess(principal)}
                            disabled={isBusy}
                          >
                            {isBusy ? "Working..." : "Reactivate School Access"}
                          </button>
                        ) : null}

                        {canManagePrincipals ? (
                          <>
                            <button
                              type="button"
                              className="db-button-primary"
                              style={smallButton}
                              onClick={() => {
                                setExpandedPrincipalId(principal.id);
                                setEditingPrincipalId(principal.id);
                                setEditingPrincipalEmail(principal.email || "");
                              }}
                              disabled={isBusy}
                            >
                              Update Email
                            </button>

                            <button
                              type="button"
                              className="db-button-primary"
                              style={smallButton}
                              onClick={() => removePrincipalFromSchool(principal)}
                              disabled={isBusy}
                            >
                              {isBusy ? "Working..." : "Remove From School"}
                            </button>

                            <button
                              type="button"
                              className="db-button-primary"
                              style={smallButton}
                              onClick={() => resendPrincipalAccess(principal)}
                              disabled={isBusy}
                            >
                              {isBusy ? "Working..." : "Resend Invite"}
                            </button>

                            <button
                              type="button"
                              className="db-button-primary"
                              style={smallButton}
                              onClick={() => sendPasswordReset(principal)}
                              disabled={isBusy}
                            >
                              {isBusy ? "Working..." : "Reset Password"}
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {hasMorePrincipals && (
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                  marginTop: "16px",
                }}
              >
                <button
                  type="button"
                  className="db-button-primary"
                  style={smallButton}
                  onClick={() =>
                    setVisiblePrincipalCount((current) => current + 5)
                  }
                >
                  Load 5 More
                </button>

                <button
                  type="button"
                  className="db-button-primary"
                  style={smallButton}
                  onClick={() =>
                    setVisiblePrincipalCount((current) => current + 10)
                  }
                >
                  Load 10 More
                </button>
              </div>
            )}
          </>
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

const detailsPanel = {
  marginTop: "12px",
  paddingTop: "12px",
  borderTop: "1px solid #F0E3D8",
};

const smallButton = {
  minHeight: "40px",
  padding: "10px 14px",
} as const;
