"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { resolveSchoolContext } from "../lib/school-context";
import SubscriptionGuard from "../components/SubscriptionGuard";

type ViewMode = "overview" | "classChecklist" | "learnerChecklist";

type LearnerRow = {
  id: string;
  name?: string | null;
  class?: string | null;
  classroom_id?: number | null;
};

type ClassroomRow = {
  id: number;
  classroom_name?: string | null;
};

type ChecklistRow = {
  id: number;
  learner_id: string;
  classroom_id?: number | null;
  stationery_item_id?: number | null;
  item_name: string;
  quantity?: string | null;
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

const template0To2 = [
  { item_name: "Birth Certificate", quantity: "1x", category: "Document" },
  { item_name: "Immunisation Card", quantity: "1x", category: "Document" },
  { item_name: "Toilet Rolls", quantity: "10x", category: "Hygiene" },
  { item_name: "Tissue Box", quantity: "3x", category: "Hygiene" },
  { item_name: "Wipes", quantity: "6x", category: "Hygiene" },
  { item_name: "Vaseline", quantity: "3x", category: "Hygiene" },
];

const template2To6 = [
  ...template0To2,
  {
    item_name: "Lifebuoy Soap / Sunlight Bar Soap",
    quantity: "4x",
    category: "Hygiene",
  },
  { item_name: "Flip File", quantity: "1x 20 pages", category: "Stationery" },
  {
    item_name: "College Book Exercise",
    quantity: "1x 72 pages",
    category: "Stationery",
  },
  { item_name: "Colouring Book", quantity: "1x", category: "Stationery" },
  { item_name: "Typek", quantity: "1x", category: "Stationery" },
  {
    item_name: "Wax Crayons",
    quantity: "1x box of 12",
    category: "Stationery",
  },
  { item_name: "Long Pencils", quantity: "4x", category: "Stationery" },
  { item_name: "Rubber / Eraser", quantity: "1x", category: "Stationery" },
  { item_name: "Glue Stick / Pritt", quantity: "1x", category: "Stationery" },
  { item_name: "Sharpener", quantity: "1x", category: "Stationery" },
];

export default function LearnerRequirementsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolParam = searchParams.get("school");

  const [viewMode, setViewMode] = useState<ViewMode>("overview");

  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);
  const [checklist, setChecklist] = useState<ChecklistRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [requirementItems, setRequirementItems] = useState<RequirementItemRow[]>([]);

  const [selectedClassroomId, setSelectedClassroomId] = useState("");
  const [selectedLearnerId, setSelectedLearnerId] = useState("");

  const [newItemName, setNewItemName] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  const [newCategory, setNewCategory] = useState("Stationery");

  const [loading, setLoading] = useState(true);
  const [savingItem, setSavingItem] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

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
        .select("id, classroom_name")
        .eq("school_id", context.schoolId)
        .order("classroom_name", { ascending: true }),

      supabase
        .from("learner_stationery_checklist")
        .select(
          "id, learner_id, classroom_id, stationery_item_id, item_name, quantity, received, received_at"
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

  async function preloadTemplate(templateType: "0_2" | "2_6") {
    if (!schoolId) return alert("School not found.");
    if (!selectedClassroomId) return alert("Please select a class first.");

    setLoadingTemplate(true);

    const templateItems = templateType === "0_2" ? template0To2 : template2To6;

    const payload = templateItems.map((item) => ({
      school_id: schoolId,
      classroom_id: Number(selectedClassroomId),
      item_name: item.item_name,
      quantity: item.quantity,
      category: item.category,
      is_active: true,
    }));

    const { error } = await supabase
      .from("classroom_requirement_items")
      .upsert(payload, {
        onConflict: "school_id,classroom_id,item_name",
        ignoreDuplicates: true,
      });

    setLoadingTemplate(false);

    if (error) return alert(error.message);

    await loadPage();
    alert("Checklist loaded successfully.");
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
    const confirmed = confirm("Delete this requirement from the class checklist?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("classroom_requirement_items")
      .update({ is_active: false })
      .eq("id", itemId);

    if (error) return alert(error.message);

    await loadPage();
  }

  async function markRequirementReceived(requirement: RequirementItemRow) {
    if (!schoolId) return alert("School not found.");
    if (!selectedClassroomId) return alert("Please select a class first.");
    if (!selectedLearnerId) return alert("Please select a learner first.");

    const existingItem = checklist.find(
      (item) =>
        item.learner_id === selectedLearnerId &&
        Number(item.stationery_item_id) === Number(requirement.id)
    );

    if (existingItem) {
      const { error } = await supabase
        .from("learner_stationery_checklist")
        .update({
          received: true,
          received_at: new Date().toISOString(),
        })
        .eq("id", existingItem.id);

      if (error) return alert(error.message);
    } else {
      const { error } = await supabase.from("learner_stationery_checklist").insert([
        {
          school_id: schoolId,
          learner_id: selectedLearnerId,
          classroom_id: Number(selectedClassroomId),
          stationery_item_id: requirement.id,
          item_name: requirement.item_name,
          quantity: requirement.quantity || null,
          received: true,
          received_at: new Date().toISOString(),
        },
      ]);

      if (error) return alert(error.message);
    }

    await loadPage();
  }

  async function markRequirementOutstanding(requirement: RequirementItemRow) {
    const existingItem = checklist.find(
      (item) =>
        item.learner_id === selectedLearnerId &&
        Number(item.stationery_item_id) === Number(requirement.id)
    );

    if (!existingItem) return;

    const { error } = await supabase
      .from("learner_stationery_checklist")
      .update({
        received: false,
        received_at: null,
      })
      .eq("id", existingItem.id);

    if (error) return alert(error.message);

    await loadPage();
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

  const selectedLearner = useMemo(() => {
    return learners.find((learner) => learner.id === selectedLearnerId) || null;
  }, [learners, selectedLearnerId]);

  const selectedClassRequirements = useMemo(() => {
    if (!selectedClassroomId) return [];

    return requirementItems.filter(
      (item) => String(item.classroom_id) === selectedClassroomId
    );
  }, [requirementItems, selectedClassroomId]);

  const groupedClassRequirements = useMemo(() => {
    const grouped: Record<string, RequirementItemRow[]> = {};

    selectedClassRequirements.forEach((item) => {
      const category = item.category || "Other";

      if (!grouped[category]) {
        grouped[category] = [];
      }

      grouped[category].push(item);
    });

    return grouped;
  }, [selectedClassRequirements]);

  const selectedLearnerRequirementStatus = useMemo(() => {
    if (!selectedLearnerId) return [];

    return selectedClassRequirements.map((requirement) => {
      const checklistItem = checklist.find(
        (item) =>
          item.learner_id === selectedLearnerId &&
          Number(item.stationery_item_id) === Number(requirement.id)
      );

      return {
        requirement,
        checklistItem,
        received: checklistItem?.received === true,
      };
    });
  }, [selectedClassRequirements, checklist, selectedLearnerId]);

  const outstandingItems = selectedLearnerRequirementStatus.filter(
    (entry) => !entry.received
  );

  const receivedItems = selectedLearnerRequirementStatus.filter(
    (entry) => entry.received
  );

  const selectedLearnerMissingDocuments = useMemo(() => {
    if (!selectedLearnerId) return [];

    const learnerDocuments = documents.filter(
      (document) => document.learner_id === selectedLearnerId
    );

    const documentRequirements = selectedClassRequirements.filter(
      (requirement) => requirement.category === "Document"
    );

    return documentRequirements.filter((requirement) => {
      return !learnerDocuments.some(
        (document) =>
          document.document_type === requirement.item_name && document.file_url
      );
    });
  }, [documents, selectedLearnerId, selectedClassRequirements]);

  function scrollToPageTop() {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function openClassChecklist() {
    setViewMode("classChecklist");
    scrollToPageTop();
  }

  function openLearnerChecklist() {
    setViewMode("learnerChecklist");
    scrollToPageTop();
  }

  function goToOverview() {
    setViewMode("overview");
    scrollToPageTop();
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
            Select a class, then choose whether to manage the class checklist or
            review a child’s checklist.
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
            onChange={(e) => {
              setSelectedClassroomId(e.target.value);
              setSelectedLearnerId("");
              setViewMode("overview");
            }}
          >
            <option value="">Select Class</option>
            {classrooms.map((classroom) => (
              <option key={classroom.id} value={classroom.id}>
                {classroom.classroom_name || "Unnamed class"}
              </option>
            ))}
          </select>
        </div>

        {viewMode !== "overview" && (
          <div style={stickyBackBar}>
            <button
              type="button"
              className="db-button-secondary"
              onClick={goToOverview}
              style={topBackButton}
            >
              &larr; Back to Class Overview
            </button>

            <strong style={currentViewLabel}>
              {viewMode === "classChecklist"
                ? "Class Checklist"
                : "Child Checklist"}
            </strong>
          </div>
        )}

        {viewMode === "overview" && (
          <>
            <div style={summaryGrid}>
              <div className="db-card db-card-blue" style={summaryCard}>
                <strong>Class Checklist Items</strong>
                <p style={summaryNumber}>{selectedClassRequirements.length}</p>
              </div>

              <div className="db-card db-card-yellow" style={summaryCard}>
                <strong>Learners in Class</strong>
                <p style={summaryNumber}>{classLearners.length}</p>
              </div>

              <div className="db-card db-card-green" style={summaryCard}>
                <strong>Selected Class</strong>
                <p style={summaryLabel}>
                  {selectedClassroom?.classroom_name || "None selected"}
                </p>
              </div>
            </div>

            <div
              className="db-card db-card-blue"
              style={{ padding: 16, marginBottom: 18 }}
            >
              <h3 style={sectionTitle}>Class Overview</h3>

              {!selectedClassroomId ? (
                <p className="db-helper">
                  Select a class to open its checklist options.
                </p>
              ) : (
                <div style={actionGrid}>
                  <button
                    type="button"
                    className="db-button-primary"
                    onClick={openClassChecklist}
                    style={largeActionButton}
                  >
                    View Class Checklist
                  </button>

                  <button
                    type="button"
                    className="db-button-secondary"
                    onClick={openLearnerChecklist}
                    style={largeActionButton}
                  >
                    View Child Checklist
                  </button>
                </div>
              )}
            </div>

            {selectedClassroomId && selectedClassRequirements.length > 0 ? (
              <div
                className="db-card db-card-green"
                style={{ padding: 16, marginBottom: 18 }}
              >
                <h3 style={sectionTitle}>Quick Preview</h3>

                <div style={{ display: "grid", gap: 12 }}>
                  {Object.entries(groupedClassRequirements).map(
                    ([category, items]) => (
                      <div key={category} style={categoryBox}>
                        <h4 style={categoryTitle}>{category}</h4>

                        <div style={{ display: "grid", gap: 8 }}>
                          {items.slice(0, 4).map((item) => (
                            <div key={item.id} style={previewRow}>
                              <span style={checkboxIcon}>☐</span>
                              <span>
                                {item.quantity ? `${item.quantity} ` : ""}
                                {item.item_name}
                              </span>
                            </div>
                          ))}
                        </div>

                        {items.length > 4 ? (
                          <p style={smallText}>
                            +{items.length - 4} more item(s)
                          </p>
                        ) : null}
                      </div>
                    )
                  )}
                </div>
              </div>
            ) : null}
          </>
        )}

        {viewMode === "classChecklist" && (
          <div
            className="db-card db-card-blue"
            style={{ padding: 16, marginBottom: 18 }}
          >
            <button
              type="button"
              className="db-button-secondary"
              onClick={goToOverview}
              style={internalBackButton}
            >
              &larr; Back to Class Overview
            </button>

            <h3 style={sectionTitle}>
              {selectedClassroom
                ? `${selectedClassroom.classroom_name} Checklist`
                : "Class Checklist"}
            </h3>

            {!selectedClassroomId ? (
              <p className="db-helper">Select a class first.</p>
            ) : (
              <>
                <div style={templateGrid}>
                  <button
                    className="db-button-secondary"
                    onClick={() => preloadTemplate("0_2")}
                    disabled={loadingTemplate}
                  >
                    {loadingTemplate
                      ? "Loading..."
                      : "Load 0–2 Years Checklist"}
                  </button>

                  <button
                    className="db-button-secondary"
                    onClick={() => preloadTemplate("2_6")}
                    disabled={loadingTemplate}
                  >
                    {loadingTemplate
                      ? "Loading..."
                      : "Load 2–6 Years Checklist"}
                  </button>
                </div>

                {selectedClassRequirements.length === 0 ? (
                  <p className="db-helper">
                    No checklist items have been added for this class yet. Load a
                    standard checklist or add items below.
                  </p>
                ) : (
                  <div style={{ display: "grid", gap: 14, marginBottom: 16 }}>
                    {Object.entries(groupedClassRequirements).map(
                      ([category, items]) => (
                        <div key={category} style={categoryBox}>
                          <h4 style={categoryTitle}>{category}</h4>

                          <div style={{ display: "grid", gap: 8 }}>
                            {items.map((item) => (
                              <div key={item.id} style={checklistRow}>
                                <div style={checkArea}>
                                  <span style={checkboxIcon}>☐</span>

                                  <div>
                                    <strong>{item.item_name}</strong>
                                    <p style={smallText}>
                                      {item.quantity || "No quantity"}
                                    </p>
                                  </div>
                                </div>

                                <button
                                  className="db-button-secondary"
                                  style={smallButton}
                                  onClick={() =>
                                    deleteRequirementItem(item.id)
                                  }
                                >
                                  Delete
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}

                <div style={addBox}>
                  <h4 style={categoryTitle}>Add Item to This Checklist</h4>

                  <div style={filterGrid}>
                    <input
                      className="db-input"
                      placeholder="Item name, e.g. Toilet Rolls"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                    />

                    <input
                      className="db-input"
                      placeholder="Quantity, e.g. 10x"
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
              </>
            )}
          </div>
        )}

        {viewMode === "learnerChecklist" && (
          <div
            className="db-card db-card-green"
            style={{ padding: 16, marginBottom: 18 }}
          >
            <button
              type="button"
              className="db-button-secondary"
              onClick={goToOverview}
              style={internalBackButton}
            >
              &larr; Back to Class Overview
            </button>

            <h3 style={sectionTitle}>Child Checklist View</h3>

            {!selectedClassroomId ? (
              <p className="db-helper">Select a class first.</p>
            ) : (
              <>
                <select
                  className="db-input"
                  value={selectedLearnerId}
                  onChange={(e) => setSelectedLearnerId(e.target.value)}
                  style={{ marginBottom: 14 }}
                >
                  <option value="">Select Learner in This Class</option>
                  {classLearners.map((learner) => (
                    <option key={learner.id} value={learner.id}>
                      {learner.name || "Unnamed learner"}
                    </option>
                  ))}
                </select>

                {!selectedLearnerId ? (
                  <p className="db-helper">
                    Select a learner to view the child’s checklist.
                  </p>
                ) : selectedClassRequirements.length === 0 ? (
                  <p className="db-helper">
                    This class has no checklist items yet.
                  </p>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={learnerHeaderCard}>
                      <div>
                        <p style={smallText}>Selected Child</p>
                        <strong>
                          {selectedLearner?.name || "Unnamed learner"}
                        </strong>
                        <p style={smallText}>
                          This child is in{" "}
                          {selectedClassroom?.classroom_name || "this class"}.
                        </p>
                      </div>

                      <Link
                        href={learnerProfileHref(selectedLearnerId)}
                        className="db-button-secondary"
                        style={linkButton}
                      >
                        View Learner
                      </Link>
                    </div>

                    <div style={miniSummaryGrid}>
                      <div style={miniSummaryCard}>
                        <strong>Outstanding</strong>
                        <p style={miniSummaryNumber}>
                          {outstandingItems.length}
                        </p>
                      </div>

                      <div style={miniSummaryCard}>
                        <strong>Received</strong>
                        <p style={miniSummaryNumber}>{receivedItems.length}</p>
                      </div>
                    </div>

                    {selectedLearnerRequirementStatus.map((entry) => (
                      <div key={entry.requirement.id} style={checklistRow}>
                        <div style={checkArea}>
                          <span
                            style={
                              entry.received ? receivedIcon : outstandingIcon
                            }
                          >
                            {entry.received ? "✓" : "☐"}
                          </span>

                          <div>
                            <strong>{entry.requirement.item_name}</strong>
                            <p style={smallText}>
                              {entry.requirement.quantity || "No quantity"} ·{" "}
                              {entry.requirement.category || "Other"}
                            </p>
                            <p style={smallText}>
                              Status:{" "}
                              {entry.received ? "Received" : "Outstanding"}
                            </p>
                          </div>
                        </div>

                        {entry.received ? (
                          <button
                            className="db-button-secondary"
                            style={smallButton}
                            onClick={() =>
                              markRequirementOutstanding(entry.requirement)
                            }
                          >
                            Mark Outstanding
                          </button>
                        ) : (
                          <button
                            className="db-button-primary"
                            style={smallButton}
                            onClick={() =>
                              markRequirementReceived(entry.requirement)
                            }
                          >
                            Mark Received
                          </button>
                        )}
                      </div>
                    ))}

                    {selectedLearnerMissingDocuments.length > 0 ? (
                      <div style={categoryBox}>
                        <h4 style={categoryTitle}>Outstanding Documents</h4>

                        <div style={{ display: "grid", gap: 8 }}>
                          {selectedLearnerMissingDocuments.map(
                            (requirement) => (
                              <div key={requirement.id} style={checklistRow}>
                                <div style={checkArea}>
                                  <span style={outstandingIcon}>☐</span>

                                  <div>
                                    <strong>{requirement.item_name}</strong>
                                    <p style={smallText}>
                                      Status: Outstanding
                                    </p>
                                  </div>
                                </div>

                                <Link
                                  href={learnerProfileHref(selectedLearnerId)}
                                  className="db-button-secondary"
                                  style={linkButton}
                                >
                                  Upload on Learner Profile
                                </Link>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </>
            )}
          </div>
        )}
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

const stickyBackBar = {
  position: "sticky" as const,
  top: 0,
  zIndex: 20,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap" as const,
  background: "#FFFFFF",
  border: "1px solid #E8E0D8",
  borderRadius: 14,
  padding: 12,
  marginBottom: 18,
  boxShadow: "0 8px 22px rgba(45, 42, 62, 0.08)",
};

const topBackButton = {
  minHeight: 40,
  padding: "9px 14px",
  fontSize: 14,
} as const;

const currentViewLabel = {
  color: "#2D2A3E",
  fontSize: 14,
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

const summaryLabel = {
  margin: "8px 0 0 0",
  fontSize: 16,
  fontWeight: 700,
  color: "#2D2A3E",
};

const actionGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const largeActionButton = {
  minHeight: 56,
  fontSize: 15,
};

const filterGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
};

const templateGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
  marginBottom: 16,
};

const internalBackButton = {
  marginBottom: 14,
  minHeight: 36,
  padding: "8px 12px",
  fontSize: 13,
} as const;

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

const categoryTitle = {
  margin: "0 0 10px 0",
  color: "#2D2A3E",
  fontSize: 16,
  fontWeight: 800 as const,
};

const previewRow = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  color: "#2D2A3E",
  fontSize: 14,
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

const receivedIcon = {
  width: 24,
  height: 24,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #9DCFA3",
  borderRadius: 6,
  color: "#166534",
  fontSize: 14,
  fontWeight: 800,
  flexShrink: 0,
};

const outstandingIcon = {
  width: 24,
  height: 24,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #E8B4A0",
  borderRadius: 6,
  color: "#B45309",
  fontSize: 14,
  fontWeight: 800,
  flexShrink: 0,
};

const addBox = {
  background: "#FFFDFB",
  border: "1px dashed #D8CBBF",
  borderRadius: 16,
  padding: 12,
};

const learnerHeaderCard = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  background: "#FFFFFF",
  border: "1px solid #DDEEDC",
  borderRadius: 14,
  padding: "12px 14px",
  flexWrap: "wrap" as const,
};

const miniSummaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
};

const miniSummaryCard = {
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: 14,
  padding: 12,
};

const miniSummaryNumber = {
  margin: "6px 0 0 0",
  fontSize: 24,
  fontWeight: 800,
  color: "#2D2A3E",
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
