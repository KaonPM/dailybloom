export default function AttendanceCard() {
  return (
    <section className="db-soft-card" style={cardStyle}>
      <h2>✔ Attendance</h2>

      <div style={gridStyle}>
        <div>
          <p>Today</p>
          <strong>✓ Present</strong>
        </div>

        <div>
          <p>Week</p>
          <strong>5 / 5</strong>
        </div>

        <div>
          <p>Month</p>
          <strong>19 / 20</strong>
        </div>

        <div>
          <p>To Date</p>
          <strong>96%</strong>
        </div>
      </div>

      <button style={buttonStyle}>View Attendance</button>
    </section>
  );
}

const cardStyle = {
  padding: "22px",
  marginBottom: "18px",
} as const;

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "14px",
  marginBottom: "18px",
} as const;

const buttonStyle = {
  border: "none",
  background: "#7CCCF3",
  color: "#fff",
  borderRadius: "999px",
  padding: "10px 16px",
  fontWeight: 700,
  cursor: "pointer",
} as const;