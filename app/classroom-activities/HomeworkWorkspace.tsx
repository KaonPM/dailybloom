"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { supabase } from "../lib/supabase";

type HomeworkType = "none" | "instructions" | "attachment";
type Selection = {
  homework_type: HomeworkType;
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
  enabled?: boolean;
};

const emptySelection = (defaultDueDate: string): Selection => ({
  homework_type: "none",
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
      enabled = true,
    },
    ref
  ) {
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

      const assigned = (body.assignments || []).map(
        (row: {
          homework_id: number | null;
          instruction_note?: string | null;
          due_date?: string | null;
        }): Selection => ({
          homework_type: row.homework_id
            ? "attachment"
            : row.instruction_note
              ? "instructions"
              : "none",
          homework_id: row.homework_id ? String(row.homework_id) : "",
          instruction_note: row.instruction_note || "",
          due_date: row.due_date || defaultDueDate,
        })
      );
      setSelections(
        enabled && assigned.length
          ? assigned.slice(0, 1)
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
    }, [load]);

    const hasSavedHomework = useCallback(
      (rows: Selection[] = selections) =>
        enabled &&
        rows.some(
          (row) =>
            (row.homework_type === "instructions" &&
              Boolean(row.instruction_note.trim())) ||
            (row.homework_type === "attachment" && Boolean(row.homework_id))
        ),
      [enabled, selections]
    );

    async function saveSelections(
      notifyParent = false,
      weekHasHomework = false
    ) {
      const incomplete = enabled
        ? selections.find(
            (row) =>
              (row.homework_type === "instructions" &&
                !row.instruction_note.trim()) ||
              (row.homework_type === "attachment" && !row.homework_id)
          )
        : null;

      if (incomplete) {
        setMessage(
          incomplete.homework_type === "attachment"
            ? "Upload an attachment before saving this homework."
            : "Add an instruction before saving instructions-only homework."
        );
        return false;
      }

      setSaving(true);
      const selected = enabled
        ? selections.filter(
            (row) =>
              (row.homework_type === "instructions" &&
                Boolean(row.instruction_note.trim())) ||
              (row.homework_type === "attachment" && Boolean(row.homework_id))
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
              row.homework_type === "attachment"
                ? Number(row.homework_id)
                : null,
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
      hasHomework: () => hasSavedHomework(),
    }));

    function updateSelection(index: number, patch: Partial<Selection>) {
      setSelections((current) =>
        current.map((row, rowIndex) =>
          rowIndex === index ? { ...row, ...patch } : row
        )
      );
    }

    function setHomeworkType(index: number, homeworkType: HomeworkType) {
      setSelections((current) =>
        current.map((row, rowIndex) => {
          if (rowIndex !== index) return row;
          if (homeworkType === "none") {
            return {
              ...emptySelection(row.due_date || defaultDueDate),
              due_date: row.due_date || defaultDueDate,
            };
          }
          return {
            ...row,
            homework_type: homeworkType,
            homework_id:
              homeworkType === "instructions" ? "" : row.homework_id,
          };
        })
      );
      setMessage("");
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

      const homework = completed.homework as { id: number; title: string };
      setSelections((current) => [
        {
          ...(current[0] || emptySelection(defaultDueDate)),
          homework_type: "attachment",
          homework_id: String(homework.id),
        },
      ]);
      setUploadTitle("");
      setUploadFile(null);
      setMessage(`${homework.title} uploaded and selected for ${dayLabel}.`);
    }

    const selection = selections[0] || emptySelection(defaultDueDate);
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
            {!isOpen ? (
              <p className="db-helper" style={{ margin: "4px 0 0" }}>
                {hasSavedHomework()
                  ? "Homework ready to be included when the week is saved."
                  : "No homework allocated."}
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
              Select the homework type for this day. You can save it now, or
              save every completed day together with the weekly plan.
            </p>

            <div className="db-list-card" style={{ display: "grid", gap: 10 }}>
              <label style={{ display: "grid", gap: 5 }}>
                <strong>Homework type</strong>
                <select
                  className="db-input"
                  value={selection.homework_type}
                  disabled={saving || uploading}
                  onChange={(event) =>
                    setHomeworkType(
                      0,
                      event.target.value as HomeworkType
                    )
                  }
                >
                  <option value="none">No homework allocated</option>
                  <option value="instructions">
                    Instructions only - no attachment
                  </option>
                  <option value="attachment">Homework with attachment</option>
                </select>
              </label>

              {selection.homework_type === "instructions" ? (
                <label style={{ display: "grid", gap: 5 }}>
                  <strong>Instructions for parent</strong>
                  <textarea
                    className="db-input"
                    value={selection.instruction_note}
                    maxLength={500}
                    required
                    placeholder="For example: Practise counting from 1 to 20 with everyday objects."
                    onChange={(event) =>
                      updateSelection(0, {
                        instruction_note: event.target.value,
                      })
                    }
                    style={{ minHeight: 90, resize: "vertical" }}
                  />
                </label>
              ) : null}

              {selection.homework_type === "attachment" ? (
                <>
                  <label style={{ display: "grid", gap: 5 }}>
                    <strong>Instructions for parent</strong>
                    <textarea
                      className="db-input"
                      value={selection.instruction_note}
                      maxLength={500}
                      placeholder="For example: Print pages 1-2 and complete them with your child."
                      onChange={(event) =>
                        updateSelection(0, {
                          instruction_note: event.target.value,
                        })
                      }
                      style={{ minHeight: 90, resize: "vertical" }}
                    />
                  </label>

                  <div className="db-soft-card" style={{ padding: 12 }}>
                    <strong>Upload an attachment for {dayLabel}</strong>
                    <p className="db-helper" style={{ margin: "4px 0 10px" }}>
                      {selection.homework_id
                        ? "An attachment is already saved for this day. Uploading another file replaces it."
                        : "Name the file clearly so parents can recognise it."}
                    </p>
                    <div style={{ display: "grid", gap: 8 }}>
                      <input
                        className="db-input"
                        value={uploadTitle}
                        maxLength={160}
                        placeholder="Homework name, e.g. Letter-sound practice"
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
                        className="db-button-secondary"
                        disabled={uploading || saving}
                        onClick={() => void uploadForDay()}
                      >
                        {uploading ? "Uploading..." : "Upload attachment"}
                      </button>
                    </div>
                  </div>
                </>
              ) : null}

              {selection.homework_type !== "none" ? (
                <label style={{ display: "grid", gap: 5 }}>
                  <strong>Due date</strong>
                  <input
                    className="db-input"
                    type="date"
                    min={activityDate}
                    value={selection.due_date}
                    onChange={(event) =>
                      updateSelection(0, { due_date: event.target.value })
                    }
                  />
                </label>
              ) : null}

              <button
                type="button"
                className="db-button-primary"
                disabled={saving || uploading}
                onClick={() => void saveSelections()}
              >
                {saving ? "Saving..." : `Save ${dayLabel} homework`}
              </button>
              <p className="db-helper" style={{ margin: 0 }}>
                Saving a day does not notify parents. A single parent update is
                sent only when the weekly activity plan is saved.
              </p>
            </div>
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
