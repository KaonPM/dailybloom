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
    "/signup",
    "/reset-password",
    "/change-password",
    "/legal",
    "/privacy",
    "/terms",

    // Parent auth pages
    "/parent-login",
    "/forgot-parent-pin",
    "/create-parent-pin",
  ];

  const isPublicRoute =
    publicRoutes.includes(pathname) ||
    pathname.startsWith("/legal") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/terms");

  // Public pages
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Parent portal pages
  if (
    pathname.startsWith("/parent") ||
    pathname.startsWith("/forgot-parent-pin") ||
    pathname.startsWith("/create-parent-pin")
  ) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#FFF8F5",
        }}
      >
        {children}
      </div>
    );
  }

  // School management pages
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