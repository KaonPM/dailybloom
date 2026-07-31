"use client";

import type { CSSProperties } from "react";
import {
  getCategoryIndicators,
  makeAssessmentKey,
} from "../../lib/progress-report-assessments";
import type {
  ProgressReportCategory,
  ProgressReportId,
  ProgressReportRatingLevel,
  ProgressReportType,
} from "../../lib/progress-report-types";

type AssessmentSummary = {
  learner_id?: ProgressReportId;
  classroom_id?: number | null;
  teacher_id?: string | null;
  report_period_id?: number | null;
  report_type?: ProgressReportType | null;
  status?: string | null;
  count: number;
};

type GeneratedReport = {
  id?: number | null;
  classroom_id?: ProgressReportId;
  learner_id?: ProgressReportId;
  report_period_id?: ProgressReportId;
  report_type?: ProgressReportType | null;
  generated_at?: string | null;
};

const textStyle: CSSProperties = {
  margin: "6px 0 0",
  color: "var(--db-text-soft)",
  lineHeight: 1.6,
};

export function TeacherChecklistCapture({
  categories,
  ratingScale,
  teacherRatings,
  onRatingChange,
  disabled = false,
}: {
  categories: ProgressReportCategory[];
  ratingScale: ProgressReportRatingLevel[];
  teacherRatings: Record<string, string>;
  onRatingChange: (
    categoryKey: string,
    indicatorKey: string,
    level: string
  ) => void;
  disabled?: boolean;
}) {
  function getLevelCode(level: ProgressReportRatingLevel): string {
    if (typeof level === "string") {
      return level.includes(" - ") ? level.split(" - ")[0] : level;
    }

    return String(
      level?.code ||
        level?.value ||
        level?.level ||
        level?.label ||
        String(level || "")
    );
  }

  const levels = ratingScale.map((level) => getLevelCode(level));

  return (
    <div style={{ display: "grid", gap: "14px", marginTop: "16px" }}>
      {categories.map((category) => {
        const indicators = getCategoryIndicators(category);

        return (
          <div key={category.key} className="db-list-card">
            <strong>{category.label}</strong>

            {category.description ? (
              <p style={textStyle}>{category.description}</p>
            ) : null}

            {indicators.length === 0 ? (
              <p className="db-helper">No indicators configured.</p>
            ) : (
              <div style={{ display: "grid", gap: "10px", marginTop: "12px" }}>
                {indicators.map((indicator) => {
                  const indicatorKey = indicator.key || indicator.label;
                  const selectedLevel =
                    teacherRatings[
                      makeAssessmentKey(category.key, indicatorKey)
                    ] || "";

                  return (
                    <div
                      key={`${category.key}-${indicatorKey}`}
                      style={{
                        borderTop: "1px solid #eee",
                        paddingTop: "10px",
                      }}
                    >
                      <p style={{ ...textStyle, color: "var(--db-text)" }}>
                        {indicator.label}
                      </p>

                      <div
                        style={{
                          display: "flex",
                          gap: "10px",
                          flexWrap: "wrap",
                          marginTop: "8px",
                        }}
                      >
                        {levels.map((level) => (
                          <label
                            key={`${category.key}-${indicatorKey}-${level}`}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              color: "var(--db-text-soft)",
                              fontSize: "13px",
                              fontWeight: 700,
                            }}
                          >
                            <input
                              type="radio"
                              name={`${category.key}-${indicatorKey}`}
                              checked={selectedLevel === level}
                              disabled={disabled}
                              onChange={() =>
                                onRatingChange(
                                  category.key,
                                  indicatorKey,
                                  level
                                )
                              }
                            />
                            {level}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PrincipalReviewList({
  items,
  expandedKey,
  reportTab,
  page,
  pageSize,
  totalItems,
  getKey,
  getLearnerName,
  getClassroomName,
  getTeacherName,
  getPeriodTitle,
  formatReportTemplate,
  formatStatus,
  statusStyle,
  onToggle,
  onOpen,
  onPageChange,
}: {
  items: AssessmentSummary[];
  expandedKey: string | null;
  reportTab: "awaiting" | "reviewed";
  page: number;
  pageSize: number;
  totalItems: number;
  getKey: (item: AssessmentSummary) => string;
  getLearnerName: (id: ProgressReportId) => string;
  getClassroomName: (id: ProgressReportId) => string;
  getTeacherName: (id: ProgressReportId) => string;
  getPeriodTitle: (id: ProgressReportId) => string;
  formatReportTemplate: (type: string) => string;
  formatStatus: (status: string) => string;
  statusStyle: (status: string) => CSSProperties;
  onToggle: (key: string | null) => void;
  onOpen: (item: AssessmentSummary) => void;
  onPageChange: (page: number) => void;
}) {
  return (
    <>
      {items.length === 0 ? (
        <p className="db-helper" style={{ marginTop: "14px" }}>
          No reports found for this view.
        </p>
      ) : (
        <div style={{ display: "grid", gap: "10px", marginTop: "14px" }}>
          {items.map((item) => {
            const key = getKey(item);
            const isExpanded = expandedKey === key;

            return (
              <div
                key={key}
                className="db-list-card"
                style={{ padding: "14px 16px" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                  }}
                  onClick={() => onToggle(isExpanded ? null : key)}
                >
                  <div>
                    <strong>{getLearnerName(item.learner_id)}</strong>
                    <p style={textStyle}>
                      {getClassroomName(item.classroom_id)} ·{" "}
                      {getTeacherName(item.teacher_id)}
                    </p>
                    <p style={textStyle}>
                      {getPeriodTitle(item.report_period_id)} ·{" "}
                      {formatReportTemplate(
                        item.report_type || "developmental"
                      )}
                    </p>
                    <span style={statusStyle(item.status || "")}>
                      {formatStatus(item.status || "")}
                    </span>
                  </div>
                  <span
                    style={{
                      color: "var(--db-text-soft)",
                      fontSize: "18px",
                    }}
                  >
                    {isExpanded ? "-" : "+"}
                  </span>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: "12px" }}>
                    <p style={textStyle}>
                      Class: {getClassroomName(item.classroom_id)}
                    </p>
                    <p style={textStyle}>
                      Practitioner: {getTeacherName(item.teacher_id)}
                    </p>
                    <p style={textStyle}>
                      Period: {getPeriodTitle(item.report_period_id)}
                    </p>
                    <p style={textStyle}>
                      Type:{" "}
                      {formatReportTemplate(
                        item.report_type || "developmental"
                      )}
                    </p>
                    <p style={textStyle}>Observation items: {item.count}</p>

                    <button
                      className="db-button-primary"
                      style={{ marginTop: "10px" }}
                      onClick={() => onOpen(item)}
                    >
                      {reportTab === "reviewed"
                        ? "View Report"
                        : "Review Report"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
        <button
          className="db-button-primary"
          disabled={page === 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          Previous
        </button>

        <button
          className="db-button-primary"
          disabled={page * pageSize >= totalItems}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </>
  );
}

export function GeneratedReportsList({
  reports,
  expandedKey,
  page,
  pageSize,
  totalItems,
  getLearnerName,
  getClassroomName,
  getPeriodTitle,
  onToggle,
  onOpen,
  onDelete,
  onDownload,
  onPageChange,
}: {
  reports: GeneratedReport[];
  expandedKey: string | null;
  page: number;
  pageSize: number;
  totalItems: number;
  getLearnerName: (id: ProgressReportId) => string;
  getClassroomName: (id: ProgressReportId) => string;
  getPeriodTitle: (id: ProgressReportId) => string;
  onToggle: (key: string | null) => void;
  onOpen: (item: GeneratedReport) => void;
  onDelete: (id: number) => void;
  onDownload: (item: GeneratedReport) => void;
  onPageChange: (page: number) => void;
}) {
  return (
    <>
      {reports.length === 0 ? (
        <p className="db-helper" style={{ marginTop: "14px" }}>
          No generated progress reports yet.
        </p>
      ) : (
        <div style={{ display: "grid", gap: "10px", marginTop: "14px" }}>
          {reports.map((item) => {
            const key = String(item.id);
            const isExpanded = expandedKey === key;

            return (
              <div
                key={item.id}
                className="db-list-card"
                style={{ padding: "14px 16px" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                  }}
                  onClick={() => onToggle(isExpanded ? null : key)}
                >
                  <strong>{getLearnerName(item.learner_id)}</strong>
                  <span
                    style={{
                      color: "var(--db-text-soft)",
                      fontSize: "18px",
                    }}
                  >
                    {isExpanded ? "-" : "+"}
                  </span>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: "12px" }}>
                    <p style={textStyle}>
                      Type:{" "}
                      {(item.report_type || "developmental") === "grade-r"
                        ? "Grade R Learner Report"
                        : (item.report_type || "developmental") === "grade-rr"
                          ? "Grade RR Progress Report"
                          : "Developmental Progress Report"}
                    </p>
                    <p style={textStyle}>
                      Class: {getClassroomName(item.classroom_id)}
                    </p>
                    <p style={textStyle}>
                      Period: {getPeriodTitle(item.report_period_id)}
                    </p>
                    <p style={textStyle}>
                      Generated:{" "}
                      {item.generated_at
                        ? new Date(item.generated_at).toLocaleDateString()
                        : "Not recorded"}
                    </p>

                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        flexWrap: "wrap",
                        marginTop: "10px",
                      }}
                    >
                      <button
                        className="db-button-primary"
                        onClick={() => onOpen(item)}
                      >
                        View Report
                      </button>

                      <button
                        className="db-button-primary"
                        style={{ background: "#d9534f" }}
                        onClick={() => item.id && onDelete(item.id)}
                      >
                        Delete Report
                      </button>

                      <button
                        className="db-button-primary"
                        onClick={() => onDownload(item)}
                      >
                        Download / Print
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
        <button
          className="db-button-primary"
          disabled={page === 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          Previous
        </button>

        <button
          className="db-button-primary"
          disabled={page * pageSize >= totalItems}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </>
  );
}
