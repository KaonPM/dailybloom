"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PermissionChecklist from "../components/PermissionChecklist";
import { getCurrentProfile } from "../lib/auth";
import { authenticatedFetch } from "../lib/authenticated-fetch";
import { Permission, selectablePermissionsForRole } from "../lib/permissions";

type Assignment = {
  user_id: string;
  status: string;
  permissions: Permission[];
  profile?: { full_name?: string | null; email?: string | null } | null;
};

const options = selectablePermissionsForRole("master_admin");
const recommendedPermissions = options.map((option) => option.permission);

export default function PlatformAccessPage() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [permissions, setPermissions] = useState<Permission[]>([...recommendedPermissions]);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => { void initialize(); }, []);

  async function initialize() {
    const { profile } = await getCurrentProfile();
    if (!profile || profile.role !== "master") {
      router.replace(profile?.role === "master_admin" ? "/master-admin" : "/dashboard");
      return;
    }
    await loadAssignments();
    setLoading(false);
  }

  async function loadAssignments() {
    try {
      const response = await authenticatedFetch("/api/role-assignments?role=master_admin");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load Master Admin accounts.");
      setAssignments(result.assignments || []);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Could not load Master Admin accounts." });
    }
  }

  async function saveRequest(payload: Record<string, unknown>, successText: string) {
    setSaving(true);
    setMessage(null);
    try {
      const response = await authenticatedFetch("/api/role-assignments", {
        method: payload.user_id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "master_admin", ...payload }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update Master Admin access.");
      setEditingUserId(null);
      setEditingPermissions([]);
      setMessage({ type: "success", text: successText });
      await loadAssignments();
      return true;
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Could not update Master Admin access." });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function invite() {
    if (!fullName.trim() || !email.trim()) {
      setMessage({ type: "error", text: "Enter the administrator's full name and email address." });
      return;
    }
    if (permissions.length === 0) {
      setMessage({ type: "error", text: "Select at least one permission." });
      return;
    }
    const saved = await saveRequest(
      { full_name: fullName.trim(), email: email.trim(), permissions },
      "Master Admin invitation sent successfully."
    );
    if (saved) {
      setFullName("");
      setEmail("");
      setPermissions([...recommendedPermissions]);
    }
  }

  if (loading) return <main style={{ padding: 24 }}><div className="db-card" style={{ padding: 20 }}>Loading platform access...</div></main>;

  return (
    <main style={{ padding: 24 }}>
      <section className="db-card" style={{ padding: 22, display: "grid", gap: 18 }}>
        <div>
          <p style={{ margin: 0, color: "#7B7592", fontWeight: 700 }}>Platform Access</p>
          <h1 className="db-page-title">Master Admin Permissions</h1>
          <p className="db-helper">Choose the platform responsibilities this assistant may perform. Master Admins cannot create or manage other Master Admins.</p>
        </div>

        {message ? <div role="status" style={{ padding: "12px 14px", borderRadius: 14, background: message.type === "success" ? "#ECFDF3" : "#FFF1F2", color: message.type === "success" ? "#166534" : "#BE123C" }}>{message.text}</div> : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          <label style={{ display: "grid", gap: 7, fontWeight: 700 }}>Full name<input className="db-input" value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
          <label style={{ display: "grid", gap: 7, fontWeight: 700 }}>Email address<input className="db-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        </div>
        <PermissionChecklist options={options} selected={permissions} onChange={setPermissions} disabled={saving} />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="db-button-primary" type="button" onClick={invite} disabled={saving}>{saving ? "Sending..." : "Invite Master Admin"}</button>
          <Link className="db-button-secondary" href="/master?view=dashboard">Back to Master Dashboard</Link>
        </div>
      </section>

      <section className="db-card" style={{ marginTop: 18, padding: 22 }}>
        <h2 style={{ marginTop: 0 }}>Current Master Admins</h2>
        {assignments.length === 0 ? <p className="db-helper">No Master Admin accounts have been added yet.</p> : (
          <div style={{ display: "grid", gap: 10 }}>
            {assignments.map((assignment) => (
              <article className="db-list-card" key={assignment.user_id} style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                  <div>
                    <strong>{assignment.profile?.full_name || "Master Admin"}</strong>
                    <p className="db-helper" style={{ margin: "4px 0" }}>{assignment.profile?.email || "No email"}</p>
                    <span className="db-main-pill" style={{ minHeight: 30, padding: "5px 10px", textTransform: "capitalize" }}>{assignment.status}</span>
                    <span className="db-helper" style={{ marginLeft: 8 }}>{assignment.permissions.length} permissions</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="db-button-secondary" type="button" onClick={() => { setEditingUserId(assignment.user_id); setEditingPermissions([...assignment.permissions]); }} disabled={saving}>Edit Permissions</button>
                    <button className="db-button-secondary" type="button" onClick={() => saveRequest({ user_id: assignment.user_id, status: assignment.status === "active" ? "suspended" : "active", permissions: assignment.permissions }, assignment.status === "active" ? "Master Admin access suspended." : "Master Admin access restored.")} disabled={saving}>{assignment.status === "active" ? "Suspend Access" : "Restore Access"}</button>
                  </div>
                </div>
                {editingUserId === assignment.user_id ? (
                  <div style={{ borderTop: "1px solid #EEE3DA", paddingTop: 14, display: "grid", gap: 12 }}>
                    <PermissionChecklist options={options} selected={editingPermissions} onChange={setEditingPermissions} disabled={saving} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="db-button-primary" type="button" disabled={saving || editingPermissions.length === 0} onClick={() => saveRequest({ user_id: assignment.user_id, status: assignment.status, permissions: editingPermissions }, "Master Admin permissions updated.")}>Save Permissions</button>
                      <button className="db-button-secondary" type="button" disabled={saving} onClick={() => setEditingUserId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
