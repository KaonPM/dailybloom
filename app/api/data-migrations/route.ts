import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { PERMISSIONS } from "@/app/lib/permissions";
import { requireStaffPermission, writeSecurityAudit } from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

type ImportRow = Record<string, string>;
const text = (value: unknown, max = 240) => typeof value === "string" ? value.trim().slice(0, max) : "";
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00`));

function normaliseRow(value: unknown): ImportRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key.trim().toLowerCase(), text(item, 1000)]));
}

async function validateRows(schoolId: number, sourceRows: unknown[]) {
  const rows = sourceRows.slice(0, 250).map(normaliseRow);
  const [{ data: classrooms }, { data: learners }] = await Promise.all([
    supabaseAdmin.from("classrooms").select("id, classroom_name").eq("school_id", schoolId),
    supabaseAdmin.from("learners").select("name, date_of_birth, guardian_name, parent_phone").eq("school_id", schoolId).or("is_deleted.is.null,is_deleted.eq.false"),
  ]);
  const classroomNames = new Set((classrooms || []).map((item) => String(item.classroom_name || "").trim().toLowerCase()));
  const existing = new Set((learners || []).map((item) => `${String(item.name || "").trim().toLowerCase()}|${String(item.date_of_birth || "")}|${String(item.parent_phone || "").replace(/\s/g, "")}`));
  const externalRefs = new Set<string>();
  const exceptions: Array<{ row: number; message: string }> = [];
  const readyRows: ImportRow[] = [];
  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const externalRef = text(row.external_ref, 120);
    const learnerName = text(row.learner_name, 180);
    const dob = text(row.date_of_birth, 10);
    const classroom = text(row.classroom_name, 180).toLowerCase();
    const guardianName = text(row.guardian_name, 180);
    const guardianPhone = text(row.guardian_phone, 60).replace(/\s/g, "");
    if (!externalRef) exceptions.push({ row: rowNumber, message: "External reference is required." });
    else if (externalRefs.has(externalRef.toLowerCase())) exceptions.push({ row: rowNumber, message: "External reference is duplicated in this file." });
    externalRefs.add(externalRef.toLowerCase());
    if (!learnerName) exceptions.push({ row: rowNumber, message: "Learner name is required." });
    if (!validDate(dob)) exceptions.push({ row: rowNumber, message: "Use YYYY-MM-DD for date of birth." });
    if (!classroom || !classroomNames.has(classroom)) exceptions.push({ row: rowNumber, message: "Classroom does not match an active DailyBloom classroom." });
    if (!guardianName || !guardianPhone) exceptions.push({ row: rowNumber, message: "Guardian name and mobile number are required." });
    const duplicateKey = `${learnerName.toLowerCase()}|${dob}|${guardianPhone}`;
    if (learnerName && validDate(dob) && guardianPhone && existing.has(duplicateKey)) exceptions.push({ row: rowNumber, message: "Possible existing learner: review before importing." });
    readyRows.push(row);
  });
  const blocked = new Set(exceptions.map((item) => item.row));
  return { rows: readyRows, exceptions, summary: { uploaded: rows.length, ready: rows.filter((_, index) => !blocked.has(index + 2)).length, exceptions: exceptions.length } };
}

export async function GET(request: Request) {
  const schoolId = Number(new URL(request.url).searchParams.get("school_id"));
  const access = await requireStaffPermission(request, PERMISSIONS.SCHOOL_MANAGE, schoolId);
  if (!access.ok) return access.response;
  const result = await supabaseAdmin.from("school_data_migrations").select("id, source_name, status, validation_summary, exceptions, created_at, imported_at, expires_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(10);
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  return NextResponse.json({ migrations: result.data || [] });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const schoolId = Number(body.school_id);
    const access = await requireStaffPermission(request, PERMISSIONS.SCHOOL_MANAGE, schoolId);
    if (!access.ok) return access.response;
    const action = text(body.action, 40);
    if (action === "preview") {
      if (!Array.isArray(body.rows) || body.rows.length === 0 || body.rows.length > 250) return NextResponse.json({ error: "Upload between 1 and 250 learner rows." }, { status: 400 });
      const validated = await validateRows(schoolId, body.rows);
      const result = await supabaseAdmin.from("school_data_migrations").insert({ school_id: schoolId, source_name: text(body.source_name, 240) || "learners.csv", source_rows: validated.rows, validation_summary: validated.summary, exceptions: validated.exceptions, created_by: access.staff.userId }).select("id, validation_summary, exceptions, expires_at").single();
      if (result.error) throw result.error;
      await writeSecurityAudit(access.staff, "data_migration.preview_created", { school_id: schoolId, uploaded: validated.summary.uploaded, exceptions: validated.summary.exceptions });
      return NextResponse.json({ migration: result.data });
    }
    if (action === "import") {
      const migrationId = text(body.migration_id, 80);
      if (body.confirmation !== "IMPORT APPROVED") return NextResponse.json({ error: "Type IMPORT APPROVED to confirm this live import." }, { status: 400 });
      const migrationResult = await supabaseAdmin.from("school_data_migrations").select("*").eq("id", migrationId).eq("school_id", schoolId).eq("status", "validated").maybeSingle();
      const migration = migrationResult.data;
      if (migrationResult.error || !migration) return NextResponse.json({ error: migrationResult.error?.message || "A valid, unimported preview was not found." }, { status: 404 });
      if (new Date(migration.expires_at).getTime() < Date.now()) return NextResponse.json({ error: "This preview has expired. Upload the file again." }, { status: 400 });
      if (Array.isArray(migration.exceptions) && migration.exceptions.length) return NextResponse.json({ error: "Resolve every validation exception before importing." }, { status: 400 });
      const classrooms = await supabaseAdmin.from("classrooms").select("id, classroom_name").eq("school_id", schoolId);
      if (classrooms.error) throw classrooms.error;
      const classroomByName = new Map((classrooms.data || []).map((item) => [String(item.classroom_name || "").trim().toLowerCase(), item]));
      const rows: ImportRow[] = Array.isArray(migration.source_rows) ? migration.source_rows.map(normaliseRow) : [];
      const learners = rows.map((row: ImportRow) => {
        const classroom = classroomByName.get(text(row.classroom_name, 180).toLowerCase());
        return { id: randomUUID(), school_id: schoolId, name: text(row.learner_name, 180), legal_name: text(row.legal_name, 180) || null, date_of_birth: text(row.date_of_birth, 10), gender: text(row.gender, 30) || null, classroom_id: classroom?.id || null, class: classroom?.classroom_name || "Unassigned", guardian_name: text(row.guardian_name, 180), guardian_relationship: text(row.guardian_relationship, 100) || null, parent_phone: text(row.guardian_phone, 60), parent_email: text(row.guardian_email, 180) || null, emergency_contact_name: text(row.emergency_contact_name, 180) || null, emergency_contact_relationship: text(row.emergency_contact_relationship, 100) || null, emergency_contact_phone: text(row.emergency_contact_phone, 60) || null, allergies: text(row.allergies, 1000) || null, medical_conditions: text(row.medical_conditions, 1000) || null, support_needs: text(row.support_needs, 1000) || null, fee_billing_start_date: text(row.fee_billing_start_date, 10) || null };
      });
      const inserted = learners.length ? await supabaseAdmin.from("learners").insert(learners) : { error: null };
      if (inserted.error) throw inserted.error;
      const completed = await supabaseAdmin.from("school_data_migrations").update({ status: "imported", imported_by: access.staff.userId, imported_at: new Date().toISOString(), source_rows: [] }).eq("id", migrationId).eq("school_id", schoolId);
      if (completed.error) throw completed.error;
      await writeSecurityAudit(access.staff, "data_migration.import_completed", { school_id: schoolId, migration_id: migrationId, learners_created: learners.length });
      return NextResponse.json({ success: true, learners_created: learners.length });
    }
    return NextResponse.json({ error: "Unknown migration action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The migration could not be processed." }, { status: 500 });
  }
}
