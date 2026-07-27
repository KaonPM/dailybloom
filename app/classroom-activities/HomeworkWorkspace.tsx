"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { supabase } from "../lib/supabase";
import { PERMISSIONS } from "../lib/permissions";

type Homework = { id: number; title: string; file_name: string };
type Selection = { homework_id: string; instruction_note: string };
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
  role: string;
  permissions: string[];
  showUpload?: boolean;
  enabled?: boolean;
};

const emptySelection = (): Selection => ({ homework_id: "", instruction_note: "" });

export const HomeworkWorkspace = forwardRef<HomeworkWorkspaceHandle, Props>(
  function HomeworkWorkspace({
    schoolId,
    classroomId,
    weekStart,
    activityDate,
    dayLabel,
    role,
    permissions,
    showUpload = false,
    enabled = true,
  }, ref) {
    const [items, setItems] = useState<Homework[]>([]);
    const [selections, setSelections] = useState<Selection[]>([emptySelection()]);
    const [title, setTitle] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const canUpload = role === "principal" ||
      (role === "admin" && permissions.includes(PERMISSIONS.HOMEWORK_MANAGE));

    const request = useCallback(async (url: string, init?: RequestInit) => {
      const { data } = await supabase.auth.getSession();
      return fetch(url, {
        ...init,
        headers: { ...(init?.headers || {}), Authorization: `Bearer ${data.session?.access_token || ""}` },
      });
    }, []);

    const load = useCallback(async () => {
      const response = await request(`/api/classroom-homework?school_id=${schoolId}&classroom_id=${classroomId}&week_start=${weekStart}&activity_date=${activityDate}`);
      const body = await response.json();
      if (!response.ok) return setMessage(body.error || "Homework could not be loaded.");
      setItems(body.homework || []);
      const assigned = (body.assignments || []).map((row: { homework_id: number; instruction_note?: string | null }) => ({
        homework_id: String(row.homework_id),
        instruction_note: row.instruction_note || "",
      }));
      setSelections(
        enabled && assigned.length ? assigned : [emptySelection()]
      );
    }, [activityDate, classroomId, enabled, request, schoolId, weekStart]);

    useEffect(() => { void load(); }, [load]);

    async function saveSelections(notifyParent = false, weekHasHomework = false) {
      setSaving(true);
      const selected = enabled
        ? selections.filter((row) => row.homework_id)
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
            homework_id: Number(row.homework_id),
            instruction_note: row.instruction_note.trim(),
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
      setMessage(selected.length ? `${dayLabel} homework saved.` : `No homework allocated for ${dayLabel}.`);
      return true;
    }

    useImperativeHandle(ref, () => ({
      save: saveSelections,
      hasHomework: () =>
        enabled && selections.some((row) => Boolean(row.homework_id)),
    }));

    function updateSelection(index: number, patch: Partial<Selection>) {
      setSelections((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
    }

    async function uploadHomework() {
      if (!file || !title.trim()) return setMessage("Add a homework name and choose a file.");
      setSaving(true);
      const form = new FormData();
      form.set("school_id", String(schoolId));
      form.set("title", title.trim());
      form.set("file", file);
      const response = await request("/api/classroom-homework", { method: "POST", body: form });
      const body = await response.json();
      setSaving(false);
      if (!response.ok) return setMessage(body.error || "Homework upload failed.");
      setTitle("");
      setFile(null);
      setMessage("Homework uploaded and ready for selection.");
      await load();
    }

    return (
      <section className="db-card db-card-blue" style={{ padding: 12, marginTop: 10 }}>
        <h4 style={{ margin: "0 0 6px" }}>Homework for {dayLabel}</h4>
        <p className="db-helper">
          Select one homework item for this teaching day and add instructions for the parent.
        </p>

        <div style={{ display: "grid", gap: 10 }}>
          {selections.map((selection, index) => (
            <div key={index} className="db-list-card" style={{ display: "grid", gap: 8 }}>
              <select className="db-input" value={selection.homework_id} disabled={saving} onChange={(event) => updateSelection(index, { homework_id: event.target.value })}>
                <option value="">No homework allocated</option>
                {items.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
              {selection.homework_id ? (
                <textarea
                  className="db-input"
                  value={selection.instruction_note}
                  maxLength={500}
                  placeholder="Instruction for parent, e.g. Print pages 1–2 and complete by Friday."
                  onChange={(event) => updateSelection(index, { instruction_note: event.target.value })}
                />
              ) : null}
            </div>
          ))}
        </div>

        {canUpload && showUpload ? (
          <details style={{ marginTop: 18 }}>
            <summary style={{ cursor: "pointer", fontWeight: 800 }}>Upload homework</summary>
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <input className="db-input" value={title} maxLength={160} placeholder="Homework name, e.g. Number Tracing Week 3" onChange={(event) => setTitle(event.target.value)} />
              <input className="db-input" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(event) => setFile(event.target.files?.[0] || null)} />
              <button type="button" className="db-button-primary" disabled={saving} onClick={() => void uploadHomework()}>
                {saving ? "Uploading..." : "Upload Homework"}
              </button>
            </div>
          </details>
        ) : null}
        {message ? <p className="db-helper" role="status" style={{ marginTop: 10 }}>{message}</p> : null}
      </section>
    );
  }
);
