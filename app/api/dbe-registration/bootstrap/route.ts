import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/app/lib/permissions";
import { requireStaffPermission } from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const schoolId = Number(new URL(request.url).searchParams.get("school_id"));

  if (!Number.isInteger(schoolId) || schoolId <= 0) {
    return NextResponse.json(
      { error: "A valid school is required." },
      { status: 400 }
    );
  }

  const authorization = await requireStaffPermission(
    request,
    PERMISSIONS.DBE_MANAGE,
    schoolId
  );
  if (!authorization.ok) return authorization.response;

  const [
    registrationResult,
    schoolResult,
    principalResult,
    signupResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("dbe_registration")
      .select("*")
      .eq("school_id", schoolId)
      .maybeSingle(),
    supabaseAdmin
      .from("schools")
      .select(
        "school_name, emis_number, contact_number, registration_status"
      )
      .eq("id", schoolId)
      .maybeSingle(),
    supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("school_id", schoolId)
      .eq("role", "principal")
      .limit(1),
    supabaseAdmin
      .from("school_signup_requests")
      .select(
        "school_name, school_email, school_phone, school_address, principal_full_name, principal_email, principal_phone"
      )
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  if (registrationResult.error) {
    return NextResponse.json(
      { error: registrationResult.error.message },
      { status: 400 }
    );
  }
  if (schoolResult.error || !schoolResult.data) {
    return NextResponse.json(
      { error: schoolResult.error?.message || "School not found." },
      { status: 404 }
    );
  }

  const registration = registrationResult.data;
  const school = schoolResult.data;
  const principal = principalResult.data?.[0];
  const signup = signupResult.data?.[0];

  return NextResponse.json({
    has_saved_registration: Boolean(registration),
    registration: {
      id: registration?.id || null,
      school_id: schoolId,
      school_name:
        registration?.school_name ||
        school.school_name ||
        signup?.school_name ||
        "",
      registration_number:
        registration?.registration_number || school.emis_number || "",
      registration_status:
        registration?.registration_status ||
        school.registration_status ||
        "Registration In Progress",
      registration_date: registration?.registration_date || "",
      renewal_date: registration?.renewal_date || "",
      principal_name:
        registration?.principal_name ||
        principal?.full_name ||
        signup?.principal_full_name ||
        "",
      contact_number:
        registration?.contact_number ||
        signup?.school_phone ||
        school.contact_number ||
        signup?.principal_phone ||
        "",
      email_address:
        registration?.email_address ||
        signup?.school_email ||
        principal?.email ||
        signup?.principal_email ||
        "",
      physical_address:
        registration?.physical_address || signup?.school_address || "",
      health_certificate_status:
        registration?.health_certificate_status || "Valid",
      fire_certificate_status:
        registration?.fire_certificate_status || "Valid",
      municipal_approval_status:
        registration?.municipal_approval_status || "Valid",
      police_clearance_status:
        registration?.police_clearance_status || "Valid",
    },
  });
}
