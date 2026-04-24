"use client";

export default function TeacherPage() {
  return (
    <div style={{ padding: "24px" }}>
      <h1 style={{ marginTop: 0 }}>Teacher Dashboard</h1>
      <p>Welcome to DailyBloom teacher workspace.</p>

      <div
        style={{
          display: "grid",
          gap: "16px",
          marginTop: "20px",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <div className="db-card">
          <h3>Attendance</h3>
          <p>Mark learners present or absent.</p>
        </div>

        <div className="db-card">
          <h3>Daily Summaries</h3>
          <p>Complete learner updates for parents.</p>
        </div>

        <div className="db-card">
          <h3>Today's Activities</h3>
          <p>View and update planned class activities.</p>
        </div>

        <div className="db-card">
          <h3>Learners</h3>
          <p>View your classroom learners.</p>
        </div>
      </div>
    </div>
  );
}