"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";
import { resolveSchoolContext } from "@/app/lib/school-context";

type CustomField = { id: string; label: string; type: "text" | "textarea" | "select"; required?: boolean };
type Requirement = { template_key?: "0_2" | "2_6"; available_from_months?: number; available_to_months?: number; category: string; item_name: string; quantity?: string | null };
type PrintableEnrolment = {
  enquiry: { enquiry_reference: string; academic_year: number };
  school?: { school_name?: string | null; logo_url?: string | null; contact_number?: string | null; email_address?: string | null; physical_address?: string | null } | null;
  settings?: { bank_account_name?: string | null; bank_name?: string | null; bank_account_number?: string | null; bank_branch_code?: string | null; bank_account_type?: string | null } | null;
  configuration?: { form_title?: string | null; introduction?: string | null; additional_declaration?: string | null; second_guardian_mode?: "hidden" | "optional" | "required"; emergency_contact_mode?: "hidden" | "optional" | "required"; previous_school_enabled?: boolean; custom_fields?: CustomField[] } | null;
  documents: Array<{ title: string; instructions?: string | null; is_required: boolean }>;
  requirements: Requirement[];
  consents: Array<{ title: string; wording: string }>;
  terms: Array<{ title: string; content: string }>;
  fees: Array<{ fee_code?: string | null; fee_name?: string | null; fee_category?: string | null; amount?: number | string | null }>;
};

function Line({ label, wide = false }: { label: string; wide?: boolean }) {
  return <div className={wide ? "blank-form-field blank-form-field-wide" : "blank-form-field"}><strong>{label}</strong><span /></div>;
}

export default function PrintBlankEnrolmentPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [data, setData] = useState<PrintableEnrolment | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadPrintableForm() {
      setError("");
      const context = await resolveSchoolContext(searchParams.get("school"));
      if (context.error || !context.schoolId) return setError(context.error || "Select a school before printing this form.");
      try {
        const response = await authenticatedFetch(`/api/enrolments/print?school_id=${context.schoolId}&enquiry_id=${encodeURIComponent(params.id)}`);
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        setData(body as PrintableEnrolment);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not load form.");
      }
    }
    void loadPrintableForm();
  }, [params.id, searchParams]);

  if (error) return <main className="db-public-page"><section className="db-card">{error}</section></main>;
  if (!data) return <main className="db-public-page"><section className="db-card">Preparing blank enrolment form...</section></main>;

  const configuration = data.configuration || {};
  const schoolParam = searchParams.get("school");
  const enrolmentsHref = schoolParam ? `/enrolments?school=${encodeURIComponent(schoolParam)}` : "/enrolments";
  const secondGuardianRequired = configuration.second_guardian_mode === "required";
  const hasResponsibleId = data.documents.some((item) => /(parent|guardian).*(id|identity|passport)|(id|identity|passport).*(parent|guardian)/i.test(item.title));
  const responsibleDocuments = hasResponsibleId ? data.documents : [...data.documents, { title: "Responsible parent/guardian identification document", instructions: "Upload an ID or passport for the responsible parent or guardian.", is_required: true }];
  const documents = configuration.second_guardian_mode !== "hidden" && !responsibleDocuments.some((item) => item.title === "Second parent/guardian identification document") ? [...responsibleDocuments, { title: "Second parent/guardian identification document", instructions: secondGuardianRequired ? "Required for the second guardian." : "Attach this document if the optional second guardian section is completed.", is_required: secondGuardianRequired }] : responsibleDocuments;

  return <main className="db-public-page blank-enrolment-print"><section className="db-card blank-form-sheet">
    <header className="blank-form-header">{data.school?.logo_url ? <img src={data.school.logo_url} alt={`${data.school.school_name || "School"} logo`} /> : <div className="blank-logo-placeholder">School logo</div>}<div><h1>{data.school?.school_name || "School"}</h1><p>{configuration.form_title || "Enrolment Form"}</p><p><strong>Registered address:</strong> {data.school?.physical_address || "Not provided by the school"}</p><p><strong>Contact number:</strong> {data.school?.contact_number || "Not provided by the school"}</p><p><strong>Email:</strong> {data.school?.email_address || "Not provided by the school"}</p></div><div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}><Link className="db-button-secondary" href={enrolmentsHref}>Back to Enrolments</Link><button className="db-button-primary" type="button" onClick={() => window.print()}>Print form</button></div></header>
    <div className="blank-form-reference"><strong>Reference:</strong> {data.enquiry.enquiry_reference} <strong>Academic year:</strong> {data.enquiry.academic_year}</div>
    {configuration.introduction ? <p className="blank-form-note">{configuration.introduction}</p> : null}
    <section><h2>Learner details</h2><div className="blank-form-grid"><Line label="First name" /><Line label="Surname" /><Line label="Date of birth" /><Line label="Gender" /><Line label="Birth certificate, ID or passport number" wide />{configuration.previous_school_enabled ? <Line label="Previous school or ECD programme" wide /> : null}</div></section>
    <section><h2>Parent or guardian details</h2><div className="blank-form-grid"><Line label="Full name" /><Line label="Relationship to learner" /><Line label="ID or passport number" /><Line label="Contact mobile number" /><Line label="Contact number during the day" /><Line label="Parent Portal mobile number" /><Line label="Email address" /><Line label="Employer or business" /><Line label="Occupation" /><Line label="Work contact number" /><Line label="Home address" wide /></div></section>
    {configuration.second_guardian_mode !== "hidden" ? <section><h2>Second parent or guardian{secondGuardianRequired ? " (required)" : " (optional)"}</h2><div className="blank-form-grid"><Line label="Full name" /><Line label="Relationship to learner" /><Line label="ID or passport number" /><Line label="Mobile number" /><Line label="Contact number during the day" /><Line label="Employer or business" /><Line label="Occupation" /></div></section> : null}
    {configuration.emergency_contact_mode !== "hidden" ? <section><h2>Emergency contact{configuration.emergency_contact_mode === "required" ? " (required)" : " (optional)"}</h2><div className="blank-form-grid"><Line label="Full name" /><Line label="Relationship to learner" /><Line label="Mobile number" /></div></section> : null}
    <section><h2>Health and medical information</h2><div className="blank-form-grid"><Line label="Allergies" wide /><Line label="Medical conditions" wide /><Line label="Medical aid name" /><Line label="Membership number" /><Line label="Main member" /><Line label="Preferred doctor" /><Line label="Doctor contact number" /></div><h3>Immunisation</h3><p className="blank-form-note">Please attach the learner&apos;s latest immunisation record or clinic card to support this information.</p><div className="blank-form-grid"><Line label="Immunisations up to date? Yes / No / Scheduled / Exempt" /><Line label="Outstanding vaccines or scheduled date" /><Line label="Immunisation or exemption notes" wide /></div></section>
    {(configuration.custom_fields || []).length ? <section><h2>Additional information</h2><div className="blank-form-grid">{(configuration.custom_fields || []).map((field) => <Line key={field.id} label={`${field.label}${field.required ? " *" : ""}`} wide={field.type === "textarea"} />)}</div></section> : null}
    <section><h2>Required documents</h2><div className="blank-check-list">{documents.map((item) => <p key={item.title}>☐ <strong>{item.title}{item.is_required ? " *" : ""}</strong></p>)}</div></section>
    <section><h2>Stationery and hygiene requirements</h2>{(["0_2", "2_6"] as const).map((templateKey) => { const templateItems = data.requirements.filter((item) => (item.template_key || "2_6") === templateKey); if (!templateItems.length) return null; return <div className="blank-requirement-template" key={templateKey}><h3>{templateKey === "0_2" ? "0–2 Years" : "2–6 Years"}</h3><div className="blank-requirement-columns">{(["stationery", "hygiene"] as const).map((category) => { const items = templateItems.filter((item) => item.category === category); if (!items.length) return null; const from = Math.min(...items.map((item) => item.available_from_months ?? (templateKey === "0_2" && category === "hygiene" ? 0 : templateKey === "0_2" ? 6 : 24))); const to = Math.max(...items.map((item) => item.available_to_months ?? (templateKey === "0_2" ? 24 : 72))); return <div key={category}><strong className="blank-category-title">{category} · {from}–{to} months</strong>{items.map((item) => <p key={`${category}-${item.item_name}`}>☐ {item.item_name}{item.quantity ? ` (${item.quantity})` : ""}</p>)}</div>; })}</div></div>; })}</section>
    {data.consents.length ? <section><h2>Consent & permissions</h2>{data.consents.map((item) => <p key={item.title}>☐ <strong>{item.title}</strong> — {item.wording}</p>)}</section> : null}
    {data.terms.length ? <section><h2>Enrolment terms & conditions</h2>{data.terms.map((item) => <div className="blank-term" key={item.title}><strong>{item.title}</strong><p>{item.content}</p></div>)}<p>☐ I accept the enrolment terms and conditions.</p></section> : null}
    <section><h2>School fees</h2>{data.fees.length ? <div className="blank-fee-grid">{data.fees.map((fee, index) => <p key={`${fee.fee_code || fee.fee_name}-${index}`}><strong>{fee.fee_name || "School fee"}</strong><span>R{Number(fee.amount || 0).toFixed(2)}</span>{fee.fee_category ? <small>{fee.fee_category}</small> : null}</p>)}</div> : <p>No active fee amounts have been configured in School Fee Setup.</p>}</section>
    <section><h2>Banking details</h2><div className="blank-form-grid"><p><strong>Account name:</strong> {data.settings?.bank_account_name || "Not configured"}</p><p><strong>Bank:</strong> {data.settings?.bank_name || "Not configured"}</p><p><strong>Account number:</strong> {data.settings?.bank_account_number || "Not configured"}</p><p><strong>Branch code:</strong> {data.settings?.bank_branch_code || "Not configured"}</p><p><strong>Account type:</strong> {data.settings?.bank_account_type || "Not configured"}</p></div></section>
    <section><h2>Declaration</h2><p>{configuration.additional_declaration || "I confirm that the information supplied is true and complete and that I accept the applicable school terms and requirements."}</p><div className="blank-form-grid"><Line label="Parent/guardian full name" /><Line label="Relationship to learner" /><Line label="Signature" /><Line label="Date" /></div></section>
    <footer>Enrolment reference: {data.enquiry.enquiry_reference}</footer>
  </section></main>;
}
