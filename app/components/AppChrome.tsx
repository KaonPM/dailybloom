"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const publicRoutes = [
    "/",
    "/login",
    "/parent-login",
    "/signup",
    "/reset-password",
    "/change-password",
    "/legal",
    "/privacy",
    "/terms",
  ];

  const isPublicRoute =
    publicRoutes.includes(pathname) ||
    pathname.startsWith("/legal") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/terms");

  // Login and public pages
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Parent portal pages
  if (pathname.startsWith("/parent")) {
    return (
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          background: "#FFF8F5",
        }}
      >
        <main
          style={{
            flex: 1,
            width: "100%",
          }}
        >
          {children}
        </main>
      </div>
    );
  }

  // School app pages
  return (
    <div className="db-app-shell">
      <Sidebar />

      <div className="db-main-shell">
        <Topbar />
        <main className="db-main-content">
          {children}
        </main>
      </div>
    </div>
  );
}