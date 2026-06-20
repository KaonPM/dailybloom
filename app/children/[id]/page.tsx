"use client";

import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { resolveSchoolContext } from "../../lib/school-context";

type TemplateKey = "0_2" | "2_6";

type LearnerRow = {
  id: string;
  name?: string | null;
  legal_name?: string | null;
  class?: string | null;
  classroom_id?: number | null;
  date_of_birth?: string | null;
  birth_certificate_number?: string | null;
  sa_id_number?: string | null;
  gender?: string | null;
  nationality?: string | null;
  home_language?: string | null;
  support_needs?: string | null;
  guardian_name?: string | null;
  guardian_relationship?: string | null;
  guardian_id_number?: string | null;
  parent_phone?: string | null;
  parent_email?: string | null;
  receiving_school?: string | null;
  ulin?: string | null;
  school_id?: number | null;
  grade_rr_candidate?: boolean | null;
  notes?: string | null;
};

type ClassroomRow = {
  id: number;
  classroom_name?: string | null;
  age_groups?: string[] | null;
  stationery_templates?: TemplateKey[] | null;
};

type RequirementTemplateItem = {
  id: number;
  school_id: number;
  classroom_id: number;
  item_name: string;
  quantity?: string | null;
  category?: string | null;
  is_active?: boolean | null;
};

type GlobalRequirementItem = RequirementTemplateItem & {
  templateKey: TemplateKey | "all";
};

type ChecklistItem = {
  id: number;
  school_id: number;
  learner_id: string;
  classroom_id: number;
  stationery_item_id: number | null;
  item_name: string;
  quantity?: string | null;
  required_quantity?: number | null;
  received_quantity?: number | null;
  received: boolean;
  received_at?: string | null;
};

type LearnerDocument = {
  id: number;
  school_id: number;
  learner_id: string;
  document_type: string;
  document_name: string;
  file_name?: string | null;
  file_url?: string | null;
  uploaded_at?: string | null;
};

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

const fallbackRequiredDocuments = GLOBAL_REQUIREMENT_ITEMS.filter(
  (item) => item.category === "Document"
).map((item) => item.item_name);

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

function getRecommendedTemplateKeys(classroom?: ClassroomRow | null): TemplateKey[] {
  const ageGroups = classroom?.age_groups || [];

  const hasZeroToTwo = ageGroups.some(
    (group) => group === "0-1 Years" || group === "1-2 Years"
  );

  const hasTwoToSix = ageGroups.some(
    (group) =>
      group === "2-3 Years" ||
      group === "3-4 Years" ||
      group === "4-5 Years" ||
      group === "5-6 Years"
  );

  if (hasZeroToTwo && hasTwoToSix) return ["0_2", "2_6"];
  if (hasZeroToTwo) return ["0_2"];
  if (hasTwoToSix) return ["2_6"];

  return ["2_6"];
}

function mergeRequirements(
  classroom: ClassroomRow | null,
  schoolSpecificItems: RequirementTemplateItem[]
) {
  const assignedTemplateKeys =
    classroom?.stationery_templates && classroom.stationery_templates.length > 0
      ? classroom.stationery_templates
      : getRecommendedTemplateKeys(classroom);

  const globalItemsForClass = GLOBAL_REQUIREMENT_ITEMS.filter((item) => {
    if (item.templateKey === "all") return true;
    return assignedTemplateKeys.includes(item.templateKey);
  });

  const mergedMap = new Map<string, RequirementTemplateItem>();

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
}

export default function LearnerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const learnerId = String(params.id || "");
  const schoolParam = searchParams.get("school");

  const [learner, setLearner] = useState<LearnerRow | null>(null);
  const [schoolId, setSchoolId] = useState<number | null>(null);

  const [activeTab, setActiveTab] = useState<
    "overview" | "requirements" | "documents"
  >("overview");

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [itemReceived, setItemReceived] = useState(false);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);

  const [documents, setDocuments] = useState<LearnerDocument[]>([]);
  const [documentRequirements, setDocumentRequirements] = useState<string[]>(
    fallbackRequiredDocuments
  );
  const [newDocumentRequirement, setNewDocumentRequirement] = useState("");
  const [uploadingDocumentType, setUploadingDocumentType] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingItem, setSavingItem] = useState(false);
  const [savingQuantityKey, setSavingQuantityKey] = useState("");
  const [savingDocumentRequirement, setSavingDocumentRequirement] =
    useState(false);

  useEffect(() => {
    loadLearnerProfile();
  }, []);

  async function loadLearnerProfile() {
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

    const { data, error } = await supabase
      .from("learners")
      .select("*")
      .eq("id", learnerId)
      .eq("school_id", context.schoolId)
      .single();

    if (error || !data) {
      alert(error?.message || "Learner not found.");
      router.push(schoolParam ? `/children?school=${schoolParam}` : "/children");
      return;
    }

    const currentLearner = data as LearnerRow;
    setLearner(currentLearner);

    if (currentLearner.classroom_id) {
      await syncAndFetchChecklist(
        context.schoolId,
        currentLearner.id,
        Number(currentLearner.classroom_id)
      );
    } else {
      setDocumentRequirements(fallbackRequiredDocuments);
    }

    await fetchDocuments(context.schoolId, currentLearner.id);

    setLoading(false);
  }

  async function syncAndFetchChecklist(
    currentSchoolId: number,
    currentLearnerId: string,
    currentClassroomId: number
  ) {
    const [
      classroomResult,
      templateResult,
      existingChecklistResult,
    ] = await Promise.all([
      supabase
        .from("classrooms")
        .select("id, classroom_name, age_groups, stationery_templates")
        .eq("id", currentClassroomId)
        .eq("school_id", currentSchoolId)
        .single(),

      supabase
        .from("classroom_requirement_items")
        .select("*")
        .eq("school_id", currentSchoolId)
        .eq("classroom_id", currentClassroomId)
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("item_name", { ascending: true }),

      supabase
        .from("learner_stationery_checklist")
        .select("*")
        .eq("school_id", currentSchoolId)
        .eq("learner_id", currentLearnerId)
        .eq("classroom_id", currentClassroomId)
        .order("id", { ascending: true }),
    ]);

    if (classroomResult.error) {
      alert(classroomResult.error.message);
      return;
    }

    if (templateResult.error) {
      alert(templateResult.error.message);
      return;
    }

    if (existingChecklistResult.error) {
      alert(existingChecklistResult.error.message);
      return;
    }

    const classroom = classroomResult.data as ClassroomRow;
    const schoolSpecificTemplates =
      (templateResult.data || []) as RequirementTemplateItem[];

    const mergedTemplates = mergeRequirements(classroom, schoolSpecificTemplates);

    const stationeryTemplates = mergedTemplates.filter(
      (item) =>
        item.category === "Stationery" ||
        item.category === "Hygiene" ||
        item.category === "Other" ||
        item.category === "Clothing" ||
        !item.category
    );

    const documentTemplates = mergedTemplates
      .filter((item) => item.category === "Document")
      .map((item) => item.item_name);

    setDocumentRequirements(
      documentTemplates.length > 0 ? documentTemplates : fallbackRequiredDocuments
    );

    const existing = (existingChecklistResult.data || []) as ChecklistItem[];
    const existingNames = new Set(
      existing.map((item) => normalizeName(item.item_name || ""))
    );

    const missingTemplates = stationeryTemplates.filter((template) => {
      return !existingNames.has(normalizeName(template.item_name));
    });

    if (missingTemplates.length > 0) {
      const rowsToInsert = missingTemplates.map((template) => {
        const requiredQuantity = parseRequiredQuantity(template.quantity);

        return {
          school_id: currentSchoolId,
          learner_id: currentLearnerId,
          classroom_id: currentClassroomId,
          stationery_item_id: template.id > 0 ? template.id : null,
          item_name: template.item_name,
          quantity: template.quantity || String(requiredQuantity),
          required_quantity: requiredQuantity,
          received_quantity: 0,
          received: false,
          received_at: null,
        };
      });

      const { error: insertError } = await supabase
        .from("learner_stationery_checklist")
        .upsert(rowsToInsert, {
          onConflict: "school_id,learner_id,classroom_id,item_name",
        });

      if (insertError) {
        alert(insertError.message);
        return;
      }
    }

    await fetchChecklist(currentSchoolId, currentLearnerId, currentClassroomId);
  }

  async function fetchChecklist(
    currentSchoolId: number,
    currentLearnerId: string,
    currentClassroomId: number
  ) {
    const { data, error } = await supabase
      .from("learner_stationery_checklist")
      .select("*")
      .eq("school_id", currentSchoolId)
      .eq("learner_id", currentLearnerId)
      .eq("classroom_id", currentClassroomId)
      .order("item_name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setChecklist((data || []) as ChecklistItem[]);
  }

  async function fetchDocuments(currentSchoolId: number, currentLearnerId: string) {
    const { data, error } = await supabase
      .from("learner_documents")
      .select("*")
      .eq("school_id", currentSchoolId)
      .eq("learner_id", currentLearnerId)
      .order("document_type", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setDocuments((data || []) as LearnerDocument[]);
  }

  function goBack() {
    router.push(schoolParam ? `/children?school=${schoolParam}` : "/children");
  }

  function resetItemForm() {
    setItemName("");
    setQuantity("");
    setItemReceived(false);
    setEditingItem(null);
  }

  async function saveRequirementItem() {
    if (!learner || !schoolId || !learner.classroom_id) return;

    if (!itemName.trim()) {
      alert("Please enter the item name.");
      return;
    }

    setSavingItem(true);

    const requiredQuantity = parseRequiredQuantity(quantity);
    const receivedQuantity = itemReceived ? requiredQuantity : 0;

    if (editingItem) {
      const { error } = await supabase
        .from("learner_stationery_checklist")
        .update({
          item_name: itemName.trim(),
          quantity: quantity.trim() || String(requiredQuantity),
          required_quantity: requiredQuantity,
          received_quantity: receivedQuantity,
          received: itemReceived,
          received_at: itemReceived ? new Date().toISOString() : null,
        })
        .eq("id", editingItem.id)
        .eq("school_id", schoolId)
        .eq("learner_id", learner.id);

      if (error) {
        alert(error.message);
        setSavingItem(false);
        return;
      }
    } else {
      const { error } = await supabase
        .from("learner_stationery_checklist")
        .upsert(
          [
            {
              school_id: schoolId,
              learner_id: learner.id,
              classroom_id: learner.classroom_id,
              stationery_item_id: null,
              item_name: itemName.trim(),
              quantity: quantity.trim() || String(requiredQuantity),
              required_quantity: requiredQuantity,
              received_quantity: 0,
              received: false,
              received_at: null,
            },
          ],
          {
            onConflict: "school_id,learner_id,classroom_id,item_name",
          }
        );

      if (error) {
        alert(error.message);
        setSavingItem(false);
        return;
      }
    }

    resetItemForm();
    await fetchChecklist(schoolId, learner.id, Number(learner.classroom_id));
    setSavingItem(false);
  }

  function startEditItem(item: ChecklistItem) {
    setEditingItem(item);
    setItemName(item.item_name || "");
    setQuantity(item.quantity || "");
    setItemReceived(item.received === true);
  }

  async function deleteRequirementItem(item: ChecklistItem) {
    if (!learner || !schoolId || !learner.classroom_id) return;

    const confirmed = confirm(`Delete ${item.item_name}?`);

    if (!confirmed) return;

    const { error } = await supabase
      .from("learner_stationery_checklist")
      .delete()
      .eq("id", item.id)
      .eq("school_id", schoolId)
      .eq("learner_id", learner.id);

    if (error) {
      alert(error.message);
      return;
    }

    await syncAndFetchChecklist(schoolId, learner.id, Number(learner.classroom_id));
  }

  async function toggleReceived(item: ChecklistItem) {
    if (!learner || !schoolId || !learner.classroom_id) return;

    const requiredQuantity =
      item.required_quantity || parseRequiredQuantity(item.quantity);
    const nextReceived = !item.received;

    const { error } = await supabase
      .from("learner_stationery_checklist")
      .update({
        required_quantity: requiredQuantity,
        received_quantity: nextReceived ? requiredQuantity : 0,
        received: nextReceived,
        received_at: nextReceived ? new Date().toISOString() : null,
      })
      .eq("id", item.id)
      .eq("school_id", schoolId)
      .eq("learner_id", learner.id);

    if (error) {
      alert(error.message);
      return;
    }

    await fetchChecklist(schoolId, learner.id, Number(learner.classroom_id));
  }

  async function updateReceivedQuantity(item: ChecklistItem, value: string) {
    if (!learner || !schoolId || !learner.classroom_id) return;

    const requiredQuantity =
      item.required_quantity || parseRequiredQuantity(item.quantity);
    const receivedQuantity = Math.max(
      0,
      Math.min(Number(value || 0), requiredQuantity)
    );
    const isFullyReceived = receivedQuantity >= requiredQuantity;

    setSavingQuantityKey(String(item.id));

    const { error } = await supabase
      .from("learner_stationery_checklist")
      .update({
        required_quantity: requiredQuantity,
        received_quantity: receivedQuantity,
        received: isFullyReceived,
        received_at: isFullyReceived ? new Date().toISOString() : null,
      })
      .eq("id", item.id)
      .eq("school_id", schoolId)
      .eq("learner_id", learner.id);

    setSavingQuantityKey("");

    if (error) {
      alert(error.message);
      return;
    }

    await fetchChecklist(schoolId, learner.id, Number(learner.classroom_id));
  }

  function getDocument(documentType: string) {
    if (!learner) return undefined;

    return documents.find(
      (document) =>
        document.learner_id === learner.id &&
        normalizeName(document.document_type) === normalizeName(documentType)
    );
  }

  async function handleDocumentUpload(
    documentType: string,
    event: ChangeEvent<HTMLInputElement>
  ) {
    if (!learner || !schoolId) return;

    const file = event.target.files?.[0];

    if (!file) return;

    setUploadingDocumentType(documentType);

    const existingDocument = getDocument(documentType);
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const filePath = `${schoolId}/${learner.id}/${documentType.replace(
      /[^a-zA-Z0-9]/g,
      "-"
    )}-${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("learner-documents")
      .upload(filePath, file, {
        upsert: true,
      });

    if (uploadError) {
      alert(uploadError.message);
      setUploadingDocumentType("");
      event.target.value = "";
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("learner-documents")
      .getPublicUrl(filePath);

    const payload = {
      school_id: schoolId,
      learner_id: learner.id,
      document_type: documentType,
      document_name: documentType,
      file_name: file.name,
      file_url: publicUrlData.publicUrl,
      uploaded_at: new Date().toISOString(),
    };

    if (existingDocument) {
      const { error } = await supabase
        .from("learner_documents")
        .update(payload)
        .eq("id", existingDocument.id)
        .eq("school_id", schoolId)
        .eq("learner_id", learner.id);

      if (error) {
        alert(error.message);
        setUploadingDocumentType("");
        event.target.value = "";
        return;
      }
    } else {
      const { error } = await supabase.from("learner_documents").insert([payload]);

      if (error) {
        alert(error.message);
        setUploadingDocumentType("");
        event.target.value = "";
        return;
      }
    }

    await fetchDocuments(schoolId, learner.id);
    setUploadingDocumentType("");
    event.target.value = "";
  }

  async function deleteDocument(document: LearnerDocument) {
    if (!learner || !schoolId) return;

    const confirmed = confirm(`Delete ${document.document_name}?`);

    if (!confirmed) return;

    const { error } = await supabase
      .from("learner_documents")
      .delete()
      .eq("id", document.id)
      .eq("school_id", schoolId)
      .eq("learner_id", learner.id);

    if (error) {
      alert(error.message);
      return;
    }

    await fetchDocuments(schoolId, learner.id);
  }

  async function addDocumentRequirement() {
    if (!learner || !schoolId) return;

    if (!learner.classroom_id) {
      alert("Link this learner to a classroom before adding document requirements.");
      return;
    }

    const documentName = newDocumentRequirement.trim();

    if (!documentName) {
      alert("Please enter the document name.");
      return;
    }

    setSavingDocumentRequirement(true);

    const { error } = await supabase.from("classroom_requirement_items").upsert(
      [
        {
          school_id: schoolId,
          classroom_id: Number(learner.classroom_id),
          item_name: documentName,
          quantity: "1 copy",
          category: "Document",
          is_active: true,
        },
      ],
      { onConflict: "school_id,classroom_id,item_name" }
    );

    setSavingDocumentRequirement(false);

    if (error) {
      alert(error.message);
      return;
    }

    setNewDocumentRequirement("");

    await syncAndFetchChecklist(
      schoolId,
      learner.id,
      Number(learner.classroom_id)
    );
  }

  if (loading) {
    return <p>Loading learner profile...</p>;
  }

  if (!learner) {
    return <p>Learner not found.</p>;
  }

  const classroomName = learner.class || "Unassigned class";
  const uniqueChecklistMap = new Map<string, ChecklistItem>();

  checklist.forEach((item) => {
    const key = normalizeName(item.item_name);

    if (!key) return;

    const existingItem = uniqueChecklistMap.get(key);

    if (!existingItem) {
      uniqueChecklistMap.set(key, item);
      return;
    }

    const existingReceived =
      existingItem.received_quantity ??
      (existingItem.received
        ? existingItem.required_quantity || parseRequiredQuantity(existingItem.quantity)
        : 0);

    const currentReceived =
      item.received_quantity ??
      (item.received
        ? item.required_quantity || parseRequiredQuantity(item.quantity)
        : 0);

    if (currentReceived > existingReceived) {
      uniqueChecklistMap.set(key, item);
    }
  });

  const uniqueChecklist = Array.from(uniqueChecklistMap.values());

  const totalRequiredQuantity = uniqueChecklist.reduce((total, item) => {
    return total + (item.required_quantity || parseRequiredQuantity(item.quantity));
  }, 0);

  const totalReceivedQuantity = uniqueChecklist.reduce((total, item) => {
    const requiredQuantity =
      item.required_quantity || parseRequiredQuantity(item.quantity);
    const receivedQuantity =
      item.received_quantity ?? (item.received ? requiredQuantity : 0);

    return total + Math.min(receivedQuantity, requiredQuantity);
  }, 0);

  const outstandingRequirementCount = Math.max(
    totalRequiredQuantity - totalReceivedQuantity,
    0
  );

  const requirementProgress =
    totalRequiredQuantity > 0
      ? Math.round((totalReceivedQuantity / totalRequiredQuantity) * 100)
      : 0;

  const uploadedDocumentCount = documentRequirements.filter((documentType) => {
    return Boolean(getDocument(documentType)?.file_url);
  }).length;

  const missingDocumentCount = documentRequirements.length - uploadedDocumentCount;

  const documentProgress =
    documentRequirements.length > 0
      ? Math.round((uploadedDocumentCount / documentRequirements.length) * 100)
      : 0;

  return (
    <div>
      <div className="db-soft-card" style={{ padding: 16, marginBottom: 16 }}>
        <button
          type="button"
          className="db-button-secondary"
          onClick={goBack}
          style={{ marginBottom: 12, minHeight: 36, padding: "8px 14px" }}
        >
          ← Back to Learners
        </button>

        <h2 className="db-page-title" style={{ marginBottom: 4 }}>
          {learner.name || "Unnamed learner"}
        </h2>

        <p className="db-page-subtitle">
          {learner.class || "Unassigned class"} ·{" "}
          {learner.legal_name || "Legal name not added"}
        </p>
      </div>

      <div
        className="db-card db-card-lavender"
        style={{ padding: 12, marginBottom: 16 }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className={
              activeTab === "overview"
                ? "db-button-primary"
                : "db-button-secondary"
            }
            style={tabButton}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>

          <button
            type="button"
            className={
              activeTab === "requirements"
                ? "db-button-primary"
                : "db-button-secondary"
            }
            style={tabButton}
            onClick={() => setActiveTab("requirements")}
          >
            Requirements
          </button>

          <button
            type="button"
            className={
              activeTab === "documents"
                ? "db-button-primary"
                : "db-button-secondary"
            }
            style={tabButton}
            onClick={() => setActiveTab("documents")}
          >
            Documents
          </button>
        </div>
      </div>

      {activeTab === "overview" && (
        <div className="db-card db-card-blue" style={{ padding: 16 }}>
          <h3 style={sectionTitle}>Learner Information</h3>

          <div style={grid}>
            <Info label="Preferred Name" value={learner.name} />
            <Info label="Full Legal Name" value={learner.legal_name} />
            <Info label="Date of Birth" value={learner.date_of_birth} />
            <Info label="Gender" value={learner.gender} />
            <Info label="Nationality" value={learner.nationality} />
            <Info label="Home Language" value={learner.home_language} />
            <Info
              label="Birth Certificate Number"
              value={learner.birth_certificate_number}
            />
            <Info label="SA ID Number" value={learner.sa_id_number} />
            <Info label="Classroom" value={learner.class} />
            <Info
              label="Grade RR Candidate"
              value={learner.grade_rr_candidate ? "Yes" : "No"}
            />
            <Info
              label="LURITS Number (Optional)"
              value={learner.ulin || "Not assigned yet"}
            />
            <Info label="Receiving School" value={learner.receiving_school} />
          </div>

          <h3 style={sectionTitle}>Primary Contact</h3>

          <div style={grid}>
            <Info label="Name" value={learner.guardian_name} />
            <Info label="Relationship" value={learner.guardian_relationship} />
            <Info label="Phone" value={learner.parent_phone} />
            <Info label="Email" value={learner.parent_email} />
            <Info label="ID Number" value={learner.guardian_id_number} />
          </div>

          <h3 style={sectionTitle}>Additional Information</h3>

          <div style={grid}>
            <Info
              label="Support Needs"
              value={learner.support_needs || "None recorded"}
            />
            <Info label="Notes" value={learner.notes || "No notes recorded"} />
          </div>
        </div>
      )}

      {activeTab === "requirements" && (
        <div className="db-card db-card-green" style={{ padding: 16 }}>
          <h3 style={{ ...sectionTitle, margin: 0 }}>
            {classroomName} Requirements
          </h3>

          <p className="db-helper" style={{ marginTop: 4 }}>
            Track learner requirements and stationery received.
          </p>

          {learner.classroom_id ? (
            <div style={progressSummary}>
              <div>
                <strong>
                  Received: {totalReceivedQuantity} / {totalRequiredQuantity} items
                </strong>
                <p style={summaryText}>
                  Outstanding: {outstandingRequirementCount} items
                </p>
              </div>

              <div style={progressBar} aria-label="Requirements progress">
                <div
                  style={{
                    ...progressFill,
                    width: `${requirementProgress}%`,
                  }}
                />
              </div>
            </div>
          ) : null}

          {!learner.classroom_id ? (
            <p className="db-helper" style={{ marginTop: 14 }}>
              This learner is not linked to a classroom yet. Link the learner to
              a class first so the correct requirements can load automatically.
            </p>
          ) : uniqueChecklist.length === 0 ? (
            <p className="db-helper" style={{ marginTop: 14 }}>
              No requirements have been loaded for this learner yet.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
              {uniqueChecklist.map((item) => {
                const requiredQuantity =
                  item.required_quantity || parseRequiredQuantity(item.quantity);
                const receivedQuantity =
                  item.received_quantity ?? (item.received ? requiredQuantity : 0);
                const outstandingQuantity = Math.max(
                  requiredQuantity - receivedQuantity,
                  0
                );

                return (
                  <div key={item.id} style={requirementRow}>
                    <button
                      type="button"
                      onClick={() => toggleReceived(item)}
                      style={checkboxButton}
                      aria-label="Toggle received status"
                    >
                      {item.received ? "✓" : ""}
                    </button>

                    <div style={{ flex: 1 }}>
                      <strong>{item.item_name}</strong>
                      <p style={summaryText}>
                        Required: {requiredQuantity} · Received:{" "}
                        {receivedQuantity} · Outstanding: {outstandingQuantity}
                      </p>
                    </div>

                    <input
                      className="db-input"
                      type="number"
                      min={0}
                      max={requiredQuantity}
                      value={receivedQuantity}
                      style={quantityInput}
                      onChange={(event) =>
                        updateReceivedQuantity(item, event.target.value)
                      }
                    />

                    <span style={summaryText}>
                      {savingQuantityKey === String(item.id) ? "Saving..." : ""}
                    </span>

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="db-button-secondary"
                        style={smallButton}
                        onClick={() => startEditItem(item)}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="db-button-secondary"
                        style={smallButton}
                        onClick={() => deleteRequirementItem(item)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: "1px solid #DDEFD8",
            }}
          >
            <h4
              style={{
                margin: "0 0 10px 0",
                color: "#2D2A3E",
                fontSize: 15,
                fontWeight: 800,
              }}
            >
              {editingItem ? "Edit requirement item" : "Add extra requirement item"}
            </h4>

            <div style={formGrid}>
              <input
                className="db-input"
                placeholder="Item name, e.g. Toilet Rolls"
                value={itemName}
                onChange={(event) => setItemName(event.target.value)}
              />

              <input
                className="db-input"
                placeholder="Quantity, e.g. 10"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />

              {editingItem ? (
                <label style={receivedToggleLabel}>
                  <input
                    type="checkbox"
                    checked={itemReceived}
                    onChange={(event) => setItemReceived(event.target.checked)}
                  />
                  Mark as received
                </label>
              ) : null}

              <button
                type="button"
                className="db-button-primary"
                onClick={saveRequirementItem}
                disabled={savingItem || !learner.classroom_id}
              >
                {savingItem
                  ? "Saving..."
                  : editingItem
                  ? "Update Item"
                  : "+ Add Item"}
              </button>

              {editingItem ? (
                <button
                  type="button"
                  className="db-button-secondary"
                  onClick={resetItemForm}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {activeTab === "documents" && (
        <div className="db-card db-card-yellow" style={{ padding: 16 }}>
          <h3 style={sectionTitle}>Documents</h3>

          <p className="db-helper">
            Upload and manage required learner documents.
          </p>

          <div style={progressSummary}>
            <div>
              <strong>
                Uploaded: {uploadedDocumentCount} / {documentRequirements.length}{" "}
                documents
              </strong>
              <p style={summaryText}>Missing: {missingDocumentCount} documents</p>
            </div>

            <div style={progressBar} aria-label="Document completion progress">
              <div
                style={{
                  ...progressFill,
                  width: `${documentProgress}%`,
                }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            {documentRequirements.map((documentType) => {
              const document = getDocument(documentType);
              const uploaded = Boolean(document?.file_url);
              const isUploading = uploadingDocumentType === documentType;

              return (
                <div key={documentType} style={documentRow}>
                  <div style={{ flex: 1 }}>
                    <strong>{documentType}</strong>

                    <p style={summaryText}>
                      {uploaded
                        ? `Uploaded: ${document?.file_name || "File attached"}`
                        : "Missing"}
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={uploaded ? uploadedBadge : missingBadge}>
                      {uploaded ? "Uploaded" : "Missing"}
                    </span>

                    <label className="db-button-secondary" style={smallButton}>
                      {isUploading ? "Uploading..." : uploaded ? "Replace" : "Upload"}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        style={{ display: "none" }}
                        onChange={(event) =>
                          handleDocumentUpload(documentType, event)
                        }
                        disabled={isUploading}
                      />
                    </label>

                    {uploaded && document?.file_url ? (
                      <a
                        href={document.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="db-button-secondary"
                        style={{ ...smallButton, textDecoration: "none" }}
                      >
                        Download
                      </a>
                    ) : null}

                    {uploaded && document ? (
                      <button
                        type="button"
                        className="db-button-secondary"
                        style={smallButton}
                        onClick={() => deleteDocument(document)}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: "1px solid #EFE3C6",
            }}
          >
            <h4
              style={{
                margin: "0 0 10px 0",
                color: "#2D2A3E",
                fontSize: 15,
                fontWeight: 800,
              }}
            >
              Add extra document requirement
            </h4>

            <div style={formGrid}>
              <input
                className="db-input"
                placeholder="Document name, e.g. Proof of Address"
                value={newDocumentRequirement}
                onChange={(event) =>
                  setNewDocumentRequirement(event.target.value)
                }
              />

              <button
                type="button"
                className="db-button-primary"
                onClick={addDocumentRequirement}
                disabled={savingDocumentRequirement || !learner.classroom_id}
              >
                {savingDocumentRequirement ? "Adding..." : "+ Add Document"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <div style={infoBox}>
      <strong style={labelText}>{label}</strong>
      <p style={valueText}>{value || "Not added"}</p>
    </div>
  );
}

const summaryText = {
  margin: "6px 0 0 0",
  color: "#6D6888",
  fontSize: 13,
};

const tabButton = {
  minHeight: 36,
  padding: "8px 14px",
  fontSize: 13,
};

const sectionTitle = {
  margin: "14px 0 10px 0",
  color: "#2D2A3E",
  fontSize: 17,
  fontWeight: 800 as const,
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 8,
};

const formGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 8,
  alignItems: "center",
};

const progressSummary = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  alignItems: "center",
  background: "#FFFDFB",
  border: "1px solid #E8E0D8",
  borderRadius: 12,
  padding: "12px 14px",
  marginTop: 12,
  marginBottom: 14,
};

const progressBar = {
  height: 10,
  borderRadius: 999,
  background: "#7CCCF3",
  overflow: "hidden",
};

const progressFill = {
  height: "100%",
  borderRadius: 999,
  background: "#7BC67E",
};

const infoBox = {
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: 12,
  padding: "10px 12px",
  color: "#2D2A3E",
  minHeight: 68,
};

const labelText = {
  display: "block",
  fontSize: 13,
  fontWeight: 800 as const,
};

const valueText = {
  margin: "5px 0 0 0",
  color: "#6D6888",
  fontSize: 12,
  lineHeight: 1.35,
};

const requirementRow = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: 12,
  padding: "10px 12px",
  flexWrap: "wrap" as const,
};

const documentRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: 12,
  padding: "10px 12px",
  flexWrap: "wrap" as const,
};

const checkboxButton = {
  width: 30,
  height: 30,
  borderRadius: 10,
  border: "1px solid #CBEAF7",
  background: "#FFFFFF",
  color: "#2D2A3E",
  fontWeight: 900 as const,
  cursor: "pointer",
};

const receivedToggleLabel = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 14,
  color: "#2D2A3E",
  fontWeight: 700,
};

const uploadedBadge = {
  minHeight: 30,
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 999,
  padding: "5px 10px",
  background: "#EAF8EE",
  border: "1px solid #CDEED8",
  color: "#166534",
  fontSize: 12,
  fontWeight: 800,
};

const missingBadge = {
  minHeight: 30,
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 999,
  padding: "5px 10px",
  background: "#FFF0EE",
  border: "1px solid #F2C4BC",
  color: "#B42318",
  fontSize: 12,
  fontWeight: 800,
};

const smallButton = {
  minHeight: 32,
  padding: "7px 10px",
  fontSize: 12,
} as const;

const quantityInput = {
  width: 82,
  minHeight: 34,
  margin: 0,
};