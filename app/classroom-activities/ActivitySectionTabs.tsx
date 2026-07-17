"use client";

export type ActivitySection =
  | "overview"
  | "today"
  | "planner"
  | "support"
  | "history"
  | "library";

type ActivitySectionTabsProps = {
  activeSection: ActivitySection;
  showOverview: boolean;
  onChange: (section: ActivitySection) => void;
};

export function ActivitySectionTabs({
  activeSection,
  showOverview,
  onChange,
}: ActivitySectionTabsProps) {
  const items: Array<[ActivitySection, string]> = [
    ...(showOverview ? [["overview", "Overview"]] as Array<[ActivitySection, string]> : []),
    ["today", "Today"],
    ["planner", "Weekly Planner"],
    ["support", "Learner Support"],
    ["history", "Completed"],
    ["library", "Activity Library"],
  ];

  return (
    <div
      className="db-card"
      style={{
        padding: "12px",
        marginBottom: "14px",
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
      }}
    >
      {items.map(([value, label]) => (
        <button
          key={value}
          type="button"
          className="db-button-primary"
          style={{
            minHeight: "34px",
            padding: "7px 10px",
            fontSize: "12px",
            ...(activeSection === value ? {} : { background: "#777" }),
          }}
          onClick={() => onChange(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
