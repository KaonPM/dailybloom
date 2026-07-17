"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { resolveSchoolContext } from "../lib/school-context";
import { authenticatedFetch } from "../lib/authenticated-fetch";
import { getCurrentProfile } from "../lib/auth";
import SubscriptionGuard from "../components/SubscriptionGuard";

type TemplateKey = "0_2" | "2_6";

type LearnerRow = {
  id: string;
  name?: string | null;
  class?: string | null;
  classroom_id?: number | null;
  parent_name?: string | null;
  parent_phone?: string | null;
};

type ClassroomRow = {
  id: number;
  classroom_name?: string | null;
  age_groups?: string[] | null;
  stationery_templates?: TemplateKey[] | null;
};

type ChecklistRow = {
  id: number;
  learner_id: string;
  classroom_id?: number | null;
  stationery_item_id?: number | null;
  item_name: string;
  quantity?: string | null;
  required_quantity?: number | null;
  received_quantity?: number | null;
  received?: boolean | null;
  received_at?: string | null;
};

type RequirementItemRow = {
  id: number;
  school_id: number;
  classroom_id: number;
  item_name: string;
  quantity?: string | null;
  category?: string | null;
  is_active?: boolean | null;
};

type GlobalRequirementItem = RequirementItemRow & {
  templateKey: TemplateKey | "all";
};

type DocumentRow = {
  id: number;
  learner_id: string;
  document_type: string;
  file_url?: string | null;
};

function normalizeName(value?: string | null) {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function parseRequiredQuantity(value?: string | null) {
  if (!value) return 1;

  const match = value.match(/\d+/);
  if (!match) return 1;

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

const GLOBAL_REQUIREMENT_ITEMS: GlobalRequirementItem[] = [
  {
    id: -1001,
    school_id: 0,
    classroom_id: 0,
    templateKey: "all",
    item_name: "Birth Certificate",
    quantity: "1 copy",
    category: "Document",
    is_active: true,
  },
  {
    id: -1002,
    school_id: 0,
    classroom_id: 0,
    templateKey: "all",
    item_name: "Immunisation Card (Clinic Card)",
    quantity: "1 copy",
    category: "Document",
    is_active: true,
  },
  {
    id: -2001,
    school_id: 0,
    classroom_id: 0,
    templateKey: "0_2",
    item_name: "Toilet Rolls",
    quantity: "10",
    category: "Hygiene",
    is_active: true,
  },
  {
    id: -2002,
    school_id: 0,
    classroom_id: 0,
    templateKey: "0_2",
    item_name: "Tissue Box",
    quantity: "3",
    category: "Hygiene",
    is_active: true,
  },
  {
    id: -2003,
    school_id: 0,
    classroom_id: 0,
    templateKey: "0_2",
    item_name: "Wipes (80 per pack)",
    quantity: "6",
    category: "Hygiene",
    is_active: true,
  },
  {
    id: -2004,
    school_id: 0,
    classroom_id: 0,
    templateKey: "0_2",
    item_name: "Big Vaseline",
    quantity: "3",
    category: "Hygiene",
    is_active: true,
  },
  {
    id: -2005,
    school_id: 0,
    classroom_id: 0,
    templateKey: "0_2",
    item_name: "Lifebuoy Soap / Sunlight Bar Soap",
    quantity: "4",
    category: "Hygiene",
    is_active: true,
  },
  {
    id: -3001,
    school_id: 0,
    classroom_id: 0,
    templateKey: "2_6",
    item_name: "Toilet Rolls",
    quantity: "10",
    category: "Hygiene",
    is_active: true,
  },
  {
    id: -3002,
    school_id: 0,
    classroom_id: 0,
    templateKey: "2_6",
    item_name: "Tissue Box",
    quantity: "3",
    category: "Hygiene",
    is_active: true,
  },
  {
    id: -3003,
    school_id: 0,
    classroom_id: 0,
    templateKey: "2_6",
    item_name: "Wipes (80 per pack)",
    quantity: "6",
    category: "Hygiene",
    is_active: true,
  },
  {
    id: -3004,
    school_id: 0,
    classroom_id: 0,
    templateKey: "2_6",
    item_name: "Big Vaseline",
    quantity: "3",
    category: "Hygiene",
    is_active: true,
  },
  {
    id: -3005,
    school_id: 0,
    classroom_id: 0,
    templateKey: "2_6",
    item_name: "Lifebuoy Soap / Sunlight Bar Soap",
    quantity: "4",
    category: "Hygiene",
    is_active: true,
  },
  {
    id: -3006,
    school_id: 0,
    classroom_id: 0,
    templateKey: "2_6",
    item_name: "Flip File (20 pages)",
    quantity: "1",
    category: "Stationery",
    is_active: true,
  },
  {
    id: -3007,
    school_id: 0,
    classroom_id: 0,
    templateKey: "2_6",
    item_name: "College Book Exercise (72 pages)",
    quantity: "1",
    category: "Stationery",
    is_active: true,
  },
  {
    id: -3008,
    school_id: 0,
    classroom_id: 0,
    templateKey: "2_6",
    item_name: "Colouring Book",
    quantity: "1",
    category: "Stationery",
    is_active: true,
  },
  {
    id: -3009,
    school_id: 0,
    classroom_id: 0,
    templateKey: "2_6",
    item_name: "Typek",
    quantity: "1",
    category: "Stationery",
    is_active: true,
  },
  {
    id: -3010,
    school_id: 0,
    classroom_id: 0,
    templateKey: "2_6",
    item_name: "Wax Crayons (box of 12)",
    quantity: "1",
    category: "Stationery",
    is_active: true,
  },
  {
    id: -3011,
    school_id: 0,
    classroom_id: 0,
    templateKey: "2_6",
    item_name: "Long Pencils",
    quantity: "4",
    category: "Stationery",
    is_active: true,
  },
  {
    id: -3012,
    school_id: 0,
    classroom_id: 0,
    templateKey: "2_6",
    item_name: "Rubber (eraser)",
    quantity: "1",
    category: "Stationery",
    is_active: true,
  },
  {
    id: -3013,
    school_id: 0,
    classroom_id: 0,
    templateKey: "2_6",
    item_name: "Glue Stick (Pritt)",
    quantity: "1",
    category: "Stationery",
    is_active: true,
  },
  {
    id: -3014,
    school_id: 0,
    classroom_id: 0,
    templateKey: "2_6",
    item_name: "Sharpener",
    quantity: "1",
    category: "Stationery",
    is_active: true,
  },
];

export default function LearnerRequirementsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolParam = searchParams.get("school");

  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);
  const [checklist, setChecklist] = useState<ChecklistRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [requirementItems, setRequirementItems] = useState<RequirementItemRow[]>([]);

  const [selectedClassroomId, setSelectedClassroomId] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  const [newCategory, setNewCategory] = useState("Stationery");

  const [loading, setLoading] = useState(true);
  const [savingItem, setSavingItem] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [learnerSearch, setLearnerSearch] = useState("");
  const [progressFilter, setProgressFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [expandedLearnerId, setExpandedLearnerId] = useState("");
  const [selectedLearnerIds, setSelectedLearnerIds] = useState<string[]>([]);
  const [workingAction, setWorkingAction] = useState("");

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);

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
    const { profile: currentProfile } = await getCurrentProfile();
    setProfile(currentProfile || null);

    const [
      learnersResult,
      classroomsResult,
      checklistResult,
      documentsResult,
      requirementItemsResult,
    ] = await Promise.all([
      supabase
        .from("learners")
        .select("id, name, class, classroom_id, parent_name, parent_phone")
        .eq("school_id", context.schoolId)
        .or("is_deleted.is.null,is_deleted.eq.false")
        .order("name", { ascending: true }),

      supabase
        .from("classrooms")
        .select("id, classroom_name, age_groups, stationery_templates")
        .eq("school_id", context.schoolId)
        .order("classroom_name", { ascending: true }),

      supabase
        .from("learner_stationery_checklist")
        .select(
          "id, learner_id, classroom_id, stationery_item_id, item_name, quantity, required_quantity, received_quantity, received, received_at"
        )
        .eq("school_id", context.schoolId)
        .limit(0)
        .order("item_name", { ascending: true }),

      supabase
        .from("learner_documents")
        .select("id, learner_id, document_type, file_url")
        .eq("school_id", context.schoolId)
        .limit(0),

      supabase
        .from("classroom_requirement_items")
        .select("id, school_id, classroom_id, item_name, quantity, category, is_active")
        .eq("school_id", context.schoolId)
        .eq("is_active", true)
        .limit(0)
        .order("category", { ascending: true })
        .order("item_name", { ascending: true }),
    ]);

    if (learnersResult.error) return alert(learnersResult.error.message);
    if (classroomsResult.error) return alert(classroomsResult.error.message);
    if (checklistResult.error) return alert(checklistResult.error.message);
    if (documentsResult.error) return alert(documentsResult.error.message);
    if (requirementItemsResult.error) {
      return alert(requirementItemsResult.error.message);
    }

    setLearners((learnersResult.data || []) as LearnerRow[]);
    setClassrooms((classroomsResult.data || []) as ClassroomRow[]);
    setChecklist((checklistResult.data || []) as ChecklistRow[]);
    setDocuments((documentsResult.data || []) as DocumentRow[]);
    setRequirementItems((requirementItemsResult.data || []) as RequirementItemRow[]);
    setLoading(false);
  }

  async function loadClassRecords(classroomId: string) {
    if (!schoolId || !classroomId) return;
    const learnerIds = learners
      .filter((learner) => String(learner.classroom_id || "") === classroomId)
      .map((learner) => learner.id);
    const [checklistResult, documentsResult, requirementItemsResult] = await Promise.all([
      supabase.from("learner_stationery_checklist")
        .select("id, learner_id, classroom_id, stationery_item_id, item_name, quantity, required_quantity, received_quantity, received, received_at")
        .eq("school_id", schoolId).eq("classroom_id", Number(classroomId)).order("item_name", { ascending: true }),
      learnerIds.length
        ? supabase.from("learner_documents").select("id, learner_id, document_type, file_url").eq("school_id", schoolId).in("learner_id", learnerIds)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("classroom_requirement_items")
        .select("id, school_id, classroom_id, item_name, quantity, category, is_active")
        .eq("school_id", schoolId).eq("classroom_id", Number(classroomId)).eq("is_active", true)
        .order("category", { ascending: true }).order("item_name", { ascending: true }),
    ]);
    const error = checklistResult.error || documentsResult.error || requirementItemsResult.error;
    if (error) return alert(error.message);
    setChecklist((checklistResult.data || []) as ChecklistRow[]);
    setDocuments((documentsResult.data || []) as DocumentRow[]);
    setRequirementItems((requirementItemsResult.data || []) as RequirementItemRow[]);
  }

  async function addRequirementItem() {
    if (!schoolId) return alert("School not found.");
    if (!selectedClassroomId) return alert("Please select a class first.");
    if (!newItemName.trim()) return alert("Please enter the requirement item.");

    setSavingItem(true);

    const response = await authenticatedFetch("/api/learner-requirements/manage", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_item", school_id: schoolId, classroom_id: Number(selectedClassroomId), item_name: newItemName.trim(), quantity: newQuantity.trim() || null, category: newCategory }),
    });
    const result = await response.json();

    setSavingItem(false);

    if (!response.ok) return alert(result.error || "Requirement could not be added.");

    setNewItemName("");
    setNewQuantity("");
    setNewCategory("Stationery");

    await loadClassRecords(selectedClassroomId);
  }

  async function deleteRequirementItem(itemId: number) {
    if (itemId < 0) return;

    const confirmed = confirm("Delete this requirement from the requirements list?");
    if (!confirmed) return;

    const response = await authenticatedFetch("/api/learner-requirements/manage", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive_item", school_id: schoolId, item_id: itemId }),
    });
    const result = await response.json();
    if (!response.ok) return alert(result.error || "Requirement could not be archived.");

    await loadClassRecords(selectedClassroomId);
  }

  function learnerProfileHref(learnerId: string) {
    return schoolParam
      ? `/children/${learnerId}?school=${schoolParam}`
      : `/children/${learnerId}`;
  }

  const selectedClassroom = useMemo(() => {
    return (
      classrooms.find((classroom) => String(classroom.id) === selectedClassroomId) ||
      null
    );
  }, [classrooms, selectedClassroomId]);

  const classLearners = useMemo(() => {
    if (!selectedClassroomId) return [];

    return learners.filter(
      (learner) => String(learner.classroom_id || "") === selectedClassroomId
    );
  }, [learners, selectedClassroomId]);

  const selectedAgeGroups = selectedClassroom?.age_groups || [];

  const hasZeroToTwo = selectedAgeGroups.some(
    (group) => group === "0-1 Years" || group === "1-2 Years"
  );

  const hasTwoToSix = selectedAgeGroups.some(
    (group) =>
      group === "2-3 Years" ||
      group === "3-4 Years" ||
      group === "4-5 Years" ||
      group === "5-6 Years"
  );

  const recommendedTemplateKeys: TemplateKey[] =
    hasZeroToTwo && hasTwoToSix
      ? ["0_2", "2_6"]
      : hasZeroToTwo
      ? ["0_2"]
      : hasTwoToSix
      ? ["2_6"]
      : [];

  const assignedTemplateKeys =
    selectedClassroom?.stationery_templates &&
    selectedClassroom.stationery_templates.length > 0
      ? selectedClassroom.stationery_templates
      : recommendedTemplateKeys;

  const selectedClassRequirements = useMemo(() => {
    if (!selectedClassroomId) return [];

    const schoolSpecificItems = requirementItems.filter(
      (item) => String(item.classroom_id) === selectedClassroomId
    );

    const globalItemsForClass = GLOBAL_REQUIREMENT_ITEMS.filter((item) => {
      if (item.templateKey === "all") return true;
      return assignedTemplateKeys.includes(item.templateKey);
    });

    const mergedMap = new Map<string, RequirementItemRow>();

    globalItemsForClass.forEach((item) => {
      mergedMap.set(
        `${normalizeName(item.category)}-${normalizeName(item.item_name)}`,
        item
      );
    });

    schoolSpecificItems.forEach((item) => {
      mergedMap.set(
        `${normalizeName(item.category)}-${normalizeName(item.item_name)}`,
        item
      );
    });

    return Array.from(mergedMap.values());
  }, [assignedTemplateKeys, requirementItems, selectedClassroomId]);

  const assignedStationeryTemplate =
    assignedTemplateKeys.length === 0
      ? "No template assigned"
      : assignedTemplateKeys
          .map((key) =>
            key === "0_2" ? "0-2 Years Template" : "2-6 Years Template"
          )
          .join(" + ");

  const stationeryRequirements = selectedClassRequirements.filter(
    (requirement) => requirement.category !== "Document"
  );

  const documentRequirements = selectedClassRequirements.filter(
    (requirement) => requirement.category === "Document"
  );

  const learnerChecklistOverview = classLearners.map((learner) => {
    const learnerChecklist = checklist.filter(
      (item) =>
        item.learner_id === learner.id &&
        String(item.classroom_id || "") === selectedClassroomId
    );

    const uniqueLearnerChecklistMap = new Map<string, ChecklistRow>();

    learnerChecklist.forEach((item) => {
      const key = normalizeName(item.item_name);

      if (!key) return;

      const existingItem = uniqueLearnerChecklistMap.get(key);

      if (!existingItem) {
        uniqueLearnerChecklistMap.set(key, item);
        return;
      }

      const existingRequired =
        existingItem.required_quantity || parseRequiredQuantity(existingItem.quantity);
      const currentRequired = item.required_quantity || parseRequiredQuantity(item.quantity);
      const existingReceived =
        existingItem.received_quantity ?? (existingItem.received ? existingRequired : 0);
      const currentReceived =
        item.received_quantity ?? (item.received ? currentRequired : 0);

      if (currentReceived > existingReceived) {
        uniqueLearnerChecklistMap.set(key, item);
      }
    });

    const uniqueLearnerChecklist = Array.from(uniqueLearnerChecklistMap.values());

    const stationeryTotals = stationeryRequirements.reduce(
      (totals, requirement) => {
        const requiredQuantity = parseRequiredQuantity(requirement.quantity);
        const requirementName = normalizeName(requirement.item_name);
        const checklistItem = uniqueLearnerChecklist.find(
          (item) => normalizeName(item.item_name) === requirementName
        );
        const receivedQuantity = Math.min(
          checklistItem?.received_quantity ??
            (checklistItem?.received ? requiredQuantity : 0),
          requiredQuantity
        );

        return {
          required: totals.required + requiredQuantity,
          received: totals.received + receivedQuantity,
        };
      },
      { required: 0, received: 0 }
    );

    const uploadedDocumentCount = documentRequirements.filter((requirement) => {
      const requirementName = normalizeName(requirement.item_name);

      return documents.some(
        (document) =>
          document.learner_id === learner.id &&
          normalizeName(document.document_type) === requirementName &&
          Boolean(document.file_url)
      );
    }).length;
    const outstandingStationery = stationeryRequirements.filter((requirement) => {
      const requiredQuantity = parseRequiredQuantity(requirement.quantity);
      const checklistItem = uniqueLearnerChecklist.find(
        (item) => normalizeName(item.item_name) === normalizeName(requirement.item_name)
      );
      const receivedQuantity = checklistItem?.received_quantity ??
        (checklistItem?.received ? requiredQuantity : 0);
      return receivedQuantity < requiredQuantity;
    }).map((requirement) => requirement.item_name);
    const missingDocuments = documentRequirements.filter((requirement) =>
      !documents.some((document) => document.learner_id === learner.id && normalizeName(document.document_type) === normalizeName(requirement.item_name) && Boolean(document.file_url))
    ).map((requirement) => requirement.item_name);

    const totalRequired = stationeryTotals.required + documentRequirements.length;
    const totalReceived = stationeryTotals.received + uploadedDocumentCount;
    const outstandingCount = Math.max(totalRequired - totalReceived, 0);
    const progress =
      totalRequired > 0 ? Math.round((totalReceived / totalRequired) * 100) : 0;

    return {
      learner,
      receivedCount: totalReceived,
      outstandingCount,
      totalCount: totalRequired,
      progress,
      outstandingItems: [...outstandingStationery, ...missingDocuments],
    };
  });

  const classCompletedItems = learnerChecklistOverview.reduce(
    (total, item) => total + item.receivedCount,
    0
  );

  const classOutstandingItems = learnerChecklistOverview.reduce(
    (total, item) => total + item.outstandingCount,
    0
  );
  const fullyCompleteLearners = learnerChecklistOverview.filter((item) => item.outstandingCount === 0 && item.totalCount > 0).length;
  const learnersWithOutstanding = learnerChecklistOverview.filter((item) => item.outstandingCount > 0).length;
  const classRequirementTotal = classCompletedItems + classOutstandingItems;
  const classCompletionPercentage = classRequirementTotal > 0 ? Math.round((classCompletedItems / classRequirementTotal) * 100) : 0;

  const canManageRequirements = ["master", "owner", "principal", "admin"].includes(String(profile?.role || "").toLowerCase());
  const visibleRequirements = stationeryRequirements.filter((item) => categoryFilter === "all" || item.category === categoryFilter);
  const visibleLearners = learnerChecklistOverview.filter((item) => {
    const matchesSearch = normalizeName(item.learner.name).includes(normalizeName(learnerSearch));
    const matchesProgress = progressFilter === "all" || (progressFilter === "outstanding" ? item.outstandingCount > 0 : item.outstandingCount === 0);
    return matchesSearch && matchesProgress;
  });

  function toggleSelectedLearner(learnerId: string) {
    setSelectedLearnerIds((current) => current.includes(learnerId) ? current.filter((id) => id !== learnerId) : [...current, learnerId]);
  }

  async function bulkReceive(item: RequirementItemRow) {
    if (!schoolId || !selectedLearnerIds.length) return alert("Select at least one learner first.");
    setWorkingAction(`receive-${item.id}`);
    const response = await authenticatedFetch("/api/learner-requirements/manage", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "bulk_receive", school_id: schoolId, classroom_id: Number(selectedClassroomId), learner_ids: selectedLearnerIds, item_id: item.id, item_name: item.item_name, quantity: item.quantity, required_quantity: parseRequiredQuantity(item.quantity) }),
    });
    const result = await response.json();
    setWorkingAction("");
    if (!response.ok) return alert(result.error || "Received items could not be saved.");
    setSelectedLearnerIds([]);
    await loadClassRecords(selectedClassroomId);
  }

  async function notifyParent(item: (typeof learnerChecklistOverview)[number]) {
    if (!schoolId || !item.learner.parent_phone || !item.outstandingItems.length || !profile?.id) {
      return alert("This learner needs a valid parent contact number before a reminder can be sent.");
    }
    const preview = item.outstandingItems.slice(0, 8).join(", ");
    const extra = item.outstandingItems.length > 8 ? ` and ${item.outstandingItems.length - 8} more` : "";
    const message = `Requirements reminder for ${item.learner.name || "your child"}: the following items are still outstanding: ${preview}${extra}. Please contact the preschool if you need assistance.`;
    if (!confirm(`Send this Parent Portal reminder to ${item.learner.parent_name || "the parent"}?\n\n${message}`)) return;
    setWorkingAction(`notify-${item.learner.id}`);
    const response = await authenticatedFetch("/api/messages/send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ school_id: schoolId, learner_id: item.learner.id, sender_role: profile.role, sender_id: profile.id, sender_name: profile.full_name || "DailyBloom staff", recipient_role: "parent", recipient_id: item.learner.parent_phone, recipient_name: item.learner.parent_name || "Parent/guardian", message }),
    });
    const result = await response.json();
    setWorkingAction("");
    if (!response.ok) return alert(result.error || "The reminder could not be sent.");
    alert("Outstanding requirements reminder sent to the Parent Portal.");
  }

  async function notifyAllOutstandingParents() {
    if (!schoolId || !profile?.id) return;
    const recipients = visibleLearners.filter((item) => item.outstandingItems.length > 0 && item.learner.parent_phone);
    if (!recipients.length) return alert("No visible learners with outstanding requirements and valid parent contact numbers were found.");
    if (!confirm(`Send Parent Portal reminders to ${recipients.length} parent${recipients.length === 1 ? "" : "s"}?`)) return;
    setWorkingAction("notify-all");
    let sent = 0;
    for (const item of recipients) {
      const preview = item.outstandingItems.slice(0, 8).join(", ");
      const extra = item.outstandingItems.length > 8 ? ` and ${item.outstandingItems.length - 8} more` : "";
      const message = `Requirements reminder for ${item.learner.name || "your child"}: the following items are still outstanding: ${preview}${extra}. Please contact the preschool if you need assistance.`;
      const response = await authenticatedFetch("/api/messages/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ school_id: schoolId, learner_id: item.learner.id, sender_role: profile.role, sender_id: profile.id, sender_name: profile.full_name || "DailyBloom staff", recipient_role: "parent", recipient_id: item.learner.parent_phone, recipient_name: item.learner.parent_name || "Parent/guardian", message }),
      });
      if (response.ok) sent += 1;
    }
    setWorkingAction("");
    alert(`${sent} of ${recipients.length} Parent Portal reminder${recipients.length === 1 ? "" : "s"} sent.`);
  }

  if (loading) {
    return <p>Loading learner requirements...</p>;
  }

  return (
    <SubscriptionGuard schoolId={schoolId} featureKey="learner_requirements">
      <div>
        <div className="db-soft-card" style={{ padding: 18, marginBottom: 18 }}>
          <h2 className="db-page-title">Learner Requirements</h2>
          <p className="db-page-subtitle">
            Manage required stationery, required documents, and learner completion
            tracking.
          </p>
        </div>

        <div
          className="db-card db-card-lavender"
          style={{ padding: 16, marginBottom: 18 }}
        >
          <h3 style={sectionTitle}>Select Class</h3>

          <select
            className="db-input"
            value={selectedClassroomId}
            onChange={(e) => { const value = e.target.value; setSelectedClassroomId(value); setSelectedLearnerIds([]); setExpandedLearnerId(""); if (value) void loadClassRecords(value); else { setChecklist([]); setDocuments([]); setRequirementItems([]); } }}
          >
            <option value="">Select Class</option>
            {classrooms.map((classroom) => (
              <option key={classroom.id} value={classroom.id}>
                {classroom.classroom_name || "Unnamed class"}
              </option>
            ))}
          </select>

          {selectedClassroomId ? (
            <div style={templateSummaryBox}>
              <strong>Assigned Stationery Template</strong>
              <p style={smallText}>{assignedStationeryTemplate}</p>

              <strong>Assigned Documents Template</strong>
              <p style={smallText}>DailyBloom Standard Required Learner Documents</p>
            </div>
          ) : null}
        </div>

        {selectedClassroomId ? (
          <div
            className="db-card db-card-blue"
            style={{ padding: 16, marginBottom: 18 }}
          >
            <h3 style={sectionTitle}>Required Stationery and Hygiene</h3>

            <div style={filterGrid}>
              <select className="db-input" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="all">All categories</option>
                <option value="Stationery">Stationery</option>
                <option value="Hygiene">Hygiene</option>
                <option value="Other">Other</option>
              </select>
              <div style={templateSummaryBox}>
                <strong>{selectedLearnerIds.length} learner{selectedLearnerIds.length === 1 ? "" : "s"} selected</strong>
                <p style={smallText}>Select learners below, then record an item for all of them here.</p>
              </div>
            </div>

            {visibleRequirements.length === 0 ? (
              <p className="db-helper">
                No stationery requirements loaded for this class yet.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {visibleRequirements.map((item) => (
                  <div key={`${item.category}-${item.id}`} style={checklistRow}>
                    <div style={checkArea}>
                      <span style={checkboxIcon}>☐</span>

                      <div>
                        <strong>{item.item_name}</strong>
                        <p style={smallText}>
                          Required: {item.quantity || "1"} | {item.category || "Other"}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button className="db-button-primary" style={smallButton} disabled={!selectedLearnerIds.length || workingAction === `receive-${item.id}`} onClick={() => bulkReceive(item)}>
                        {workingAction === `receive-${item.id}` ? "Saving..." : "Receive for Selected"}
                      </button>
                      {item.id > 0 && canManageRequirements ? (
                        <button className="db-button-secondary" style={smallButton} onClick={() => deleteRequirementItem(item.id)}>Archive</button>
                      ) : item.id < 0 ? <span style={smallText}>DailyBloom standard</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {selectedClassroomId ? (
          <div
            className="db-card db-card-yellow"
            style={{ padding: 16, marginBottom: 18 }}
          >
            <h3 style={sectionTitle}>Required Documents</h3>

            {documentRequirements.length === 0 ? (
              <p className="db-helper">
                No document requirements loaded for this class yet.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {documentRequirements.map((item) => (
                  <div key={`${item.category}-${item.id}`} style={checklistRow}>
                    <div style={checkArea}>
                      <span style={checkboxIcon}>☐</span>

                      <div>
                        <strong>{item.item_name}</strong>
                        <p style={smallText}>Required: {item.quantity || "1 copy"}</p>
                      </div>
                    </div>

                    {item.id > 0 && canManageRequirements ? (
                      <button
                        className="db-button-secondary"
                        style={smallButton}
                        onClick={() => deleteRequirementItem(item.id)}
                      >
                        Archive
                      </button>
                    ) : (
                      <span style={smallText}>DailyBloom standard</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {selectedClassroomId ? (
          <div
            className="db-card db-card-lavender"
            style={{ padding: 16, marginBottom: 18 }}
          >
            <h3 style={sectionTitle}>Class Progress Summary</h3>

            <div style={summaryGrid}>
              <div style={summaryCard}>
                <strong>Learners Complete</strong>
                <p style={summaryNumber}>{fullyCompleteLearners} / {classLearners.length}</p>
              </div>

              <div style={summaryCard}>
                <strong>Learners Outstanding</strong>
                <p style={summaryNumber}>{learnersWithOutstanding}</p>
              </div>

              <div style={summaryCard}>
                <strong>Overall Completion</strong>
                <p style={summaryNumber}>{classCompletionPercentage}%</p>
              </div>
            </div>
          </div>
        ) : null}

        {selectedClassroomId ? (
          <div
            className="db-card db-card-green"
            style={{ padding: 16, marginBottom: 18 }}
          >
            <h3 style={sectionTitle}>Learner Checklist Overview</h3>
            <div style={filterGrid}>
              <input className="db-input" placeholder="Search learner" value={learnerSearch} onChange={(event) => setLearnerSearch(event.target.value)} />
              <select className="db-input" value={progressFilter} onChange={(event) => setProgressFilter(event.target.value)}>
                <option value="all">All learners</option>
                <option value="outstanding">Outstanding only</option>
                <option value="complete">Complete only</option>
              </select>
            </div>
            {visibleLearners.length ? <button type="button" className="db-main-pill" style={{ marginBottom: 12 }} onClick={() => setSelectedLearnerIds(selectedLearnerIds.length === visibleLearners.length ? [] : visibleLearners.map((item) => item.learner.id))}>
              {selectedLearnerIds.length === visibleLearners.length ? "Clear Selection" : "Select Visible Learners"}
            </button> : null}
            {visibleLearners.some((item) => item.outstandingItems.length > 0) ? <button type="button" className="db-main-pill db-main-pill-yellow" style={{ marginBottom: 12, marginLeft: 8 }} disabled={workingAction === "notify-all"} onClick={notifyAllOutstandingParents}>
              {workingAction === "notify-all" ? "Sending Reminders..." : "Notify All Outstanding Parents"}
            </button> : null}

            {learnerChecklistOverview.length === 0 ? (
              <p className="db-helper">No learners found in this class.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {visibleLearners.map((item) => (
                  <div key={item.learner.id} style={categoryBox}>
                    <div style={learnerProgressHeader}>
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <input type="checkbox" checked={selectedLearnerIds.includes(item.learner.id)} onChange={() => toggleSelectedLearner(item.learner.id)} aria-label={`Select ${item.learner.name || "learner"}`} />
                        <div>
                        <strong>{item.learner.name || "Unnamed learner"}</strong>
                        <p style={smallText}>
                          Received: {item.receivedCount} / {item.totalCount} | Outstanding: {item.outstandingCount}
                        </p>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button className="db-button-secondary" style={smallButton} onClick={() => setExpandedLearnerId(expandedLearnerId === item.learner.id ? "" : item.learner.id)}>{expandedLearnerId === item.learner.id ? "Hide Details" : "View Outstanding"}</button>
                        {item.outstandingCount > 0 ? <button className="db-button-primary" style={smallButton} disabled={workingAction === `notify-${item.learner.id}`} onClick={() => notifyParent(item)}>{workingAction === `notify-${item.learner.id}` ? "Sending..." : "Notify Parent"}</button> : null}
                        <Link href={learnerProfileHref(item.learner.id)} className="db-button-secondary" style={linkButton}>Open Learner</Link>
                      </div>
                    </div>

                    <div style={progressBar}>
                      <div
                        style={{
                          ...progressFill,
                          width: `${item.progress}%`,
                        }}
                      />
                    </div>
                    {expandedLearnerId === item.learner.id ? <div style={templateSummaryBox}>
                      <strong>{item.outstandingItems.length ? "Outstanding items" : "All requirements complete"}</strong>
                      {item.outstandingItems.length ? <ul style={{ marginBottom: 0 }}>{item.outstandingItems.map((name) => <li key={name}>{name}</li>)}</ul> : <p style={smallText}>Nothing is currently outstanding.</p>}
                    </div> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {selectedClassroomId && canManageRequirements ? (
          <div
            className="db-card db-card-lavender"
            style={{ padding: 16, marginBottom: 18 }}
          >
            <h3 style={sectionTitle}>Add Extra Requirement</h3>

            <div style={filterGrid}>
              <input
                className="db-input"
                placeholder="Item name, e.g. Toilet Rolls"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
              />

              <input
                className="db-input"
                placeholder="Quantity, e.g. 10"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
              />

              <select
                className="db-input"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              >
                <option value="Document">Document</option>
                <option value="Stationery">Stationery</option>
                <option value="Hygiene">Hygiene</option>
                <option value="Other">Other</option>
              </select>

              <button
                className="db-button-primary"
                onClick={addRequirementItem}
                disabled={savingItem}
              >
                {savingItem ? "Adding..." : "Add Requirement"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </SubscriptionGuard>
  );
}

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  marginBottom: 18,
};

const templateSummaryBox = {
  marginTop: 12,
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: 14,
  padding: 12,
};

const learnerProgressHeader = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap" as const,
  marginBottom: 10,
};

const progressBar = {
  height: 10,
  borderRadius: 999,
  background: "#ECE7DF",
  overflow: "hidden",
};

const progressFill = {
  height: "100%",
  borderRadius: 999,
  background: "#5E9F68",
};

const summaryCard = {
  padding: 16,
  minHeight: 92,
};

const summaryNumber = {
  margin: "8px 0 0 0",
  fontSize: 28,
  fontWeight: 800,
  color: "#2D2A3E",
};

const filterGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
};

const sectionTitle = {
  margin: "0 0 12px 0",
  color: "#2D2A3E",
  fontSize: 20,
  fontWeight: 800 as const,
};

const categoryBox = {
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: 16,
  padding: 12,
};

const checklistRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  background: "#FFFFFF",
  border: "1px solid #F0E3D8",
  borderRadius: 14,
  padding: "12px 14px",
  flexWrap: "wrap" as const,
};

const checkArea = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
};

const checkboxIcon = {
  width: 24,
  height: 24,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #CFC8B8",
  borderRadius: 6,
  color: "#8A84A3",
  fontSize: 14,
  flexShrink: 0,
};

const smallText = {
  margin: "5px 0 0 0",
  color: "#6D6888",
  fontSize: 13,
  lineHeight: 1.4,
};

const linkButton = {
  textDecoration: "none",
  minHeight: 34,
  padding: "8px 12px",
  fontSize: 13,
} as const;

const smallButton = {
  minHeight: 34,
  padding: "8px 12px",
  fontSize: 13,
} as const;
