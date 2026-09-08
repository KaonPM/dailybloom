"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getCurrentProfile } from "../../lib/auth";
import { resolveSchoolContext } from "../../lib/school-context";
import { authenticatedFetch } from "../../lib/authenticated-fetch";
import { supabase } from "../../lib/supabase";
import { ComplianceNav } from "../components";

type ComplianceDocument = {
  id: string;
  school_id: number;
  document_name: string;
  file_path: string;
  file_name?: string | null;
  uploaded_at?: string | null;
  document_type?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  issuing_authority?: string | null;
  document_reference?: string | null;
  verification_status?: string | null;
};

export default function DbeComplianceDocumentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolParam = searchParams.get("school");

  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [documents, setDocuments] = useState<ComplianceDocument[]>([]);
  const [evidenceLinks, setEvidenceLinks] = useState<Array<{ document_id: string }>>([]);
  const [documentName, setDocumentName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showUploadForm, setShowUploadForm] = useState(true);
  const [editingDetailsId, setEditingDetailsId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, string>>({});

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
    const linksResponse = await authenticatedFetch(`/api/compliance?school_id=${currentSchoolId}&resource=evidence`);
    if (linksResponse.ok) {
      const links = await linksResponse.json();
      setEvidenceLinks(links.items || []);
    }
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

  async function saveDetails(document: ComplianceDocument) {
    if (!schoolId) return;
    const response = await authenticatedFetch("/api/dbe-compliance-documents", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ school_id: schoolId, document_id: document.id, document_name: document.document_name, ...details, verify: details.verify === "true" }) });
    const result = await response.json();
    if (!response.ok) { alert(result.error || "Document details could not be saved."); return; }
    setEditingDetailsId(null); setDetails({}); await fetchDocuments(schoolId);
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
      <ComplianceNav />
      <div className="db-soft-card" style={{ padding: 18, marginBottom: 18 }}>
        <h2 className="db-page-title">Compliance &amp; Registration: Documents &amp; Evidence</h2>
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
        {documents.filter((document) => !evidenceLinks.some((link) => link.document_id === document.id)).length > 0 ? <div className="db-list-card" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}><span><strong>{documents.filter((document) => !evidenceLinks.some((link) => link.document_id === document.id)).length} document{documents.filter((document) => !evidenceLinks.some((link) => link.document_id === document.id)).length === 1 ? "" : "s"} need{documents.filter((document) => !evidenceLinks.some((link) => link.document_id === document.id)).length === 1 ? "s" : ""} to be linked to a requirement</strong><p className="db-helper" style={{ margin: "4px 0 0" }}>Link existing evidence without uploading or duplicating the file.</p></span><Link className="db-button-secondary" href={`/dbe-registration/requirements${schoolParam ? `?school=${schoolParam}` : ""}`}>Link Evidence</Link></div> : null}
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

                    {document.document_type || document.expiry_date || document.verification_status ? <p style={smallText}>Type: {document.document_type || "Not specified"} · {document.expiry_date ? `Expires: ${document.expiry_date}` : "No expiry"} · {document.verification_status || "Unverified"}</p> : null}

                    {editingDetailsId === document.id ? <div style={{ ...grid2, marginTop: 10 }}>
                      <input className="db-input" placeholder="Document type" value={details.document_type || ""} onChange={(e) => setDetails((v) => ({ ...v, document_type: e.target.value }))} />
                      <input className="db-input" type="date" value={details.issue_date || ""} onChange={(e) => setDetails((v) => ({ ...v, issue_date: e.target.value }))} />
                      <input className="db-input" type="date" value={details.expiry_date || ""} onChange={(e) => setDetails((v) => ({ ...v, expiry_date: e.target.value }))} />
                      <input className="db-input" placeholder="Issuing authority" value={details.issuing_authority || ""} onChange={(e) => setDetails((v) => ({ ...v, issuing_authority: e.target.value }))} />
                      <input className="db-input" placeholder="Reference" value={details.document_reference || ""} onChange={(e) => setDetails((v) => ({ ...v, document_reference: e.target.value }))} />
                      <label><input type="checkbox" checked={details.verify === "true"} onChange={(e) => setDetails((v) => ({ ...v, verify: String(e.target.checked) }))} /> Verified</label>
                      <button className="db-button-primary" onClick={() => void saveDetails(document)}>Save details</button>
                    </div> : null}

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

                      <button type="button" className="db-button-secondary" onClick={() => { setEditingDetailsId(document.id); setDetails({ document_type: document.document_type || "", issue_date: document.issue_date || "", expiry_date: document.expiry_date || "", issuing_authority: document.issuing_authority || "", document_reference: document.document_reference || "", verify: String(document.verification_status === "Verified") }); }}>Edit Details</button>

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
