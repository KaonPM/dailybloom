"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type HomeworkItem = {
  id: number;
  title: string;
  file_name: string;
};

type Props = {
  schoolId: number;
  onLibraryChanged: () => void;
};

export default function HomeworkLibraryPanel({
  schoolId,
  onLibraryChanged,
}: Props) {
  const [items, setItems] = useState<HomeworkItem[]>([]);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const request = useCallback(async (url: string, init?: RequestInit) => {
    const { data } = await supabase.auth.getSession();
    return fetch(url, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${data.session?.access_token || ""}`,
      },
    });
  }, []);

  const load = useCallback(async () => {
    const response = await request(
      `/api/classroom-homework?school_id=${schoolId}`
    );
    const body = await response.json();
    if (!response.ok) {
      setMessage(body.error || "Homework library could not be loaded.");
      return;
    }
    setItems(body.homework || []);
  }, [request, schoolId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  async function uploadHomework() {
    if (!title.trim() || !file) {
      setMessage("Add a homework name and choose a file.");
      return;
    }
    if (file.size <= 0 || file.size > 15 * 1024 * 1024) {
      setMessage("Upload a file no larger than 15 MB.");
      return;
    }
    setBusy(true);
    setMessage("");
    const prepareResponse = await request("/api/classroom-homework", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_upload",
        school_id: schoolId,
        title: title.trim(),
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
      }),
    });
    const prepared = await prepareResponse.json();
    if (!prepareResponse.ok) {
      setBusy(false);
      setMessage(prepared.error || "Homework upload could not be prepared.");
      return;
    }

    const uploadResult = await Promise.race([
      supabase.storage
        .from("classroom-homework")
        .uploadToSignedUrl(prepared.path, prepared.token, file, {
          contentType: file.type,
        }),
      new Promise<never>((_, reject) =>
        window.setTimeout(
          () => reject(new Error("The upload took too long.")),
          120000
        )
      ),
    ]).catch((error: unknown) => ({
      error: error instanceof Error ? error : new Error("Homework upload failed."),
    }));
    if (uploadResult.error) {
      setBusy(false);
      setMessage(uploadResult.error.message);
      return;
    }

    const completeResponse = await request("/api/classroom-homework", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "complete_upload",
        school_id: schoolId,
        title: title.trim(),
        file_name: file.name,
        file_path: prepared.path,
      }),
    });
    const completed = await completeResponse.json();
    setBusy(false);
    if (!completeResponse.ok) {
      setMessage(completed.error || "Uploaded homework could not be saved.");
      return;
    }

    setTitle("");
    setFile(null);
    setMessage("Homework uploaded and ready for daily allocation.");
    await load();
    onLibraryChanged();
  }

  async function archiveHomework(homeworkId: number) {
    const confirmed = window.confirm(
      "Archive this homework item? Existing allocations will remain available to parents."
    );
    if (!confirmed) return;

    setBusy(true);
    const response = await request(
      `/api/classroom-homework?school_id=${schoolId}&homework_id=${homeworkId}`,
      { method: "DELETE" }
    );
    const body = await response.json();
    setBusy(false);
    if (!response.ok) {
      setMessage(body.error || "Homework could not be archived.");
      return;
    }
    setMessage("Homework archived.");
    await load();
    onLibraryChanged();
  }

  return (
    <details
      className="db-card db-card-purple"
      style={{ padding: 16, marginBottom: 14 }}
    >
      <summary style={{ cursor: "pointer", fontWeight: 800 }}>
        Homework Library ({items.length})
      </summary>
      <p className="db-helper">
        Principals and authorised preschool administrators can keep reusable
        resources here. Practitioners can also upload a file directly while
        preparing a day.
      </p>

      <div style={{ display: "grid", gap: 10 }}>
        <input
          className="db-input"
          value={title}
          maxLength={160}
          placeholder="Homework name, e.g. Letter-sound practice"
          onChange={(event) => setTitle(event.target.value)}
        />
        <input
          className="db-input"
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          onChange={(event) => setFile(event.target.files?.[0] || null)}
        />
        <button
          type="button"
          className="db-button-primary"
          disabled={busy}
          onClick={() => void uploadHomework()}
        >
          {busy ? "Uploading..." : "Upload Homework"}
        </button>
      </div>

      {items.length ? (
        <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
          {items.map((item) => (
            <div
              key={item.id}
              className="db-list-card"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <strong>{item.title}</strong>
                <p className="db-helper" style={{ margin: "4px 0 0" }}>
                  {item.file_name}
                </p>
              </div>
              <button
                type="button"
                className="db-button-secondary"
                disabled={busy}
                onClick={() => void archiveHomework(item.id)}
              >
                Archive
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {message ? (
        <p className="db-helper" role="status" style={{ marginTop: 10 }}>
          {message}
        </p>
      ) : null}
    </details>
  );
}
