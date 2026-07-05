import { redirect } from "next/navigation";
import { getCurrentParent } from "@/app/lib/getCurrentParent";

export default async function ParentDashboard() {
  const parent = await getCurrentParent();

  if (!parent) {
    redirect("/parent-login");
  }

  const child =
    parent.children?.length > 0
      ? parent.children[0]
      : null;

  if (!child) {
    return (
      <div
        style={{
          padding: "40px",
        }}
      >
        <h1>No child found</h1>

        <p>
          No learners are linked to this account.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "30px",
      }}
    >
      <h1>
        Welcome 👋
      </h1>

      <p
        style={{
          color: "#666",
          marginBottom: "25px",
        }}
      >
        Parent account: {parent.phone}
      </p>

      <div
        style={{
          background: "#fff",
          padding: "25px",
          borderRadius: "18px",
          border: "1px solid #eee",
          marginBottom: "25px",
        }}
      >
        <h2>
          {child.name}
        </h2>

        <p>
          Class:{" "}
          {child.classroom_name ||
            "Not assigned"}
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(220px,1fr))",
          gap: "20px",
        }}
      >
        <div
          style={{
            background: "#fff",
            padding: "20px",
            borderRadius: "16px",
            border: "1px solid #eee",
          }}
        >
          <h3>Daily Summary</h3>

          <p>
            Today's activities,
            meals and updates
          </p>
        </div>

        <div
          style={{
            background: "#fff",
            padding: "20px",
            borderRadius: "16px",
            border: "1px solid #eee",
          }}
        >
          <h3>Messages</h3>

          <p>
            View messages from
            the school
          </p>
        </div>

        <div
          style={{
            background: "#fff",
            padding: "20px",
            borderRadius: "16px",
            border: "1px solid #eee",
          }}
        >
          <h3>Broadcasts</h3>

          <p>
            School announcements
            and reminders
          </p>
        </div>

        <div
          style={{
            background: "#fff",
            padding: "20px",
            borderRadius: "16px",
            border: "1px solid #eee",
          }}
        >
          <h3>Attendance</h3>

          <p>
            Attendance history
            and status
          </p>
        </div>
      </div>
    </div>
  );
}