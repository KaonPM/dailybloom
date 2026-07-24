"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PermissionChecklist from "../components/PermissionChecklist";
import { getCurrentProfile } from "../lib/auth";
import { authenticatedFetch } from "../lib/authenticated-fetch";
import { Permission, selectablePermissionsForRole } from "../lib/permissions";
import { resolveSchoolContext } from "../lib/school-context";

type Assignment = {
  user_id: string;
  status: string;
  permissions: Permission[];
  profile?: { full_name?: string | null; email?: string | null; last_login_at?: string | null } | null;
};

const adminOptions = selectablePermissionsForRole("admin");
const recommendedAdminPermissions = adminOptions.map((option) => option.permission);

export default function StaffAccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [permissions, setPermissions] = useState<Permission[]>([...recommendedAdminPermissions]);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => { void initialize(); }, []);

  async function initialize() {
    const [{ profile }, context] = await Promise.all([
      getCurrentProfile(),
      resolveSchoolContext(searchParams.get("school")),
    ]);
    const role = String(profile?.role || "").toLowerCase();
    if (!profile || !["owner", "principal", "master"].includes(role) || !context.schoolId) {
      router.replace(role === "master" ? "/master?view=manage-schools" : "/dashboard");
      return;
    }
    setSchoolId(context.schoolId);
    await loadAssignments(context.schoolId);
    setLoading(false);
  }

  async function loadAssignments(id: number) {
    try {
      const response = await authenticatedFetch(`/api/role-assignments?role=admin&school_id=${id}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load Preschool Admin accounts.");
      setAssignments(result.assignments || []);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Could not load Preschool Admin accounts." });
    }
  }

  async function inviteAdmin() {
    if (!schoolId || !fullName.trim() || !email.trim()) {
      setMessage({ type: "error", text: "Enter the administrator's full name and email address." });
      return;
    }
    if (permissions.length === 0) {
      setMessage({ type: "error", text: "Select at least one permission." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await authenticatedFetch("/api/role-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "admin", school_id: schoolId, full_name: fullName.trim(), email: email.trim(), permissions }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not invite the Preschool Admin.");
      setFullName("");
      setEmail("");
      setPermissions([...recommendedAdminPermissions]);
      setMessage({ type: "success", text: "Preschool Admin invitation sent successfully." });
      await loadAssignments(schoolId);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Could not invite the Preschool Admin." });
    } finally {
      setSaving(false);
    }
  }

  async function updateAssignment(assignment: Assignment, status: string) {
    if (!schoolId) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await authenticatedFetch("/api/role-assignments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "admin", school_id: schoolId, user_id: assignment.user_id, status, permissions: assignment.permissions }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update the Preschool Admin.");
      setMessage({ type: "success", text: status === "active" ? "Preschool Admin access restored." : "Preschool Admin access suspended." });
      await loadAssignments(schoolId);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Could not update the Preschool Admin." });
    } finally {
      setSaving(false);
    }
  }

  function beginEditing(assignment: Assignment) {
    setEditingUserId(assignment.user_id);
    setEditingPermissions([...assignment.permissions]);
    setMessage(null);
  }

  async function savePermissions(assignment: Assignment) {
    if (!schoolId || editingPermissions.length === 0) {
      setMessage({ type: "error", text: "Select at least one permission." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await authenticatedFetch("/api/role-assignments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "admin",
          school_id: schoolId,
          user_id: assignment.user_id,
          status: assignment.status,
          permissions: editingPermissions,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update permissions.");
      setEditingUserId(null);
      setEditingPermissions([]);
      setMessage({ type: "success", text: "Preschool Admin permissions updated." });
      await loadAssignments(schoolId);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Could not update permissions." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="db-page-shell"><div className="db-card">Loading staff access…</div></main>;

  return (
    <main className="db-page-shell">
      <section className="db-card" style={{ display: "grid", gap: "18px", padding: "22px" }}>
        <div>
          <p className="db-eyebrow">Staff Access</p>
          <h1 className="db-page-title">Admin Access</h1>
          <p className="db-helper">
            Select the DailyBloom areas this administrator may use. The checklist covers the full school platform available to a Principal; Master platform controls are never included.
          </p>
        </div>

        {message ? (
          <div role="status" style={{ padding: "12px 14px", borderRadius: "14px", background: message.type === "success" ? "#ECFDF3" : "#FFF1F2", color: message.type === "success" ? "#166534" : "#BE123C", border: `1px solid ${message.type === "success" ? "#BBF7D0" : "#FECDD3"}` }}>
            {message.text}
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
          <label style={{ display: "grid", gap: "7px", fontWeight: 700 }}>Full name<input className="db-input" value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
          <label style={{ display: "grid", gap: "7px", fontWeight: 700 }}>Email address<input className="db-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button className="db-button-secondary" type="button" disabled={saving} onClick={() => setPermissions([...recommendedAdminPermissions])}>
            Select All School Access
          </button>
          <button className="db-button-secondary" type="button" disabled={saving} onClick={() => setPermissions([])}>
            Clear All
          </button>
        </div>
        <PermissionChecklist options={adminOptions} selected={permissions} onChange={setPermissions} disabled={saving} />

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button className="db-button-primary" type="button" onClick={inviteAdmin} disabled={saving}>{saving ? "Sending..." : "Invite Preschool Admin"}</button>
          <Link className="db-button-secondary" href={schoolId ? `/dashboard?school=${schoolId}` : "/dashboard"}>Back to Dashboard</Link>
        </div>
      </section>

      <section className="db-card" style={{ marginTop: "18px", padding: "22px" }}>
        <h2 className="db-section-title">Current Admins</h2>
        {assignments.length === 0 ? <p className="db-helper">No Preschool Admin accounts have been added yet.</p> : (
          <div style={{ display: "grid", gap: "10px", marginTop: "12px" }}>
            {assignments.map((assignment) => (
              <article key={assignment.user_id} className="db-list-card" style={{ display: "grid", gap: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", alignItems: "center", flexWrap: "wrap" }}>
                  <div>
                    <strong>{assignment.profile?.full_name || "Preschool Admin"}</strong>
                    <p className="db-helper" style={{ margin: "4px 0" }}>{assignment.profile?.email || "No email"}</p>
                    <span className="db-main-pill" style={{ minHeight: "30px", padding: "5px 10px", textTransform: "capitalize" }}>{assignment.status}</span>
                    <span className="db-helper" style={{ marginLeft: "8px" }}>{assignment.permissions.length} permissions</span>
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button className="db-button-secondary" type="button" disabled={saving} onClick={() => beginEditing(assignment)}>Edit Permissions</button>
                    <button className="db-button-secondary" type="button" disabled={saving} onClick={() => updateAssignment(assignment, assignment.status === "active" ? "suspended" : "active")}>
                      {assignment.status === "active" ? "Suspend Access" : "Restore Access"}
                    </button>
                  </div>
                </div>
                {editingUserId === assignment.user_id ? (
                  <div style={{ borderTop: "1px solid #EEE3DA", paddingTop: "14px", display: "grid", gap: "12px" }}>
                    <PermissionChecklist options={adminOptions} selected={editingPermissions} onChange={setEditingPermissions} disabled={saving} />
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button className="db-button-primary" type="button" disabled={saving} onClick={() => savePermissions(assignment)}>Save Permissions</button>
                      <button className="db-button-secondary" type="button" disabled={saving} onClick={() => { setEditingUserId(null); setEditingPermissions([]); }}>Cancel</button>
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
