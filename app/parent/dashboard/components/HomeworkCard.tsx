"use client";

import { useEffect, useState } from "react";

type HomeworkRow = {
  id: number;
  week_start: string;
  activity_date: string;
  instruction_note?: string | null;
  homework_library?: { title?: string | null } | { title?: string | null }[] | null;
};

type Props = {
  learnerId: string;
  schoolId: number;
  onCurrentHomeworkChange: (count: number) => void;
};

function currentMonday() {
  const value = new Date();
  const dayFromMonday = (value.getDay() + 6) % 7;
  value.setDate(value.getDate() - dayFromMonday);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function homeworkTitle(row: HomeworkRow) {
  const library = Array.isArray(row.homework_library)
    ? row.homework_library[0]
    : row.homework_library;
  return library?.title || "Homework";
}

export default function HomeworkCard({
  learnerId,
  schoolId,
  onCurrentHomeworkChange,
}: Props) {
  const [rows, setRows] = useState<HomeworkRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadHomework() {
      setLoading(true);
      const response = await fetch(
        `/api/parent-homework?learner_id=${encodeURIComponent(learnerId)}&school_id=${schoolId}`,
        { cache: "no-store" }
      );
      const body = await response.json();
      if (!active) return;
      const available = response.ok
        ? ((body.homework || []) as HomeworkRow[]).filter(
            (row) => row.week_start >= currentMonday()
          )
        : [];
      setRows(available);
      onCurrentHomeworkChange(available.length);
      setLoading(false);
    }

    void loadHomework();
    return () => {
      active = false;
    };
  }, [learnerId, onCurrentHomeworkChange, schoolId]);

  return (
    <section className="db-soft-card" style={cardStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={{ margin: 0 }}>Homework</h2>
          <p className="db-helper" style={{ margin: "5px 0 0" }}>
            Worksheets and instructions shared by the school
          </p>
        </div>
        <a href="/parent/homework" className="db-button-primary" style={linkStyle}>
          View &amp; Print
        </a>
      </div>

      {loading ? (
        <p className="db-helper">Loading homework...</p>
      ) : rows.length ? (
        <div style={listStyle}>
          {rows.slice(0, 3).map((row) => (
            <a key={row.id} href="/parent/homework" style={itemStyle}>
              <strong>{homeworkTitle(row)}</strong>
              <span style={noteStyle}>For {row.activity_date}</span>
              <span style={noteStyle}>
                {row.instruction_note || "Open homework for the teacher's instructions."}
              </span>
            </a>
          ))}
        </div>
      ) : (
        <p className="db-helper" style={{ marginBottom: 0 }}>
          No homework has been allocated for this week.
        </p>
      )}
    </section>
  );
}

const cardStyle = {
  padding: "20px",
  marginBottom: "18px",
  borderTop: "4px solid #7CCCF3",
} as const;

const headerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
} as const;

const linkStyle = {
  textDecoration: "none",
  width: "auto",
  padding: "10px 16px",
} as const;

const listStyle = {
  display: "grid",
  gap: "9px",
  marginTop: "14px",
} as const;

const itemStyle = {
  display: "grid",
  gap: "4px",
  padding: "12px 14px",
  border: "1px solid #eadfd8",
  borderRadius: "16px",
  color: "#25213f",
  textDecoration: "none",
  background: "#fffdfa",
} as const;

const noteStyle = {
  color: "#746b86",
  fontSize: "0.92rem",
} as const;
