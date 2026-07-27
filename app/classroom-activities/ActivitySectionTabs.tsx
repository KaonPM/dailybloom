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
        padding: "10px",
        marginBottom: "16px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: "8px",
        background: "linear-gradient(135deg, #fff 0%, #faf7ff 100%)",
        border: "1px solid #eadff5",
      }}
    >
      {items.map(([value, label]) => (
        <button
          key={value}
          type="button"
          className="db-button-primary"
          style={{
            width: "100%",
            minHeight: "42px",
            padding: "9px 12px",
            fontSize: "13px",
            borderRadius: "12px",
            border: activeSection === value
              ? "1px solid #65bde8"
              : "1px solid #e5dced",
            background: activeSection === value
              ? "linear-gradient(135deg, #72c8ee 0%, #8ed8f4 100%)"
              : "#ffffff",
            color: activeSection === value ? "#17324d" : "#5e5570",
            boxShadow: activeSection === value
              ? "0 5px 14px rgba(101, 189, 232, 0.22)"
              : "0 2px 6px rgba(73, 55, 92, 0.05)",
            fontWeight: 800,
          }}
          onClick={() => onChange(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
