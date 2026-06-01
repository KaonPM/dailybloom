"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getCurrentProfile } from "../../lib/auth";
import { resolveSchoolContext } from "../../lib/school-context";

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
    const { data, error } = await supabase
      .from("dbe_compliance_documents")
      .select("*")
      .eq("school_id", currentSchoolId)
      .order("uploaded_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setDocuments((data || []) as ComplianceDocument[]);
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

    const safeFileName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const filePath = `${schoolId}/${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("dbe-compliance-documents")
      .upload(filePath, selectedFile, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      alert(uploadError.message);
      setUploading(false);
      return;
    }

    const { error: insertError } = await supabase
      .from("dbe_compliance_documents")
      .insert([
        {
          school_id: schoolId,
          document_name: documentName.trim(),
          file_path: filePath,
          file_name: selectedFile.name,
        },
      ]);

    if (insertError) {
      alert(insertError.message);
      setUploading(false);
      return;
    }

    setDocumentName("");
    setSelectedFile(null);

    const fileInput = document.getElementById(
      "dbe-compliance-document-file"
    ) as HTMLInputElement | null;

    if (fileInput) {
      fileInput.value = "";
    }

    await fetchDocuments(schoolId);
    setUploading(false);
    alert("Compliance document uploaded.");
  }

  function downloadDocument(document: ComplianceDocument) {
    const { data } = supabase.storage
      .from("dbe-compliance-documents")
      .getPublicUrl(document.file_path);

    if (!data.publicUrl) {
      alert("Could not generate download link.");
      return;
    }

    window.open(data.publicUrl, "_blank");
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

    const { error } = await supabase
      .from("dbe_compliance_documents")
      .update({
        document_name: renameValue.trim(),
      })
      .eq("id", documentId)
      .eq("school_id", schoolId);

    if (error) {
      alert(error.message);
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

    await supabase.storage
      .from("dbe-compliance-documents")
      .remove([document.file_path]);

    const { error } = await supabase
      .from("dbe_compliance_documents")
      .delete()
      .eq("id", document.id)
      .eq("school_id", schoolId);

    if (error) {
      alert(error.message);
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

      <div className="db-card db-card-blue" style={{ padding: 16, marginBottom: 18 }}>
        <h3 style={sectionTitle}>Upload Compliance Document</h3>

        <div style={grid2}>
          <Field label="Document Name">
            <input
              className="db-input"
              placeholder="Example: NPO Certificate"
              value={documentName}
              onChange={(event) => setDocumentName(event.target.value)}
            />
          </Field>

          <Field label="Choose File">
            <input
              id="dbe-compliance-document-file"
              className="db-input"
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
            />
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