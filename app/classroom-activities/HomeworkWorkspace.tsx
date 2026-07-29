"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { supabase } from "../lib/supabase";

type Homework = { id: number; title: string; file_name: string };
type Selection = {
  homework_id: string;
  instruction_note: string;
  due_date: string;
};
export type HomeworkWorkspaceHandle = {
  save: (notifyParent?: boolean, weekHasHomework?: boolean) => Promise<boolean>;
  hasHomework: () => boolean;
};
type Props = {
  schoolId: number;
  classroomId: number;
  weekStart: string;
  activityDate: string;
  dayLabel: string;
  defaultDueDate: string;
  libraryVersion?: number;
  enabled?: boolean;
};

const INSTRUCTIONS_ONLY = "instructions-only";
const emptySelection = (defaultDueDate: string): Selection => ({
  homework_id: "",
  instruction_note: "",
  due_date: defaultDueDate,
});

export const HomeworkWorkspace = forwardRef<HomeworkWorkspaceHandle, Props>(
  function HomeworkWorkspace(
    {
      schoolId,
      classroomId,
      weekStart,
      activityDate,
      dayLabel,
      defaultDueDate,
      libraryVersion = 0,
      enabled = true,
    },
    ref
  ) {
    const [items, setItems] = useState<Homework[]>([]);
    const [selections, setSelections] = useState<Selection[]>([
      emptySelection(defaultDueDate),
    ]);
    const [uploadTitle, setUploadTitle] = useState("");
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
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
        `/api/classroom-homework?school_id=${schoolId}&classroom_id=${classroomId}&week_start=${weekStart}&activity_date=${activityDate}`
      );
      const body = await response.json();
      if (!response.ok) {
        setMessage(body.error || "Homework could not be loaded.");
        return;
      }
      setItems(body.homework || []);
      const assigned = (body.assignments || []).map(
        (row: {
          homework_id: number | null;
          instruction_note?: string | null;
          due_date?: string | null;
        }) => ({
          homework_id: row.homework_id
            ? String(row.homework_id)
            : INSTRUCTIONS_ONLY,
          instruction_note: row.instruction_note || "",
          due_date: row.due_date || defaultDueDate,
        })
      );
      setSelections(
        enabled && assigned.length
          ? assigned
          : [emptySelection(defaultDueDate)]
      );
    }, [
      activityDate,
      classroomId,
      defaultDueDate,
      enabled,
      request,
      schoolId,
      weekStart,
    ]);

    useEffect(() => {
      const timeout = window.setTimeout(() => void load(), 0);
      return () => window.clearTimeout(timeout);
    }, [libraryVersion, load]);

    async function saveSelections(
      notifyParent = false,
      weekHasHomework = false
    ) {
      setSaving(true);
      const selected = enabled
        ? selections.filter(
            (row) =>
              row.homework_id &&
              (row.homework_id !== INSTRUCTIONS_ONLY ||
                row.instruction_note.trim())
          )
        : [];
      const response = await request("/api/classroom-homework", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school_id: schoolId,
          classroom_id: classroomId,
          week_start: weekStart,
          activity_date: activityDate,
          notify_parent: notifyParent,
          week_has_homework: weekHasHomework,
          items: selected.map((row, position) => ({
            homework_id:
              row.homework_id === INSTRUCTIONS_ONLY
                ? null
                : Number(row.homework_id),
            instruction_note: row.instruction_note.trim(),
            due_date: row.due_date || defaultDueDate,
            position,
          })),
        }),
      });
      const body = await response.json();
      setSaving(false);
      if (!response.ok) {
        setMessage(body.error || "Homework could not be saved.");
        return false;
      }
      setMessage(
        selected.length
          ? `${dayLabel} homework saved.`
          : `No homework allocated for ${dayLabel}.`
      );
      return true;
    }

    useImperativeHandle(ref, () => ({
      save: saveSelections,
      hasHomework: () =>
        enabled &&
        selections.some(
          (row) =>
            Boolean(row.homework_id) &&
            (row.homework_id !== INSTRUCTIONS_ONLY ||
              Boolean(row.instruction_note.trim()))
        ),
    }));

    function updateSelection(index: number, patch: Partial<Selection>) {
      setSelections((current) =>
        current.map((row, rowIndex) =>
          rowIndex === index ? { ...row, ...patch } : row
        )
      );
    }

    async function uploadForDay() {
      if (!uploadTitle.trim() || !uploadFile) {
        setMessage("Add a homework name and choose a file.");
        return;
      }
      if (uploadFile.size <= 0 || uploadFile.size > 15 * 1024 * 1024) {
        setMessage("Upload a file no larger than 15 MB.");
        return;
      }

      setUploading(true);
      setMessage("");
      const prepareResponse = await request("/api/classroom-homework", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_upload",
          school_id: schoolId,
          classroom_id: classroomId,
          title: uploadTitle.trim(),
          file_name: uploadFile.name,
          file_type: uploadFile.type,
          file_size: uploadFile.size,
        }),
      });
      const prepared = await prepareResponse.json();
      if (!prepareResponse.ok) {
        setUploading(false);
        setMessage(prepared.error || "Homework upload could not be prepared.");
        return;
      }

      const uploadResult = await Promise.race([
        supabase.storage
          .from("classroom-homework")
          .uploadToSignedUrl(prepared.path, prepared.token, uploadFile, {
            contentType: uploadFile.type,
          }),
        new Promise<never>((_, reject) =>
          window.setTimeout(
            () => reject(new Error("The upload took too long.")),
            120000
          )
        ),
      ]).catch((error: unknown) => ({
        error:
          error instanceof Error
            ? error
            : new Error("Homework upload failed."),
      }));
      if (uploadResult.error) {
        setUploading(false);
        setMessage(uploadResult.error.message);
        return;
      }

      const completeResponse = await request("/api/classroom-homework", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete_upload",
          school_id: schoolId,
          classroom_id: classroomId,
          title: uploadTitle.trim(),
          file_name: uploadFile.name,
          file_path: prepared.path,
        }),
      });
      const completed = await completeResponse.json();
      setUploading(false);
      if (!completeResponse.ok) {
        setMessage(completed.error || "Uploaded homework could not be saved.");
        return;
      }

      const homework = completed.homework as Homework;
      setItems((current) =>
        [...current.filter((item) => item.id !== homework.id), homework].sort(
          (left, right) => left.title.localeCompare(right.title)
        )
      );
      setSelections([
        {
          homework_id: String(homework.id),
          instruction_note: selections[0]?.instruction_note || "",
          due_date: selections[0]?.due_date || defaultDueDate,
        },
      ]);
      setUploadTitle("");
      setUploadFile(null);
      setMessage(`${homework.title} uploaded and selected for ${dayLabel}.`);
    }

    return (
      <section
        className="db-card db-card-blue"
        style={{ padding: 12, marginTop: 10 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div>
            <h4 style={{ margin: 0 }}>Homework for {dayLabel}</h4>
            {!isOpen && selections.some((row) => row.homework_id) ? (
              <p className="db-helper" style={{ margin: "4px 0 0" }}>
                Homework selected
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="db-button-secondary"
            aria-expanded={isOpen}
            onClick={() => setIsOpen((current) => !current)}
            style={{ width: "auto", padding: "8px 14px" }}
          >
            {isOpen ? "Close" : "Open"}
          </button>
        </div>

        {isOpen ? (
          <>
            <p className="db-helper">
              Select one homework item or send instructions without an
              attachment.
            </p>

            <div style={{ display: "grid", gap: 10 }}>
          {selections.map((selection, index) => (
            <div
              key={index}
              className="db-list-card"
              style={{ display: "grid", gap: 8 }}
            >
              <select
                className="db-input"
                value={selection.homework_id}
                disabled={saving}
                onChange={(event) =>
                  updateSelection(index, {
                    homework_id: event.target.value,
                  })
                }
              >
                <option value="">No homework allocated</option>
                <option value={INSTRUCTIONS_ONLY}>
                  Instructions only — no attachment
                </option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
              {selection.homework_id ? (
                <>
                  <textarea
                    className="db-input"
                    value={selection.instruction_note}
                    maxLength={500}
                    required={selection.homework_id === INSTRUCTIONS_ONLY}
                    placeholder={
                      selection.homework_id === INSTRUCTIONS_ONLY
                        ? "Homework instruction for the parent, e.g. Practise counting from 1 to 20."
                        : "Instruction for parent, e.g. Print pages 1–2 and complete by Friday."
                    }
                    onChange={(event) =>
                      updateSelection(index, {
                        instruction_note: event.target.value,
                      })
                    }
                  />
                  <label style={{ display: "grid", gap: 5 }}>
                    <strong>Due date</strong>
                    <input
                      className="db-input"
                      type="date"
                      min={activityDate}
                      value={selection.due_date}
                      onChange={(event) =>
                        updateSelection(index, {
                          due_date: event.target.value,
                        })
                      }
                    />
                  </label>
                </>
              ) : null}
            </div>
          ))}
            </div>

            <details className="db-list-card" style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", fontWeight: 800 }}>
                Upload homework for {dayLabel}
              </summary>
              <p className="db-helper">
                Optional. You can send instructions without uploading a file.
              </p>
              <div style={{ display: "grid", gap: 8 }}>
                <input
                  className="db-input"
                  value={uploadTitle}
                  maxLength={160}
                  placeholder="Homework name"
                  onChange={(event) => setUploadTitle(event.target.value)}
                />
                <input
                  className="db-input"
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(event) =>
                    setUploadFile(event.target.files?.[0] || null)
                  }
                />
                <button
                  type="button"
                  className="db-button-primary"
                  disabled={uploading || saving}
                  onClick={() => void uploadForDay()}
                >
                  {uploading ? "Uploading..." : "Upload and select"}
                </button>
              </div>
            </details>
          </>
        ) : null}

        {message ? (
          <p className="db-helper" role="status" style={{ marginTop: 10 }}>
            {message}
          </p>
        ) : null}
      </section>
    );
  }
);
