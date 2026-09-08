"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";
import { getCurrentProfile } from "@/app/lib/auth";
import { resolveSchoolContext } from "@/app/lib/school-context";
import { ComplianceHeader } from "../components";

const statusOptions = ["Valid", "Expired", "Outstanding"];

type StatusField =
  | "health_certificate_status"
  | "fire_certificate_status"
  | "municipal_approval_status";

type RegistrationSummary = Record<StatusField, string | null>;

const statusCards: Array<{
  field: StatusField;
  title: string;
  description: string;
}> = [
  {
    field: "health_certificate_status",
    title: "Environmental health clearance",
    description:
      "Record the school’s latest health or environmental-health clearance where it applies to the premises and local authority requirements.",
  },
  {
    field: "fire_certificate_status",
    title: "Fire and safety evidence",
    description:
      "Record the school’s fire-safety certificate, report or other evidence requested by its municipality or registration authority.",
  },
  {
    field: "municipal_approval_status",
    title: "Municipal and land-use approval",
    description:
      "Record applicable municipal evidence, such as land-use, zoning, occupancy or approved-building documentation.",
  },
];

export default function ComplianceStatusPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolParam = searchParams.get("school");
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [hasRegistration, setHasRegistration] = useState(false);
  const [statuses, setStatuses] = useState<Record<StatusField, string>>({
    health_certificate_status: "Outstanding",
    fire_certificate_status: "Outstanding",
    municipal_approval_status: "Outstanding",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (currentSchoolId: number) => {
    const response = await authenticatedFetch(
      `/api/dbe-registration/bootstrap?school_id=${currentSchoolId}`
    );
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Compliance status could not be loaded.");

    const registration = result.registration as RegistrationSummary;
    setHasRegistration(Boolean(result.has_saved_registration));
    setStatuses({
      health_certificate_status: registration.health_certificate_status || "Outstanding",
      fire_certificate_status: registration.fire_certificate_status || "Outstanding",
      municipal_approval_status: registration.municipal_approval_status || "Outstanding",
    });
  }, []);

  const loadPage = useCallback(async () => {
    const { profile, error } = await getCurrentProfile();
    if (error || !profile) return router.push("/login");
    if (profile.role === "teacher") return router.push("/teacher");

    const context = await resolveSchoolContext(schoolParam);
    if (context.error) return router.push("/login");
    if (context.shouldReturnToMaster || !context.schoolId) return router.push("/master");

    try {
      setSchoolId(context.schoolId);
      await load(context.schoolId);
    } catch (loadError) {
      alert(loadError instanceof Error ? loadError.message : "Compliance status could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [load, router, schoolParam]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadPage(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadPage]);

  async function save() {
    if (!schoolId || !hasRegistration) return;
    setSaving(true);
    try {
      const response = await authenticatedFetch("/api/dbe-registration", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ school_id: schoolId, ...statuses }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Compliance status could not be saved.");
      await load(schoolId);
      alert("School compliance status saved.");
    } catch (saveError) {
      alert(saveError instanceof Error ? saveError.message : "Compliance status could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Loading school compliance status...</p>;

  const contextSuffix = schoolId ? `?school=${schoolId}` : "";
  return (
    <div>
      <ComplianceHeader
        title="School Compliance Status"
        description="A school-recorded readiness summary for premises evidence. It does not replace DBE, provincial or municipal assessment."
      />

      {!hasRegistration ? (
        <div className="db-card db-card-lavender" style={{ padding: 18, marginBottom: 16 }}>
          <h3 style={cardTitle}>Start with the registration record</h3>
          <p className="db-helper" style={{ margin: "0 0 14px" }}>
            Save the school’s registration record first. This keeps the compliance summary attached to the correct school record.
          </p>
          <Link className="db-button-primary" style={{ textDecoration: "none" }} href={`/dbe-registration${contextSuffix}`}>
            Open Registration
          </Link>
        </div>
      ) : null}

      <div className="db-card db-card-blue" style={{ padding: 18, marginBottom: 16 }}>
        <h3 style={cardTitle}>How to use this page</h3>
        <p className="db-helper" style={{ margin: 0, lineHeight: 1.6 }}>
          Keep source documents in Documents &amp; Evidence, then record the school’s current summary here. Confirm the exact evidence and renewal requirements with the relevant provincial DBE office and municipality; DailyBloom does not issue or validate official certification.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
        {statusCards.map((card) => (
          <section key={card.field} className="db-card" style={{ padding: 18 }}>
            <h3 style={cardTitle}>{card.title}</h3>
            <p className="db-helper" style={{ minHeight: 64, margin: "0 0 14px", lineHeight: 1.55 }}>
              {card.description}
            </p>
            <label style={labelStyle} htmlFor={card.field}>Recorded status</label>
            <select
              id={card.field}
              className="db-input"
              value={statuses[card.field]}
              disabled={!hasRegistration || saving}
              onChange={(event) => setStatuses((current) => ({ ...current, [card.field]: event.target.value }))}
            >
              {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </section>
        ))}
      </div>

      <div className="db-card db-card-lavender" style={{ padding: 18, marginTop: 16 }}>
        <h3 style={cardTitle}>Evidence and staff records</h3>
        <p className="db-helper" style={{ margin: "0 0 14px", lineHeight: 1.55 }}>
          Upload facility evidence once and keep individual staff suitability, clearance and credential records person-by-person in Staff Compliance.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="db-button-secondary" style={{ textDecoration: "none" }} href={`/dbe-registration/documents${contextSuffix}`}>Documents &amp; Evidence</Link>
          <Link className="db-button-secondary" style={{ textDecoration: "none" }} href={`/dbe-registration/staff-compliance${contextSuffix}`}>Staff Compliance</Link>
        </div>
      </div>

      <button type="button" className="db-button-primary" style={{ width: "100%", marginTop: 16 }} disabled={!hasRegistration || saving} onClick={save}>
        {saving ? "Saving..." : "Save School Compliance Status"}
      </button>
    </div>
  );
}

const cardTitle = { margin: "0 0 8px", color: "#2D2A3E", fontSize: 19, fontWeight: 700 as const };
const labelStyle = { display: "block", marginBottom: 6, color: "#5B5675", fontWeight: 700, fontSize: 13 };
