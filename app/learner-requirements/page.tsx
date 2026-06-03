"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { resolveSchoolContext } from "../lib/school-context";
import SubscriptionGuard from "../components/SubscriptionGuard";

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
  classroom_id: number;
  item_name: string;
  quantity?: string | null;
  received: boolean;
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

const requiredDocuments = [
  "Birth Certificate",
  "Immunisation Card",
  "Parent / Guardian ID",
  "Contract",
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
  const [searchText, setSearchText] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  const [newCategory, setNewCategory] = useState("Stationery");

  const [loading, setLoading] = useState(true);
  const [savingItem, setSavingItem] = useState(false);

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
        .select("id, learner_id, classroom_id, item_name, quantity, received")
        .eq("school_id", context.schoolId)
        .eq("received", false)
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
        .order("created_at", { ascending: false }),
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

    const { error } = await supabase.from("classroom_requirement_items").insert([
      {
        school_id: schoolId,
        classroom_id: Number(selectedClassroomId),
        item_name: newItemName.trim(),
        quantity: newQuantity.trim() || null,
        category: newCategory,
        is_active: true,
      },
    ]);

    if (error) {
      setSavingItem(false);
      return alert(error.message);
    }

    setNewItemName("");
    setNewQuantity("");
    setNewCategory("Stationery");
    await loadPage();
    setSavingItem(false);
  }

  async function deleteRequirementItem(itemId: number) {
    const confirmed = confirm("Delete this requirement from the class list?");

    if (!confirmed) return;

    const { error } = await supabase
      .from("classroom_requirement_items")
      .update({ is_active: false })
      .eq("id", itemId);

    if (error) return alert(error.message);

    await loadPage();
  }

  function learnerProfileHref(learnerId: string) {
    return schoolParam
      ? `/children/${learnerId}?school=${schoolParam}`
      : `/children/${learnerId}`;
  }

  const filteredLearners = useMemo(() => {
    return learners.filter((learner) => {
      const matchesClass =
        !selectedClassroomId ||
        String(learner.classroom_id || "") === selectedClassroomId;

      const matchesSearch =
        !searchText.trim() ||
        String(learner.name || "")
          .toLowerCase()
          .includes(searchText.trim().toLowerCase());

      return matchesClass && matchesSearch;
    });
  }, [learners, selectedClassroomId, searchText]);

  const selectedClassRequirements = useMemo(() => {
    if (!selectedClassroomId) return [];

    return requirementItems.filter(
      (item) => String(item.classroom_id) === selectedClassroomId
    );
  }, [requirementItems, selectedClassroomId]);

  const outstandingStationery = useMemo(() => {
    return filteredLearners
      .map((learner) => {
        const items = checklist.filter(
          (item) => item.learner_id === learner.id && !item.received
        );

        return { learner, items };
      })
      .filter((entry) => entry.items.length > 0);
  }, [filteredLearners, checklist]);

  const outstandingDocuments = useMemo(() => {
    return filteredLearners
      .map((learner) => {
        const learnerDocuments = documents.filter(
          (document) => document.learner_id === learner.id
        );

        const missing = requiredDocuments.filter((requiredDocument) => {
          return !learnerDocuments.some(
            (document) =>
              document.document_type === requiredDocument && document.file_url
          );
        });

        return { learner, missing };
      })
      .filter((entry) => entry.missing.length > 0);
  }, [filteredLearners, documents]);

  const affectedLearnerIds = new Set([
    ...outstandingStationery.map((entry) => entry.learner.id),
    ...outstandingDocuments.map((entry) => entry.learner.id),
  ]);

  const totalOutstandingStationery = outstandingStationery.reduce(
    (sum, entry) => sum + entry.items.length,
    0
  );

  const totalOutstandingDocuments = outstandingDocuments.reduce(
    (sum, entry) => sum + entry.missing.length,
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
            Manage class requirement lists and view outstanding learner items.
          </p>
        </div>

        <div style={summaryGrid}>
          <div className="db-card db-card-blue" style={summaryCard}>
            <strong>Outstanding Stationery</strong>
            <p style={summaryNumber}>{totalOutstandingStationery}</p>
          </div>

          <div className="db-card db-card-yellow" style={summaryCard}>
            <strong>Outstanding Documents</strong>
            <p style={summaryNumber}>{totalOutstandingDocuments}</p>
          </div>

          <div className="db-card db-card-green" style={summaryCard}>
            <strong>Learners Affected</strong>
            <p style={summaryNumber}>{affectedLearnerIds.size}</p>
          </div>
        </div>

        <div className="db-card db-card-lavender" style={{ padding: 16, marginBottom: 18 }}>
          <div style={filterGrid}>
            <select
              className="db-input"
              value={selectedClassroomId}
              onChange={(e) => setSelectedClassroomId(e.target.value)}
            >
              <option value="">All Classes</option>
              {classrooms.map((classroom) => (
                <option key={classroom.id} value={classroom.id}>
                  {classroom.classroom_name || "Unnamed class"}
                </option>
              ))}
            </select>

            <input
              className="db-input"
              placeholder="Search learner"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
        </div>

        <div className="db-card db-card-blue" style={{ padding: 16, marginBottom: 18 }}>
          <h3 style={sectionTitle}>Class Requirement List</h3>

          {!selectedClassroomId ? (
            <p className="db-helper">Select a class to add or delete requirements.</p>
          ) : (
            <>
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

              <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                {selectedClassRequirements.length === 0 ? (
                  <p className="db-helper">No requirements added for this class yet.</p>
                ) : (
                  selectedClassRequirements.map((item) => (
                    <div key={item.id} style={rowCard}>
                      <div>
                        <strong>{item.item_name}</strong>
                        <p style={smallText}>
                          {item.quantity || "No quantity"} · {item.category || "Other"}
                        </p>
                      </div>

                      <button
                        className="db-button-secondary"
                        style={deleteButton}
                        onClick={() => deleteRequirementItem(item.id)}
                      >
                        Delete
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <div className="db-card db-card-green" style={{ padding: 16, marginBottom: 18 }}>
          <h3 style={sectionTitle}>Outstanding Stationery</h3>

          {outstandingStationery.length === 0 ? (
            <p className="db-helper">No outstanding stationery found.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {outstandingStationery.map((entry) => (
                <div key={entry.learner.id} style={rowCard}>
                  <div>
                    <strong>{entry.learner.name || "Unnamed learner"}</strong>
                    <p style={smallText}>{entry.learner.class || "Unassigned class"}</p>
                    <p style={smallText}>
                      {entry.items
                        .map((item) =>
                          item.quantity
                            ? `${item.quantity} ${item.item_name}`
                            : item.item_name
                        )
                        .join(", ")}
                    </p>
                  </div>

                  <Link
                    href={learnerProfileHref(entry.learner.id)}
                    className="db-button-secondary"
                    style={linkButton}
                  >
                    View Learner
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="db-card db-card-yellow" style={{ padding: 16 }}>
          <h3 style={sectionTitle}>Outstanding Documents</h3>

          {outstandingDocuments.length === 0 ? (
            <p className="db-helper">No outstanding documents found.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {outstandingDocuments.map((entry) => (
                <div key={entry.learner.id} style={rowCard}>
                  <div>
                    <strong>{entry.learner.name || "Unnamed learner"}</strong>
                    <p style={smallText}>{entry.learner.class || "Unassigned class"}</p>
                    <p style={smallText}>{entry.missing.join(", ")}</p>
                  </div>

                  <Link
                    href={learnerProfileHref(entry.learner.id)}
                    className="db-button-secondary"
                    style={linkButton}
                  >
                    View Learner
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
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

const rowCard = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: 14,
  padding: "12px 14px",
  flexWrap: "wrap" as const,
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

const deleteButton = {
  minHeight: 34,
  padding: "8px 12px",
  fontSize: 13,
} as const;