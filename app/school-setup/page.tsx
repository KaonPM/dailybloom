"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";
import { resolveSchoolContext } from "@/app/lib/school-context";
import { MonthlyFeeSetup } from "@/app/children/MonthlyFeeOptions";
import { OtherFeeSetup } from "@/app/children/OtherFeeSetup";

type FormType = "general" | "babies" | "grade_r";

type EnrolmentForm = {
  id: string;
  form_type: FormType;
  form_name: string;
  instructions?: string | null;
  source_document_name?: string | null;
  source_document_size?: number | null;
  is_active: boolean;
};

type SchoolSettings = {
  bank_account_name: string;
  bank_name: string;
  bank_account_number: string;
  bank_branch_code: string;
  bank_account_type: string;
  payment_reminder_day: number;
};

type SchoolFeeType = {
  id: number;
  fee_code: string;
  fee_name: string;
  fee_category: "registration" | "monthly" | "other";
  amount: number;
};

const emptySettings: SchoolSettings = {
  bank_account_name: "",
  bank_name: "",
  bank_account_number: "",
  bank_branch_code: "",
  bank_account_type: "",
  payment_reminder_day: 1,
};

const formOptions: { type: FormType; title: string; description: string; defaultName: string }[] = [
  {
    type: "general",
    title: "General Enrolment Form",
    description: "Use for the main preschool enrolment process.",
    defaultName: "Enrolment Form",
  },
  {
    type: "babies",
    title: "Babies Enrolment Form",
    description: "Use where your babies programme needs its own form or instructions.",
    defaultName: "Babies Enrolment Form",
  },
  {
    type: "grade_r",
    title: "Grade R Enrolment Form",
    description: "Use for Grade R enquiries and school-readiness information.",
    defaultName: "Grade R Enrolment Form",
  },
];

function formatBytes(value?: number | null) {
  if (!value) return "";
  return `${(value / 1024 / 1024).toFixed(value >= 1024 * 1024 ? 1 : 2)} MB`;
}

export default function SchoolSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [settings, setSettings] = useState<SchoolSettings>(emptySettings);
  const [forms, setForms] = useState<EnrolmentForm[]>([]);
  const [schoolFeeTypes, setSchoolFeeTypes] = useState<SchoolFeeType[]>([]);
  const [schoolRegistrationFee, setSchoolRegistrationFee] = useState("");
  const [schoolMonthlyFee, setSchoolMonthlyFee] = useState("");
  const [newMonthlyFeeName, setNewMonthlyFeeName] = useState("");
  const [newMonthlyFeeAmount, setNewMonthlyFeeAmount] = useState("");
  const [newOtherFeeName, setNewOtherFeeName] = useState("");
  const [newOtherFeeAmount, setNewOtherFeeAmount] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingForm, setSavingForm] = useState<FormType | null>(null);
  const [uploadingForm, setUploadingForm] = useState<FormType | null>(null);
  const [savingFeeSetup, setSavingFeeSetup] = useState(false);

  const schoolQuery = useMemo(() => {
    const value = searchParams.get("school");
    return value ? `?school=${encodeURIComponent(value)}` : "";
  }, [searchParams]);

  async function fetchSchoolFeeCatalog(activeSchoolId: number) {
    const response = await authenticatedFetch(
      `/api/school-fees/catalog?school_id=${activeSchoolId}`,
      { cache: "no-store" }
    );
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error || "The school fee setup could not be loaded.");
    }
    const fees = (body.fees || []) as SchoolFeeType[];
    setSchoolFeeTypes(fees);
    setSchoolRegistrationFee(
      String(fees.find((fee) => fee.fee_category === "registration")?.amount || 0)
    );
    setSchoolMonthlyFee(
      String(fees.find((fee) => fee.fee_code === "monthly_school_fee")?.amount || 0)
    );
  }

  async function loadPage() {
    const context = await resolveSchoolContext(searchParams.get("school"));
    if (context.error) {
      setError(context.error);
      if (context.error === "Not authenticated") router.push("/login");
      return;
    }
    if (context.shouldReturnToMaster || !context.schoolId) {
      router.push("/master");
      return;
    }
    setSchoolId(context.schoolId);
    try {
      const response = await authenticatedFetch(`/api/school-setup?school_id=${context.schoolId}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "School Setup could not be loaded.");
      setSettings({ ...emptySettings, ...(body.settings || {}) });
      setForms(body.forms || []);
      await fetchSchoolFeeCatalog(context.schoolId);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "School Setup could not be loaded.");
    }
  }

  async function updateSchoolFeeCatalog(
    action: string,
    extra: Record<string, unknown> = {}
  ) {
    if (!schoolId) return false;
    setSavingFeeSetup(true);
    setMessage("");
    setError("");
    try {
      const response = await authenticatedFetch("/api/school-fees/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ school_id: schoolId, action, ...extra }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "The school fee setup could not be updated.");
      }
      await fetchSchoolFeeCatalog(schoolId);
      return true;
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The school fee setup could not be updated."
      );
      return false;
    } finally {
      setSavingFeeSetup(false);
    }
  }

  async function saveStandardSchoolFees() {
    const registrationAmount = Number(schoolRegistrationFee || 0);
    const monthlyAmount = Number(schoolMonthlyFee || 0);
    if (
      Number.isNaN(registrationAmount) ||
      registrationAmount < 0 ||
      Number.isNaN(monthlyAmount) ||
      monthlyAmount < 0
    ) {
      setError("Enter valid registration and monthly fee amounts.");
      return;
    }
    const saved = await updateSchoolFeeCatalog("save_standard", {
      registration_amount: registrationAmount,
      monthly_amount: monthlyAmount,
    });
    if (saved) setMessage("School fees saved.");
  }

  async function addMonthlySchoolFee() {
    const amount = Number(newMonthlyFeeAmount || 0);
    if (!newMonthlyFeeName.trim() || Number.isNaN(amount) || amount <= 0) {
      setError("Enter a monthly fee name and an amount greater than zero.");
      return;
    }
    const saved = await updateSchoolFeeCatalog("add_monthly", {
      fee_name: newMonthlyFeeName.trim(),
      amount,
    });
    if (saved) {
      setNewMonthlyFeeName("");
      setNewMonthlyFeeAmount("");
      setMessage("Monthly fee option saved.");
    }
  }

  async function addOtherSchoolFee() {
    const amount = Number(newOtherFeeAmount || 0);
    if (!newOtherFeeName.trim() || Number.isNaN(amount) || amount < 0) {
      setError("Enter an additional fee name and a valid amount.");
      return;
    }
    const saved = await updateSchoolFeeCatalog("add_other", {
      fee_name: newOtherFeeName.trim(),
      amount,
    });
    if (saved) {
      setNewOtherFeeName("");
      setNewOtherFeeAmount("");
      setMessage("Additional fee saved.");
    }
  }

  useEffect(() => {
    void loadPage();
    // Resolve the active school once when this page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function formFor(type: FormType) {
    return forms.find((form) => form.form_type === type) || null;
  }

  function updateForm(type: FormType, updates: Partial<EnrolmentForm>) {
    setForms((current) => {
      const existing = current.find((form) => form.form_type === type);
      if (existing) return current.map((form) => form.form_type === type ? { ...form, ...updates } : form);
      return [...current, {
        id: "",
        form_type: type,
        form_name: formOptions.find((option) => option.type === type)?.defaultName || "Enrolment Form",
        instructions: "",
        is_active: true,
        ...updates,
      }];
    });
  }

  async function saveSettings() {
    if (!schoolId) return;
    setSavingSettings(true);
    setMessage("");
    setError("");
    try {
      const response = await authenticatedFetch("/api/school-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_settings", school_id: schoolId, ...settings }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "School settings could not be saved.");
      setSettings({ ...emptySettings, ...(body.settings || {}) });
      setMessage("School setup saved. The bank details will appear in the registration-fee payment message.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "School settings could not be saved.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function saveForm(type: FormType) {
    if (!schoolId) return null;
    const form = formFor(type);
    if (!form?.form_name.trim()) {
      setError("Enter a name for the enrolment form first.");
      return null;
    }
    setSavingForm(type);
    setMessage("");
    setError("");
    try {
      const response = await authenticatedFetch("/api/school-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_form",
          school_id: schoolId,
          form_type: type,
          form_name: form.form_name,
          instructions: form.instructions || "",
          is_active: form.is_active,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The enrolment form could not be saved.");
      updateForm(type, body.form);
      setMessage(`${form.form_name} saved.`);
      return body.form as EnrolmentForm;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The enrolment form could not be saved.");
      return null;
    } finally {
      setSavingForm(null);
    }
  }

  async function uploadTemplate(type: FormType, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !schoolId) return;
    const supportedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!supportedTypes.includes(file.type) || file.size > 10 * 1024 * 1024) {
      setError("Use a PDF, JPG, PNG or WEBP form no larger than 10 MB.");
      return;
    }
    setUploadingForm(type);
    setMessage("");
    setError("");
    try {
      let form = formFor(type);
      if (!form?.id) form = await saveForm(type);
      if (!form?.id) return;
      const createResponse = await authenticatedFetch("/api/school-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_form_upload",
          school_id: schoolId,
          form_id: form.id,
          file_name: file.name,
          file_size: file.size,
          content_type: file.type,
        }),
      });
      const createBody = await createResponse.json();
      if (!createResponse.ok) throw new Error(createBody.error || "The form upload could not be prepared.");
      const uploadResponse = await fetch(createBody.signed_url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadResponse.ok) throw new Error("The form document could not be uploaded. Please try again.");
      const completeResponse = await authenticatedFetch("/api/school-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete_form_upload",
          school_id: schoolId,
          form_id: form.id,
          path: createBody.path,
          file_name: file.name,
          file_size: file.size,
          content_type: file.type,
        }),
      });
      const completeBody = await completeResponse.json();
      if (!completeResponse.ok) throw new Error(completeBody.error || "The uploaded form could not be saved.");
      updateForm(type, completeBody.form);
      setMessage(`${file.name} is now attached to ${form.form_name}.`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "The form document could not be uploaded.");
    } finally {
      setUploadingForm(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <section className="db-page-header db-card-blue">
        <div>
          <h1 className="db-page-title">School Setup</h1>
          <p className="db-page-subtitle">Set your bank details, payment reminder date and the enrolment forms used by your school.</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="db-main-pill db-main-pill-yellow" href={`/dashboard${schoolQuery}`}>Dashboard</Link>
          <Link className="db-button-primary" href={`/enrolments${schoolQuery}`}>Open Enrolments</Link>
        </div>
      </section>

      {error ? <div className="db-soft-card" role="alert" style={{ padding: 14, color: "#a33d45" }}>{error}</div> : null}
      {message ? <div className="db-soft-card" role="status" style={{ padding: 14, color: "#246b45" }}>{message}</div> : null}

      <section className="db-card db-card-yellow" style={{ display: "grid", gap: 18 }}>
        <div>
          <h2 style={{ margin: 0 }}>School Fees</h2>
          <p className="db-helper" style={{ marginBottom: 0 }}>Configure the registration fee, monthly fee options and once-off charges used when adding or editing learners.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <label style={{ display: "grid", gap: 7 }}>
            <strong>Registration Fee</strong>
            <input className="db-input" type="number" min="0" step="0.01" value={schoolRegistrationFee} onChange={(event) => setSchoolRegistrationFee(event.target.value)} />
          </label>
          <label style={{ display: "grid", gap: 7 }}>
            <strong>Standard Monthly School Fee</strong>
            <input className="db-input" type="number" min="0" step="0.01" value={schoolMonthlyFee} onChange={(event) => setSchoolMonthlyFee(event.target.value)} />
          </label>
        </div>
        <div><button className="db-button-primary" type="button" disabled={savingFeeSetup} onClick={() => void saveStandardSchoolFees()}>{savingFeeSetup ? "Saving..." : "Save Standard Fees"}</button></div>
        <MonthlyFeeSetup
          options={schoolFeeTypes.filter((fee) => fee.fee_category === "monthly")}
          name={newMonthlyFeeName}
          amount={newMonthlyFeeAmount}
          saving={savingFeeSetup}
          onNameChange={setNewMonthlyFeeName}
          onAmountChange={setNewMonthlyFeeAmount}
          onAdd={() => void addMonthlySchoolFee()}
          onRemove={(feeId) => void updateSchoolFeeCatalog("archive_monthly", { fee_id: feeId })}
        />
        <OtherFeeSetup
          options={schoolFeeTypes.filter((fee) => fee.fee_category === "other")}
          name={newOtherFeeName}
          amount={newOtherFeeAmount}
          saving={savingFeeSetup}
          onNameChange={setNewOtherFeeName}
          onAmountChange={setNewOtherFeeAmount}
          onAdd={() => void addOtherSchoolFee()}
          onRemove={(feeId) => void updateSchoolFeeCatalog("archive_other", { fee_id: feeId })}
        />
      </section>

      <section className="db-card db-card-green" style={{ display: "grid", gap: 18 }}>
        <div>
          <h2 style={{ margin: 0 }}>Payment details and reminders</h2>
          <p className="db-helper" style={{ marginBottom: 0 }}>Parents receive these bank details in the registration-fee payment message. Choose the day you want payment reminders prepared each month.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <label style={{ display: "grid", gap: 7 }}><strong>Account name</strong><input className="db-input" value={settings.bank_account_name} onChange={(event) => setSettings({ ...settings, bank_account_name: event.target.value })} placeholder="School account name" /></label>
          <label style={{ display: "grid", gap: 7 }}><strong>Bank name</strong><input className="db-input" value={settings.bank_name} onChange={(event) => setSettings({ ...settings, bank_name: event.target.value })} placeholder="Bank name" /></label>
          <label style={{ display: "grid", gap: 7 }}><strong>Account number</strong><input className="db-input" inputMode="numeric" value={settings.bank_account_number} onChange={(event) => setSettings({ ...settings, bank_account_number: event.target.value })} placeholder="Account number" /></label>
          <label style={{ display: "grid", gap: 7 }}><strong>Branch code</strong><input className="db-input" inputMode="numeric" value={settings.bank_branch_code} onChange={(event) => setSettings({ ...settings, bank_branch_code: event.target.value })} placeholder="Branch code" /></label>
          <label style={{ display: "grid", gap: 7 }}><strong>Account type</strong><input className="db-input" value={settings.bank_account_type} onChange={(event) => setSettings({ ...settings, bank_account_type: event.target.value })} placeholder="e.g. Cheque account" /></label>
          <label style={{ display: "grid", gap: 7 }}><strong>Payment reminder day</strong><select className="db-input" value={settings.payment_reminder_day} onChange={(event) => setSettings({ ...settings, payment_reminder_day: Number(event.target.value) })}>{Array.from({ length: 28 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}{index === 0 ? "st" : index === 1 ? "nd" : index === 2 ? "rd" : "th"} of the month</option>)}</select></label>
        </div>
        <div><button className="db-button-primary" type="button" disabled={savingSettings} onClick={() => void saveSettings()}>{savingSettings ? "Saving..." : "Save School Setup"}</button></div>
      </section>

      <section className="db-card db-card-lavender" style={{ display: "grid", gap: 18 }}>
        <div>
          <h2 style={{ margin: 0 }}>Enrolment Forms</h2>
          <p className="db-helper" style={{ marginBottom: 0 }}>Keep up to three school-specific form types. An uploaded form is kept as your reference; DailyBloom sends a secure digital form link after the Registration Fee is confirmed.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {formOptions.map((option) => {
            const form = formFor(option.type) || { id: "", form_type: option.type, form_name: option.defaultName, instructions: "", is_active: true };
            return (
              <article className="db-soft-card" key={option.type} style={{ display: "grid", gap: 12, padding: 16 }}>
                <div><h3 style={{ margin: 0 }}>{option.title}</h3><p className="db-helper" style={{ marginBottom: 0 }}>{option.description}</p></div>
                <label style={{ display: "grid", gap: 7 }}><strong>Form name</strong><input className="db-input" value={form.form_name} onChange={(event) => updateForm(option.type, { form_name: event.target.value })} /></label>
                <label style={{ display: "grid", gap: 7 }}><strong>School instructions</strong><textarea className="db-input" rows={4} value={form.instructions || ""} onChange={(event) => updateForm(option.type, { instructions: event.target.value })} placeholder="Optional school-specific instructions for the parent" /></label>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}><input type="checkbox" checked={form.is_active} onChange={(event) => updateForm(option.type, { is_active: event.target.checked })} /> Available for new enquiries</label>
                <div className="db-helper">{form.source_document_name ? `Reference file: ${form.source_document_name}${form.source_document_size ? ` (${formatBytes(form.source_document_size)})` : ""}` : "No reference document uploaded yet."}</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className="db-button-secondary" type="button" onClick={() => void saveForm(option.type)} disabled={savingForm === option.type}>{savingForm === option.type ? "Saving..." : "Save Form"}</button>
                  <label className="db-button-primary" style={{ cursor: uploadingForm === option.type ? "wait" : "pointer" }}>
                    <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" hidden disabled={uploadingForm === option.type} onChange={(event) => void uploadTemplate(option.type, event)} />
                    {uploadingForm === option.type ? "Uploading..." : form.source_document_name ? "Replace File" : "Upload Reference"}
                  </label>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
