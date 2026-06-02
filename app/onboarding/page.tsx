"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";
import { useRouter } from "next/navigation";

const statuses = [
  "Not started",
  "In progress",
  "Awaiting documents",
  "Setup scheduled",
  "Ready for activation",
  "Activated",
];

export default function OnboardingPage() {
  const router = useRouter();

  const [rows, setRows] = useState<any[]>([]);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(5);

  useEffect(() => {
    loadPage();
  }, []);

  const visibleRows = useMemo(() => {
    return rows.slice(0, visibleCount);
  }, [rows, visibleCount]);

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
      .eq("role", "principal");

    if (principalsError) {
      alert(principalsError.message);
      return;
    }

    const merged = (schools || []).map((school: any) => {
      const record = onboarding?.find(
        (item: any) => item.school_id === school.id
      );

      const principal = principals?.find(
        (item: any) => item.school_id === school.id
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
        setup_fee_amount: school.setup_fee_amount || school.setup_fee || "Not added",
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

  function updateLocalRow(schoolId: number, field: string, value: any) {
    setRows((current) =>
      current.map((row) =>
        row.school_id === schoolId ? { ...row, [field]: value } : row
      )
    );
  }

  async function saveRow(row: any) {
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

    const { error } = await supabase
      .from("school_onboarding")
      .upsert(payload, { onConflict: "school_id" });

    if (error) {
      alert(error.message);
      setSavingId(null);
      return;
    }

    await fetchOnboarding();
    setSavingId(null);
    alert("Onboarding updated.");
  }

  async function activateSchool(row: any) {
    const confirmed = window.confirm(
      `Activate ${row.school_name}?\n\nThis will mark the school as active and send the welcome email.`
    );

    if (!confirmed) return;

    setActivatingId(String(row.school_id));

    const { error: schoolError } = await supabase
      .from("schools")
      .update({
        status: "active",
        activated_at: new Date().toISOString(),
      })
      .eq("id", row.school_id);

    if (schoolError) {
      alert(schoolError.message);
      setActivatingId(null);
      return;
    }

    const { error: onboardingError } = await supabase
      .from("school_onboarding")
      .upsert(
        {
          school_id: row.school_id,
          onboarding_status: "Activated",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "school_id" }
      );

    if (onboardingError) {
      alert(onboardingError.message);
      setActivatingId(null);
      return;
    }

    const emailResponse = await fetch("/api/school-activated-email", {
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
          Manage approved schools from signup approval until activation.
        </p>
      </div>

      <div
        className="db-card db-card-blue"
        style={{ padding: "16px", overflowX: "auto" }}
      >
        {rows.length === 0 ? (
          <p className="db-helper">No schools found yet.</p>
        ) : (
          <>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "1180px",
              }}
            >
              <thead>
                <tr>
                  {[
                    "School",
                    "Principal",
                    "Package",
                    "Status",
                    "Fees",
                    "Setup Date",
                    "Documents",
                    "Notes",
                    "Action",
                  ].map((heading) => (
                    <th key={heading} style={thStyle}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.school_id}>
                    <td style={tdStyle}>
                      <strong>{row.school_name}</strong>
                      <p style={smallText}>School status: {row.school_status}</p>
                      <Link
                        href={`/master/school/${row.school_id}`}
                        style={smallLink}
                      >
                        Open overview
                      </Link>
                    </td>

                    <td style={tdStyle}>
                      <strong>{row.principal_name}</strong>
                      {row.principal_email ? (
                        <p style={smallText}>{row.principal_email}</p>
                      ) : null}
                    </td>

                    <td style={tdStyle}>{row.package_name}</td>

                    <td style={tdStyle}>
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
                    </td>

                    <td style={tdStyle}>
                      <p style={smallText}>Setup: {row.setup_fee_amount}</p>
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
                        Setup paid
                      </label>

                      <p style={smallText}>Sub: {row.subscription_amount}</p>
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
                        Sub paid
                      </label>
                    </td>

                    <td style={tdStyle}>
                      <input
                        className="db-input"
                        type="date"
                        value={row.setup_date}
                        onChange={(e) =>
                          updateLocalRow(
                            row.school_id,
                            "setup_date",
                            e.target.value
                          )
                        }
                      />
                    </td>

                    <td style={tdStyle}>
                      <div style={{ display: "grid", gap: "6px" }}>
                        {[
                          ["logo_received", "Logo"],
                          ["brand_colours_received", "Colours"],
                          ["learner_list_received", "Learners"],
                          ["teacher_list_received", "Teachers"],
                          ["classroom_list_received", "Classes"],
                          ["year_planner_received", "Planner"],
                        ].map(([field, label]) => (
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
                    </td>

                    <td style={tdStyle}>
                      <textarea
                        className="db-input"
                        rows={3}
                        placeholder="Notes"
                        value={row.onboarding_notes}
                        onChange={(e) =>
                          updateLocalRow(
                            row.school_id,
                            "onboarding_notes",
                            e.target.value
                          )
                        }
                      />
                    </td>

                    <td style={tdStyle}>
                      <div style={{ display: "grid", gap: "8px" }}>
                        <button
                          className="db-button-primary"
                          onClick={() => saveRow(row)}
                          disabled={savingId === String(row.school_id)}
                        >
                          {savingId === String(row.school_id)
                            ? "Saving..."
                            : "Save"}
                        </button>

                        {row.onboarding_status === "Ready for activation" &&
                          row.school_status !== "active" && (
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
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {visibleCount < rows.length && (
              <button
                type="button"
                style={{ ...secondaryButton, marginTop: "14px" }}
                onClick={() => setVisibleCount((current) => current + 5)}
              >
                Show Next 5
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const thStyle = {
  textAlign: "left" as const,
  padding: "10px",
  borderBottom: "1px solid rgba(0,0,0,0.08)",
  color: "var(--db-text)",
  fontSize: "13px",
  fontWeight: 800 as const,
};

const tdStyle = {
  padding: "10px",
  borderBottom: "1px solid rgba(0,0,0,0.06)",
  verticalAlign: "top" as const,
  color: "var(--db-text-soft)",
  fontSize: "13px",
};

const smallText = {
  margin: "4px 0",
  color: "var(--db-text-soft)",
  fontSize: "12px",
};

const checkLabel = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "12px",
  color: "var(--db-text-soft)",
};

const smallLink = {
  display: "inline-block",
  marginTop: "4px",
  color: "var(--db-text)",
  fontSize: "12px",
  fontWeight: 700,
  textDecoration: "underline",
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