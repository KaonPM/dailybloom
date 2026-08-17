"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";
import { resolveSchoolContext } from "@/app/lib/school-context";

type PrintableEnrolment = {
  enquiry: { enquiry_reference: string; academic_year: number };
  school?: { school_name?: string | null; logo_url?: string | null } | null;
  configuration?: { form_title?: string | null } | null;
  documents: Array<{ title: string; instructions?: string | null; is_required: boolean }>;
  requirements: Array<{ item_name: string; quantity?: string | null }>;
  consents: Array<{ title: string; wording: string }>;
  terms: Array<{ title: string; content: string }>;
};

export default function PrintBlankEnrolmentPage() {
  const params = useParams<{ id: string }>(); const searchParams = useSearchParams(); const [data, setData] = useState<PrintableEnrolment | null>(null); const [error, setError] = useState("");
  useEffect(() => {
    async function loadPrintableForm() {
      setError("");
      const context = await resolveSchoolContext(searchParams.get("school"));
      if (context.error || !context.schoolId) {
        setError(context.error || "Select a school before printing this form.");
        return;
      }
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
  return <main className="db-public-page"><section className="db-card" style={{ display: "grid", gap: 16 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>{data.school?.logo_url ? <img src={data.school.logo_url} alt="School logo" style={{ width: 72, height: 72, objectFit: "contain" }} /> : null}<div><h1 className="db-page-title" style={{ margin: 0 }}>{data.school?.school_name}</h1><p className="db-helper">{data.configuration?.form_title || "Enrolment Form"}</p></div><button className="db-button-primary no-print" onClick={() => window.print()}>Print form</button></div><div className="db-soft-card" style={{ padding: 12 }}><strong>Enrolment Reference: {data.enquiry.enquiry_reference}</strong><br />Academic Year: {data.enquiry.academic_year}</div><h3>Learner details</h3><p>Names: ________________________________________________</p><p>Date of birth: ____________________  Parent Portal mobile number: ____________________</p><h3>Parent / guardian details</h3><p>Full name: ________________________________________________</p><p>Mobile: ____________________ Email: ____________________</p><h3>Required documents</h3>{data.documents.map((item) => <p key={item.title}>☐ {item.title}{item.is_required ? " (Required)" : ""}{item.instructions ? ` — ${item.instructions}` : ""}</p>)}<h3>Requirements</h3>{data.requirements.map((item) => <p key={item.item_name}>☐ {item.item_name}{item.quantity ? ` (${item.quantity})` : ""}</p>)}<h3>Consent & permissions</h3>{data.consents.map((item) => <p key={item.title}>☐ {item.title}: {item.wording}</p>)}<h3>Terms & conditions</h3>{data.terms.map((item) => <div key={item.title}><strong>{item.title}</strong><p>{item.content}</p></div>)}<h3>Declaration</h3><p>I confirm that the information supplied is correct.</p><p>Parent/guardian name: ____________________ Relationship: ____________________ Signature: ____________________</p><small>Enrolment Reference: {data.enquiry.enquiry_reference}</small></section></main>;
}
