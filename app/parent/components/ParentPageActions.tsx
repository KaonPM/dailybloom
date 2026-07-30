"use client";

import Link from "next/link";

export default function ParentPageActions() {
  return (
    <nav aria-label="Parent portal page navigation">
      <Link href="/parent/dashboard" className="db-main-pill db-main-pill-yellow" style={{ textDecoration: "none" }}>
        🏠 Dashboard
      </Link>
    </nav>
  );
}
