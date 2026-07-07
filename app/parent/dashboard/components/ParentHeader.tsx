export default function ParentHeader({
  child,
  school,
  classroom,
}: {
  child: any;
  school: any;
  classroom: any;
}) {
  return (
    <div
      className="db-soft-card"
      style={{
        padding: "24px",
        marginBottom: "18px",
        borderTop: `4px solid ${school?.primary_color || "#7CCCF3"}`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "18px",
          alignItems: "center",
        }}
      >
        <div>
          <h1 style={{ margin: "0 0 10px" }}>
            {school?.school_name || "DailyBloom"}
          </h1>

          <p style={{ margin: "6px 0", color: "#666" }}>
            Viewing updates for {child.name}
          </p>

          <p style={{ margin: "6px 0", color: "#666" }}>
            Class: {classroom?.classroom_name || "Not assigned"}
          </p>

          <p style={{ margin: "6px 0", color: "#666" }}>
            Teacher: {classroom?.teacher_name || "Not assigned"}
          </p>
        </div>

        <img
          src={school?.logo_url || "/school-placeholder.png"}
          alt="School"
          style={{
            width: "72px",
            height: "72px",
            borderRadius: "18px",
            objectFit: "cover",
            border: "1px solid #eee",
          }}
        />
      </div>
    </div>
  );
}