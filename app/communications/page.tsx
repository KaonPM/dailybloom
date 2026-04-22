"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { resolveSchoolContext } from "../lib/school-context";

type CommunicationLogItem = {
  id: number;
  school_id: number;
  learner_name?: string | null;
  parent_phone?: string | null;
  communication_type?: string | null;
  channel?: string | null;
  message_preview?: string | null;
  sent_by_user_id?: string | null;
  sent_at?: string | null;
  status?: string | null;
};

export default function CommunicationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const schoolParam = searchParams.get("school");

  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [logs, setLogs] = useState<CommunicationLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [typeFilter, setTypeFilter] = useState("");
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    const context = await resolveSchoolContext(schoolParam);

    if (context.error || !context.schoolId) {
      router.push("/login");
      return;
    }

    setSchoolId(context.schoolId);
    await fetchLogs(context.schoolId);
    setLoading(false);
  }

  async function fetchLogs(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("communication_logs")
      .select("*")
      .eq("school_id", currentSchoolId)
      .order("sent_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setLogs((data || []) as CommunicationLogItem[]);
  }

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesType = typeFilter
        ? String(log.communication_type || "").toLowerCase() === typeFilter.toLowerCase()
        : true;

      const haystack = [
        log.learner_name || "",
        log.parent_phone || "",
        log.communication_type || "",
        log.message_preview || "",
        log.status || "",
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = searchText
        ? haystack.includes(searchText.trim().toLowerCase())
        : true;

      return matchesType && matchesSearch;
    });
  }, [logs, typeFilter, searchText]);

  if (loading) {
    return <p>Loading communication tracking...</p>;
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: "20px 22px", marginBottom: "24px" }}>
        <h2 className="db-page-title">Parent Communication Tracking</h2>
        <p className="db-page-subtitle">
          View summary sends and payment reminders sent to parents over time.
        </p>
      </div>

      <div className="db-card db-card-blue" style={{ padding: "20px", marginBottom: "24px" }}>
        <h3 style={sectionTitle}>Filters</h3>

        <select
          className="db-input"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All Communication Types</option>
          <option value="summary">Summary</option>
          <option value="payment_reminder">Payment Reminder</option>
          <option value="broadcast">Broadcast</option>
        </select>

        <input
          className="db-input"
          placeholder="Search learner, phone, message, or status"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      </div>

      <div className="db-card db-card-lavender" style={{ padding: "20px" }}>
        <h3 style={sectionTitle}>Communication History ({filteredLogs.length})</h3>

        {filteredLogs.length === 0 ? (
          <p className="db-helper">No communication logs found.</p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {filteredLogs.map((log) => (
              <div key={log.id} className="db-list-card">
                <strong style={{ fontSize: "17px" }}>
                  {log.learner_name || "No learner name"}
                </strong>

                <p style={textStyle}>
                  Type: {log.communication_type || "Not set"}
                </p>

                <p style={textStyle}>
                  Channel: {log.channel || "Not set"}
                </p>

                <p style={textStyle}>
                  Parent Phone: {log.parent_phone || "Not added"}
                </p>

                <p style={textStyle}>
                  Status: {log.status || "Not set"}
                </p>

                <p style={textStyle}>
                  Message Preview: {log.message_preview || "No message preview"}
                </p>

                <p style={metaTextStyle}>
                  {log.sent_at
                    ? new Date(log.sent_at).toLocaleString()
                    : "No timestamp"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const sectionTitle = {
  marginTop: 0,
  marginBottom: "14px",
  color: "var(--db-text)",
  fontSize: "22px",
  fontWeight: 800 as const,
};

const textStyle = {
  margin: "6px 0 0 0",
  color: "var(--db-text-soft)",
  lineHeight: 1.6,
};

const metaTextStyle = {
  margin: "10px 0 0 0",
  color: "#8A84A3",
  fontSize: "12px",
};