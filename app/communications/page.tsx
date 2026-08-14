"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { resolveSchoolContext } from "../lib/school-context";
import { authenticatedFetch } from "../lib/authenticated-fetch";
import CommunicationSummary from "./components/CommunicationSummary";
import CommunicationHistory from "./components/CommunicationHistory";
import styles from "./communications.module.css";
import { ClassroomOption, CommunicationRow, CommunicationSummaryData, PaginationData } from "./types";

const EMPTY_SUMMARY: CommunicationSummaryData = {
  sentToday: 0,
  delivered: 0,
  read: 0,
  failed: 0,
  awaiting: 0,
};
const DEFAULT_PAGINATION: PaginationData = { page: 1, pageSize: 20, total: 0, totalPages: 1 };
const channels = ["", "parent_portal", "in_app", "push", "sms", "whatsapp", "email"];
const statuses = ["", "queued", "sending", "sent", "delivered", "read", "retry_scheduled", "failed", "skipped"];

type Filters = {
  from: string;
  to: string;
  classroom: string;
  type: string;
  channel: string;
  status: string;
  search: string;
};

const label = (value: string) =>
  value
    ? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "All";
const dateInput = (date: Date) => date.toISOString().slice(0, 10);
const defaultFilters = (): Filters => ({
  from: dateInput(new Date(Date.now() - 29 * 86400000)),
  to: dateInput(new Date()),
  classroom: "",
  type: "",
  channel: "",
  status: "",
  search: "",
});

export default function CommunicationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSchool = searchParams.get("school");
  const initialFilters = useMemo(defaultFilters, []);
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [rows, setRows] = useState<CommunicationRow[]>([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [pagination, setPagination] = useState(DEFAULT_PAGINATION);
  const [classrooms, setClassrooms] = useState<ClassroomOption[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [selected, setSelected] = useState<CommunicationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draftFilters, setDraftFilters] = useState<Filters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(initialFilters);

  useEffect(() => {
    let active = true;
    void (async () => {
      const context = await resolveSchoolContext(requestedSchool);
      if (!active) return;
      if (context.error) {
        router.push("/login");
        return;
      }
      if (context.shouldReturnToMaster || !context.schoolId) {
        router.push("/master");
        return;
      }
      setSchoolId(context.schoolId);
    })();
    return () => {
      active = false;
    };
  }, [requestedSchool, router]);

  const load = useCallback(
    async (requestedPage = 1) => {
      if (!schoolId) return;
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        school_id: String(schoolId),
        page: String(requestedPage),
        page_size: "20",
        from: appliedFilters.from,
        to: appliedFilters.to,
      });
      if (appliedFilters.classroom) params.set("classroom_id", appliedFilters.classroom);
      if (appliedFilters.type) params.set("communication_type", appliedFilters.type);
      if (appliedFilters.channel) params.set("channel", appliedFilters.channel);
      if (appliedFilters.status) params.set("status", appliedFilters.status);
      if (appliedFilters.search.trim()) params.set("search", appliedFilters.search.trim());

      try {
        const response = await authenticatedFetch(`/api/communications/notification-centre?${params}`);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Communication history could not be loaded.");
        setRows(payload.notifications || []);
        setSummary(payload.summary || EMPTY_SUMMARY);
        setPagination(payload.pagination || DEFAULT_PAGINATION);
        setClassrooms(payload.classrooms || []);
        setTypes(payload.communicationTypes || []);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Communication history could not be loaded.");
      } finally {
        setLoading(false);
      }
    },
    [appliedFilters, schoolId],
  );

  useEffect(() => {
    if (schoolId) void load(1);
  }, [load, schoolId]);

  function updateFilter(key: keyof Filters, value: string) {
    setDraftFilters((current) => ({ ...current, [key]: value }));
  }

  function applyFilters() {
    setAppliedFilters({ ...draftFilters });
  }

  function resetFilters() {
    const next = defaultFilters();
    setDraftFilters(next);
    setAppliedFilters(next);
  }

  function exportCsv() {
    const headings = ["Date", "Learner/parent", "Class", "Type", "Subject", "Channel", "Status", "Sent by"];
    const csv = [
      headings,
      ...rows.map((row) => [
        row.sent_at || row.created_at || "",
        row.learner_name || row.recipient_name || "",
        row.classroom_name || "",
        row.communication_type || "",
        row.subject || "",
        row.channel || "",
        row.status || "",
        row.sent_by_name || "",
      ]),
    ]
      .map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "dailybloom-communication-history.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <h1 className="db-page-title">Communication Centre</h1>
        <p>One auditable history of parent portal notices, push notifications, SMS, WhatsApp and email.</p>
      </section>
      <CommunicationSummary summary={summary} />

      <section className={styles.panel}>
        <div className={styles.filters}>
          <label>
            From
            <input type="date" value={draftFilters.from} onChange={(event) => updateFilter("from", event.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={draftFilters.to} onChange={(event) => updateFilter("to", event.target.value)} />
          </label>
          <label>
            Class
            <select value={draftFilters.classroom} onChange={(event) => updateFilter("classroom", event.target.value)}>
              <option value="">All classes</option>
              {classrooms.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.classroom_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Communication type
            <select value={draftFilters.type} onChange={(event) => updateFilter("type", event.target.value)}>
              <option value="">All types</option>
              {types.map((item) => (
                <option key={item} value={item}>
                  {label(item)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Channel
            <select value={draftFilters.channel} onChange={(event) => updateFilter("channel", event.target.value)}>
              {channels.map((item) => (
                <option key={item} value={item}>
                  {label(item)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={draftFilters.status} onChange={(event) => updateFilter("status", event.target.value)}>
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {label(item)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Search
            <input
              value={draftFilters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder="Parent, learner, phone or subject"
            />
          </label>
          <div className={styles.filterActions}>
            <button className={styles.primary} type="button" onClick={applyFilters}>
              Apply
            </button>
            <button className={styles.secondary} type="button" onClick={resetFilters}>
              Clear
            </button>
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Communication history</h2>
            <span>{pagination.total} records</span>
          </div>
          <button className={styles.secondary} type="button" onClick={exportCsv} disabled={!rows.length}>
            Export current page
          </button>
        </div>
        {error ? (
          <div className={styles.error}>{error}</div>
        ) : loading ? (
          <div className={styles.empty}>Loading communication history…</div>
        ) : (
          <CommunicationHistory rows={rows} pagination={pagination} onPage={load} onView={setSelected} />
        )}
      </section>

      {selected && (
        <div className={styles.drawerBackdrop} onClick={() => setSelected(null)}>
          <aside className={styles.drawer} onClick={(event) => event.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <div>
                <h2>{label(selected.communication_type || "Communication")}</h2>
                <p>{selected.subject || selected.learner_name}</p>
              </div>
              <button className={styles.close} type="button" aria-label="Close details" onClick={() => setSelected(null)}>
                ×
              </button>
            </div>
            <dl>
              <dt>Status</dt>
              <dd>{label(selected.status || "")}</dd>
              <dt>Channel</dt>
              <dd>{label(selected.channel || "")}</dd>
              <dt>Classroom</dt>
              <dd>{selected.classroom_name || "School-wide"}</dd>
              <dt>Recipient</dt>
              <dd>
                {selected.recipient_name || selected.learner_name || "General"}
                <br />
                {selected.recipient_phone || selected.recipient_email}
              </dd>
              <dt>Message</dt>
              <dd>{selected.body_preview || "No preview recorded."}</dd>
              <dt>Sent by</dt>
              <dd>{selected.sent_by_name || "DailyBloom"}</dd>
              <dt>Attempts</dt>
              <dd>{selected.attempt_count || 0}</dd>
              {selected.error_message && (
                <>
                  <dt>Failure reason</dt>
                  <dd>{selected.error_message}</dd>
                </>
              )}
            </dl>
          </aside>
        </div>
      )}
    </main>
  );
}
