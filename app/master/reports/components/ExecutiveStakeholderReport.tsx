"use client";

import { stakeholderPresets } from "../report-config";
import type { ReportRow, StakeholderPresetKey } from "../types";

type ExecutiveStakeholderReportProps = {
  rows: ReportRow[];
  preset: StakeholderPresetKey;
  onPresetChange: (preset: StakeholderPresetKey) => void;
  periodLabel: string;
  lastRefreshed: string;
  warnings: string[];
};

const categoryStyles: Record<string, { border: string; background: string }> = {
  "Reach & Capacity": { border: "#78C9ED", background: "#F1FAFE" },
  "Learning & Readiness": { border: "#9F8BEF", background: "#F7F4FF" },
  "Parent Engagement": { border: "#F1B7D4", background: "#FFF5FA" },
  "Safeguarding & Support": { border: "#F3C95C", background: "#FFFAEC" },
  "Adoption & Data Quality": { border: "#72C997", background: "#F2FBF6" },
  "Financial Sustainability": { border: "#85BDF5", background: "#F3F8FF" },
  "Sponsorship & Impact": { border: "#E9A76C", background: "#FFF7F0" },
};

function buildNarrative(rows: ReportRow[]) {
  const valueFor = (detail: string) =>
    rows.find((row) => row.detail === detail)?.value || "not available";

  return `The selected portfolio currently represents ${valueFor(
    "Schools in scope"
  )} schools and ${valueFor(
    "Learners reached"
  )} learners. Attendance for the selected period is ${valueFor(
    "Learner attendance rate"
  )}, while ${valueFor(
    "Schools using DailyBloom"
  )} of schools recorded operational activity. This view separates current reach from activity measured during the selected reporting period.`;
}

export default function ExecutiveStakeholderReport({
  rows,
  preset,
  onPresetChange,
  periodLabel,
  lastRefreshed,
  warnings,
}: ExecutiveStakeholderReportProps) {
  const activePreset =
    stakeholderPresets.find((item) => item.key === preset) ||
    stakeholderPresets[0];
  const visibleRows = rows.filter((row) =>
    activePreset.categories.includes(row.type)
  );

  return (
    <div style={{ display: "grid", gap: 16, marginTop: 14 }}>
      <div
        style={{
          border: "1px solid #E9DDF5",
          borderRadius: 16,
          padding: 16,
          background: "linear-gradient(135deg, #FFF9FC 0%, #F2FAFE 100%)",
        }}
      >
        <div style={header}>
          <div>
            <p style={eyebrow}>STAKEHOLDER VIEW</p>
            <h3 style={{ margin: 0, color: "#2D2A3E", fontSize: 22 }}>
              DailyBloom Executive Reporting
            </h3>
            <p style={muted}>{activePreset.description}</p>
          </div>

          <select
            className="db-input"
            aria-label="Stakeholder reporting view"
            value={preset}
            onChange={(event) =>
              onPresetChange(event.target.value as StakeholderPresetKey)
            }
            style={{ maxWidth: 240 }}
          >
            {stakeholderPresets.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <p style={{ ...muted, marginTop: 14 }}>{buildNarrative(rows)}</p>

        <div style={metaGrid}>
          <span>
            <strong>Reporting period:</strong> {periodLabel}
          </span>
          <span>
            <strong>Last refreshed:</strong> {lastRefreshed}
          </span>
          <span>
            <strong>Scope:</strong>{" "}
            {rows.find((row) => row.detail === "Schools in scope")?.value ||
              "Data unavailable"}{" "}
            schools
          </span>
        </div>
      </div>

      {warnings.length > 0 ? (
        <div
          role="status"
          style={{
            border: "1px solid #F0CF7C",
            background: "#FFF9E9",
            borderRadius: 14,
            padding: "12px 14px",
            color: "#6B5420",
          }}
        >
          <strong>Data quality notice</strong>
          <p style={{ ...muted, color: "#6B5420" }}>
            {warnings.length} indicator{warnings.length === 1 ? "" : "s"} could
            not be calculated. They are shown as &quot;Data unavailable&quot;
            instead of zero.
          </p>
        </div>
      ) : null}

      {activePreset.categories.map((category) => {
        const categoryRows = visibleRows.filter((row) => row.type === category);
        if (categoryRows.length === 0) return null;
        const colors = categoryStyles[category] || {
          border: "#78C9ED",
          background: "#F7FBFD",
        };

        return (
          <section
            key={category}
            style={{
              border: `1px solid ${colors.border}`,
              borderTopWidth: 5,
              borderRadius: 16,
              padding: 14,
              background: colors.background,
            }}
          >
            <div style={header}>
              <h4 style={{ margin: 0, color: "#2D2A3E", fontSize: 18 }}>
                {category}
              </h4>
              <span style={periodPill}>
                {categoryRows.some((row) => row.status === "Period")
                  ? "Selected period"
                  : "Current position"}
              </span>
            </div>

            <div style={metricGrid}>
              {categoryRows.map((row) => {
                const unavailable = row.value === "Data unavailable";
                return (
                  <article
                    key={`${row.type}-${row.detail}`}
                    style={{
                      border: "1px solid rgba(45, 42, 62, 0.10)",
                      borderRadius: 13,
                      padding: 13,
                      background: "#FFFFFF",
                    }}
                  >
                    <p style={metricLabel}>{row.detail}</p>
                    <strong
                      style={{
                        display: "block",
                        marginTop: 6,
                        color: unavailable ? "#A04459" : "#2D2A3E",
                        fontSize: unavailable ? 15 : 24,
                      }}
                    >
                      {row.value}
                    </strong>
                    <p style={metricStatus}>{row.status}</p>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      <details
        style={{
          border: "1px solid #E9DDD3",
          borderRadius: 14,
          padding: "12px 14px",
          background: "#FFFDFB",
        }}
      >
        <summary style={{ cursor: "pointer", fontWeight: 800, color: "#2D2A3E" }}>
          Definitions and interpretation
        </summary>
        <ul style={{ ...muted, paddingLeft: 20, lineHeight: 1.6 }}>
          <li>Current indicators reflect records available at refresh time.</li>
          <li>
            Period indicators include activity dated inside the selected
            reporting period.
          </li>
          <li>
            Expected monthly revenue is based on active or trial subscription
            prices; it is not cash received.
          </li>
          <li>
            A school is counted as using DailyBloom when it records attendance,
            a summary, a broadcast or a learner report during the period.
          </li>
          <li>
            Percentages show their numerator and denominator in the indicator
            status where relevant.
          </li>
        </ul>
      </details>
    </div>
  );
}

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap" as const,
};

const eyebrow = {
  margin: "0 0 5px",
  color: "#7B61B3",
  fontWeight: 900,
  letterSpacing: "0.08em",
  fontSize: 11,
};

const muted = {
  margin: "5px 0 0",
  color: "#6D6888",
  fontSize: 13,
};

const metaGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 8,
  marginTop: 14,
  color: "#514C69",
  fontSize: 12,
};

const metricGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))",
  gap: 10,
  marginTop: 12,
};

const metricLabel = {
  margin: 0,
  color: "#5C5673",
  fontSize: 13,
  fontWeight: 750,
};

const metricStatus = {
  margin: "6px 0 0",
  color: "#817B96",
  fontSize: 11,
};

const periodPill = {
  borderRadius: 999,
  background: "#FFFFFF",
  border: "1px solid rgba(45, 42, 62, 0.10)",
  padding: "5px 9px",
  color: "#625C78",
  fontSize: 11,
  fontWeight: 800,
};
