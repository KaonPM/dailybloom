"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { resolveSchoolContext } from "../lib/school-context";
import SubscriptionGuard from "../components/SubscriptionGuard";

type TemplateKey = "0_2" | "2_6";

type LearnerRow = {
  id: string;
  name?: string | null;
  class?: string | null;
  classroom_id?: number | null;
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

const GLOBAL_REQUIREMENT_ITEMS: RequirementItemRow[] = [
  {
    id: -1001,
    school_id: 0,
    classroom_id: 0,
    item_name: "Birth Certificate",
    quantity: "1 copy",
    category: "Document",
    is_active: true,
  },
  {
    id: -1002,
    school_id: 0,
    classroom_id: 0,
    item_name: "Parent / Guardian ID Copy",
    quantity: "1 copy",
    category: "Document",
    is_active: true,
  },
  {
    id: -1003,
    school_id: 0,
    classroom_id: 0,
    item_name: "Clinic Card / Immunisation Record",
    quantity: "1 copy",
    category: "Document",
    is_active: true,
  },
  {
    id: -1004,
    school_id: 0,
    classroom_id: 0,
    item_name: "Proof of Address",
    quantity: "1 copy",
    category: "Document",
    is_active: true,
  },
  {
    id: -2001,
    school_id: 0,
    classroom_id: 0,
    item_name: "Pencils",
    quantity: "4",
    category: "Stationery",
    is_active: true,
  },
  {
    id: -2002,
    school_id: 0,
    classroom_id: 0,
    item_name: "Crayons",
    quantity: "1 pack",
    category: "Stationery",
    is_active: true,
  },
  {
    id: -2003,
    school_id: 0,
    classroom_id: 0,
    item_name: "Glue Stick",
    quantity: "2",
    category: "Stationery",
    is_active: true,
  },
  {
    id: -2004,
    school_id: 0,
    classroom_id: 0,
    item_name: "A4 Exercise Book",
    quantity: "2",
    category: "Stationery",
    is_active: true,
  },
  {
    id: -2005,
    school_id: 0,
    classroom_id: 0,
    item_name: "Tissues",
    quantity: "2 boxes",
    category: "Hygiene",
    is_active: true,
  },
  {
    id: -2006,
    school_id: 0,
    classroom_id: 0,
    item_name: "Wet Wipes",
    quantity: "2 packs",
    category: "Hygiene",
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
  const [savingQuantityKey, setSavingQuantityKey] = useState("");

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
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

    const [
      learnersResult,
      classroomsResult,
      checklistResult,
      documentsResult,
      requirementItemsResult,
    ] = await Promise.all([
      supabase
        .from("learners")
        .select("id, name, class, classroom_id")
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
        .order("item_name", { ascending: true }),

      supabase
        .from("learner_documents")
        .select("id, learner_id, document_type, file_url")
        .eq("school_id", context.schoolId),

      supabase
        .from("classroom_requirement_items")
        .select("id, school_id, classroom_id, item_name, quantity, category, is_active")
        .eq("school_id", context.schoolId)
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("item_name", { ascending: true }),
    ]);

    if (learnersResult.error) return alert(learnersResult.error.message);
    if (classroomsResult.error) return alert(classroomsResult.error.message);
    if (checklistResult.error) return alert(checklistResult.error.message);
    if (documentsResult.error) return alert(documentsResult.error.message);
    if (requirementItemsResult.error) return alert(requirementItemsResult.error.message);

    setLearners((learnersResult.data || []) as LearnerRow[]);
    setClassrooms((classroomsResult.data || []) as ClassroomRow[]);
    setChecklist((checklistResult.data || []) as ChecklistRow[]);
    setDocuments((documentsResult.data || []) as DocumentRow[]);
    setRequirementItems((requirementItemsResult.data || []) as RequirementItemRow[]);
    setLoading(false);
  }

  async function addRequirementItem() {
    if (!schoolId) return alert("School not found.");
    if (!selectedClassroomId) return alert("Please select a class first.");
    if (!newItemName.trim()) return alert("Please enter the requirement item.");

    setSavingItem(true);

    const { error } = await supabase.from("classroom_requirement_items").upsert(
      [
        {
          school_id: schoolId,
          classroom_id: Number(selectedClassroomId),
          item_name: newItemName.trim(),
          quantity: newQuantity.trim() || null,
          category: newCategory,
          is_active: true,
        },
      ],
      { onConflict: "school_id,classroom_id,item_name" }
    );

    setSavingItem(false);

    if (error) return alert(error.message);

    setNewItemName("");
    setNewQuantity("");
    setNewCategory("Stationery");

    await loadPage();
  }

  async function deleteRequirementItem(itemId: number) {
    if (itemId < 0) return;

    const confirmed = confirm("Delete this requirement from the requirements list?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("classroom_requirement_items")
      .update({ is_active: false })
      .eq("id", itemId);

    if (error) return alert(error.message);

    await loadPage();
  }

  async function updateLearnerQuantity(
    learner: LearnerRow,
    requirement: RequirementItemRow,
    receivedQuantityValue: string
  ) {
    if (!schoolId) return alert("School not found.");
    if (!selectedClassroomId) return alert("Please select a class first.");

    const requiredQuantity = parseRequiredQuantity(requirement.quantity);
    const receivedQuantity = Math.max(
      0,
      Math.min(Number(receivedQuantityValue || 0), requiredQuantity)
    );

    const isFullyReceived = receivedQuantity >= requiredQuantity;
    const normalizedRequirementName = normalizeName(requirement.item_name);

    const existingItem = checklist.find(
      (item) =>
        item.learner_id === learner.id &&
        String(item.classroom_id || "") === selectedClassroomId &&
        normalizeName(item.item_name) === normalizedRequirementName
    );

    const savingKey = `${learner.id}-${requirement.id}`;
    setSavingQuantityKey(savingKey);

    if (existingItem) {
      const { error } = await supabase
        .from("learner_stationery_checklist")
        .update({
          quantity: requirement.quantity || String(requiredQuantity),
          required_quantity: requiredQuantity,
          received_quantity: receivedQuantity,
          received: isFullyReceived,
          received_at: isFullyReceived ? new Date().toISOString() : null,
        })
        .eq("id", existingItem.id);

      setSavingQuantityKey("");

      if (error) return alert(error.message);

      await loadPage();
      return;
    }

    const { error } = await supabase.from("learner_stationery_checklist").insert([
      {
        school_id: schoolId,
        learner_id: learner.id,
        classroom_id: Number(selectedClassroomId),
        stationery_item_id: requirement.id > 0 ? requirement.id : null,
        item_name: requirement.item_name,
        quantity: requirement.quantity || String(requiredQuantity),
        required_quantity: requiredQuantity,
        received_quantity: receivedQuantity,
        received: isFullyReceived,
        received_at: isFullyReceived ? new Date().toISOString() : null,
      },
    ]);

    setSavingQuantityKey("");

    if (error) return alert(error.message);

    await loadPage();
  }

  function learnerProfileHref(learnerId: string) {
    return schoolParam
      ? `/children/${learnerId}?school=${schoolParam}`
      : `/children/${learnerId}`;
  }

  function getLearnerChecklistItem(learnerId: string, requirementName: string) {
    return checklist.find(
      (item) =>
        item.learner_id === learnerId &&
        String(item.classroom_id || "") === selectedClassroomId &&
        normalizeName(item.item_name) === normalizeName(requirementName)
    );
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

  const selectedClassRequirements = useMemo(() => {
    if (!selectedClassroomId) return [];

    const schoolSpecificItems = requirementItems.filter(
      (item) => String(item.classroom_id) === selectedClassroomId
    );

    const mergedMap = new Map<string, RequirementItemRow>();

    GLOBAL_REQUIREMENT_ITEMS.forEach((item) => {
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
  }, [requirementItems, selectedClassroomId]);

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

  const assignedStationeryTemplate =
    assignedTemplateKeys.length === 0
      ? "DailyBloom Standard Requirements"
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
    const stationeryTotals = stationeryRequirements.reduce(
      (totals, requirement) => {
        const requiredQuantity = parseRequiredQuantity(requirement.quantity);
        const checklistItem = getLearnerChecklistItem(
          learner.id,
          requirement.item_name
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

    const documentTotal = documentRequirements.length;
    const totalRequired = stationeryTotals.required + documentTotal;
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

  if (loading) {
    return <p>Loading learner requirements...</p>;
  }

  return (
    <SubscriptionGuard schoolId={schoolId} featureKey="learner_requirements">
      <div>
        <div className="db-soft-card" style={{ padding: 18, marginBottom: 18 }}>
          <h2 className="db-page-title">Learner Requirements</h2>
          <p className="db-page-subtitle">
            Manage required stationery, required documents, and learner
            completion tracking.
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
            onChange={(e) => setSelectedClassroomId(e.target.value)}
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
              <p style={smallText}>
                DailyBloom Standard Required Learner Documents
              </p>
            </div>
          ) : null}
        </div>

        {selectedClassroomId ? (
          <div
            className="db-card db-card-blue"
            style={{ padding: 16, marginBottom: 18 }}
          >
            <h3 style={sectionTitle}>Required Stationery and Hygiene</h3>

            {stationeryRequirements.length === 0 ? (
              <p className="db-helper">
                No stationery requirements loaded for this class yet.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {stationeryRequirements.map((item) => (
                  <div key={item.id} style={checklistRow}>
                    <div style={checkArea}>
                      <span style={checkboxIcon}>☐</span>

                      <div>
                        <strong>{item.item_name}</strong>
                        <p style={smallText}>
                          Required: {item.quantity || "1"} |{" "}
                          {item.category || "Other"}
                        </p>
                      </div>
                    </div>

                    {item.id > 0 ? (
                      <button
                        className="db-button-secondary"
                        style={smallButton}
                        onClick={() => deleteRequirementItem(item.id)}
                      >
                        Delete
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
                  <div key={item.id} style={checklistRow}>
                    <div style={checkArea}>
                      <span style={checkboxIcon}>☐</span>

                      <div>
                        <strong>{item.item_name}</strong>
                        <p style={smallText}>
                          Required: {item.quantity || "1 copy"}
                        </p>
                      </div>
                    </div>

                    {item.id > 0 ? (
                      <button
                        className="db-button-secondary"
                        style={smallButton}
                        onClick={() => deleteRequirementItem(item.id)}
                      >
                        Delete
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
                <strong>Total Learners</strong>
                <p style={summaryNumber}>{classLearners.length}</p>
              </div>

              <div style={summaryCard}>
                <strong>Total Received Quantity</strong>
                <p style={summaryNumber}>{classCompletedItems}</p>
              </div>

              <div style={summaryCard}>
                <strong>Total Outstanding Quantity</strong>
                <p style={summaryNumber}>{classOutstandingItems}</p>
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

            {learnerChecklistOverview.length === 0 ? (
              <p className="db-helper">No learners found in this class.</p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {learnerChecklistOverview.map((item) => (
                  <div key={item.learner.id} style={categoryBox}>
                    <div style={learnerProgressHeader}>
                      <div>
                        <strong>{item.learner.name || "Unnamed learner"}</strong>
                        <p style={smallText}>
                          Received: {item.receivedCount} / {item.totalCount} |{" "}
                          Outstanding: {item.outstandingCount}
                        </p>
                      </div>

                      <Link
                        href={learnerProfileHref(item.learner.id)}
                        className="db-button-secondary"
                        style={linkButton}
                      >
                        View Learner
                      </Link>
                    </div>

                    <div style={progressBar}>
                      <div
                        style={{
                          ...progressFill,
                          width: `${item.progress}%`,
                        }}
                      />
                    </div>

                    <div style={learnerItemsGrid}>
                      {stationeryRequirements.map((requirement) => {
                        const requiredQuantity = parseRequiredQuantity(
                          requirement.quantity
                        );
                        const checklistItem = getLearnerChecklistItem(
                          item.learner.id,
                          requirement.item_name
                        );

                        const currentReceived =
                          checklistItem?.received_quantity ??
                          (checklistItem?.received ? requiredQuantity : 0);

                        const outstanding = Math.max(
                          requiredQuantity - currentReceived,
                          0
                        );

                        const savingKey = `${item.learner.id}-${requirement.id}`;

                        return (
                          <div
                            key={`${item.learner.id}-${requirement.id}`}
                            style={learnerItemRow}
                          >
                            <div>
                              <strong>{requirement.item_name}</strong>
                              <p style={smallText}>
                                Required: {requiredQuantity} | Outstanding:{" "}
                                {outstanding}
                              </p>
                            </div>

                            <input
                              className="db-input"
                              type="number"
                              min={0}
                              max={requiredQuantity}
                              value={currentReceived}
                              style={quantityInput}
                              onChange={(e) =>
                                updateLearnerQuantity(
                                  item.learner,
                                  requirement,
                                  e.target.value
                                )
                              }
                            />

                            <span style={smallText}>
                              {savingQuantityKey === savingKey
                                ? "Saving..."
                                : "Received"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
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
                placeholder="Quantity, e.g. 4"
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

const learnerItemsGrid = {
  display: "grid",
  gap: 8,
  marginTop: 12,
};

const learnerItemRow = {
  display: "grid",
  gridTemplateColumns: "1fr 90px 80px",
  gap: 10,
  alignItems: "center",
  background: "#FFFFFF",
  border: "1px solid #F0E3D8",
  borderRadius: 12,
  padding: 10,
};

const quantityInput = {
  marginBottom: 0,
  minHeight: 36,
};