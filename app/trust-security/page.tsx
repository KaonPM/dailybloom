"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TrustSecurityCentre from "../components/trust-security/TrustSecurityCentre";
import { getCurrentProfile } from "../lib/auth";
import { PERMISSIONS } from "../lib/permissions";
import styles from "../components/trust-security/trust-security.module.css";

export default function SchoolTrustSecurityPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { profile } = await getCurrentProfile();
      if (!active) return;
      if (!profile) return router.replace("/login");

      const role = String(profile.role || "").toLowerCase();
      const canView = role === "principal" || role === "owner" ||
        (role === "admin" && profile.permissions?.includes(PERMISSIONS.REPORTS_VIEW));
      if (!canView) return router.replace("/dashboard");
      setAllowed(true);
    })();
    return () => { active = false; };
  }, [router]);

  if (!allowed) return <p className={styles.loading}>Loading Trust &amp; Security Centre…</p>;
  return <TrustSecurityCentre scope="school" />;
}
