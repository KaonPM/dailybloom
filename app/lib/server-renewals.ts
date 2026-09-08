import "server-only";
import { supabaseAdmin } from "./supabase-admin";
import { renewalItem, sortRenewals, summarizeRenewals, type RenewalItem } from "./renewal-aggregation";

type RecordRow = Record<string, unknown>;
const clean = (value: unknown) => String(value || "").trim();
const date = (value: unknown) => clean(value) || null;
const documentRoute = "/dbe-registration/documents";

export async function getSchoolRenewals(schoolId: number) {
  const [registrationResult, documentsResult, staffResult, certificatesResult] = await Promise.all([
    supabaseAdmin.from("dbe_registration").select("id, registration_number, registration_date, renewal_date, official_status, registration_status").eq("school_id", schoolId).maybeSingle(),
    supabaseAdmin.from("dbe_compliance_documents").select("id, document_name, document_type, issue_date, expiry_date, verification_status").eq("school_id", schoolId),
    supabaseAdmin.from("staff_compliance_items").select("id, staff_user_id, title, issue_date, expiry_date, verification_status, document_id").eq("school_id", schoolId),
    supabaseAdmin.from("compliance_certificates").select("id, certificate_type, holder_name, issue_date, expiry_date, verification_status, renewal_status, document_id, notes").eq("school_id", schoolId),
  ]);
  const error = [registrationResult, documentsResult, staffResult, certificatesResult].find((result) => result.error)?.error;
  if (error) throw new Error(error.message);

  const staffIds = [...new Set((staffResult.data || []).map((item) => clean(item.staff_user_id)).filter(Boolean))];
  const profilesResult = staffIds.length
    ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", staffIds)
    : { data: [], error: null };
  if (profilesResult.error) throw new Error(profilesResult.error.message);
  const staffNames = new Map((profilesResult.data || []).map((profile) => [profile.id, clean(profile.full_name) || "Staff member"]));

  const registration = registrationResult.data as RecordRow | null;
  const documents = (documentsResult.data || []) as RecordRow[];
  const staff = (staffResult.data || []) as RecordRow[];
  const certificates = (certificatesResult.data || []) as RecordRow[];
  const staffDocumentIds = new Set(staff.map((item) => clean(item.document_id)).filter(Boolean));
  const manualDocumentIds = new Set(certificates.map((item) => clean(item.document_id)).filter(Boolean));
  const documentById = new Map(documents.map((item) => [clean(item.id), item]));

  const items: RenewalItem[] = [];
  if (registration?.renewal_date) items.push(renewalItem({
    source_type: "registration", source_id: clean(registration.id), school_id: schoolId,
    title: "DBE Registration", category: "Registration", holder: "School", issue_date: date(registration.registration_date), expiry_date: date(registration.renewal_date),
    renewal_status: clean(registration.official_status) === "Renewal In Progress" ? "Renewal In Progress" : null,
    verification_status: null, linked_document_id: null, source_route: "/dbe-registration", source_label: "Registration", is_manual: false,
  }));

  for (const item of staff) {
    if (!item.expiry_date) continue;
    const staffUserId = clean(item.staff_user_id);
    items.push(renewalItem({
      source_type: "staff", source_id: clean(item.id), school_id: schoolId, title: clean(item.title) || "Staff compliance item", category: "Staff credential",
      holder: staffNames.get(staffUserId) || "Staff member", issue_date: date(item.issue_date), expiry_date: date(item.expiry_date), renewal_status: null,
      verification_status: clean(item.verification_status) || null, linked_document_id: date(item.document_id), source_route: "/dbe-registration/staff-compliance", source_label: "Staff Compliance", is_manual: false,
    }));
  }

  for (const item of documents) {
    const id = clean(item.id);
    if (!item.expiry_date || staffDocumentIds.has(id)) continue;
    items.push(renewalItem({
      source_type: "document", source_id: id, school_id: schoolId, title: clean(item.document_name) || "Compliance document", category: clean(item.document_type) || "Compliance document",
      holder: "School", issue_date: date(item.issue_date), expiry_date: date(item.expiry_date), renewal_status: null,
      verification_status: clean(item.verification_status) || null, linked_document_id: id, source_route: documentRoute, source_label: "Documents & Evidence", is_manual: false,
      possible_duplicate: manualDocumentIds.has(id),
    }));
  }

  for (const item of certificates) {
    const linkedDocumentId = clean(item.document_id);
    if (linkedDocumentId && (staffDocumentIds.has(linkedDocumentId) || documentById.has(linkedDocumentId))) continue;
    const title = clean(item.certificate_type) || "Manual certificate";
    const expiryDate = date(item.expiry_date);
    const matchesSource = items.some((source) => source.title.toLowerCase() === title.toLowerCase() && source.expiry_date === expiryDate && source.holder === (clean(item.holder_name) || "School"));
    items.push(renewalItem({
      source_type: "manual", source_id: clean(item.id), school_id: schoolId, title, category: "Manual certificate", holder: clean(item.holder_name) || "School",
      issue_date: date(item.issue_date), expiry_date: expiryDate, renewal_status: clean(item.renewal_status) || "Current",
      verification_status: clean(item.verification_status) || null, linked_document_id: linkedDocumentId || null, source_route: "/dbe-registration/certificates", source_label: "Manual Certificate", is_manual: true,
      possible_duplicate: matchesSource,
    }));
  }
  return { items: sortRenewals(items), summary: summarizeRenewals(items) };
}
