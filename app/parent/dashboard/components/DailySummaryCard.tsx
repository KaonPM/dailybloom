export default function DailySummaryCard({
  child,
  school,
}: {
  child: any;
  school: any;
}) {
  return (
    <section className="db-soft-card" style={cardStyle}>
      <h2>📝 Today's Summary</h2>

      <p style={{ color: "#666", marginBottom: "18px" }}>Today</p>

      <p style={{ lineHeight: 1.7, fontSize: "16px" }}>
        Good afternoon 👋
        <br />
        <br />
        {child.name} had a cheerful and active day today. He enjoyed painting
        and outdoor play with friends. He participated well in class activities
        and interacted positively with others.
        <br />
        <br />
        Thank you for trusting us with another beautiful day.
        <br />
        <br />
        {school?.school_name || "DailyBloom"}
      </p>

      <div style={tabsStyle}>
        {["Today", "Week", "Month", "To Date"].map((item) => (
          <button key={item} style={tabStyle}>
            {item}
          </button>
        ))}
      </div>
    </section>
  );
}

const cardStyle = {
  padding: "22px",
  marginBottom: "18px",
} as const;

const tabsStyle = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  marginTop: "18px",
} as const;

const tabStyle = {
  border: "1px solid #d9e7e4",
  background: "#fff",
  borderRadius: "999px",
  padding: "8px 14px",
  fontWeight: 600,
  cursor: "pointer",
} as const;