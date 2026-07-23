"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "../lib/auth";
import { Permission, PERMISSIONS, PERMISSION_OPTIONS } from "../lib/permissions";
import { supabase } from "../lib/supabase";

const destinations: Partial<Record<Permission, string>> = {
  [PERMISSIONS.SCHOOL_ONBOARD]: "/onboarding",
  [PERMISSIONS.SCHOOL_STATUS]: "/principals",
  [PERMISSIONS.PRINCIPAL_MANAGE]: "/principals",
  [PERMISSIONS.BILLING_MANAGE]: "/billing",
};

export default function MasterAdminPage() {
  const router = useRouter();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [name, setName] = useState("Master Admin");
  const [loading, setLoading] = useState(true);

  useEffect(() => { void load(); }, []);

  async function load() {
    const { profile } = await getCurrentProfile();
    if (!profile) {
      router.replace("/login");
      return;
    }
    if (profile.role === "master") {
      router.replace("/master?view=dashboard");
      return;
    }
    if (profile.role !== "master_admin") {
      router.replace("/dashboard");
      return;
    }
    setName(profile.full_name || "Master Admin");
    setPermissions(Array.isArray(profile.permissions) ? profile.permissions as Permission[] : []);
    setLoading(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) return <main style={{ padding: 24 }}><div className="db-card" style={{ padding: 20 }}>Loading your access...</div></main>;

  const allowed = PERMISSION_OPTIONS.filter((option) => permissions.includes(option.permission));

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <section className="db-card db-card-blue" style={{ padding: 24 }}>
        <p style={{ margin: 0, color: "#7B7592", fontWeight: 700 }}>DailyBloom Platform</p>
        <h1 className="db-page-title">Welcome, {name}</h1>
        <p className="db-helper">Only the responsibilities assigned by the Master are available here.</p>
        <button className="db-button-secondary" type="button" onClick={logout}>Log out</button>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginTop: 18 }}>
        {allowed.map((option) => {
          const href = destinations[option.permission];
          const content = (
            <>
              <strong style={{ fontSize: 17 }}>{option.label}</strong>
              <span className="db-helper">{option.description}</span>
              <span style={{ color: "#287EA8", fontWeight: 700 }}>Open tool</span>
            </>
          );
          return href ? (
            <Link key={option.permission} href={href} className="db-card" style={{ padding: 18, display: "grid", gap: 9, textDecoration: "none" }}>{content}</Link>
          ) : null;
        })}
      </section>

      {allowed.length === 0 ? <div className="db-card" style={{ padding: 20, marginTop: 18 }}>No platform permissions are currently assigned. Please contact the Master account.</div> : null}
    </main>
  );
}
