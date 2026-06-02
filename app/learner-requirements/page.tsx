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
  const [selectedClassroomId, setSelectedClassroomId] = useState("");
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);

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

    const [learnersResult, classroomsResult, checklistResult, documentsResult] =
      await Promise.all([
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
      ]);

    if (learnersResult.error) {
      alert(learnersResult.error.message);
      return;
    }

    if (classroomsResult.error) {
      alert(classroomsResult.error.message);
      return;
    }

    if (checklistResult.error) {
      alert(checklistResult.error.message);
      return;
    }

    if (documentsResult.error) {
      alert(documentsResult.error.message);
      return;
    }

    setLearners((learnersResult.data || []) as LearnerRow[]);
    setClassrooms((classroomsResult.data || []) as ClassroomRow[]);
    setChecklist((checklistResult.data || []) as ChecklistRow[]);
    setDocuments((documentsResult.data || []) as DocumentRow[]);
    setLoading(false);
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

  const outstandingStationery = useMemo(() => {
    return filteredLearners
      .map((learner) => {
        const items = checklist.filter(
          (item) => item.learner_id === learner.id && !item.received
        );

        return {
          learner,
          items,
        };
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

        return {
          learner,
          missing,
        };
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
            View outstanding stationery and learner documents from one dashboard.
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