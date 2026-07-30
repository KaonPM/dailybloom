"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ParentPageActions() {
  const router = useRouter();

  return (
    <nav aria-label="Parent portal page navigation" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <button type="button" className="db-main-pill db-main-pill-blue" onClick={() => router.back()}>
        ← Back
      </button>
      <Link href="/parent/dashboard" className="db-main-pill db-main-pill-yellow" style={{ textDecoration: "none" }}>
        🏠 Dashboard
      </Link>
    </nav>
  );
}
