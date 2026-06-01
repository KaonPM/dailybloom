"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";
import { resolveSchoolContext } from "../lib/school-context";

type DbeRegistration = {
  id?: string;
  school_id: number;
  school_name?: string | null;
  registration_number?: string | null;
  registration_status?: string | null;
  registration_date?: string | null;
  renewal_date?: string | null;
  principal_name?: string | null;
  contact_number?: string | null;
  email_address?: string | null;
  physical_address?: string | null;
  health_certificate_status?: string | null;
  fire_certificate_status?: string | null;
  municipal_approval_status?: string | null;
  popia_compliance_status?: string | null;
};

const registrationStatuses = [
  "Registered",
  "Registration In Progress",
  "Not Registered",
];

const complianceStatuses = ["Valid", "Expiring Soon", "Expired"];

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
  const [principalName, setPrincipalName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [physicalAddress, setPhysicalAddress] = useState("");

  const [healthCertificateStatus, setHealthCertificateStatus] =
    useState("Valid");
  const [fireCertificateStatus, setFireCertificateStatus] = useState("Valid");
  const [municipalApprovalStatus, setMunicipalApprovalStatus] =
    useState("Valid");
  const [popiaComplianceStatus, setPopiaComplianceStatus] = useState("Valid");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
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

    await Promise.all([
      loadSchoolName(context.schoolId),
      loadRegistration(context.schoolId),
    ]);

    setLoading(false);
  }

  async function loadSchoolName(currentSchoolId: number) {
    const { data } = await supabase
      .from("schools")
      .select("school_name")
      .eq("id", currentSchoolId)
      .single();

    if (data?.school_name) {
      setSchoolName(data.school_name);
    }
  }

  async function loadRegistration(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("dbe_registration")
      .select("*")
      .eq("school_id", currentSchoolId)
      .maybeSingle();

    if (error) {
      alert(error.message);
      return;
    }

    if (!data) return;

    const record = data as DbeRegistration;

    setRecordId(record.id || null);
    setSchoolName(record.school_name || "");
    setRegistrationNumber(record.registration_number || "");
    setRegistrationStatus(
      record.registration_status || "Registration In Progress"
    );
    setRegistrationDate(record.registration_date || "");
    setRenewalDate(record.renewal_date || "");
    setPrincipalName(record.principal_name || "");
    setContactNumber(record.contact_number || "");
    setEmailAddress(record.email_address || "");
    setPhysicalAddress(record.physical_address || "");
    setHealthCertificateStatus(record.health_certificate_status || "Valid");
    setFireCertificateStatus(record.fire_certificate_status || "Valid");
    setMunicipalApprovalStatus(record.municipal_approval_status || "Valid");
    setPopiaComplianceStatus(record.popia_compliance_status || "Valid");
  }

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
      principal_name: principalName.trim() || null,
      contact_number: contactNumber.trim() || null,
      email_address: emailAddress.trim() || null,
      physical_address: physicalAddress.trim() || null,
      health_certificate_status: healthCertificateStatus,
      fire_certificate_status: fireCertificateStatus,
      municipal_approval_status: municipalApprovalStatus,
      popia_compliance_status: popiaComplianceStatus,
      updated_at: new Date().toISOString(),
    };

    const { error } = recordId
      ? await supabase
          .from("dbe_registration")
          .update(payload)
          .eq("id", recordId)
          .eq("school_id", schoolId)
      : await supabase.from("dbe_registration").insert([payload]);

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    await loadRegistration(schoolId);
    setSaving(false);
    alert("DBE registration information saved.");
  }

  if (loading) {
    return <p>Loading DBE registration information...</p>;
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: 18, marginBottom: 18 }}>
        <h2 className="db-page-title">DBE Registration Information</h2>
        <p className="db-page-subtitle">
          Store the school’s registration details and compliance status in one place.
        </p>
      </div>

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
          <Field label="Renewal Date">
            <input
              className="db-input"
              type="date"
              value={renewalDate}
              onChange={(event) => setRenewalDate(event.target.value)}
            />
          </Field>

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

          <Field label="POPIA Compliance">
            <StatusSelect
              value={popiaComplianceStatus}
              onChange={setPopiaComplianceStatus}
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