"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getCurrentProfile } from "../../lib/auth";

type ReportRow = {
  school: string;
  type: string;
  detail: string;
  value: string;
  status: string;
};

const reportTypes = [
  "Schools Report",
  "Subscriptions Report",
  "Revenue Report",
  "Package Breakdown",
  "Overdue Schools",
  "Learners by School",
  "Teachers by School",
  "Registration Status",
  "WageFlow Enabled Schools",
];

export default function MasterReportsPage() {
  const router = useRouter();

  const [reportType, setReportType] = useState("Schools Report");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  async function checkAccess() {
    const { profile, error } = await getCurrentProfile();

    if (error || !profile) {
      router.push("/login");
      return;
    }

    if (profile.role !== "master") {
      router.push("/dashboard");
      return;
    }

    setLoading(false);
  }

  async function runReport() {
    setRunning(true);

    if (reportType === "Schools Report") await runSchoolsReport();
    if (reportType === "Subscriptions Report") await runSubscriptionsReport();
    if (reportType === "Revenue Report") await runRevenueReport();
    if (reportType === "Package Breakdown") await runPackageBreakdownReport();
    if (reportType === "Overdue Schools") await runOverdueSchoolsReport();
    if (reportType === "Learners by School") await runLearnersBySchoolReport();
    if (reportType === "Teachers by School") await runTeachersBySchoolReport();
    if (reportType === "Registration Status") await runRegistrationStatusReport();
    if (reportType === "WageFlow Enabled Schools") await runWageFlowReport();

    setShowResults(true);
    setRunning(false);
  }

  async function runSchoolsReport() {
    const { data, error } = await supabase
      .from("schools")
      .select("id, school_name, is_active, billing_status, status, package_name, registration_status")
      .order("school_name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setRows(
      (data || []).map((school: any) => ({
        school: school.school_name || "Unnamed school",
        type: "School",
        detail: `Package: ${school.package_name || "Not set"}`,
        value: `Billing: ${school.billing_status || "Not set"}`,
        status: school.registration_status || school.status || "Not set",
      }))
    );
  }

  async function runSubscriptionsReport() {
    const { data, error } = await supabase
      .from("school_subscriptions")
      .select(
        `
        school_id,
        plan_name,
        monthly_price,
        status,
        next_billing_date,
        schools (
          school_name
        )
      `
      )
      .order("next_billing_date", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setRows(
      (data || []).map((item: any) => ({
        school: item.schools?.school_name || `School ID ${item.school_id}`,
        type: "Subscription",
        detail: item.plan_name || "No plan",
        value: `R${Number(item.monthly_price || 0).toFixed(2)} | Next billing: ${
          item.next_billing_date || "Not set"
        }`,
        status: item.status || "Not set",
      }))
    );
  }

  async function runRevenueReport() {
    const { data, error } = await supabase
      .from("school_subscriptions")
      .select(
        `
        school_id,
        plan_name,
        monthly_price,
        status,
        schools (
          school_name
        )
      `
      );

    if (error) {
      alert(error.message);
      return;
    }

    setRows(
      (data || []).map((item: any) => {
        const monthly = Number(item.monthly_price || 0);
        return {
          school: item.schools?.school_name || `School ID ${item.school_id}`,
          type: "Revenue",
          detail: item.plan_name || "No plan",
          value: `Monthly: R${monthly.toFixed(2)} | Annual: R${(monthly * 12).toFixed(2)}`,
          status: item.status || "Not set",
        };
      })
    );
  }

  async function runPackageBreakdownReport() {
    const { data, error } = await supabase
      .from("school_subscriptions")
      .select("plan_name, status");

    if (error) {
      alert(error.message);
      return;
    }

    const packageMap = new Map<string, number>();

    (data || []).forEach((item: any) => {
      const plan = item.plan_name || "No package";
      packageMap.set(plan, (packageMap.get(plan) || 0) + 1);
    });

    setRows(
      Array.from(packageMap.entries()).map(([plan, count]) => ({
        school: "All Schools",
        type: "Package Breakdown",
        detail: plan,
        value: String(count),
        status: "Total schools",
      }))
    );
  }

  async function runOverdueSchoolsReport() {
    const { data, error } = await supabase
      .from("school_subscriptions")
      .select(
        `
        school_id,
        plan_name,
        monthly_price,
        status,
        next_billing_date,
        schools (
          school_name
        )
      `
      )
      .eq("status", "overdue")
      .order("next_billing_date", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setRows(
      (data || []).map((item: any) => ({
        school: item.schools?.school_name || `School ID ${item.school_id}`,
        type: "Overdue Subscription",
        detail: item.plan_name || "No plan",
        value: `R${Number(item.monthly_price || 0).toFixed(2)} | Due: ${
          item.next_billing_date || "Not set"
        }`,
        status: item.status || "overdue",
      }))
    );
  }

  async function runLearnersBySchoolReport() {
    const { data, error } = await supabase
      .from("learners")
      .select(
        `
        id,
        school_id,
        schools (
          school_name
        )
      `
      )
      .or("is_deleted.is.null,is_deleted.eq.false");

    if (error) {
      alert(error.message);
      return;
    }

    const schoolMap = new Map<string, number>();

    (data || []).forEach((item: any) => {
      const schoolName = item.schools?.school_name || `School ID ${item.school_id}`;
      schoolMap.set(schoolName, (schoolMap.get(schoolName) || 0) + 1);
    });

    setRows(
      Array.from(schoolMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([school, count]) => ({
          school,
          type: "Learners",
          detail: "Active learners",
          value: String(count),
          status: "Current",
        }))
    );
  }

  async function runTeachersBySchoolReport() {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        `
        id,
        school_id,
        schools (
          school_name
        )
      `
      )
      .eq("role", "teacher");

    if (error) {
      alert(error.message);
      return;
    }

    const schoolMap = new Map<string, number>();

    (data || []).forEach((item: any) => {
      const schoolName = item.schools?.school_name || `School ID ${item.school_id}`;
      schoolMap.set(schoolName, (schoolMap.get(schoolName) || 0) + 1);
    });

    setRows(
      Array.from(schoolMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([school, count]) => ({
          school,
          type: "Teachers",
          detail: "Teacher profiles",
          value: String(count),
          status: "Current",
        }))
    );
  }

  async function runRegistrationStatusReport() {
    const { data, error } = await supabase
      .from("schools")
      .select("school_name, registration_status, status")
      .order("school_name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setRows(
      (data || []).map((school: any) => ({
        school: school.school_name || "Unnamed school",
        type: "Registration Status",
        detail: "DBE registration status",
        value: school.registration_status || "Not set",
        status: school.status || "Not set",
      }))
    );
  }

  async function runWageFlowReport() {
    const { data, error } = await supabase
      .from("schools")
      .select("school_name, wageflow_enabled, package_name")
      .eq("wageflow_enabled", true)
      .order("school_name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setRows(
      (data || []).map((school: any) => ({
        school: school.school_name || "Unnamed school",
        type: "WageFlow",
        detail: "WageFlow enabled",
        value: school.package_name || "Not set",
        status: "Enabled",
      }))
    );
  }

  function buildFilename(extension: string) {
    return `${reportType.toLowerCase().replace(/\s+/g, "-")}-${new Date()
      .toISOString()
      .split("T")[0]}.${extension}`;
  }

  function exportCsv() {
    if (rows.length === 0) {
      alert("No report results to export.");
      return;
    }

    const headers = ["school", "type", "detail", "value", "status"];
    const csvRows = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((header) => {
            const value = String((row as any)[header] || "");
            return `"${value.replace(/"/g, '""')}"`;
          })
          .join(",")
      ),
    ];

    downloadBlob(csvRows.join("\n"), "text/csv;charset=utf-8;", buildFilename("csv"));
  }

  function exportExcel() {
    if (rows.length === 0) {
      alert("No report results to export.");
      return;
    }

    const tableRows = rows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.school)}</td>
            <td>${escapeHtml(row.type)}</td>
            <td>${escapeHtml(row.detail)}</td>
            <td>${escapeHtml(row.value)}</td>
            <td>${escapeHtml(row.status)}</td>
          </tr>
        `
      )
      .join("");

    const html = `
      <html>
        <head><meta charset="UTF-8" /></head>
        <body>
          <table border="1">
            <thead>
              <tr>
                <th>School</th>
                <th>Type</th>
                <th>Detail</th>
                <th>Value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </body>
      </html>
    `;

    downloadBlob(html, "application/vnd.ms-excel;charset=utf-8;", buildFilename("xls"));
  }

  function exportPdf() {
    if (rows.length === 0) {
      alert("No report results to export.");
      return;
    }

    const tableRows = rows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.school)}</td>
            <td>${escapeHtml(row.type)}</td>
            <td>${escapeHtml(row.detail)}</td>
            <td>${escapeHtml(row.value)}</td>
            <td>${escapeHtml(row.status)}</td>
          </tr>
        `
      )
      .join("");

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      alert("Could not open print window. Please allow pop-ups and try again.");
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${escapeHtml(reportType)}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 24px;
              color: #2D2A3E;
            }
            h1 {
              margin: 0 0 6px 0;
              font-size: 22px;
            }
            p {
              margin: 0 0 18px 0;
              color: #5B5675;
              font-size: 13px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
            }
            th,
            td {
              border: 1px solid #D8D8D8;
              padding: 7px;
              text-align: left;
              vertical-align: top;
            }
            th {
              background: #EAF7FD;
            }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(reportType)}</h1>
          <p>Generated by DailyBloom Master Dashboard</p>
          <table>
            <thead>
              <tr>
                <th>School</th>
                <th>Type</th>
                <th>Detail</th>
                <th>Value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
          <script>
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  }

  function downloadBlob(content: string, type: string, filename: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  function escapeHtml(value: string) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  if (loading) {
    return <p>Loading platform reports...</p>;
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: 18, marginBottom: 18 }}>
        <h2 className="db-page-title">Platform Reports</h2>
        <p className="db-page-subtitle">
          Generate master-level reports across all DailyBloom schools.
        </p>
      </div>

      <div className="db-card db-card-blue" style={{ padding: 16, marginBottom: 18 }}>
        <h3 style={sectionTitle}>Report Filters</h3>

        <div style={grid}>
          <div>
            <p style={labelText}>Report Type</p>
            <select
              className="db-input"
              value={reportType}
              onChange={(event) => setReportType(event.target.value)}
            >
              {reportTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <button
            type="button"
            className="db-button-primary"
            onClick={runReport}
            disabled={running}
          >
            {running ? "Running..." : "Run Report"}
          </button>

          <button type="button" className="db-button-secondary" onClick={exportCsv}>
            Export CSV
          </button>

          <button type="button" className="db-button-secondary" onClick={exportExcel}>
            Export Excel
          </button>

          <button type="button" className="db-button-secondary" onClick={exportPdf}>
            Export PDF
          </button>
        </div>
      </div>

      <div className="db-card db-card-green" style={{ padding: 16 }}>
        <div style={sectionHeader}>
          <div>
            <h3 style={sectionTitle}>Report Results ({rows.length})</h3>
            <p style={smallText}>
              Generate a report, then export it as CSV, Excel or PDF.
            </p>
          </div>

          <button
            type="button"
            className="db-button-secondary"
            onClick={() => setShowResults((prev) => !prev)}
          >
            {showResults ? "Hide" : "View Results"}
          </button>
        </div>

        {showResults ? (
          rows.length === 0 ? (
            <p className="db-helper" style={{ marginTop: 12 }}>
              No report results yet.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              {rows.map((row, index) => (
                <div key={`${row.school}-${row.type}-${index}`} style={resultRow}>
                  <div>
                    <strong>{row.school}</strong>
                    <p style={smallText}>{row.type}</p>
                  </div>

                  <div>
                    <strong>{row.detail}</strong>
                    <p style={smallText}>{row.value}</p>
                    <p style={smallText}>Status: {row.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}

const sectionTitle = {
  margin: "0 0 10px 0",
  color: "#2D2A3E",
  fontSize: 20,
  fontWeight: 700 as const,
};

const labelText = {
  margin: "0 0 8px 0",
  color: "#6D6888",
  fontSize: 13,
  fontWeight: 800,
};

const smallText = {
  margin: "4px 0 0 0",
  color: "#6D6888",
  fontSize: 13,
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
};

const sectionHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap" as const,
};

const resultRow = {
  display: "grid",
  gridTemplateColumns: "220px 1fr",
  gap: 12,
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: 12,
  padding: "10px 12px",
};