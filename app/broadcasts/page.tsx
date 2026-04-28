"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { resolveSchoolContext } from "../lib/school-context";

type Learner = {
  id: number;
  name?: string | null;
  parent_phone?: string | null;
};

type Broadcast = {
  id: number;
  school_id?: number | null;
  title?: string | null;
  message?: string | null;
  recipient_count?: number | null;
  created_at?: string | null;
};

export default function BroadcastsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolParam = searchParams.get("school");

  const today = new Date().toISOString().split("T")[0];

  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedBroadcast, setSelectedBroadcast] = useState<Broadcast | null>(null);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

    await Promise.all([
      fetchLearners(context.schoolId),
      fetchBroadcasts(context.schoolId),
    ]);

    setLoading(false);
  }

  async function fetchLearners(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("learners")
      .select("id, name, parent_phone")
      .eq("school_id", currentSchoolId)
      .order("name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setLearners((data || []) as Learner[]);
  }

  async function fetchBroadcasts(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("broadcasts")
      .select("id, school_id, title, message, recipient_count, created_at")
      .eq("school_id", currentSchoolId)
      .gte("created_at", `${fromDate} 00:00:00`)
      .lte("created_at", `${toDate} 23:59:59`)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setBroadcasts((data || []) as Broadcast[]);
  }

  const parentsWithPhones = learners.filter((learner) =>
    String(learner.parent_phone || "").trim()
  );

  async function createBroadcast() {
    if (!schoolId) return;

    if (!title.trim()) {
      alert("Please enter broadcast title.");
      return;
    }

    if (!message.trim()) {
      alert("Please write the broadcast message.");
      return;
    }

    if (parentsWithPhones.length === 0) {
      alert("No parent phone numbers found.");
      return;
    }

    setSaving(true);

    const { data: broadcastData, error: broadcastError } = await supabase
      .from("broadcasts")
      .insert([
        {
          school_id: schoolId,
          title: title.trim(),
          message: message.trim(),
          recipient_count: parentsWithPhones.length,
        },
      ])
      .select()
      .single();

    if (broadcastError) {
      alert(broadcastError.message);
      setSaving(false);
      return;
    }

    const communicationRows = parentsWithPhones.map((learner) => ({
      school_id: schoolId,
      learner_name: learner.name || null,
      parent_phone: learner.parent_phone || null,
      communication_type: "Broadcast",
      message: message.trim(),
      status: "Pending WhatsApp",
      sent_date: today,
    }));

    await supabase.from("communications").insert(communicationRows);

    setTitle("");
    setMessage("");
    setShowCreate(false);
    setSelectedBroadcast(broadcastData as Broadcast);

    await fetchBroadcasts(schoolId);

    setSaving(false);
    alert("Broadcast created and added to communication tracking.");
  }

  function copyBroadcastMessage() {
    if (!selectedBroadcast?.message) return;

    navigator.clipboard.writeText(selectedBroadcast.message);
    alert("Broadcast message copied.");
  }

  if (loading) {
    return <p>Loading broadcasts...</p>;
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: 18, marginBottom: 18 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 className="db-page-title">Broadcasts</h2>
            <p className="db-page-subtitle">
              Create parent broadcasts and prepare WhatsApp communication records.
            </p>
          </div>

          <button
            type="button"
            className="db-button-primary"
            onClick={() => setShowCreate((prev) => !prev)}
          >
            {showCreate ? "Close" : "Create Broadcast"}
          </button>
        </div>
      </div>

      {showCreate ? (
        <div className="db-card db-card-blue" style={{ padding: 16, marginBottom: 18 }}>
          <h3 style={sectionTitle}>Create Broadcast</h3>

          <p style={smallText}>
            Parents with phone numbers: {parentsWithPhones.length}
          </p>

          <div style={{ marginTop: 12 }}>
            <p style={labelText}>Broadcast Title</p>
            <input
              className="db-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Example: Friday Reminder"
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <p style={labelText}>Write Broadcast</p>
            <textarea
              className="db-input"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="Write the message parents should receive..."
              style={{ width: "100%", resize: "vertical" }}
            />
          </div>

          <button
            type="button"
            className="db-button-primary"
            onClick={createBroadcast}
            disabled={saving}
            style={{ width: "100%", marginTop: 12 }}
          >
            {saving ? "Creating..." : "Create Broadcast"}
          </button>

          <p style={smallText}>
            WhatsApp API sending will be connected later. For now, this saves the
            broadcast and creates communication tracking records.
          </p>
        </div>
      ) : null}

      {selectedBroadcast ? (
        <div className="db-card db-card-green" style={{ padding: 16, marginBottom: 18 }}>
          <h3 style={sectionTitle}>{selectedBroadcast.title || "Broadcast"}</h3>

          <p style={smallText}>
            Recipients: {selectedBroadcast.recipient_count || 0}
          </p>

          <div style={messageBox}>
            {selectedBroadcast.message || "No message saved."}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <button
              type="button"
              className="db-button-secondary"
              onClick={copyBroadcastMessage}
            >
              Copy WhatsApp Message
            </button>

            <button
              type="button"
              className="db-button-secondary"
              onClick={() => setSelectedBroadcast(null)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      <div className="db-card db-card-yellow" style={{ padding: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h3 style={sectionTitle}>Broadcast History ({broadcasts.length})</h3>
            <p style={smallText}>Open only when you need to review broadcasts.</p>
          </div>

          <button
            type="button"
            className="db-button-secondary"
            onClick={() => setShowHistory((prev) => !prev)}
          >
            {showHistory ? "Hide" : "View History"}
          </button>
        </div>

        {showHistory ? (
          <div style={{ marginTop: 12 }}>
            <div style={dateGrid}>
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

              <button
                type="button"
                className="db-button-secondary"
                onClick={() => {
                  if (schoolId) fetchBroadcasts(schoolId);
                }}
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
                    <strong>{broadcast.title || "Untitled broadcast"}</strong>

                    <span style={pillBlue}>
                      {broadcast.recipient_count || 0} parents
                    </span>

                    <span style={pillNeutral}>
                      {broadcast.created_at
                        ? broadcast.created_at.split("T")[0]
                        : "No date"}
                    </span>
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

const dateGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
  alignItems: "end",
  marginBottom: 12,
};

const messageBox = {
  marginTop: 12,
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: 14,
  padding: 12,
  color: "#2D2A3E",
  lineHeight: 1.6,
};

const broadcastButton = {
  width: "100%",
  display: "grid",
  gridTemplateColumns: "1fr 120px 120px",
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