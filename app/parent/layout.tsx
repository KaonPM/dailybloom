import { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentParent } from "@/app/lib/getCurrentParent";

const parentNav = [
  {
    label: "🏠 Dashboard",
    href: "/parent/dashboard",
  },
  {
    label: "📘 Summaries",
    href: "/parent/summaries",
  },
  {
    label: "📢 Broadcasts",
    href: "/parent/broadcasts",
  },
  {
    label: "✅ Attendance",
    href: "/parent/attendance",
  },
  {
    label: "📅 Events",
    href: "/parent/events",
  },
  {
    label: "💬 Messages",
    href: "/parent/messages",
  },
];

export default async function ParentLayout({
  children,
}: {
  children: ReactNode;
}) {
  const parent = await getCurrentParent();

  // Everything inside /parent requires login
  if (!parent) {
    redirect("/parent-login");
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#FFF8F5",
      }}
    >
      <aside
        style={{
          width: "250px",
          background: "#ffffff",
          borderRight: "1px solid #eee",
          padding: "20px",
        }}
      >
        <h2
          style={{
            color: "#FF5EA8",
            marginBottom: "30px",
          }}
        >
          DailyBloom
        </h2>

        <div
          style={{
            display: "grid",
            gap: "10px",
          }}
        >
          {parentNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                textDecoration: "none",
                color: "#2D2A3E",
                background: "#FFFDFB",
                padding: "12px",
                borderRadius: "12px",
                border: "1px solid #eee",
                fontWeight: 600,
              }}
            >
              {item.label}
            </Link>
          ))}

          <Link
            href="/api/parent-logout"
            style={{
              textDecoration: "none",
              color: "#2D2A3E",
              background: "#FFFDFB",
              padding: "12px",
              borderRadius: "12px",
              border: "1px solid #eee",
              fontWeight: 600,
            }}
          >
            🚪 Logout
          </Link>
        </div>
      </aside>

      <main
        style={{
          flex: 1,
          padding: "30px",
        }}
      >
        {children}
      </main>
    </div>
  );
}