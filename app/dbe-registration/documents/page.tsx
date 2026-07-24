"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCurrentProfile } from "../../lib/auth";
import { resolveSchoolContext } from "../../lib/school-context";
import { authenticatedFetch } from "../../lib/authenticated-fetch";
import { supabase } from "../../lib/supabase";

type ComplianceDocument = {
  id: string;
  school_id: number;
  document_name: string;
  file_path: string;
  file_name?: string | null;
  uploaded_at?: string | null;
};

export default function DbeComplianceDocumentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolParam = searchParams.get("school");

  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [documents, setDocuments] = useState<ComplianceDocument[]>([]);
  const [documentName, setDocumentName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showUploadForm, setShowUploadForm] = useState(true);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    const { profile, error: profileError } = await getCurrentProfile();

    if (profileError || !profile) {
      router.push("/login");
      return;
    }

    if (profile.role === "teacher") {
      router.push("/teacher");
      return;
    }

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
    await fetchDocuments(context.schoolId);
    setLoading(false);
  }

  async function fetchDocuments(currentSchoolId: number) {
    const response = await authenticatedFetch(
      `/api/dbe-compliance-documents?school_id=${currentSchoolId}`
    );
    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "Compliance documents could not be loaded.");
      return;
    }

    setDocuments((result.documents || []) as ComplianceDocument[]);
  }

  async function uploadDocument() {
    if (!schoolId) return;

    if (!documentName.trim()) {
      alert("Please enter the document name.");
      return;
    }

    if (!selectedFile) {
      alert("Please choose a file.");
      return;
    }

    setUploading(true);

    try {
      const prepareResponse = await authenticatedFetch(
        "/api/dbe-compliance-documents",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create_upload",
            school_id: schoolId,
            document_name: documentName.trim(),
            file_name: selectedFile.name,
            file_type: selectedFile.type,
            file_size: selectedFile.size,
          }),
        }
      );
      const prepared = await prepareResponse.json();
      if (!prepareResponse.ok || !prepared.path || !prepared.token) {
        throw new Error(
          prepared.error || "A secure upload could not be prepared."
        );
      }

      const { error: uploadError } = await supabase.storage
        .from("dbe-compliance-documents")
        .uploadToSignedUrl(prepared.path, prepared.token, selectedFile, {
          contentType: selectedFile.type,
        });
      if (uploadError) throw uploadError;

      const completeResponse = await authenticatedFetch(
        "/api/dbe-compliance-documents",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "complete_upload",
            school_id: schoolId,
            document_name: documentName.trim(),
            file_name: selectedFile.name,
            file_path: prepared.path,
          }),
        }
      );
      const completed = await completeResponse.json();
      if (!completeResponse.ok) {
        throw new Error(
          completed.error || "The compliance document could not be saved."
        );
      }

      setDocumentName("");
      setSelectedFile(null);

      const fileInput = document.getElementById(
        "dbe-compliance-document-file"
      ) as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";

      await fetchDocuments(schoolId);
      setShowUploadForm(false);
      alert("Compliance document uploaded.");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "The compliance document could not be uploaded."
      );
    } finally {
      setUploading(false);
    }
  }

  async function downloadDocument(document: ComplianceDocument) {
    if (!schoolId) return;
    const response = await authenticatedFetch(
      `/api/dbe-compliance-documents?school_id=${schoolId}&document_id=${document.id}`
    );
    const result = await response.json();

    if (!response.ok || !result.url) {
      alert(result.error || "Could not generate download link.");
      return;
    }

    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  function startRename(document: ComplianceDocument) {
    setRenamingId(document.id);
    setRenameValue(document.document_name);
  }

  async function saveRename(documentId: string) {
    if (!schoolId) return;

    if (!renameValue.trim()) {
      alert("Please enter the document name.");
      return;
    }

    const response = await authenticatedFetch(
      "/api/dbe-compliance-documents",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school_id: schoolId,
          document_id: documentId,
          document_name: renameValue.trim(),
        }),
      }
    );
    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "The document could not be renamed.");
      return;
    }

    setRenamingId(null);
    setRenameValue("");

    await fetchDocuments(schoolId);
    alert("Document renamed.");
  }

  async function deleteDocument(document: ComplianceDocument) {
    if (!schoolId) return;

    const confirmed = confirm(
      `Delete "${document.document_name}"? This will remove the compliance document.`
    );

    if (!confirmed) return;

    const response = await authenticatedFetch(
      "/api/dbe-compliance-documents",
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school_id: schoolId,
          document_id: document.id,
        }),
      }
    );
    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "The document could not be deleted.");
      return;
    }

    await fetchDocuments(schoolId);
    alert("Document deleted.");
  }

  if (loading) {
    return <p>Loading compliance documents...</p>;
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: 18, marginBottom: 18 }}>
        <h2 className="db-page-title">Compliance Documents</h2>
        <p className="db-page-subtitle">
          Store official registration and compliance documents for the school.
        </p>
      </div>

      {showUploadForm ? (
        <div className="db-card db-card-blue" style={{ padding: 16, marginBottom: 18 }}>
          <div style={formHeader}>
            <h3 style={sectionTitle}>Upload Compliance Document</h3>

            {documents.length > 0 ? (
              <button
                type="button"
                className="db-button-secondary"
                onClick={() => setShowUploadForm(false)}
              >
                Close
              </button>
            ) : null}
          </div>

          <div style={grid2}>
            <Field label="Document Name">
              <input
                className="db-input"
                placeholder="Example: NPO Certificate"
                value={documentName}
                onChange={(event) => setDocumentName(event.target.value)}
              />
            </Field>

            <Field label="File">
              <input
                id="dbe-compliance-document-file"
                style={hiddenFileInput}
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
              />
              <label htmlFor="dbe-compliance-document-file" style={uploadButton}>
                Choose File
              </label>
              <p style={smallText}>{selectedFile?.name || "No file selected"}</p>
            </Field>
          </div>

          <button
            type="button"
            className="db-button-primary"
            style={{ width: "100%", marginTop: 12 }}
            onClick={uploadDocument}
            disabled={uploading}
          >
            {uploading ? "Uploading..." : "Upload Document"}
          </button>
        </div>
      ) : (
        <div className="db-card db-card-blue" style={{ padding: 16, marginBottom: 18 }}>
          <div style={formHeader}>
            <div>
              <h3 style={sectionTitle}>Compliance Documents Ready</h3>
              <p className="db-helper" style={{ marginTop: 4 }}>
                Upload form closed after the last saved document.
              </p>
            </div>

            <button
              type="button"
              className="db-button-primary"
              onClick={() => setShowUploadForm(true)}
            >
              Upload Document
            </button>
          </div>
        </div>
      )}

      <div className="db-card db-card-lavender" style={{ padding: 16 }}>
        <h3 style={sectionTitle}>
          Saved Compliance Documents ({documents.length})
        </h3>

        {documents.length === 0 ? (
          <p className="db-helper">No compliance documents uploaded yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {documents.map((document) => (
              <div key={document.id} className="db-list-card">
                {renamingId === document.id ? (
                  <div style={grid2}>
                    <input
                      className="db-input"
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                    />

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="db-button-primary"
                        onClick={() => saveRename(document.id)}
                      >
                        Save
                      </button>

                      <button
                        type="button"
                        className="db-button-secondary"
                        onClick={() => {
                          setRenamingId(null);
                          setRenameValue("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <strong style={{ fontSize: 16 }}>
                      {document.document_name}
                    </strong>

                    <p style={smallText}>
                      File: {document.file_name || "Uploaded file"}
                    </p>

                    <p style={smallText}>
                      Uploaded:{" "}
                      {document.uploaded_at
                        ? new Date(document.uploaded_at).toLocaleDateString()
                        : "Not available"}
                    </p>

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        marginTop: 10,
                      }}
                    >
                      <button
                        type="button"
                        className="db-button-primary"
                        onClick={() => downloadDocument(document)}
                      >
                        Download
                      </button>

                      <button
                        type="button"
                        className="db-button-secondary"
                        onClick={() => startRename(document)}
                      >
                        Rename
                      </button>

                      <button
                        type="button"
                        className="db-button-secondary"
                        onClick={() => deleteDocument(document)}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p style={labelText}>{label}</p>
      {children}
    </div>
  );
}

const sectionTitle = {
  margin: "0 0 10px 0",
  color: "#2D2A3E",
  fontSize: 20,
  fontWeight: 700 as const,
};

const labelText = {
  margin: "0 0 8px 0",
  color: "#6D6888",
  fontSize: 13,
  fontWeight: 800,
};

const smallText = {
  margin: "6px 0 0 0",
  color: "#6D6888",
  fontSize: 13,
};

const grid2 = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
};

const formHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap" as const,
  marginBottom: 10,
};

const hiddenFileInput = {
  position: "absolute",
  inlineSize: 1,
  blockSize: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  clipPath: "inset(50%)",
} as const;

const uploadButton = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 44,
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #CBEAF7",
  background: "#EAF7FD",
  color: "#2D2A3E",
  fontWeight: 800,
  cursor: "pointer",
};
