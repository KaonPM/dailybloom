"use client";

import Link from "next/link";
import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";
import { useRouter } from "next/navigation";
import { authenticatedFetch } from "../lib/authenticated-fetch";
import { PERMISSIONS } from "../lib/permissions";

const statuses = [
  "Not started",
  "In progress",
  "Awaiting documents",
  "Setup scheduled",
  "Ready for activation",
  "Activated",
];

type OnboardingRow = {
  school_id: number;
  school_name?: string | null;
  principal_name: string;
  principal_email: string;
  package_name: string;
  subscription_amount: string | number;
  setup_fee_amount: string | number;
  school_status: string;
  onboarding_id: number | null;
  onboarding_status: string;
  setup_fee_paid: boolean;
  subscription_paid: boolean;
  setup_date: string;
  onboarding_notes: string;
  logo_received: boolean;
  brand_colours_received: boolean;
  learner_list_received: boolean;
  teacher_list_received: boolean;
  classroom_list_received: boolean;
  year_planner_received: boolean;
};

type SchoolSourceRow = {
  id: number;
  school_name?: string | null;
  principal_name?: string | null;
  principal_email?: string | null;
  package_name?: string | null;
  package?: string | null;
  subscription_amount?: string | number | null;
  subscription?: string | number | null;
  setup_fee_amount?: string | number | null;
  setup_fee?: string | number | null;
  status?: string | null;
};

type OnboardingSourceRow = Partial<Omit<OnboardingRow, "school_name" | "principal_name" | "principal_email" | "package_name" | "subscription_amount" | "setup_fee_amount" | "school_status">> & {
  id?: number | null;
  school_id: number;
};

type PrincipalSourceRow = {
  school_id?: number | null;
  full_name?: string | null;
  email?: string | null;
};

type OnboardingBooleanField =
  | "logo_received"
  | "brand_colours_received"
  | "learner_list_received"
  | "teacher_list_received"
  | "classroom_list_received"
  | "year_planner_received";

const onboardingDocumentFields: Array<[OnboardingBooleanField, string]> = [
  ["logo_received", "Logo received"],
  ["brand_colours_received", "Brand colours received"],
  ["learner_list_received", "Learner list received"],
  ["teacher_list_received", "Teacher list received"],
  ["classroom_list_received", "Classroom list received"],
  ["year_planner_received", "Year planner received"],
];

export default function OnboardingPage() {
  const router = useRouter();

  const [rows, setRows] = useState<OnboardingRow[]>([]);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [pendingVisibleCount, setPendingVisibleCount] = useState(5);
  const [completedVisibleCount, setCompletedVisibleCount] = useState(5);
  const [canActivateSchools, setCanActivateSchools] = useState(false);
  const [canOpenMasterOverview, setCanOpenMasterOverview] = useState(false);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    const { profile, error } = await getCurrentProfile();

    if (error || !profile) {
      router.push("/login");
      return;
    }

    const delegatedPermissions = Array.isArray(profile.permissions) ? profile.permissions : [];
    if (
      profile.role !== "master" &&
      !(profile.role === "master_admin" && delegatedPermissions.includes(PERMISSIONS.SCHOOL_ONBOARD))
    ) {
      router.push(profile.role === "master_admin" ? "/master-admin" : "/dashboard");
      return;
    }

    setCanActivateSchools(
      profile.role === "master" || delegatedPermissions.includes(PERMISSIONS.SCHOOL_STATUS)
    );
    setCanOpenMasterOverview(profile.role === "master");
    setCheckingAccess(false);
    await fetchOnboarding();
  }

  async function fetchOnboarding() {
    const { data: schools, error: schoolsError } = await supabase
      .from("schools")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (schoolsError) {
      alert(schoolsError.message);
      return;
    }

    const { data: onboarding, error: onboardingError } = await supabase
      .from("school_onboarding")
      .select("*");

    if (onboardingError) {
      alert(onboardingError.message);
      return;
    }

    const { data: principals, error: principalsError } = await supabase
      .from("profiles")
      .select("id, full_name, email, school_id")
      .in("role", ["owner", "principal"]);

    if (principalsError) {
      alert(principalsError.message);
      return;
    }

    const merged = ((schools || []) as SchoolSourceRow[]).map((school) => {
      const record = (onboarding as OnboardingSourceRow[] | null)?.find(
        (item) => item.school_id === school.id
      );

      const principal = (principals as PrincipalSourceRow[] | null)?.find(
        (item) => item.school_id === school.id
      );

      return {
        school_id: school.id,
        school_name: school.school_name,
        principal_name:
          principal?.full_name || school.principal_name || "Not added",
        principal_email: principal?.email || school.principal_email || "",
        package_name: school.package_name || school.package || "Not added",
        subscription_amount:
          school.subscription_amount || school.subscription || "Not added",
        setup_fee_amount:
          school.setup_fee_amount || school.setup_fee || "Not added",
        school_status: school.status || "inactive",
        onboarding_id: record?.id || null,
        onboarding_status: record?.onboarding_status || "Not started",
        setup_fee_paid: record?.setup_fee_paid || false,
        subscription_paid: record?.subscription_paid || false,
        setup_date: record?.setup_date || "",
        onboarding_notes: record?.onboarding_notes || "",
        logo_received: record?.logo_received || false,
        brand_colours_received: record?.brand_colours_received || false,
        learner_list_received: record?.learner_list_received || false,
        teacher_list_received: record?.teacher_list_received || false,
        classroom_list_received: record?.classroom_list_received || false,
        year_planner_received: record?.year_planner_received || false,
      };
    });

    setRows(merged);
  }

  function updateLocalRow<K extends keyof OnboardingRow>(schoolId: number, field: K, value: OnboardingRow[K]) {
    setRows((current) =>
      current.map((row) =>
        row.school_id === schoolId ? { ...row, [field]: value } : row
      )
    );
  }

  async function runPlatformOperation(payload: Record<string, unknown>) {
    const response = await authenticatedFetch("/api/platform-operations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not update onboarding.");
    return result;
  }

  async function saveRow(row: OnboardingRow) {
    setSavingId(String(row.school_id));

    const payload = {
      school_id: row.school_id,
      onboarding_status: row.onboarding_status,
      setup_fee_paid: row.setup_fee_paid,
      subscription_paid: row.subscription_paid,
      setup_date: row.setup_date || null,
      onboarding_notes: row.onboarding_notes || null,
      logo_received: row.logo_received,
      brand_colours_received: row.brand_colours_received,
      learner_list_received: row.learner_list_received,
      teacher_list_received: row.teacher_list_received,
      classroom_list_received: row.classroom_list_received,
      year_planner_received: row.year_planner_received,
      updated_at: new Date().toISOString(),
    };

    try {
      await runPlatformOperation({ action: "save_onboarding", ...payload });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not update onboarding.");
      setSavingId(null);
      return;
    }

    await fetchOnboarding();
    setSavingId(null);
    setEditingId(null);
    alert("Onboarding updated.");
  }

  async function activateSchool(row: OnboardingRow) {
    const confirmed = window.confirm(
      `Activate ${row.school_name}?\n\nThis will mark the school as active and send the welcome email.`
    );

    if (!confirmed) return;

    setActivatingId(String(row.school_id));

    try {
      await runPlatformOperation({ action: "activate_school", school_id: row.school_id });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not activate the school.");
      setActivatingId(null);
      return;
    }

    const emailResponse = await authenticatedFetch("/api/school-activated-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schoolId: row.school_id,
      }),
    });

    const emailResult = await emailResponse.json();

    await fetchOnboarding();
    setActivatingId(null);
    setEditingId(null);

    if (!emailResponse.ok) {
      alert(
        `School activated, but welcome email was not sent: ${
          emailResult.error || "Unknown email error"
        }`
      );
      return;
    }

    alert("School activated and welcome email sent.");
  }

  const pendingRows = useMemo(() => {
    return rows.filter((row) => row.onboarding_status !== "Activated");
  }, [rows]);

  const completedRows = useMemo(() => {
    return rows.filter((row) => row.onboarding_status === "Activated");
  }, [rows]);

  const visiblePendingRows = pendingRows.slice(0, pendingVisibleCount);
  const visibleCompletedRows = completedRows.slice(0, completedVisibleCount);

  if (checkingAccess) {
    return <p>Loading...</p>;
  }

  return (
    <div>
      <div
        className="db-soft-card"
        style={{ padding: "20px 22px", marginBottom: "24px" }}
      >
        <h1 className="db-page-title">School Onboarding Pipeline</h1>
        <p className="db-page-subtitle">
          View pending onboarding and completed onboarding separately.
        </p>
      </div>

      <OnboardingSection
        title="Pending Onboarding"
        rows={visiblePendingRows}
        total={pendingRows.length}
        expandedId={expandedId}
        editingId={editingId}
        savingId={savingId}
        activatingId={activatingId}
        setExpandedId={setExpandedId}
        setEditingId={setEditingId}
        updateLocalRow={updateLocalRow}
        saveRow={saveRow}
        activateSchool={activateSchool}
        canActivateSchools={canActivateSchools}
        canOpenMasterOverview={canOpenMasterOverview}
      />

      {pendingRows.length > pendingVisibleCount ? (
        <LoadMoreButtons
          onLoad5={() => setPendingVisibleCount((current) => current + 5)}
          onLoad10={() => setPendingVisibleCount((current) => current + 10)}
        />
      ) : null}

      <OnboardingSection
        title="Completed Onboarding"
        rows={visibleCompletedRows}
        total={completedRows.length}
        expandedId={expandedId}
        editingId={editingId}
        savingId={savingId}
        activatingId={activatingId}
        setExpandedId={setExpandedId}
        setEditingId={setEditingId}
        updateLocalRow={updateLocalRow}
        saveRow={saveRow}
        activateSchool={activateSchool}
        canActivateSchools={canActivateSchools}
        canOpenMasterOverview={canOpenMasterOverview}
      />

      {completedRows.length > completedVisibleCount ? (
        <LoadMoreButtons
          onLoad5={() => setCompletedVisibleCount((current) => current + 5)}
          onLoad10={() => setCompletedVisibleCount((current) => current + 10)}
        />
      ) : null}
    </div>
  );
}

type OnboardingSectionProps = {
  title: string;
  rows: OnboardingRow[];
  total: number;
  expandedId: number | null;
  editingId: number | null;
  savingId: string | null;
  activatingId: string | null;
  setExpandedId: Dispatch<SetStateAction<number | null>>;
  setEditingId: Dispatch<SetStateAction<number | null>>;
  updateLocalRow: <K extends keyof OnboardingRow>(schoolId: number, field: K, value: OnboardingRow[K]) => void;
  saveRow: (row: OnboardingRow) => Promise<void>;
  activateSchool: (row: OnboardingRow) => Promise<void>;
  canActivateSchools: boolean;
  canOpenMasterOverview: boolean;
};

function OnboardingSection({
  title,
  rows,
  total,
  expandedId,
  editingId,
  savingId,
  activatingId,
  setExpandedId,
  setEditingId,
  updateLocalRow,
  saveRow,
  activateSchool,
  canActivateSchools,
  canOpenMasterOverview,
}: OnboardingSectionProps) {
  return (
    <div
      className="db-card db-card-blue"
      style={{ padding: "18px", marginBottom: "18px" }}
    >
      <h3 style={sectionTitle}>
        {title} ({total})
      </h3>

      {rows.length === 0 ? (
        <p className="db-helper">No schools in this section.</p>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {rows.map((row) => {
            const isExpanded = expandedId === row.school_id;
            const isEditing = editingId === row.school_id;

            return (
              <div key={row.school_id} className="db-list-card">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <strong style={{ fontSize: "17px" }}>
                    {row.school_name || "Unnamed school"}
                  </strong>

                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      style={smallButton}
                      onClick={() => {
                        setExpandedId(isExpanded ? null : row.school_id);
                        setEditingId(null);
                      }}
                    >
                      {isExpanded ? "Hide" : "View"}
                    </button>

                    <button
                      type="button"
                      style={smallButton}
                      onClick={() => {
                        setEditingId(isEditing ? null : row.school_id);
                        setExpandedId(row.school_id);
                      }}
                    >
                      {isEditing ? "Close Edit" : "Edit"}
                    </button>

                    {canOpenMasterOverview ? (
                      <Link
                        href={`/master/school/${row.school_id}`}
                        style={primaryButton}
                      >
                        Open School Overview
                      </Link>
                    ) : null}
                  </div>
                </div>

                {isExpanded ? (
                  <div style={detailsPanel}>
                    <p style={textStyle}>
                      Principal: {row.principal_name || "Not added"}
                    </p>
                    <p style={textStyle}>
                      Email: {row.principal_email || "Not added"}
                    </p>
                    <p style={textStyle}>Package: {row.package_name}</p>
                    <p style={textStyle}>
                      School Status: {row.school_status || "inactive"}
                    </p>
                    <p style={textStyle}>
                      Onboarding Status: {row.onboarding_status}
                    </p>
                    <p style={textStyle}>
                      Setup Fee Paid: {row.setup_fee_paid ? "Yes" : "No"}
                    </p>
                    <p style={textStyle}>
                      Subscription Paid: {row.subscription_paid ? "Yes" : "No"}
                    </p>
                    <p style={textStyle}>
                      Setup Date: {row.setup_date || "Not set"}
                    </p>
                    <p style={textStyle}>
                      Notes: {row.onboarding_notes || "No notes"}
                    </p>
                  </div>
                ) : null}

                {isEditing ? (
                  <div style={editPanel}>
                    <label style={labelStyle}>Onboarding Status</label>
                    <select
                      className="db-input"
                      value={row.onboarding_status}
                      onChange={(e) =>
                        updateLocalRow(
                          row.school_id,
                          "onboarding_status",
                          e.target.value
                        )
                      }
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>

                    <label style={checkLabel}>
                      <input
                        type="checkbox"
                        checked={row.setup_fee_paid}
                        onChange={(e) =>
                          updateLocalRow(
                            row.school_id,
                            "setup_fee_paid",
                            e.target.checked
                          )
                        }
                      />
                      Setup fee paid
                    </label>

                    <label style={checkLabel}>
                      <input
                        type="checkbox"
                        checked={row.subscription_paid}
                        onChange={(e) =>
                          updateLocalRow(
                            row.school_id,
                            "subscription_paid",
                            e.target.checked
                          )
                        }
                      />
                      Subscription paid
                    </label>

                    <label style={labelStyle}>Setup Date</label>
                    <input
                      className="db-input"
                      type="date"
                      value={row.setup_date}
                      onChange={(e) =>
                        updateLocalRow(row.school_id, "setup_date", e.target.value)
                      }
                    />

                    <div style={documentGrid}>
                      {onboardingDocumentFields.map(([field, label]) => (
                        <label key={field} style={checkLabel}>
                          <input
                            type="checkbox"
                            checked={row[field]}
                            onChange={(e) =>
                              updateLocalRow(
                                row.school_id,
                                field,
                                e.target.checked
                              )
                            }
                          />
                          {label}
                        </label>
                      ))}
                    </div>

                    <label style={labelStyle}>Notes</label>
                    <textarea
                      className="db-input"
                      rows={3}
                      value={row.onboarding_notes}
                      onChange={(e) =>
                        updateLocalRow(
                          row.school_id,
                          "onboarding_notes",
                          e.target.value
                        )
                      }
                    />

                    <div style={{ display: "grid", gap: "8px", marginTop: "10px" }}>
                      <button
                        type="button"
                        className="db-button-primary"
                        onClick={() => saveRow(row)}
                        disabled={savingId === String(row.school_id)}
                      >
                        {savingId === String(row.school_id)
                          ? "Saving..."
                          : "Save Onboarding"}
                      </button>

                      {canActivateSchools &&
                      row.onboarding_status === "Ready for activation" &&
                      row.school_status !== "active" ? (
                        <button
                          type="button"
                          className="db-button-primary"
                          onClick={() => activateSchool(row)}
                          disabled={activatingId === String(row.school_id)}
                        >
                          {activatingId === String(row.school_id)
                            ? "Activating..."
                            : "Activate School"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LoadMoreButtons({
  onLoad5,
  onLoad10,
}: {
  onLoad5: () => void;
  onLoad10: () => void;
}) {
  return (
    <div style={{ display: "flex", gap: "10px", marginBottom: "18px" }}>
      <button type="button" style={smallButton} onClick={onLoad5}>
        Load 5 More
      </button>

      <button type="button" style={smallButton} onClick={onLoad10}>
        Load 10 More
      </button>
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
  marginTop: "14px",
  paddingTop: "14px",
  borderTop: "1px solid #F0E3D8",
};

const editPanel = {
  marginTop: "14px",
  paddingTop: "14px",
  borderTop: "1px solid #F0E3D8",
  display: "grid",
  gap: "10px",
};

const documentGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "8px",
};

const labelStyle = {
  display: "block",
  color: "var(--db-text)",
  fontWeight: 700,
  fontSize: "13px",
};

const checkLabel = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  color: "var(--db-text-soft)",
  fontSize: "13px",
};

const smallButton = {
  background: "#FFFFFF",
  color: "#2D2A3E",
  border: "1px solid #E3D9CD",
  borderRadius: "12px",
  padding: "9px 12px",
  fontWeight: 600,
  cursor: "pointer",
};

const primaryButton = {
  textDecoration: "none",
  background: "#7CCCF3",
  color: "#2D2A3E",
  border: "1px solid #CBEAF7",
  borderRadius: "12px",
  padding: "9px 12px",
  fontWeight: 600,
  display: "inline-block",
};
