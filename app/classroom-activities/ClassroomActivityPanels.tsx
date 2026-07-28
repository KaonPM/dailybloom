"use client";

type DashboardStats = {
  weekPlanned: boolean;
  planned: number;
  completed: number;
};

type ClassroomOverviewRow = {
  classroom: { id: number; classroom_name?: string | null };
  planned: number;
  completed: number;
  weekReady: boolean;
  todayComplete: boolean;
  openSupport: number;
};

type CompletedActivity = {
  id: number;
  activity_name: string;
  activity_date: string;
  theme: string;
  completed_at?: string | null;
};

export function ActivityDashboardStats({ stats }: { stats: DashboardStats }) {
  return (
    <div style={compactGrid}>
      <StatCard
        title="Week Planned"
        value={stats.weekPlanned ? "Yes" : "No"}
        note={stats.weekPlanned ? "Monday to Friday ready" : "Week incomplete"}
      />
      <StatCard title="Planned" value={stats.planned} note="Teaching activities" />
      <StatCard title="Completed" value={stats.completed} note="Completed this week" />
    </div>
  );
}

export function ClassroomActivityOverview({
  rows,
  onOpenClassroom,
}: {
  rows: ClassroomOverviewRow[];
  onOpenClassroom: (classroomId: number) => void;
}) {
  return (
    <div className="db-card db-card-blue" style={cardStyle}>
      <h3 style={sectionTitle}>Classroom Activity Overview</h3>
      <p style={smallHint}>
        Weekly planning, today&apos;s completion and learner support across the school.
      </p>
      <div style={{ display: "grid", gap: "10px", marginTop: "12px" }}>
        {rows.map((row) => (
          <div key={row.classroom.id} className="db-list-card">
            <div style={sectionHeader}>
              <div>
                <strong>{row.classroom.classroom_name}</strong>
                <p style={textStyle}>
                  Week: {row.weekReady ? "Planned" : "Incomplete"} · Today:{" "}
                  {row.todayComplete ? "Complete" : "Pending"}
                </p>
                <p style={smallHint}>
                  {row.completed}/{row.planned} activities completed · {row.openSupport}{" "}
                  open support cases
                </p>
              </div>
              <button
                type="button"
                className="db-button-primary"
                style={smallButton}
                onClick={() => onOpenClassroom(row.classroom.id)}
              >
                Open Classroom
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CompletedActivitiesPanel({
  open,
  plans,
  totalCount,
  hasMore,
  onToggle,
  onShowMore,
  formatDisplayDate,
  formatShortDate,
}: {
  open: boolean;
  plans: CompletedActivity[];
  totalCount: number;
  hasMore: boolean;
  onToggle: (open: boolean) => void;
  onShowMore: () => void;
  formatDisplayDate: (value: string) => string;
  formatShortDate: (value: string) => string;
}) {
  return (
    <details
      className="db-card db-card-blue"
      style={cardStyle}
      open={open}
      onToggle={(event) => onToggle((event.target as HTMLDetailsElement).open)}
    >
      <summary style={summaryStyle}>Completed Activities ({totalCount})</summary>
      <p style={smallHint}>
        Completed classroom activities are kept here so the working area stays clean.
      </p>

      {totalCount === 0 ? (
        <p className="db-helper">No completed activities yet.</p>
      ) : (
        <div style={{ display: "grid", gap: "8px", marginTop: "12px" }}>
          {plans.map((plan) => (
            <div key={plan.id} className="db-list-card">
              <strong>{plan.activity_name}</strong>
              <p style={textStyle}>
                {formatDisplayDate(plan.activity_date)} | {plan.theme}
              </p>
              <p style={smallHint}>
                Completed: {formatShortDate(plan.completed_at || plan.activity_date)}
              </p>
            </div>
          ))}
        </div>
      )}

      {hasMore ? (
        <button
          type="button"
          className="db-button-primary"
          style={{ ...smallButton, marginTop: "10px" }}
          onClick={onShowMore}
        >
          Show More Completed Activities
        </button>
      ) : null}
    </details>
  );
}

function StatCard({
  title,
  value,
  note,
}: {
  title: string;
  value: string | number;
  note: string;
}) {
  return (
    <div className="db-card" style={{ padding: "12px" }}>
      <p style={{ margin: 0, color: "var(--db-text-soft)", fontSize: "12px" }}>
        {title}
      </p>
      <h2 style={{ margin: "4px 0", color: "var(--db-text)", fontSize: "22px" }}>
        {value}
      </h2>
      <p style={{ margin: 0, color: "var(--db-text-soft)", fontSize: "12px" }}>
        {note}
      </p>
    </div>
  );
}

const cardStyle = { padding: "16px", marginBottom: "16px" };

const compactGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: "10px",
  marginBottom: "16px",
};

const sectionHeader = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
  flexWrap: "wrap" as const,
  marginBottom: "12px",
};

const sectionTitle = {
  margin: 0,
  color: "var(--db-text)",
  fontSize: "18px",
  fontWeight: 800,
};

const smallHint = {
  margin: "4px 0 0 0",
  color: "var(--db-text-soft)",
  fontSize: "12px",
};

const textStyle = {
  margin: "6px 0 0 0",
  color: "var(--db-text-soft)",
  fontSize: "13px",
};

const smallButton = {
  minHeight: "34px",
  padding: "8px 12px",
  fontSize: "12px",
};

const summaryStyle = {
  cursor: "pointer",
  fontSize: "18px",
  fontWeight: 800,
  color: "var(--db-text)",
};
