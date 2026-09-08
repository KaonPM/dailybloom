import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/app/lib/permissions";
import {
  requireStaffPermission,
  writeRequiredSecurityAudit,
} from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export const runtime = "nodejs";

const REGISTRATION_STATUSES = new Set([
  "Registered",
  "Conditionally Registered",
  "Registration In Progress",
  "Unregistered",
  "Not Registered",
]);
const COMPLIANCE_STATUSES = new Set(["Valid", "Expired", "Outstanding"]);
const OFFICIAL_STATUSES = new Set([
  "Not Started", "Application In Progress", "Bronze", "Silver", "Gold",
  "Renewal In Progress", "Expired", "Other",
]);

function text(value: unknown, maximum = 250) {
  return String(value || "").trim().slice(0, maximum);
}

function optionalText(value: unknown, maximum = 250) {
  return text(value, maximum) || null;
}

export async function PUT(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const schoolId = Number(body.school_id);
  if (!Number.isInteger(schoolId) || schoolId <= 0) {
    return NextResponse.json({ error: "A valid school is required." }, { status: 400 });
  }

  const authorization = await requireStaffPermission(
    request,
    PERMISSIONS.DBE_MANAGE,
    schoolId
  );
  if (!authorization.ok) return authorization.response;

  const schoolName = text(body.school_name, 250);
  const registrationNumber = text(body.registration_number, 250);
  const registrationStatus = text(body.registration_status, 80);
  const healthCertificateStatus = text(body.health_certificate_status, 80);
  const fireCertificateStatus = text(body.fire_certificate_status, 80);
  const municipalApprovalStatus = text(body.municipal_approval_status, 80);
  const officialStatus = optionalText(body.official_status, 80);

  if (!schoolName || !registrationNumber) {
    return NextResponse.json(
      { error: "School name and registration number are required." },
      { status: 400 }
    );
  }
  if (!REGISTRATION_STATUSES.has(registrationStatus)) {
    return NextResponse.json({ error: "Choose a valid registration status." }, { status: 400 });
  }
  if (
    ![healthCertificateStatus, fireCertificateStatus, municipalApprovalStatus]
      .every((status) => COMPLIANCE_STATUSES.has(status))
  ) {
    return NextResponse.json({ error: "Choose valid compliance statuses." }, { status: 400 });
  }
  if (officialStatus && !OFFICIAL_STATUSES.has(officialStatus)) {
    return NextResponse.json({ error: "Choose a valid official registration status." }, { status: 400 });
  }

  const registrationDate = optionalText(body.registration_date, 10);
  if (registrationDate && !/^\d{4}-\d{2}-\d{2}$/.test(registrationDate)) {
    return NextResponse.json({ error: "Use a valid registration date." }, { status: 400 });
  }
  const renewalDate = optionalText(body.renewal_date, 10);
  const lastVerifiedAt = optionalText(body.last_verified_at, 40);

  const { data, error } = await supabaseAdmin
    .from("dbe_registration")
    .upsert(
      {
        school_id: schoolId,
        school_name: schoolName,
        registration_number: registrationNumber,
        registration_status: registrationStatus,
        registration_date: registrationDate,
        renewal_date: renewalDate,
        official_status: officialStatus,
        status_source: optionalText(body.status_source, 160),
        last_verified_at: lastVerifiedAt,
        registration_notes: optionalText(body.registration_notes, 2000),
        principal_name: optionalText(body.principal_name),
        contact_number: optionalText(body.contact_number, 80),
        email_address: optionalText(body.email_address),
        physical_address: optionalText(body.physical_address, 1000),
        health_certificate_status: healthCertificateStatus,
        fire_certificate_status: fireCertificateStatus,
        municipal_approval_status: municipalApprovalStatus,
        // Kept in the reconciled legacy schema for historic records only. New
        // police-clearance evidence is recorded per person in Staff Compliance.
        updated_at: new Date().toISOString(),
      },
      { onConflict: "school_id" }
    )
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  try {
    await writeRequiredSecurityAudit(
      authorization.staff,
      "dbe.registration_saved",
      { registration_id: data.id },
      { type: "dbe_registration", id: data.id }
    );
  } catch (auditError) {
    console.error("DBE registration audit write failed", {
      schoolId,
      registrationId: data.id,
      error: auditError instanceof Error ? auditError.message : String(auditError),
    });
    return NextResponse.json(
      {
        error:
          "Registration information was saved, but its required audit record could not be written. Please contact support before making further changes.",
      },
      { status: 500 }
    );
  }
  return NextResponse.json({ success: true, registration_id: data.id });
}

/**
 * Updates only the existing school-wide premises compliance summary. The detailed
 * registration form remains the owner of registration data, which prevents a
 * status-only screen from overwriting it with stale values.
 */
export async function PATCH(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const schoolId = Number(body.school_id);
  if (!Number.isInteger(schoolId) || schoolId <= 0) {
    return NextResponse.json({ error: "A valid school is required." }, { status: 400 });
  }

  const authorization = await requireStaffPermission(
    request,
    PERMISSIONS.DBE_MANAGE,
    schoolId
  );
  if (!authorization.ok) return authorization.response;

  const statuses = {
    health_certificate_status: text(body.health_certificate_status, 80),
    fire_certificate_status: text(body.fire_certificate_status, 80),
    municipal_approval_status: text(body.municipal_approval_status, 80),
  };

  if (!Object.values(statuses).every((status) => COMPLIANCE_STATUSES.has(status))) {
    return NextResponse.json({ error: "Choose valid compliance statuses." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("dbe_registration")
    .update({ ...statuses, updated_at: new Date().toISOString() })
    .eq("school_id", schoolId)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) {
    return NextResponse.json(
      { error: "Save the registration record before recording compliance status." },
      { status: 409 }
    );
  }

  try {
    await writeRequiredSecurityAudit(
      authorization.staff,
      "dbe.compliance_status_saved",
      { registration_id: data.id, fields: Object.keys(statuses) },
      { type: "dbe_registration", id: data.id }
    );
  } catch (auditError) {
    console.error("DBE compliance status audit write failed", {
      schoolId,
      registrationId: data.id,
      error: auditError instanceof Error ? auditError.message : String(auditError),
    });
    return NextResponse.json(
      { error: "Compliance status was saved, but its required audit record could not be written." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, registration_id: data.id });
}
