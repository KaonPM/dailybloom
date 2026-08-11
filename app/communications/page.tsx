"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { resolveSchoolContext } from "../lib/school-context";
import { authenticatedFetch } from "../lib/authenticated-fetch";

type Learner = {
  id: string;
  name: string;
  parent_phone?: string | null;
  class?: string | null;
};

type CommunicationRow = {
  id: string;
  school_id?: number | null;
  learner_id?: string | null;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  recipient_email?: string | null;
  recipient_count?: number | null;
  channel?: string | null;
  communication_type?: string | null;
  subject?: string | null;
  body_preview?: string | null;
  status?: string | null;
  sent_at?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
  failed_at?: string | null;
  error_message?: string | null;
  created_at?: string | null;
};

const channelOptions = ["All", "Parent Portal", "In App", "Push", "SMS", "WhatsApp", "Email"];
const statusOptions = ["All", "Queued", "Sending", "Sent", "Delivered", "Read", "Retry Scheduled", "Failed", "Skipped"];

export default function CommunicationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolParam = searchParams.get("school");

  const today = new Date().toISOString().split("T")[0];

  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [records, setRecords] = useState<CommunicationRow[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<CommunicationRow | null>(null);

  const [channel, setChannel] = useState("All");
  const [status, setStatus] = useState("All");
  const [learnerName, setLearnerName] = useState("");
  const [phoneSearch, setPhoneSearch] = useState("");
  const [generalSearch, setGeneralSearch] = useState("");

  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);

  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
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
    await fetchLearners(context.schoolId);
    setLoading(false);
  }

  async function fetchLearners(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("learners")
      .select("id, name, parent_phone, class")
      .eq("school_id", currentSchoolId)
      .order("name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setLearners((data || []) as Learner[]);
  }

  async function runCommunicationSearch() {
    if (!schoolId) return;

    if (fromDate > toDate) {
      alert("From date cannot be after To date.");
      return;
    }

    setRunning(true);

    const learner = learners.find((item) => item.name === learnerName);
    const params = new URLSearchParams({ school_id: String(schoolId), from: fromDate, to: toDate });
    if (channel !== "All") params.set("channel", channel.toLowerCase().replace(" ", "_"));
    if (status !== "All") params.set("status", status.toLowerCase().replace(" ", "_"));
    if (learner?.id) params.set("learner_id", learner.id);
    if (generalSearch.trim()) params.set("search", generalSearch.trim());

    const response = await authenticatedFetch(`/api/communications/notification-centre?${params.toString()}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      alert(payload.error || "Could not load communication history.");
      setRunning(false);
      return;
    }
    let rows = (payload.notifications || []) as CommunicationRow[];

    if (phoneSearch.trim()) {
      rows = rows.filter((row) =>
        String(row.recipient_phone || "")
          .toLowerCase()
          .includes(phoneSearch.trim().toLowerCase())
      );
    }

    if (generalSearch.trim()) {
      const term = generalSearch.trim().toLowerCase();

      rows = rows.filter((row) => {
        const combined = [
          row.recipient_name,
          row.recipient_phone,
          row.recipient_email,
          row.channel,
          row.communication_type,
          row.status,
          row.subject,
          row.body_preview,
        ]
          .join(" ")
          .toLowerCase();

        return combined.includes(term);
      });
    }

    setRecords(rows);
    setSelectedRecord(null);
    setRunning(false);
  }

  function exportCsv() {
    if (records.length === 0) {
      alert("No communication records to export.");
      return;
    }

    const headers: (keyof CommunicationRow)[] = [
      "created_at",
      "recipient_name",
      "recipient_phone",
      "recipient_email",
      "channel",
      "communication_type",
      "status",
      "body_preview",
    ];

    const csvRows = [
      headers.join(","),
      ...records.map((row) =>
        headers
          .map((header) => {
            const value = String(row[header] || "");
            return `"${value.replace(/"/g, '""')}"`;
          })
          .join(",")
      ),
    ];

    const blob = new Blob([csvRows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const filename = `communications-${fromDate}-to-${toDate}.csv`;

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  const selectedLearnerPhone = useMemo(() => {
    const learner = learners.find((item) => item.name === learnerName);
    return learner?.parent_phone || "";
  }, [learners, learnerName]);

  if (loading) {
    return <p>Loading communications...</p>;
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: 18, marginBottom: 18 }}>
        <h2 className="db-page-title">Communications</h2>
        <p className="db-page-subtitle">
          Review parent portal, in-app, push, SMS, WhatsApp and email communication in one secure history.
        </p>
      </div>

      <div className="db-card db-card-blue" style={{ padding: 16, marginBottom: 18 }}>
        <h3 style={sectionTitle}>Communication Filters</h3>

        <div style={grid}>
          <div>
            <p style={labelText}>Channel</p>
            <select
              className="db-input"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            >
              {channelOptions.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <p style={labelText}>Status</p>
            <select
              className="db-input"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {statusOptions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>

          <div>
            <p style={labelText}>Learner</p>
            <select
              className="db-input"
              value={learnerName}
              onChange={(e) => setLearnerName(e.target.value)}
            >
              <option value="">All learners</option>
              {learners.map((learner) => (
                <option key={learner.id} value={learner.name}>
                  {learner.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p style={labelText}>Phone</p>
            <input
              className="db-input"
              value={phoneSearch || selectedLearnerPhone}
              onChange={(e) => setPhoneSearch(e.target.value)}
              placeholder="Search phone number"
            />
          </div>

          <div>
            <p style={labelText}>Search</p>
            <input
              className="db-input"
              value={generalSearch}
              onChange={(e) => setGeneralSearch(e.target.value)}
              placeholder="Search message, learner, type..."
            />
          </div>

          <div>
            <p style={labelText}>From</p>
            <input
              type="date"
              className="db-input"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div>
            <p style={labelText}>To</p>
            <input
              type="date"
              className="db-input"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <button
            type="button"
            className="db-button-primary"
            onClick={runCommunicationSearch}
            disabled={running}
          >
            {running ? "Loading..." : "View Communication History"}
          </button>

          <button type="button" className="db-button-secondary" onClick={exportCsv}>
            Export CSV
          </button>
        </div>
      </div>

      {selectedRecord ? (
        <div className="db-card db-card-yellow" style={{ padding: 16, marginBottom: 18 }}>
          <h3 style={sectionTitle}>Communication Details</h3>

          <p style={smallText}>Recipient: {selectedRecord.recipient_name || "Not linked"}</p>
          <p style={smallText}>Phone: {selectedRecord.recipient_phone || "Not added"}</p>
          <p style={smallText}>Email: {selectedRecord.recipient_email || "Not added"}</p>
          <p style={smallText}>Channel: {selectedRecord.channel || "Not added"}</p>
          <p style={smallText}>
            Type: {selectedRecord.communication_type || "Not added"}
          </p>
          <p style={smallText}>Status: {selectedRecord.status || "Not added"}</p>
          <p style={smallText}>Date: {selectedRecord.sent_at || selectedRecord.created_at || "No date"}</p>

          <div style={messageBox}>
            {selectedRecord.body_preview || "No message preview saved."}
          </div>

          <button
            type="button"
            className="db-button-secondary"
            onClick={() => setSelectedRecord(null)}
            style={{ marginTop: 12 }}
          >
            Close Details
          </button>
        </div>
      ) : null}

      <div className="db-card db-card-green" style={{ padding: 16 }}>
        <h3 style={sectionTitle}>Communication History ({records.length})</h3>

        {records.length === 0 ? (
          <p className="db-helper">
            No communication history loaded. Use the filters above and click View.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {records.map((record) => (
              <button
                key={record.id}
                type="button"
                onClick={() => setSelectedRecord(record)}
                style={recordButton}
              >
                <span style={pillBlue}>{String(record.sent_at || record.created_at || "No date").slice(0, 10)}</span>

                <strong>{record.recipient_name || "General"}</strong>

                <span style={pillNeutral}>
                  {record.channel || "Message"}
                </span>

                <span style={pillStatus}>{record.status || "Saved"}</span>
              </button>
            ))}
          </div>
        )}
      </div>
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
  margin: "4px 0 0 0",
  color: "#6D6888",
  fontSize: 13,
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
};

const recordButton = {
  width: "100%",
  display: "grid",
  gridTemplateColumns: "120px 1fr 150px 100px",
  gap: 8,
  alignItems: "center",
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: 12,
  padding: "10px 12px",
  color: "#2D2A3E",
  cursor: "pointer",
  textAlign: "left" as const,
};

const pillBlue = {
  background: "#EAF7FD",
  border: "1px solid #CBEAF7",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 12,
  color: "#2D2A3E",
  textAlign: "center" as const,
};

const pillNeutral = {
  background: "#F8F4FF",
  border: "1px solid #E7DFF8",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 12,
  color: "#2D2A3E",
  textAlign: "center" as const,
};

const pillStatus = {
  background: "#EAF8EE",
  border: "1px solid #CDEED8",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 12,
  color: "#2D2A3E",
  textAlign: "center" as const,
};

const messageBox = {
  marginTop: 10,
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: 12,
  padding: 12,
  color: "#2D2A3E",
  fontSize: 14,
  lineHeight: 1.6,
};
