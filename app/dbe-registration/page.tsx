"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCurrentProfile } from "../lib/auth";
import { resolveSchoolContext } from "../lib/school-context";
import { authenticatedFetch } from "../lib/authenticated-fetch";
import { ComplianceNav } from "./components";

type DbeRegistration = {
  id?: string;
  school_id: number;
  school_name?: string | null;
  registration_number?: string | null;
  registration_status?: string | null;
  registration_date?: string | null;
  renewal_date?: string | null;
  official_status?: string | null;
  status_source?: string | null;
  last_verified_at?: string | null;
  registration_notes?: string | null;
  principal_name?: string | null;
  contact_number?: string | null;
  email_address?: string | null;
  physical_address?: string | null;
  health_certificate_status?: string | null;
  fire_certificate_status?: string | null;
  municipal_approval_status?: string | null;
  police_clearance_status?: string | null;
};

const registrationStatuses = [
  "Registered",
  "Conditionally Registered",
  "Registration In Progress",
  "Unregistered",
  "Not Registered",
];
const officialStatuses = ["Not Started", "Application In Progress", "Bronze", "Silver", "Gold", "Renewal In Progress", "Expired", "Other"];

const complianceStatuses = ["Valid","Expired", "Outstanding"];

export default function DbeRegistrationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolParam = searchParams.get("school");

  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [recordId, setRecordId] = useState<string | null>(null);

  const [schoolName, setSchoolName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [registrationStatus, setRegistrationStatus] = useState(
    "Registration In Progress"
  );
  const [registrationDate, setRegistrationDate] = useState("");
  const [renewalDate, setRenewalDate] = useState("");
  const [officialStatus, setOfficialStatus] = useState("");
  const [statusSource, setStatusSource] = useState("");
  const [registrationNotes, setRegistrationNotes] = useState("");
  const [principalName, setPrincipalName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [physicalAddress, setPhysicalAddress] = useState("");

  const [healthCertificateStatus, setHealthCertificateStatus] =
    useState("Valid");
  const [fireCertificateStatus, setFireCertificateStatus] = useState("Valid");
  const [municipalApprovalStatus, setMunicipalApprovalStatus] =
    useState("Valid");
  const [policeClearanceStatus, setPoliceClearanceStatus] = useState("Valid");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingRegistration, setEditingRegistration] = useState(true);

  const loadRegistration = useCallback(async (currentSchoolId: number) => {
    try {
      const response = await authenticatedFetch(
        `/api/dbe-registration/bootstrap?school_id=${currentSchoolId}`
      );
      const result = await response.json();

      if (!response.ok) {
        alert(result.error || "Registration information could not be loaded.");
        return;
      }

      const record = result.registration as DbeRegistration;

      setRecordId(record.id || null);
      setSchoolName(record.school_name || "");
      setRegistrationNumber(record.registration_number || "");
      setRegistrationStatus(
        record.registration_status || "Registration In Progress"
      );
      setRegistrationDate(record.registration_date || "");
      setRenewalDate(record.renewal_date || "");
      setOfficialStatus(record.official_status || "");
      setStatusSource(record.status_source || "");
      setRegistrationNotes(record.registration_notes || "");
      setPrincipalName(record.principal_name || "");
      setContactNumber(record.contact_number || "");
      setEmailAddress(record.email_address || "");
      setPhysicalAddress(record.physical_address || "");
      setHealthCertificateStatus(record.health_certificate_status || "Valid");
      setFireCertificateStatus(record.fire_certificate_status || "Valid");
      setMunicipalApprovalStatus(record.municipal_approval_status || "Valid");
      setPoliceClearanceStatus(record.police_clearance_status || "Valid");
      setEditingRegistration(!result.has_saved_registration);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Registration information could not be loaded."
      );
    }
  }, []);

  const loadPage = useCallback(async () => {
    const { profile, error: profileError } = await getCurrentProfile();

    if (profileError || !profile) {
      router.push("/login");
      return;
    }

    if (profile.role === "teacher") {
      router.push("/teacher");
      return;
    }

    const context = await resolveSchoolContext(schoolParam);

    if (context.error) {
      router.push("/login");
      return;
    }

    if (context.shouldReturnToMaster || !context.schoolId) {
      router.push("/master");
      return;
    }

    setSchoolId(context.schoolId);

    await loadRegistration(context.schoolId);
    setLoading(false);
  }, [loadRegistration, router, schoolParam]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadPage(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadPage]);

  async function saveRegistration() {
    if (!schoolId) return;

    if (!schoolName.trim()) {
      alert("Please enter the school name.");
      return;
    }

    if (!registrationNumber.trim()) {
      alert("Please enter the NPO / Registration Number.");
      return;
    }

    setSaving(true);

    const payload = {
      school_id: schoolId,
      school_name: schoolName.trim(),
      registration_number: registrationNumber.trim(),
      registration_status: registrationStatus,
      registration_date: registrationDate || null,
      renewal_date: renewalDate || null,
      official_status: officialStatus || null,
      status_source: statusSource.trim() || null,
      registration_notes: registrationNotes.trim() || null,
      principal_name: principalName.trim() || null,
      contact_number: contactNumber.trim() || null,
      email_address: emailAddress.trim() || null,
      physical_address: physicalAddress.trim() || null,
      health_certificate_status: healthCertificateStatus,
      fire_certificate_status: fireCertificateStatus,
      municipal_approval_status: municipalApprovalStatus,
      police_clearance_status: policeClearanceStatus,
      updated_at: new Date().toISOString(),
    };

    const response = await authenticatedFetch("/api/dbe-registration", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "DBE registration information could not be saved.");
      setSaving(false);
      return;
    }

    await loadRegistration(schoolId);
    setEditingRegistration(false);
    setSaving(false);
    alert("DBE registration information saved.");
  }

  if (loading) {
    return <p>Loading DBE registration information...</p>;
  }

  return (
    <div>
      <ComplianceNav />
      <div className="db-soft-card" style={{ padding: 18, marginBottom: 18 }}>
        <h2 className="db-page-title">Compliance &amp; Registration: Registration</h2>
        <p className="db-page-subtitle">
          Store the school’s recorded official registration information. This is separate from DailyBloom readiness.
        </p>
      </div>

      {!editingRegistration && recordId ? (
        <div className="db-card db-card-blue" style={{ padding: 16 }}>
          <div style={summaryHeader}>
            <div>
              <h3 style={sectionTitle}>Registration Details</h3>
              <p className="db-helper" style={{ marginTop: 4 }}>
                Saved registration and compliance information.
              </p>
            </div>

            <button
              type="button"
              className="db-button-secondary"
              onClick={() => setEditingRegistration(true)}
            >
              Edit Registration Details
            </button>
          </div>

          <div style={summaryGrid}>
            <SummaryItem label="School" value={schoolName} />
            <SummaryItem label="Registration Number" value={registrationNumber} />
            <SummaryItem label="Status" value={registrationStatus} />
            <SummaryItem label="Registration Date" value={registrationDate || "Not added"} />
            <SummaryItem label="Principal" value={principalName || "Not added"} />
            <SummaryItem label="Contact" value={contactNumber || "Not added"} />
          </div>
        </div>
      ) : (
        <>
          <div className="db-card db-card-blue" style={{ padding: 16 }}>
            <h3 style={sectionTitle}>Registration Details</h3>

            <div style={grid2}>
              <Field label="School Name">
                <input
                  className="db-input"
                  value={schoolName}
                  onChange={(event) => setSchoolName(event.target.value)}
                />
              </Field>

              <Field label="NPO / Registration Number">
                <input
                  className="db-input"
                  value={registrationNumber}
                  onChange={(event) => setRegistrationNumber(event.target.value)}
                  placeholder="Example: NPO-123456 or 2025/123456/08"
                />
              </Field>
            </div>

            <div className="db-card db-card-lavender" style={{ padding: 14, marginTop: 14 }}>
              <h3 style={sectionTitle}>Recorded Official Status</h3>
              <p className="db-helper">This records information supplied or verified by the school. It is not calculated from DailyBloom readiness.</p>
              <div style={grid2}>
                <Field label="Official Status"><select className="db-input" value={officialStatus} onChange={(event) => setOfficialStatus(event.target.value)}><option value="">Not recorded</option>{officialStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></Field>
                <Field label="Status Source"><input className="db-input" value={statusSource} onChange={(event) => setStatusSource(event.target.value)} placeholder="Example: Official certificate" /></Field>
                <Field label="Renewal / Expiry Date"><input className="db-input" type="date" value={renewalDate} onChange={(event) => setRenewalDate(event.target.value)} /></Field>
              </div>
              <Field label="Registration Notes"><textarea className="db-input" value={registrationNotes} onChange={(event) => setRegistrationNotes(event.target.value)} style={{ minHeight: 70, resize: "vertical" }} /></Field>
            </div>

            <div style={grid2}>
              <Field label="Registration Status">
                <select
                  className="db-input"
                  value={registrationStatus}
                  onChange={(event) => setRegistrationStatus(event.target.value)}
                >
                  {registrationStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Registration Date">
                <input
                  className="db-input"
                  type="date"
                  value={registrationDate}
                  onChange={(event) => setRegistrationDate(event.target.value)}
                />
              </Field>
            </div>

            <div style={grid2}>

              <Field label="Principal Name">
                <input
                  className="db-input"
                  value={principalName}
                  onChange={(event) => setPrincipalName(event.target.value)}
                />
              </Field>
            </div>

            <div style={grid2}>
              <Field label="Contact Number">
                <input
                  className="db-input"
                  value={contactNumber}
                  onChange={(event) => setContactNumber(event.target.value)}
                />
              </Field>

              <Field label="Email Address">
                <input
                  className="db-input"
                  type="email"
                  value={emailAddress}
                  onChange={(event) => setEmailAddress(event.target.value)}
                />
              </Field>
            </div>

            <Field label="Physical Address">
              <textarea
                className="db-input"
                value={physicalAddress}
                onChange={(event) => setPhysicalAddress(event.target.value)}
                style={{ minHeight: 80, resize: "vertical" }}
              />
            </Field>
          </div>

          <div
            className="db-card db-card-lavender"
            style={{ padding: 16, marginTop: 18 }}
          >
            <h3 style={sectionTitle}>Compliance Status</h3>

            <div style={grid2}>
              <Field label="Health Certificate">
                <StatusSelect
                  value={healthCertificateStatus}
                  onChange={setHealthCertificateStatus}
                />
              </Field>

              <Field label="Fire Certificate">
                <StatusSelect
                  value={fireCertificateStatus}
                  onChange={setFireCertificateStatus}
                />
              </Field>

              <Field label="Municipal Approval">
                <StatusSelect
                  value={municipalApprovalStatus}
                  onChange={setMunicipalApprovalStatus}
                />
              </Field>

              <Field label="Police Clearance">
                <StatusSelect
                  value={policeClearanceStatus}
                  onChange={setPoliceClearanceStatus}
                />
              </Field>
            </div>

            <button
              type="button"
              className="db-button-primary"
              style={{ width: "100%", marginTop: 12 }}
              onClick={saveRegistration}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Registration Information"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginTop: 10 }}>
      <p style={labelText}>{label}</p>
      {children}
    </div>
  );
}

function StatusSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      className="db-input"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {complianceStatuses.map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
    </select>
  );
}

function SummaryItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={summaryItem}>
      <strong style={labelText}>{label}</strong>
      <p style={summaryValue}>{value || "Not added"}</p>
    </div>
  );
}

const sectionTitle = {
  margin: "0 0 10px 0",
  color: "#2D2A3E",
  fontSize: 20,
  fontWeight: 700 as const,
};

const labelText = {
  margin: "0 0 8px 0",
  color: "#6D6888",
  fontSize: 13,
  fontWeight: 800,
};

const grid2 = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
};

const summaryHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap" as const,
  marginBottom: 12,
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 10,
};

const summaryItem = {
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: 12,
  padding: "10px 12px",
};

const summaryValue = {
  margin: "5px 0 0",
  color: "#2D2A3E",
  fontSize: 14,
};
