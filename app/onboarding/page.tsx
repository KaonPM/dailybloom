"use client";

import { useEffect, useState } from "react";
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
    await fetchOnboarding();
  }

  async function fetchOnboarding() {
    const { data: schools, error: schoolsError } = await supabase
      .from("schools")
      .select("*")
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

    const merged = (schools || []).map((school: any) => {
      const record = onboarding?.find((item: any) => item.school_id === school.id);

      return {
        school_id: school.id,
        school_name: school.school_name,
        principal_name: school.principal_name || "Not added",
        package_name: school.package_name || school.package || "Not added",
        subscription_amount: school.subscription_amount || school.subscription || "Not added",
        setup_fee_amount: school.setup_fee_amount || school.setup_fee || "Not added",
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
    alert("Onboarding updated");
  }

  if (checkingAccess) {
    return <p>Loading...</p>;
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: "20px 22px", marginBottom: "24px" }}>
        <h1 className="db-page-title">School Onboarding Pipeline</h1>
        <p className="db-page-subtitle">
          Manage approved schools from signup approval until activation.
        </p>
      </div>

      <div className="db-card db-card-blue" style={{ padding: "20px", overflowX: "auto" }}>
        {rows.length === 0 ? (
          <p className="db-helper">No schools found yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1250px" }}>
            <thead>
              <tr>
                {[
                  "School",
                  "Principal",
                  "Package",
                  "Status",
                  "Setup Fee",
                  "Subscription",
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
              {rows.map((row) => (
                <tr key={row.school_id}>
                  <td style={tdStyle}>
                    <strong>{row.school_name}</strong>
                  </td>

                  <td style={tdStyle}>{row.principal_name}</td>

                  <td style={tdStyle}>{row.package_name}</td>

                  <td style={tdStyle}>
                    <select
                      className="db-input"
                      value={row.onboarding_status}
                      onChange={(e) =>
                        updateLocalRow(row.school_id, "onboarding_status", e.target.value)
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
                    <p style={smallText}>{row.setup_fee_amount}</p>
                    <label style={checkLabel}>
                      <input
                        type="checkbox"
                        checked={row.setup_fee_paid}
                        onChange={(e) =>
                          updateLocalRow(row.school_id, "setup_fee_paid", e.target.checked)
                        }
                      />
                      Paid
                    </label>
                  </td>

                  <td style={tdStyle}>
                    <p style={smallText}>{row.subscription_amount}</p>
                    <label style={checkLabel}>
                      <input
                        type="checkbox"
                        checked={row.subscription_paid}
                        onChange={(e) =>
                          updateLocalRow(row.school_id, "subscription_paid", e.target.checked)
                        }
                      />
                      Paid
                    </label>
                  </td>

                  <td style={tdStyle}>
                    <input
                      className="db-input"
                      type="date"
                      value={row.setup_date}
                      onChange={(e) =>
                        updateLocalRow(row.school_id, "setup_date", e.target.value)
                      }
                    />
                  </td>

                  <td style={tdStyle}>
                    <div style={{ display: "grid", gap: "8px" }}>
                      {[
                        ["logo_received", "Logo"],
                        ["brand_colours_received", "Brand colours"],
                        ["learner_list_received", "Learner list"],
                        ["teacher_list_received", "Teacher list"],
                        ["classroom_list_received", "Classroom list"],
                        ["year_planner_received", "Year planner"],
                      ].map(([field, label]) => (
                        <label key={field} style={checkLabel}>
                          <input
                            type="checkbox"
                            checked={row[field]}
                            onChange={(e) =>
                              updateLocalRow(row.school_id, field, e.target.checked)
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
                      rows={4}
                      placeholder="Onboarding notes"
                      value={row.onboarding_notes}
                      onChange={(e) =>
                        updateLocalRow(row.school_id, "onboarding_notes", e.target.value)
                      }
                    />
                  </td>

                  <td style={tdStyle}>
                    <button
                      className="db-button-primary"
                      onClick={() => saveRow(row)}
                      disabled={savingId === String(row.school_id)}
                    >
                      {savingId === String(row.school_id) ? "Saving..." : "Save"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const thStyle = {
  textAlign: "left" as const,
  padding: "12px",
  borderBottom: "1px solid rgba(0,0,0,0.08)",
  color: "var(--db-text)",
  fontSize: "14px",
  fontWeight: 800 as const,
};

const tdStyle = {
  padding: "12px",
  borderBottom: "1px solid rgba(0,0,0,0.06)",
  verticalAlign: "top" as const,
  color: "var(--db-text-soft)",
};

const smallText = {
  margin: "0 0 8px 0",
  color: "var(--db-text-soft)",
};

const checkLabel = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "14px",
  color: "var(--db-text-soft)",
};