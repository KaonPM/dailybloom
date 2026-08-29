"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";
import { resolveSchoolContext } from "@/app/lib/school-context";
import { getCurrentProfile } from "@/app/lib/auth";
import { PERMISSIONS } from "@/app/lib/permissions";
import { MonthlyFeeSetup } from "@/app/children/MonthlyFeeOptions";
import { OtherFeeSetup } from "@/app/children/OtherFeeSetup";

type CustomFormField = {
  id: string;
  label: string;
  type: "text" | "textarea" | "select";
  required: boolean;
  options?: string[];
};


type SchoolSettings = {
  bank_account_name: string;
  bank_name: string;
  bank_account_number: string;
  bank_branch_code: string;
  bank_account_type: string;
  payment_reminder_day: number;
  grade_r_home_language: string;
  grade_r_first_additional_language: string;
};

type SchoolBrand = { school_name?: string | null; logo_url?: string | null; primary_color?: string | null };
type SchoolRegistration = { registration_number?: string | null; physical_address?: string | null; contact_number?: string | null; email_address?: string | null };
type UniversalEnrolmentConfiguration = { form_title: string; introduction?: string | null; is_open: boolean; second_guardian_mode: "hidden" | "optional" | "required"; emergency_contact_mode: "hidden" | "optional" | "required"; previous_school_enabled: boolean; additional_declaration?: string | null; custom_fields?: CustomFormField[] };
type DocumentRequirement = { id: string; title: string; instructions?: string | null; is_required: boolean; is_active: boolean; display_order: number };
type RequirementTemplateKey = "0_2" | "2_6";
type RequirementCategory = "stationery" | "hygiene";
type RequirementTemplate = { id: string; template_key: RequirementTemplateKey; available_from_months: number; available_to_months: number; category: RequirementCategory; item_name: string; quantity?: string | null; instructions?: string | null; is_required: boolean; is_active: boolean; display_order: number };
type ConsentItem = { id: string; title: string; wording: string; is_required: boolean; is_active: boolean; display_order: number };
type TermItem = { id: string; title: string; content: string; is_active: boolean; display_order: number };
const emptyUniversalConfiguration: UniversalEnrolmentConfiguration = { form_title: "Enrolment Form", introduction: "", is_open: true, second_guardian_mode: "optional", emergency_contact_mode: "required", previous_school_enabled: true, additional_declaration: "", custom_fields: [] };

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
  grade_r_home_language: "English",
  grade_r_first_additional_language: "Afrikaans",
};

const gradeRLanguageOptions = ["Afrikaans", "English", "IsiNdebele", "IsiXhosa", "IsiZulu", "Sepedi", "Sesotho", "Setswana", "Siswati", "Tshivenda", "Xitsonga"];


export default function SchoolSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [settings, setSettings] = useState<SchoolSettings>(emptySettings);
  const [schoolBrand, setSchoolBrand] = useState<SchoolBrand | null>(null);
  const [schoolRegistration, setSchoolRegistration] = useState<SchoolRegistration | null>(null);
  const [universalConfiguration, setUniversalConfiguration] = useState<UniversalEnrolmentConfiguration>(emptyUniversalConfiguration);
  const [documentRequirements, setDocumentRequirements] = useState<DocumentRequirement[]>([]);
  const [requirementTemplates, setRequirementTemplates] = useState<RequirementTemplate[]>([]);
  const [consents, setConsents] = useState<ConsentItem[]>([]); const [terms, setTerms] = useState<TermItem[]>([]);
  const [newConsent, setNewConsent] = useState({ title: "", wording: "", is_required: true }); const [newTerm, setNewTerm] = useState({ title: "", content: "" });
  const [termDrafts, setTermDrafts] = useState<Record<string, { title: string; content: string }>>({});
  const [savingTermId, setSavingTermId] = useState("");
  const [editingTermId, setEditingTermId] = useState("");
  const [savingConsent, setSavingConsent] = useState(false); const [savingTerm, setSavingTerm] = useState(false);
  const [consentsOpen, setConsentsOpen] = useState(false); const [termsOpen, setTermsOpen] = useState(false);
  const [newRequirementTemplate, setNewRequirementTemplate] = useState<{ category: "stationery" | "hygiene"; item_name: string; quantity: string; instructions: string; is_required: boolean }>({ category: "stationery", item_name: "", quantity: "", instructions: "", is_required: false });
  const [requirementAgeRanges, setRequirementAgeRanges] = useState<Record<string, { from: number; to: number }>>({ "0_2:stationery": { from: 6, to: 24 }, "0_2:hygiene": { from: 0, to: 24 }, "2_6:stationery": { from: 24, to: 72 }, "2_6:hygiene": { from: 24, to: 72 } });
  const [savingRequirementTemplate, setSavingRequirementTemplate] = useState(false);
  const [learnerRequirementsOpen, setLearnerRequirementsOpen] = useState(false);
  const [newDocumentRequirement, setNewDocumentRequirement] = useState({ title: "", instructions: "", is_required: false });
  const [savingDocumentRequirement, setSavingDocumentRequirement] = useState(false);
  const [learnerDocumentsOpen, setLearnerDocumentsOpen] = useState(false);
  const [savingUniversalConfiguration, setSavingUniversalConfiguration] = useState(false);
  const [universalEnrolmentOpen, setUniversalEnrolmentOpen] = useState(false);
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
  const [savingFeeSetup, setSavingFeeSetup] = useState(false);
  const [schoolFeesOpen, setSchoolFeesOpen] = useState(false);
  const [paymentDetailsOpen, setPaymentDetailsOpen] = useState(false);
  const [gradeRLanguagesOpen, setGradeRLanguagesOpen] = useState(false);

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
    const { profile, error: profileError } = await getCurrentProfile();
    if (profileError || !profile) {
      router.push("/login");
      return;
    }
    const role = String(profile.role || "").toLowerCase();
    const mayManageSchool = ["master", "owner", "principal"].includes(role) || (role === "admin" && (profile.permissions || []).includes(PERMISSIONS.SCHOOL_MANAGE));
    if (!mayManageSchool) {
      router.replace("/teacher");
      return;
    }
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
    // Fees are an independent School Setup module. Load them even when a newer
    // enrolment migration has not yet been applied, so existing fee data remains visible.
    await fetchSchoolFeeCatalog(context.schoolId);
    try {
      const response = await authenticatedFetch(`/api/school-setup?school_id=${context.schoolId}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "School Setup could not be loaded.");
      setSettings({ ...emptySettings, ...(body.settings || {}) });
      setSchoolBrand(body.school || null);
      setSchoolRegistration(body.registration || null);
      setUniversalConfiguration({ ...emptyUniversalConfiguration, ...(body.enrolment_configuration || {}) });
      setDocumentRequirements(body.document_requirements || []);
      const loadedRequirements = ((body.requirement_templates || []) as Array<Partial<RequirementTemplate> & Pick<RequirementTemplate, "id" | "category" | "item_name" | "is_required" | "is_active" | "display_order">>).map((item) => ({ ...item, template_key: item.template_key === "0_2" ? "0_2" : "2_6", available_from_months: item.available_from_months ?? (item.template_key === "0_2" ? (item.category === "hygiene" ? 0 : 6) : 24), available_to_months: item.available_to_months ?? (item.template_key === "0_2" ? 24 : 72) })) as RequirementTemplate[];
      setRequirementTemplates(loadedRequirements);
      setRequirementAgeRanges((current) => Object.fromEntries(Object.entries(current).map(([key, fallback]) => { const [templateKey, category] = key.split(":"); const item = loadedRequirements.find((row) => row.template_key === templateKey && row.category === category); return [key, item ? { from: item.available_from_months, to: item.available_to_months } : fallback]; })));
      setConsents(body.consents || []);
      const loadedTerms = (body.terms || []) as TermItem[];
      setTerms(loadedTerms);
      setTermDrafts(Object.fromEntries(loadedTerms.map((item) => [item.id, { title: item.title, content: item.content }])));
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
    if (saved) {
      setMessage("School fees saved.");
      setSchoolFeesOpen(false);
    }
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
      setSchoolFeesOpen(false);
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
      setSchoolFeesOpen(false);
    }
  }

  useEffect(() => {
    void loadPage();
    // Resolve the active school once when this page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setMessage("School setup saved.");
      setPaymentDetailsOpen(false);
      setGradeRLanguagesOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "School settings could not be saved.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function saveUniversalConfiguration() {
    if (!schoolId) return;
    setSavingUniversalConfiguration(true); setError(""); setMessage("");
    try {
      const response = await authenticatedFetch("/api/school-setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save_universal_enrolment_configuration", school_id: schoolId, ...universalConfiguration }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Universal enrolment settings could not be saved.");
      setUniversalConfiguration({ ...emptyUniversalConfiguration, ...body.enrolment_configuration });
      setMessage("Universal enrolment settings saved."); setUniversalEnrolmentOpen(false);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Universal enrolment settings could not be saved."); }
    finally { setSavingUniversalConfiguration(false); }
  }

  async function saveDocumentRequirement(requirement: typeof newDocumentRequirement | DocumentRequirement = newDocumentRequirement) {
    if (!schoolId || !requirement.title.trim()) { setError("Enter a learner document name."); return; }
    setSavingDocumentRequirement(true); setError("");
    try {
      const response = await authenticatedFetch("/api/school-setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save_enrolment_item", kind: "document", school_id: schoolId, ...requirement, display_order: documentRequirements.findIndex((item) => item.id === (requirement as DocumentRequirement).id) + 1 }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Learner document could not be saved.");
      setDocumentRequirements((current) => { const item = body.item as DocumentRequirement; return current.some((row) => row.id === item.id) ? current.map((row) => row.id === item.id ? item : row) : [...current, item]; });
      setNewDocumentRequirement({ title: "", instructions: "", is_required: false }); setMessage("Learner document saved.");
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Learner document could not be saved."); } finally { setSavingDocumentRequirement(false); }
  }

  async function archiveDocumentRequirement(id: string) {
    if (!schoolId) return;
    const response = await authenticatedFetch("/api/school-setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "archive_enrolment_item", kind: "document", school_id: schoolId, id }) });
    const body = await response.json(); if (!response.ok) { setError(body.error || "Learner document could not be archived."); return; }
    setDocumentRequirements((current) => current.map((item) => item.id === id ? { ...item, is_active: false } : item));
  }

  async function saveRequirementTemplate(requirement: typeof newRequirementTemplate | RequirementTemplate = newRequirementTemplate, templateKey?: RequirementTemplateKey) {
    if (!schoolId || !requirement.item_name.trim()) { setError("Enter a requirement item name."); return; }
    setSavingRequirementTemplate(true); setError("");
    try {
      const resolvedTemplateKey = "id" in requirement ? requirement.template_key : templateKey || "2_6";
      const range = requirementAgeRanges[`${resolvedTemplateKey}:${requirement.category}`];
      const response = await authenticatedFetch("/api/school-setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save_enrolment_item", kind: "requirement", school_id: schoolId, ...requirement, template_key: resolvedTemplateKey, available_from_months: "id" in requirement ? requirement.available_from_months : range.from, available_to_months: "id" in requirement ? requirement.available_to_months : range.to, display_order: "id" in requirement ? requirement.display_order : requirementTemplates.filter((item) => item.template_key === resolvedTemplateKey).length }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Requirement could not be saved.");
      setRequirementTemplates((current) => { const item = body.item as RequirementTemplate; return current.some((row) => row.id === item.id) ? current.map((row) => row.id === item.id ? item : row) : [...current, item]; }); setNewRequirementTemplate({ category: "stationery", item_name: "", quantity: "", instructions: "", is_required: false }); setMessage("Learner requirement saved.");
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Requirement could not be saved."); } finally { setSavingRequirementTemplate(false); }
  }

  async function archiveRequirementTemplate(id: string) {
    if (!schoolId) return;
    const response = await authenticatedFetch("/api/school-setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "archive_enrolment_item", kind: "requirement", school_id: schoolId, id }) }); const body = await response.json();
    if (!response.ok) { setError(body.error || "Requirement could not be archived."); return; } setRequirementTemplates((current) => current.map((item) => item.id === id ? { ...item, is_active: false } : item));
  }

  async function saveRequirementAgeRange(templateKey: RequirementTemplateKey, category: RequirementCategory) {
    if (!schoolId) return;
    const range = requirementAgeRanges[`${templateKey}:${category}`];
    const response = await authenticatedFetch("/api/school-setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save_requirement_template_months", school_id: schoolId, template_key: templateKey, category, available_from_months: range.from, available_to_months: range.to }) });
    const body = await response.json();
    if (!response.ok) { setError(body.error || "The starting age could not be saved."); return; }
    setRequirementTemplates((current) => current.map((item) => item.template_key === templateKey && item.category === category ? { ...item, available_from_months: body.available_from_months, available_to_months: body.available_to_months } : item));
    setMessage(`${templateKey === "0_2" ? "0–2" : "2–6"} ${category} age range saved.`);
  }

  async function deleteSetupItem(kind: "document" | "requirement", id: string) {
    if (!schoolId || !window.confirm("Delete this item from the school default list? Existing submitted enrolments will not change.")) return;
    const response = await authenticatedFetch("/api/school-setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete_enrolment_item", kind, school_id: schoolId, id }) });
    const body = await response.json();
    if (!response.ok) { setError(body.error || "The item could not be deleted."); return; }
    if (kind === "document") setDocumentRequirements((current) => current.filter((item) => item.id !== id));
    else setRequirementTemplates((current) => current.filter((item) => item.id !== id));
    setMessage("Default-list item deleted.");
  }

  async function editDocumentRequirement(item: DocumentRequirement) {
    const title = window.prompt("Document name", item.title); if (title === null || !title.trim()) return;
    const instructions = window.prompt("Instructions", item.instructions || ""); if (instructions === null) return;
    await saveDocumentRequirement({ ...item, title, instructions });
  }

  async function editRequirementTemplate(item: RequirementTemplate) {
    const itemName = window.prompt("Requirement name", item.item_name); if (itemName === null || !itemName.trim()) return;
    const quantity = window.prompt("Quantity", item.quantity || ""); if (quantity === null) return;
    await saveRequirementTemplate({ ...item, item_name: itemName, quantity });
  }

  async function saveEnrolmentListItem(kind: "consent" | "term") {
    if (!schoolId) return;
    const item = kind === "consent" ? newConsent : newTerm;
    if (!item.title.trim() || !(kind === "consent" ? newConsent.wording.trim() : newTerm.content.trim())) { setError(`Complete the ${kind} title and wording.`); return; }
    if (kind === "consent") setSavingConsent(true);
    else setSavingTerm(true);
    setError("");
    try { const response = await authenticatedFetch("/api/school-setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save_enrolment_item", kind, school_id: schoolId, ...item, display_order: kind === "consent" ? consents.length : terms.length }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error || "Item could not be saved."); if (kind === "consent") { setConsents((current) => [...current, body.item as ConsentItem]); setNewConsent({ title: "", wording: "", is_required: true }); } else { setTerms((current) => [...current, body.item as TermItem]); setNewTerm({ title: "", content: "" }); } setMessage(`${kind === "consent" ? "Consent" : "Term"} saved.`); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Item could not be saved."); } finally {
      if (kind === "consent") setSavingConsent(false);
      else setSavingTerm(false);
    }
  }

  async function archiveEnrolmentListItem(kind: "consent" | "term", id: string) {
    if (!schoolId) return;
    const response = await authenticatedFetch("/api/school-setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "archive_enrolment_item", kind, school_id: schoolId, id }) });
    const body = await response.json();
    if (!response.ok) { setError(body.error || "The item could not be deactivated."); return; }
    if (kind === "consent") setConsents((current) => current.map((item) => item.id === id ? { ...item, is_active: false } : item));
    else setTerms((current) => current.map((item) => item.id === id ? { ...item, is_active: false } : item));
    setMessage(`${kind === "consent" ? "Consent" : "Term"} deactivated.`);
  }

  async function activateEnrolmentListItem(kind: "consent" | "term", item: ConsentItem | TermItem) {
    if (!schoolId) return;
    setError("");
    const response = await authenticatedFetch("/api/school-setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save_enrolment_item", kind, school_id: schoolId, ...item, is_active: true }) });
    const body = await response.json();
    if (!response.ok) { setError(body.error || "The item could not be activated."); return; }
    if (kind === "consent") setConsents((current) => current.map((row) => row.id === item.id ? body.item as ConsentItem : row));
    else setTerms((current) => current.map((row) => row.id === item.id ? body.item as TermItem : row));
    setMessage(`${kind === "consent" ? "Consent" : "Term"} activated.`);
  }

  async function deleteEnrolmentListItem(kind: "consent" | "term", id: string) {
    if (!schoolId || !window.confirm("Delete this item? It will not change enrolments already submitted.")) return;
    const response = await authenticatedFetch("/api/school-setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete_enrolment_item", kind, school_id: schoolId, id }) });
    const body = await response.json();
    if (!response.ok) { setError(body.error || "The item could not be deleted."); return; }
    if (kind === "consent") setConsents((current) => current.filter((item) => item.id !== id));
    else setTerms((current) => current.filter((item) => item.id !== id));
    setMessage(`${kind === "consent" ? "Consent" : "Term"} deleted.`);
  }

  async function moveEnrolmentListItem(kind: "consent" | "term", id: string, direction: -1 | 1) {
    if (!schoolId) return;
    const source = kind === "consent" ? consents : terms;
    const index = source.findIndex((item) => item.id === id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= source.length) return;
    const reordered = [...source];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    const withOrder = reordered.map((item, display_order) => ({ ...item, display_order }));
    if (kind === "consent") setConsents(withOrder as ConsentItem[]); else setTerms(withOrder as TermItem[]);
    const results = await Promise.all(withOrder.slice(Math.min(index, targetIndex), Math.max(index, targetIndex) + 1).map(async (item) => {
      const response = await authenticatedFetch("/api/school-setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save_enrolment_item", kind, school_id: schoolId, ...item }) });
      return response.ok;
    }));
    if (results.some((saved) => !saved)) { setError("The display order could not be saved. Refresh and try again."); return; }
    setMessage(`${kind === "consent" ? "Consent" : "Terms"} order updated.`);
  }

  async function toggleConsentRequired(item: ConsentItem) {
    if (!schoolId) return;
    const response = await authenticatedFetch("/api/school-setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save_enrolment_item", kind: "consent", school_id: schoolId, ...item, is_required: !item.is_required }) });
    const body = await response.json();
    if (!response.ok) { setError(body.error || "The consent requirement could not be updated."); return; }
    setConsents((current) => current.map((row) => row.id === item.id ? body.item as ConsentItem : row));
    setMessage(`Consent marked ${item.is_required ? "optional" : "required"}.`);
  }

  async function editEnrolmentListItem(kind: "consent" | "term", item: ConsentItem | TermItem) {
    if (!schoolId) return;
    const title = window.prompt(`${kind === "consent" ? "Consent" : "Term"} title`, item.title);
    if (title === null || !title.trim()) return;
    const currentText = kind === "consent" ? (item as ConsentItem).wording : (item as TermItem).content;
    const wording = window.prompt(`${kind === "consent" ? "Consent wording" : "Term wording"}`, currentText);
    if (wording === null || !wording.trim()) return;
    const payload = kind === "consent"
      ? { id: item.id, title, wording, is_required: (item as ConsentItem).is_required, is_active: item.is_active, display_order: consents.findIndex((row) => row.id === item.id) }
      : { id: item.id, title, content: wording, is_active: item.is_active, display_order: terms.findIndex((row) => row.id === item.id) };
    const response = await authenticatedFetch("/api/school-setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save_enrolment_item", kind, school_id: schoolId, ...payload }) });
    const body = await response.json();
    if (!response.ok) { setError(body.error || "The item could not be updated."); return; }
    if (kind === "consent") setConsents((current) => current.map((row) => row.id === item.id ? body.item as ConsentItem : row));
    else setTerms((current) => current.map((row) => row.id === item.id ? body.item as TermItem : row));
    setMessage(`${kind === "consent" ? "Consent" : "Term"} updated.`);
  }

  async function saveTermDetails(item: TermItem) {
    if (!schoolId) return;
    const draft = termDrafts[item.id] || { title: item.title, content: item.content };
    if (!draft.title.trim() || !draft.content.trim()) {
      setError("Complete the policy title and school-specific details.");
      return;
    }
    setSavingTermId(item.id);
    setError("");
    try {
      const response = await authenticatedFetch("/api/school-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_enrolment_item", kind: "term", school_id: schoolId, id: item.id, title: draft.title, content: draft.content, is_active: item.is_active, display_order: terms.findIndex((row) => row.id === item.id) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The policy details could not be saved.");
      setTerms((current) => current.map((row) => row.id === item.id ? body.item as TermItem : row));
      setEditingTermId("");
      setMessage(`${draft.title} details saved.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The policy details could not be saved.");
    } finally {
      setSavingTermId("");
    }
  }

  function openParentFormPreview() {
    const previewId = crypto.randomUUID();
    const previewData = {
      form_name: universalConfiguration.form_title || "Enrolment Form",
      instructions: universalConfiguration.introduction || "",
      custom_fields: universalConfiguration.custom_fields || [],
      document_requirements: documentRequirements.filter((item) => item.is_active),
      requirement_templates: requirementTemplates.filter((item) => item.is_active),
      consents: consents.filter((item) => item.is_active),
      terms: terms.filter((item) => item.is_active),
      enrolment_configuration: universalConfiguration,
      school_name: schoolBrand?.school_name || "Your School",
      school_logo_url: schoolBrand?.logo_url || null,
      school_primary_color: schoolBrand?.primary_color || null,
      school_registration_number: schoolRegistration?.registration_number || null,
      school_physical_address: schoolRegistration?.physical_address || null,
      school_contact_number: schoolRegistration?.contact_number || null,
      school_email_address: schoolRegistration?.email_address || null,
      fees: schoolFeeTypes,
      banking_details: settings,
    };

    try {
      localStorage.setItem(`dailybloom:enrolment-preview:${previewId}`, JSON.stringify(previewData));
      window.open(`/enrolment/preview?preview_id=${encodeURIComponent(previewId)}`, "_blank", "noopener,noreferrer");
    } catch {
      setError("The parent form preview could not be opened. Please try again.");
    }
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <section className="db-page-header db-card-blue">
        <div>
          <h1 className="db-page-title">School Setup</h1>
          <p className="db-page-subtitle">Configure the universal enrolment form, school policies, fees, payment details and parent requirements.</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="db-main-pill db-main-pill-yellow" href={`/dashboard${schoolQuery}`}>Dashboard</Link>
          <Link className="db-button-primary" href={`/enrolments${schoolQuery}`}>Open Enrolments</Link>
        </div>
      </section>

      {error ? <div className="db-soft-card" role="alert" style={{ padding: 14, color: "#a33d45" }}>{error}</div> : null}
      {message ? <div className="db-soft-card" role="status" style={{ padding: 14, color: "#246b45" }}>{message}</div> : null}

      <CollapsibleSetupSection
        title="Consent & Permissions" description="Set the parent acknowledgements required for enrolment." isOpen={consentsOpen} onToggle={() => setConsentsOpen((current) => !current)} tone="lavender">
        <div className="db-soft-card" style={{ padding: 10 }}><strong>Detailed consent requests</strong><p className="db-helper" style={{ margin: "4px 0 0" }}>When the school needs consent for a specific outing, activity, treatment or other situation, the details will be sent to the parent through the Parent Portal.</p></div>
        {consents.some((item) => !item.is_active) ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{consents.filter((item) => !item.is_active).map((item) => <button key={item.id} className="db-collapse-action" type="button" onClick={() => void activateEnrolmentListItem("consent", item)}>Activate {item.title}</button>)}</div> : null}
        <div style={{ display: "grid", gap: 8 }}>{consents.map((item, index) => <div className="db-soft-card" key={item.id} style={{ padding: 10, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><span><strong>{item.title}</strong><p className="db-helper" style={{ margin: "4px 0 0" }}>{item.wording}</p></span>{item.is_active ? <span style={{ display: "flex", gap: 8, alignItems: "start" }}><button className="db-collapse-action" type="button" disabled={index === 0} onClick={() => void moveEnrolmentListItem("consent", item.id, -1)}>Up</button><button className="db-collapse-action" type="button" disabled={index === consents.length - 1} onClick={() => void moveEnrolmentListItem("consent", item.id, 1)}>Down</button><button className="db-collapse-action" type="button" onClick={() => void toggleConsentRequired(item)}>{item.is_required ? "Make optional" : "Make required"}</button><button className="db-collapse-action" type="button" onClick={() => void editEnrolmentListItem("consent", item)}>Edit</button><button className="db-collapse-action" type="button" onClick={() => void archiveEnrolmentListItem("consent", item.id)}>Deactivate</button><button className="db-collapse-action" type="button" onClick={() => void deleteEnrolmentListItem("consent", item.id)}>Delete</button></span> : <span className="db-helper">Inactive</span>}</div>)}</div>
        <div style={{ display: "grid", gap: 8 }}><input className="db-input" value={newConsent.title} onChange={(event) => setNewConsent({ ...newConsent, title: event.target.value })} placeholder="Consent title" /><textarea className="db-input" rows={3} value={newConsent.wording} onChange={(event) => setNewConsent({ ...newConsent, wording: event.target.value })} placeholder="Consent wording shown to the parent" /><div><label><input type="checkbox" checked={newConsent.is_required} onChange={(event) => setNewConsent({ ...newConsent, is_required: event.target.checked })} /> Required</label> <button className="db-button-primary" type="button" disabled={savingConsent} onClick={() => void saveEnrolmentListItem("consent")}>{savingConsent ? "Saving..." : "Add consent"}</button></div></div>
      </CollapsibleSetupSection>
      <CollapsibleSetupSection
        title="Enrolment Terms & Conditions" description="Create editable sections that parents accept and submitted enrolments retain." isOpen={termsOpen} onToggle={() => setTermsOpen((current) => !current)} tone="yellow">
        <div className="db-soft-card" style={{ padding: 10 }}><strong>Enter the school&apos;s actual values</strong><p className="db-helper" style={{ margin: "4px 0 0" }}>Type exact details such as “Open 06:30–17:30”, “Collect by 17:30”, “R50 per 15 minutes late”, “Aftercare until 18:00”, or “30 calendar days&apos; notice”. Save each policy after editing it. Submitted enrolments retain the exact terms accepted at the time.</p></div>
        {terms.some((item) => !item.is_active) ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{terms.filter((item) => !item.is_active).map((item) => <button key={item.id} className="db-collapse-action" type="button" onClick={() => void activateEnrolmentListItem("term", item)}>Activate {item.title}</button>)}</div> : null}
        <div style={{ display: "grid", gap: 10 }}>{terms.map((item, index) => {
          const draft = termDrafts[item.id] || { title: item.title, content: item.content };
          const isEditing = editingTermId === item.id;
          return <div className="db-soft-card" key={item.id} style={{ padding: 12, display: "grid", gap: 8 }}>
            {isEditing ? <><label style={{ display: "grid", gap: 4 }}><strong>Policy title</strong><input className="db-input" value={draft.title} onChange={(event) => setTermDrafts((current) => ({ ...current, [item.id]: { ...draft, title: event.target.value } }))} /></label><label style={{ display: "grid", gap: 4 }}><strong>School-specific details</strong><textarea className="db-input" rows={3} value={draft.content} onChange={(event) => setTermDrafts((current) => ({ ...current, [item.id]: { ...draft, content: event.target.value } }))} placeholder="Enter exact times, amounts, notice periods and conditions shown to parents." /></label></> : <div><strong>{item.title}</strong><p className="db-helper" style={{ margin: "4px 0 0" }}>{item.content}</p></div>}
            {item.is_active ? <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>{isEditing ? <><button className="db-button-primary" type="button" disabled={savingTermId === item.id} onClick={() => void saveTermDetails(item)}>{savingTermId === item.id ? "Saving..." : "Save and close"}</button><button className="db-collapse-action" type="button" disabled={savingTermId === item.id} onClick={() => { setTermDrafts((current) => ({ ...current, [item.id]: { title: item.title, content: item.content } })); setEditingTermId(""); }}>Cancel</button></> : <button className="db-button-secondary" type="button" onClick={() => setEditingTermId(item.id)}>Edit details</button>}<button className="db-collapse-action" type="button" disabled={index === 0 || isEditing} onClick={() => void moveEnrolmentListItem("term", item.id, -1)}>Up</button><button className="db-collapse-action" type="button" disabled={index === terms.length - 1 || isEditing} onClick={() => void moveEnrolmentListItem("term", item.id, 1)}>Down</button><button className="db-collapse-action" type="button" disabled={isEditing} onClick={() => void archiveEnrolmentListItem("term", item.id)}>Deactivate</button><button className="db-collapse-action" type="button" disabled={isEditing} onClick={() => void deleteEnrolmentListItem("term", item.id)}>Delete</button></div> : <span className="db-helper">Inactive</span>}
          </div>;
        })}</div>
        <div style={{ display: "grid", gap: 8 }}><input className="db-input" value={newTerm.title} onChange={(event) => setNewTerm({ ...newTerm, title: event.target.value })} placeholder="e.g. Fees and payments" /><textarea className="db-input" rows={3} value={newTerm.content} onChange={(event) => setNewTerm({ ...newTerm, content: event.target.value })} placeholder="Term wording" /><div><button className="db-button-primary" type="button" disabled={savingTerm} onClick={() => void saveEnrolmentListItem("term")}>{savingTerm ? "Saving..." : "Add term"}</button></div></div>
      </CollapsibleSetupSection>
      <CollapsibleSetupSection
        title="Default Learner Requirements"
        description="The school-wide stationery and hygiene list used for enrolment. Add, edit, deactivate or delete items here; track received items on Learner Requirements Tracking."
        isOpen={learnerRequirementsOpen}
        onToggle={() => setLearnerRequirementsOpen((current) => !current)}
        tone="yellow"
      >
        {(["0_2", "2_6"] as RequirementTemplateKey[]).map((templateKey) => {
          const templateItems = requirementTemplates.filter((item) => item.template_key === templateKey);
          const templateLabel = templateKey === "0_2" ? "0–2 Years Template" : "2–6 Years Template";
          return <details key={templateKey} className="db-soft-card" style={{ padding: 12 }}>
            <summary style={{ cursor: "pointer", fontWeight: 800 }}>{templateLabel} ({templateItems.filter((item) => item.is_active).length} active items)</summary>
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              {(["stationery", "hygiene"] as const).map((category) => { const categoryItems = templateItems.filter((item) => item.category === category); const rangeKey = `${templateKey}:${category}`; const range = requirementAgeRanges[rangeKey]; return <section key={category} style={{ display: "grid", gap: 8 }}><h4 style={{ margin: "6px 0 0", textTransform: "capitalize" }}>{category} ({categoryItems.length})</h4>{templateKey === "0_2" ? <div className="db-soft-card" style={{ padding: 10 }}><strong style={{ textTransform: "capitalize" }}>{category} age disclaimer</strong><p className="db-helper" style={{ margin: "4px 0 8px" }}>{category === "stationery" ? "Babies do not normally need stationery. The school can request it from 6 months or another selected age." : "Choose the 0–2 age range for which hygiene items apply."}</p><span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><label>From <input className="db-input" style={{ width: 90 }} type="number" min={0} max={24} value={range.from} onChange={(event) => setRequirementAgeRanges((current) => ({ ...current, [rangeKey]: { ...range, from: Number(event.target.value) } }))} /> months</label><label>To <input className="db-input" style={{ width: 90 }} type="number" min={0} max={24} value={range.to} onChange={(event) => setRequirementAgeRanges((current) => ({ ...current, [rangeKey]: { ...range, to: Number(event.target.value) } }))} /> months</label><button className="db-button-secondary" type="button" onClick={() => void saveRequirementAgeRange(templateKey, category)}>Save age range</button></span></div> : null}{categoryItems.length ? categoryItems.map((item) => <div className="db-soft-card" key={item.id} style={{ padding: 10, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><span><strong>{item.item_name}</strong><br /><small className="db-helper">{item.quantity ? `Required quantity: ${item.quantity}` : "No quantity"} {item.is_required ? "· Required" : ""} {!item.is_active ? "· Inactive" : ""}</small></span><span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className="db-collapse-action" type="button" onClick={() => void editRequirementTemplate(item)}>Edit</button>{item.is_active ? <button className="db-collapse-action" type="button" onClick={() => void archiveRequirementTemplate(item.id)}>Deactivate</button> : <button className="db-collapse-action" type="button" onClick={() => void saveRequirementTemplate({ ...item, is_active: true })}>Activate</button>}<button className="db-collapse-action" type="button" onClick={() => void deleteSetupItem("requirement", item.id)}>Delete</button></span></div>) : <p className="db-helper" style={{ margin: 0 }}>No {category} items in this template yet.</p>}</section>; })}
              <div style={{ display: "grid", gridTemplateColumns: "120px minmax(0, 1fr) 110px auto", gap: 10, alignItems: "end" }}><label style={{ display: "grid", gap: 5 }}><span className="db-helper">Category</span><select className="db-input" value={newRequirementTemplate.category} onChange={(event) => setNewRequirementTemplate({ ...newRequirementTemplate, category: event.target.value as "stationery" | "hygiene" })}><option value="stationery">Stationery</option><option value="hygiene">Hygiene</option></select></label><label style={{ display: "grid", gap: 5 }}><span className="db-helper">Item</span><input className="db-input" value={newRequirementTemplate.item_name} onChange={(event) => setNewRequirementTemplate({ ...newRequirementTemplate, item_name: event.target.value })} /></label><label style={{ display: "grid", gap: 5 }}><span className="db-helper">Quantity</span><input className="db-input" value={newRequirementTemplate.quantity} onChange={(event) => setNewRequirementTemplate({ ...newRequirementTemplate, quantity: event.target.value })} /></label><div style={{ display: "grid", gap: 7 }}><label><input type="checkbox" checked={newRequirementTemplate.is_required} onChange={(event) => setNewRequirementTemplate({ ...newRequirementTemplate, is_required: event.target.checked })} /> Required</label><button className="db-button-primary" type="button" disabled={savingRequirementTemplate} onClick={() => void saveRequirementTemplate(newRequirementTemplate, templateKey)}>{savingRequirementTemplate ? "Saving..." : `Add to ${templateLabel}`}</button></div></div>
            </div>
          </details>;
        })}
      </CollapsibleSetupSection>

      <CollapsibleSetupSection
        title="Default Learner Documents"
        description="The school-wide document list used for enrolment. Manage the list here; upload and track each learner's documents on Learner Requirements Tracking."
        isOpen={learnerDocumentsOpen}
        onToggle={() => setLearnerDocumentsOpen((current) => !current)}
        tone="green"
      >
        <div style={{ display: "grid", gap: 10 }}>{documentRequirements.map((item) => <div className="db-soft-card" key={item.id} style={{ padding: 10, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><span><strong>{item.title}</strong><br /><small className="db-helper">{item.is_required ? "Required" : "Optional"}{item.instructions ? ` · ${item.instructions}` : ""}{!item.is_active ? " · Inactive" : ""}</small></span><span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className="db-collapse-action" type="button" onClick={() => void editDocumentRequirement(item)}>Edit</button>{item.is_active ? <button className="db-collapse-action" type="button" onClick={() => void archiveDocumentRequirement(item.id)}>Deactivate</button> : <button className="db-collapse-action" type="button" onClick={() => void saveDocumentRequirement({ ...item, is_active: true })}>Activate</button>}<button className="db-collapse-action" type="button" onClick={() => void deleteSetupItem("document", item.id)}>Delete</button></span></div>)}</div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) auto", gap: 10, alignItems: "end" }}><label style={{ display: "grid", gap: 5 }}><span className="db-helper">Document name</span><input className="db-input" value={newDocumentRequirement.title} onChange={(event) => setNewDocumentRequirement({ ...newDocumentRequirement, title: event.target.value })} placeholder="e.g. Birth certificate" /></label><label style={{ display: "grid", gap: 5 }}><span className="db-helper">Instructions</span><input className="db-input" value={newDocumentRequirement.instructions} onChange={(event) => setNewDocumentRequirement({ ...newDocumentRequirement, instructions: event.target.value })} placeholder="Optional note" /></label><div style={{ display: "grid", gap: 7 }}><label><input type="checkbox" checked={newDocumentRequirement.is_required} onChange={(event) => setNewDocumentRequirement({ ...newDocumentRequirement, is_required: event.target.checked })} /> Required</label><button className="db-button-primary" type="button" disabled={savingDocumentRequirement} onClick={() => void saveDocumentRequirement()}>{savingDocumentRequirement ? "Saving..." : "Add"}</button></div></div>
      </CollapsibleSetupSection>

      <CollapsibleSetupSection
        title="Main Universal Enrolment Form"
        description="Configure the school-branded form parents complete for new enrolments and re-enrolments. The introduction, declaration and custom questions entered here appear directly on that form."
        isOpen={universalEnrolmentOpen}
        onToggle={() => setUniversalEnrolmentOpen((current) => !current)}
        tone="lavender"
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <label style={{ display: "grid", gap: 7 }}><strong>Form title</strong><input className="db-input" value={universalConfiguration.form_title} onChange={(event) => setUniversalConfiguration({ ...universalConfiguration, form_title: event.target.value })} /></label>
          <label style={{ display: "grid", gap: 7 }}><strong>Second guardian</strong><select className="db-input" value={universalConfiguration.second_guardian_mode} onChange={(event) => setUniversalConfiguration({ ...universalConfiguration, second_guardian_mode: event.target.value as UniversalEnrolmentConfiguration["second_guardian_mode"] })}><option value="hidden">Hidden</option><option value="optional">Optional</option><option value="required">Required</option></select></label>
          <label style={{ display: "grid", gap: 7 }}><strong>Emergency contact</strong><select className="db-input" value={universalConfiguration.emergency_contact_mode} onChange={(event) => setUniversalConfiguration({ ...universalConfiguration, emergency_contact_mode: event.target.value as UniversalEnrolmentConfiguration["emergency_contact_mode"] })}><option value="hidden">Hidden</option><option value="optional">Optional</option><option value="required">Required</option></select></label>
        </div>
        <label style={{ display: "grid", gap: 7 }}><strong>Parent introduction</strong><textarea className="db-input" rows={3} value={universalConfiguration.introduction || ""} onChange={(event) => setUniversalConfiguration({ ...universalConfiguration, introduction: event.target.value })} /></label>
        <label style={{ display: "grid", gap: 7 }}><strong>Additional declaration <span className="db-helper">(optional)</span></strong><textarea className="db-input" rows={3} value={universalConfiguration.additional_declaration || ""} onChange={(event) => setUniversalConfiguration({ ...universalConfiguration, additional_declaration: event.target.value })} /></label>
        <details style={{ display: "grid", gap: 10 }}>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Custom parent questions ({universalConfiguration.custom_fields?.length || 0})</summary>
          <p className="db-helper" style={{ margin: 0 }}>Add only the school-specific questions that are not already collected in the main enrolment form.</p>
          {(universalConfiguration.custom_fields || []).map((field) => (
            <div className="db-soft-card" key={field.id} style={{ padding: 10, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 130px auto", gap: 8, alignItems: "end" }}>
              <label style={{ display: "grid", gap: 5 }}><span className="db-helper">Question</span><input className="db-input" value={field.label} onChange={(event) => setUniversalConfiguration({ ...universalConfiguration, custom_fields: (universalConfiguration.custom_fields || []).map((item) => item.id === field.id ? { ...item, label: event.target.value } : item) })} /></label>
              <label style={{ display: "grid", gap: 5 }}><span className="db-helper">Answer type</span><select className="db-input" value={field.type} onChange={(event) => setUniversalConfiguration({ ...universalConfiguration, custom_fields: (universalConfiguration.custom_fields || []).map((item) => item.id === field.id ? { ...item, type: event.target.value as CustomFormField["type"], options: event.target.value === "select" ? item.options || ["Option 1"] : undefined } : item) })}><option value="text">Short answer</option><option value="textarea">Long answer</option><option value="select">Choose one</option></select></label>
              <button className="db-collapse-action" type="button" onClick={() => setUniversalConfiguration({ ...universalConfiguration, custom_fields: (universalConfiguration.custom_fields || []).filter((item) => item.id !== field.id) })}>Remove</button>
              {field.type === "select" ? <label style={{ gridColumn: "1 / -1", display: "grid", gap: 5 }}><span className="db-helper">Options (one per line)</span><textarea className="db-input" rows={2} value={(field.options || []).join("\n")} onChange={(event) => setUniversalConfiguration({ ...universalConfiguration, custom_fields: (universalConfiguration.custom_fields || []).map((item) => item.id === field.id ? { ...item, options: event.target.value.split("\n").map((option) => option.trim()).filter(Boolean) } : item) })} /></label> : null}
              <label style={{ gridColumn: "1 / -1" }}><input type="checkbox" checked={field.required} onChange={(event) => setUniversalConfiguration({ ...universalConfiguration, custom_fields: (universalConfiguration.custom_fields || []).map((item) => item.id === field.id ? { ...item, required: event.target.checked } : item) })} /> Required for parents</label>
            </div>
          ))}
          <div><button className="db-button-secondary" type="button" onClick={() => setUniversalConfiguration({ ...universalConfiguration, custom_fields: [...(universalConfiguration.custom_fields || []), { id: `question_${Date.now()}`, label: "New question", type: "text", required: false }] })}>Add question</button></div>
        </details>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}><label><input type="checkbox" checked={universalConfiguration.is_open} onChange={(event) => setUniversalConfiguration({ ...universalConfiguration, is_open: event.target.checked })} /> Enrolment open</label><label><input type="checkbox" checked={universalConfiguration.previous_school_enabled} onChange={(event) => setUniversalConfiguration({ ...universalConfiguration, previous_school_enabled: event.target.checked })} /> Ask about previous school</label></div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><button className="db-button-primary" type="button" disabled={savingUniversalConfiguration} onClick={() => void saveUniversalConfiguration()}>{savingUniversalConfiguration ? "Saving..." : "Save Enrolment Settings"}</button><button className="db-button-secondary" type="button" onClick={openParentFormPreview}>Preview Parent Form</button></div>
      </CollapsibleSetupSection>

      <CollapsibleSetupSection
        title="School Fees"
        description="Configure registration, monthly and once-off charges used for learners."
        isOpen={schoolFeesOpen}
        onToggle={() => setSchoolFeesOpen((current) => !current)}
        tone="yellow"
      >
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
      </CollapsibleSetupSection>

      <CollapsibleSetupSection
        title="Grade R curriculum languages"
        description="Choose the Home Language and First Additional Language used on Grade R reports and in the Learning Hub."
        isOpen={gradeRLanguagesOpen}
        onToggle={() => setGradeRLanguagesOpen((current) => !current)}
        tone="lavender"
      >
        <p className="db-helper" style={{ margin: 0 }}>These labels apply to future Grade R confirmations and reports. Previously confirmed term results keep the language label recorded at the time.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <label style={{ display: "grid", gap: 7 }}><strong>Home Language</strong><select className="db-input" value={settings.grade_r_home_language} onChange={(event) => setSettings({ ...settings, grade_r_home_language: event.target.value, grade_r_first_additional_language: settings.grade_r_first_additional_language === event.target.value ? (event.target.value === "Afrikaans" ? "English" : "Afrikaans") : settings.grade_r_first_additional_language })}>{gradeRLanguageOptions.map((language) => <option key={language} value={language}>{language}</option>)}</select></label>
          <label style={{ display: "grid", gap: 7 }}><strong>First Additional Language</strong><select className="db-input" value={settings.grade_r_first_additional_language} onChange={(event) => setSettings({ ...settings, grade_r_first_additional_language: event.target.value })}>{gradeRLanguageOptions.filter((language) => language !== settings.grade_r_home_language).map((language) => <option key={language} value={language}>{language}</option>)}</select></label>
        </div>
        <div><button className="db-button-primary" type="button" disabled={savingSettings} onClick={() => void saveSettings()}>{savingSettings ? "Saving..." : "Save Grade R languages"}</button></div>
      </CollapsibleSetupSection>

      <CollapsibleSetupSection
        title="Payment details and reminders"
        description="Bank details and the date payment reminders are sent to unpaid learners."
        isOpen={paymentDetailsOpen}
        onToggle={() => setPaymentDetailsOpen((current) => !current)}
        tone="green"
      >
        <p className="db-helper" style={{ margin: 0 }}>Parents receive these bank details in the registration-fee payment message. On the selected date each month, payment reminders are sent only to unpaid learners who do not have an active payment arrangement.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <label style={{ display: "grid", gap: 7 }}><strong>Account name</strong><input className="db-input" value={settings.bank_account_name} onChange={(event) => setSettings({ ...settings, bank_account_name: event.target.value })} placeholder="School account name" /></label>
          <label style={{ display: "grid", gap: 7 }}><strong>Bank name</strong><input className="db-input" value={settings.bank_name} onChange={(event) => setSettings({ ...settings, bank_name: event.target.value })} placeholder="Bank name" /></label>
          <label style={{ display: "grid", gap: 7 }}><strong>Account number</strong><input className="db-input" inputMode="numeric" value={settings.bank_account_number} onChange={(event) => setSettings({ ...settings, bank_account_number: event.target.value })} placeholder="Account number" /></label>
          <label style={{ display: "grid", gap: 7 }}><strong>Branch code</strong><input className="db-input" inputMode="numeric" value={settings.bank_branch_code} onChange={(event) => setSettings({ ...settings, bank_branch_code: event.target.value })} placeholder="Branch code" /></label>
          <label style={{ display: "grid", gap: 7 }}><strong>Account type</strong><input className="db-input" value={settings.bank_account_type} onChange={(event) => setSettings({ ...settings, bank_account_type: event.target.value })} placeholder="e.g. Cheque account" /></label>
          <label style={{ display: "grid", gap: 7 }}><strong>Reminder send date</strong><select className="db-input" value={settings.payment_reminder_day} onChange={(event) => setSettings({ ...settings, payment_reminder_day: Number(event.target.value) })}>{Array.from({ length: 28 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}{index === 0 ? "st" : index === 1 ? "nd" : index === 2 ? "rd" : "th"} of every month</option>)}</select></label>
        </div>
        <div><button className="db-button-primary" type="button" disabled={savingSettings} onClick={() => void saveSettings()}>{savingSettings ? "Saving..." : "Save School Setup"}</button></div>
      </CollapsibleSetupSection>

    </div>
  );
}

function CollapsibleSetupSection({
  title,
  description,
  isOpen,
  onToggle,
  tone,
  children,
}: {
  title: string;
  description: string;
  isOpen: boolean;
  onToggle: () => void;
  tone: "yellow" | "green" | "lavender";
  children: React.ReactNode;
}) {
  return (
    <section className={`db-card db-card-${tone}`} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 18 }}>
      <div style={setupSectionHeader}>
        <div style={{ textAlign: "left" }}>
          <span style={setupSectionTitle}>{title}</span>
          <span className="db-helper" style={{ display: "block", marginTop: 4 }}>{description}</span>
        </div>
        <button type="button" className="db-collapse-action db-section-toggle" onClick={onToggle} aria-expanded={isOpen}>
          {isOpen ? "Close" : "Open"}
        </button>
      </div>
      {isOpen ? children : null}
    </section>
  );
}

const setupSectionHeader: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "center",
  gap: 16,
  width: "100%",
  minWidth: 0,
  gridColumn: "1 / -1",
  justifySelf: "stretch",
};

const setupSectionTitle: React.CSSProperties = {
  display: "block",
  color: "#2D2A3E",
  fontSize: 18,
  fontWeight: 700,
};
