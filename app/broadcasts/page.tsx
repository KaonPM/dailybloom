"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authenticatedFetch } from "../lib/authenticated-fetch";
import { resolveSchoolContext } from "../lib/school-context";

type Classroom = {
  id: number;
  classroom_name?: string | null;
  age_group?: string | null;
};

type Broadcast = {
  id: number;
  school_id?: number | null;
  title?: string | null;
  message?: string | null;
  recipient_count?: number | null;
  recipient_scope?: "school" | "classroom" | string | null;
  classroom_id?: number | null;
  classroom_name?: string | null;
  status?: "draft" | "sent" | string | null;
  created_at?: string | null;
  created_by_name?: string | null;
};

type BroadcastResponse = {
  broadcasts?: Broadcast[];
  is_practitioner?: boolean;
  assigned_classroom?: Classroom | null;
  classrooms?: Classroom[];
  error?: string;
};

export default function BroadcastsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolParam = searchParams.get("school");
  const today = new Date().toISOString().split("T")[0];

  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [isPractitioner, setIsPractitioner] = useState(false);
  const [assignedClassroom, setAssignedClassroom] = useState<Classroom | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedBroadcast, setSelectedBroadcast] = useState<Broadcast | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [recipientScope, setRecipientScope] = useState<"school" | "classroom">("school");
  const [selectedClassroomId, setSelectedClassroomId] = useState("");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadPage();
    // The initial school context must load once when this page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    await fetchBroadcasts(context.schoolId, true);
    setLoading(false);
  }

  async function fetchBroadcasts(currentSchoolId: number, initialise = false) {
    const query = new URLSearchParams({
      school_id: String(currentSchoolId),
      from_date: fromDate,
      to_date: toDate,
    });
    const response = await authenticatedFetch(`/api/broadcasts?${query.toString()}`);
    const result = (await response.json()) as BroadcastResponse;

    if (!response.ok) {
      alert(result.error || "Could not load broadcasts.");
      return;
    }

    setBroadcasts(result.broadcasts || []);
    setClassrooms(result.classrooms || []);
    setIsPractitioner(Boolean(result.is_practitioner));
    setAssignedClassroom(result.assigned_classroom || null);

    if (initialise && result.is_practitioner) {
      setRecipientScope("classroom");
      setSelectedClassroomId(
        result.assigned_classroom?.id ? String(result.assigned_classroom.id) : ""
      );
    }
  }

  const targetClassroom =
    recipientScope === "classroom"
      ? isPractitioner
        ? assignedClassroom
        : classrooms.find((classroom) => classroom.id === Number(selectedClassroomId)) || null
      : null;

  const targetLabel =
    recipientScope === "school"
      ? "all parents at this school"
      : `${targetClassroom?.classroom_name || "the selected classroom"} parents`;

  async function submitBroadcast(status: "draft" | "sent") {
    if (!schoolId) return;

    if (!title.trim()) {
      alert("Please enter a broadcast title.");
      return;
    }

    if (!message.trim()) {
      alert("Please write the broadcast message.");
      return;
    }

    if (recipientScope === "classroom" && !targetClassroom) {
      alert(
        isPractitioner
          ? "A classroom assignment is needed before you can send a class broadcast."
          : "Please select the classroom that should receive this broadcast."
      );
      return;
    }

    setSaving(true);

    try {
      const response = await authenticatedFetch("/api/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school_id: schoolId,
          title: title.trim(),
          message: message.trim(),
          status,
          recipient_scope: recipientScope,
          classroom_id:
            recipientScope === "classroom" ? targetClassroom?.id || null : null,
        }),
      });
      const result = (await response.json()) as {
        broadcast?: Broadcast;
        recipients?: number;
        error?: string;
      };

      if (!response.ok || !result.broadcast) {
        alert(result.error || "Could not save broadcast.");
        return;
      }

      const savedBroadcast = {
        ...result.broadcast,
        recipient_count: result.recipients ?? result.broadcast.recipient_count ?? 0,
      };

      setSelectedBroadcast(savedBroadcast);
      setTitle("");
      setMessage("");
      setShowCreate(false);
      await fetchBroadcasts(schoolId);
      alert(
        status === "sent"
          ? `Broadcast sent to ${targetLabel}.`
          : "Broadcast saved as a draft."
      );
    } finally {
      setSaving(false);
    }
  }

  async function sendExistingDraft(broadcast: Broadcast) {
    if (!schoolId) return;

    setSaving(true);

    try {
      const response = await authenticatedFetch("/api/broadcasts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ school_id: schoolId, broadcast_id: broadcast.id }),
      });
      const result = (await response.json()) as {
        broadcast?: Broadcast;
        recipients?: number;
        error?: string;
      };

      if (!response.ok || !result.broadcast) {
        alert(result.error || "Could not send broadcast.");
        return;
      }

      setSelectedBroadcast({
        ...result.broadcast,
        recipient_count: result.recipients ?? result.broadcast.recipient_count ?? 0,
      });
      await fetchBroadcasts(schoolId);
      alert("Broadcast sent to parents.");
    } finally {
      setSaving(false);
    }
  }

  async function copyBroadcastMessage() {
    if (!selectedBroadcast?.message) return;

    await navigator.clipboard.writeText(selectedBroadcast.message);
    alert("Broadcast message copied.");
  }

  function openCreate() {
    setShowCreate((current) => !current);
    setSelectedBroadcast(null);
  }

  if (loading) {
    return <p>Loading broadcasts...</p>;
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: 18, marginBottom: 18 }}>
        <div style={headingRow}>
          <div>
            <h2 className="db-page-title">Broadcasts</h2>
            <p className="db-page-subtitle">
              {isPractitioner
                ? "Send parent messages only to your assigned classroom."
                : "Send parent messages to the whole school or one classroom."}
            </p>
          </div>

          <button type="button" className="db-button-primary" onClick={openCreate}>
            {showCreate ? "Close" : "Create Broadcast"}
          </button>
        </div>
      </div>

      {showCreate ? (
        <div className="db-card db-card-blue" style={{ padding: 16, marginBottom: 18 }}>
          <h3 style={sectionTitle}>Create Broadcast</h3>

          {isPractitioner ? (
            assignedClassroom ? (
              <div style={targetNote}>
                <strong>Classroom audience</strong>
                <span>This broadcast will go only to {assignedClassroom.classroom_name} parents.</span>
              </div>
            ) : (
              <div style={warningNote}>
                A classroom assignment is needed before you can create a broadcast. Please ask the principal to assign your class.
              </div>
            )
          ) : (
            <div style={{ marginTop: 12 }}>
              <p style={labelText}>Send to</p>
              <div style={scopeControls}>
                <button
                  type="button"
                  onClick={() => setRecipientScope("school")}
                  style={recipientScope === "school" ? selectedScopeButton : scopeButton}
                >
                  All School Parents
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientScope("classroom")}
                  style={recipientScope === "classroom" ? selectedScopeButton : scopeButton}
                >
                  One Classroom
                </button>
              </div>

              {recipientScope === "classroom" ? (
                <div style={{ marginTop: 12 }}>
                  <p style={labelText}>Classroom</p>
                  <select
                    className="db-input"
                    value={selectedClassroomId}
                    onChange={(event) => setSelectedClassroomId(event.target.value)}
                  >
                    <option value="">Select classroom</option>
                    {classrooms.map((classroom) => (
                      <option key={classroom.id} value={classroom.id}>
                        {classroom.classroom_name || "Unnamed classroom"}
                        {classroom.age_group ? ` - ${classroom.age_group}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <p style={labelText}>Broadcast Title</p>
            <input
              className="db-input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Example: Friday reminder"
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <p style={labelText}>Write Broadcast</p>
            <textarea
              className="db-input"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={5}
              placeholder="Write the message parents should receive..."
              style={{ width: "100%", resize: "vertical" }}
            />
          </div>

          <p style={smallText}>
            Audience: <strong>{targetLabel}</strong>. Sent broadcasts are recorded in communication reporting and shown to the relevant parents.
          </p>

          <div style={actionRow}>
            <button
              type="button"
              onClick={() => void submitBroadcast("draft")}
              disabled={saving || (isPractitioner && !assignedClassroom)}
              style={{ ...saveDraftButton, opacity: saving || (isPractitioner && !assignedClassroom) ? 0.7 : 1 }}
            >
              {saving ? "Saving..." : "Save Draft"}
            </button>
            <button
              type="button"
              onClick={() => void submitBroadcast("sent")}
              disabled={saving || (isPractitioner && !assignedClassroom)}
              style={{ ...sendButton, opacity: saving || (isPractitioner && !assignedClassroom) ? 0.7 : 1 }}
            >
              {saving ? "Sending..." : "Send to Parents"}
            </button>
          </div>
        </div>
      ) : null}

      {selectedBroadcast ? (
        <div className="db-card db-card-green" style={{ padding: 16, marginBottom: 18 }}>
          <div style={headingRow}>
            <div>
              <h3 style={sectionTitle}>{selectedBroadcast.title || "Broadcast"}</h3>
              <p style={smallText}>
                {getAudienceLabel(selectedBroadcast)} - {selectedBroadcast.recipient_count || 0} parent{selectedBroadcast.recipient_count === 1 ? "" : "s"}
              </p>
            </div>
            <span style={selectedBroadcast.status === "draft" ? pillAmber : pillGreen}>
              {selectedBroadcast.status === "draft" ? "Draft" : "Sent"}
            </span>
          </div>

          <div style={messageBox}>{selectedBroadcast.message || "No message saved."}</div>

          <div style={actionRow}>
            <button type="button" className="db-button-secondary" onClick={() => void copyBroadcastMessage()}>
              Copy Message
            </button>
            {selectedBroadcast.status === "draft" ? (
              <button
                type="button"
                onClick={() => void sendExistingDraft(selectedBroadcast)}
                disabled={saving}
                style={{ ...sendButton, opacity: saving ? 0.7 : 1 }}
              >
                {saving ? "Sending..." : "Send to Parents"}
              </button>
            ) : null}
            <button type="button" className="db-button-secondary" onClick={() => setSelectedBroadcast(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      <div className="db-card db-card-yellow" style={{ padding: 16 }}>
        <div style={headingRow}>
          <div>
            <h3 style={sectionTitle}>Broadcast History ({broadcasts.length})</h3>
            <p style={smallText}>Open only when you need to review a sent message or draft.</p>
          </div>
          <button type="button" className="db-button-secondary" onClick={() => setShowHistory((current) => !current)}>
            {showHistory ? "Hide" : "View History"}
          </button>
        </div>

        {showHistory ? (
          <div style={{ marginTop: 12 }}>
            <div style={dateGrid}>
              <div>
                <p style={labelText}>From</p>
                <input type="date" className="db-input" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
              </div>
              <div>
                <p style={labelText}>To</p>
                <input type="date" className="db-input" value={toDate} onChange={(event) => setToDate(event.target.value)} />
              </div>
              <button
                type="button"
                className="db-button-secondary"
                onClick={() => schoolId && void fetchBroadcasts(schoolId)}
              >
                View
              </button>
            </div>

            {broadcasts.length === 0 ? (
              <p className="db-helper">No broadcasts found for this period.</p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {broadcasts.map((broadcast) => (
                  <button
                    key={broadcast.id}
                    type="button"
                    onClick={() => setSelectedBroadcast(broadcast)}
                    style={broadcastButton}
                  >
                    <strong style={{ overflowWrap: "anywhere" }}>{broadcast.title || "Untitled broadcast"}</strong>
                    <span style={broadcast.status === "draft" ? pillAmber : pillGreen}>{broadcast.status === "draft" ? "Draft" : "Sent"}</span>
                    <span style={pillBlue}>{getAudienceLabel(broadcast)}</span>
                    <span style={pillNeutral}>{broadcast.recipient_count || 0} parents</span>
                    <span style={pillNeutral}>{broadcast.created_at ? broadcast.created_at.split("T")[0] : "No date"}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function getAudienceLabel(broadcast: Broadcast) {
  return broadcast.recipient_scope === "classroom"
    ? `${broadcast.classroom_name || "Classroom"} parents`
    : "All school parents";
}

const headingRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap" as const,
};

const sectionTitle = { margin: "0 0 10px", color: "#2D2A3E", fontSize: 20, fontWeight: 700 };
const labelText = { margin: "0 0 8px", color: "#6D6888", fontSize: 13, fontWeight: 800 };
const smallText = { margin: "6px 0 0", color: "#6D6888", fontSize: 13, lineHeight: 1.55 };
const actionRow = { display: "flex", gap: 10, flexWrap: "wrap" as const, marginTop: 14 };
const scopeControls = { display: "flex", gap: 8, flexWrap: "wrap" as const };
const dateGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, alignItems: "end", marginBottom: 12 };
const targetNote = { display: "grid", gap: 3, marginTop: 12, padding: 12, borderRadius: 12, background: "#ECF8EE", color: "#346B3A", border: "1px solid #C8E9CE" };
const warningNote = { marginTop: 12, padding: 12, borderRadius: 12, background: "#FFF3D4", color: "#805B0B", border: "1px solid #F3DE9D", lineHeight: 1.5 };
const messageBox = { marginTop: 12, background: "#FFFDFB", border: "1px solid #F0E3D8", borderRadius: 14, padding: 12, color: "#2D2A3E", lineHeight: 1.6, whiteSpace: "pre-wrap" as const };
const scopeButton = { border: "1px solid #D7E7EF", borderRadius: 999, padding: "9px 13px", background: "#FFFDFB", color: "#2D2A3E", fontWeight: 700, cursor: "pointer" };
const selectedScopeButton = { ...scopeButton, background: "#DDF3FC", borderColor: "#71C6E9" };
const broadcastButton = { width: "100%", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" as const, background: "#FFFDFB", border: "1px solid #F0E3D8", borderRadius: 12, padding: "10px 12px", color: "#2D2A3E", cursor: "pointer", textAlign: "left" as const };
const pillBlue = { background: "#EAF7FD", border: "1px solid #CBEAF7", borderRadius: 999, padding: "4px 10px", fontSize: 12, color: "#2D2A3E" };
const pillNeutral = { background: "#F8F4FF", border: "1px solid #E7DFF8", borderRadius: 999, padding: "4px 10px", fontSize: 12, color: "#2D2A3E" };
const pillGreen = { background: "#DFF4DF", border: "1px solid #BFE6BF", borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 700, color: "#3F7A3F" };
const pillAmber = { background: "#FFF2BF", border: "1px solid #F3E4A3", borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 700, color: "#8A6812" };
const saveDraftButton = { border: "none", borderRadius: 16, background: "#EF9F27", color: "#fff", padding: "12px 18px", fontWeight: 800, cursor: "pointer" };
const sendButton = { border: "none", borderRadius: 16, background: "#34A853", color: "#fff", padding: "12px 18px", fontWeight: 800, cursor: "pointer" };
