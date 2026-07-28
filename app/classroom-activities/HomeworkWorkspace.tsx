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
  libraryVersion?: number;
  enabled?: boolean;
};

const INSTRUCTIONS_ONLY = "instructions-only";
const emptySelection = (): Selection => ({
  homework_id: "",
  instruction_note: "",
});

export const HomeworkWorkspace = forwardRef<HomeworkWorkspaceHandle, Props>(
  function HomeworkWorkspace(
    {
      schoolId,
      classroomId,
      weekStart,
      activityDate,
      dayLabel,
      libraryVersion = 0,
      enabled = true,
    },
    ref
  ) {
    const [items, setItems] = useState<Homework[]>([]);
    const [selections, setSelections] = useState<Selection[]>([
      emptySelection(),
    ]);
    const [saving, setSaving] = useState(false);
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
        }) => ({
          homework_id: row.homework_id
            ? String(row.homework_id)
            : INSTRUCTIONS_ONLY,
          instruction_note: row.instruction_note || "",
        })
      );
      setSelections(
        enabled && assigned.length ? assigned : [emptySelection()]
      );
    }, [
      activityDate,
      classroomId,
      enabled,
      request,
      schoolId,
      weekStart,
    ]);

    useEffect(() => {
      const timeout = window.setTimeout(() => {
        void load();
      }, 0);
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

    return (
      <section
        className="db-card db-card-blue"
        style={{ padding: 12, marginTop: 10 }}
      >
        <h4 style={{ margin: "0 0 6px" }}>Homework for {dayLabel}</h4>
        <p className="db-helper">
          Select one homework item or send instructions without an attachment.
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
              ) : null}
            </div>
          ))}
        </div>

        {message ? (
          <p className="db-helper" role="status" style={{ marginTop: 10 }}>
            {message}
          </p>
        ) : null}
      </section>
    );
  }
);
