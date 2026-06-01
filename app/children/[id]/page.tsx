"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { resolveSchoolContext } from "../../lib/school-context";

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

export default function LearnerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const learnerId = String(params.id || "");
  const schoolParam = searchParams.get("school");

  const [learner, setLearner] = useState<LearnerRow | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "requirements" | "documents"
  >("overview");
  const [loading, setLoading] = useState(true);

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

    setLearner(data as LearnerRow);
    setLoading(false);
  }

  function goBack() {
    router.push(schoolParam ? `/children?school=${schoolParam}` : "/children");
  }

  if (loading) {
    return <p>Loading learner profile...</p>;
  }

  if (!learner) {
    return <p>Learner not found.</p>;
  }

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

        <div style={summaryGrid}>
          <div className="db-card db-card-blue" style={summaryCard}>
            <strong>Requirements</strong>
            <p style={summaryText}>Coming next</p>
          </div>

          <div className="db-card db-card-green" style={summaryCard}>
            <strong>Documents</strong>
            <p style={summaryText}>Coming next</p>
          </div>

          <div className="db-card db-card-yellow" style={summaryCard}>
            <strong>Outstanding</strong>
            <p style={summaryText}>Coming next</p>
          </div>
        </div>
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
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <h3 style={{ ...sectionTitle, margin: 0 }}>Requirements</h3>

            <button type="button" className="db-button-primary">
              + Add Item
            </button>
          </div>

          <p className="db-helper">
            Stationery requirements for this learner will appear here.
          </p>

          <div
            style={{
              background: "#FFFDFB",
              border: "1px solid #F0E3D8",
              borderRadius: 12,
              padding: 12,
              marginTop: 12,
            }}
          >
            <strong>Example Items</strong>

            <div style={{ marginTop: 10 }}>☐ 10x Toilet Rolls</div>
            <div style={{ marginTop: 8 }}>☐ 3x Tissue Boxes</div>
            <div style={{ marginTop: 8 }}>☐ 6x Wipes</div>
            <div style={{ marginTop: 8 }}>☐ 1x Glue Stick</div>
          </div>
        </div>
      )}

      {activeTab === "documents" && (
        <div className="db-card db-card-yellow" style={{ padding: 16 }}>
          <h3 style={sectionTitle}>Documents</h3>
          <p className="db-helper">
            Birth certificate, immunisation card, parent / guardian ID and contract uploads
          </p>
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

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
  marginTop: 14,
};

const summaryCard = {
  padding: 12,
  minHeight: 76,
};

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