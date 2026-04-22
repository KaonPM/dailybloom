"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { resolveSchoolContext } from "../lib/school-context";

type BroadcastItem = {
  id: number;
  title?: string | null;
  message?: string | null;
  school_id?: number | null;
  created_at?: string | null;
};

export default function BroadcastsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([]);
  const [schoolId, setSchoolId] = useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [showCreateForm, setShowCreateForm] = useState(true);
  const [highlightCreateForm, setHighlightCreateForm] = useState(false);
  const [lastSavedSuccess, setLastSavedSuccess] = useState(false);

  const formRef = useRef<HTMLDivElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const action = searchParams.get("action");
  const schoolParam = searchParams.get("school");
  const returnTo = searchParams.get("returnTo");

  const shouldShowBackToOverview =
    returnTo === "school-overview" && schoolId !== null;
  const shouldShowBackToDashboard = returnTo === "dashboard";

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    if (action === "create") {
      setShowCreateForm(true);
      setHighlightCreateForm(true);

      const timer = window.setTimeout(() => {
        formRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });

        window.setTimeout(() => {
          titleInputRef.current?.focus();

          const params = new URLSearchParams(searchParams.toString());
          params.delete("action");

          const nextQuery = params.toString();
          router.replace(nextQuery ? `/broadcasts?${nextQuery}` : "/broadcasts", { scroll: false });
        }, 350);
      }, 250);

      return () => window.clearTimeout(timer);
    }
  }, [action, router, searchParams]);

  useEffect(() => {
    if (!highlightCreateForm) return;

    const timer = window.setTimeout(() => {
      setHighlightCreateForm(false);
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [highlightCreateForm]);

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
    await fetchBroadcasts(context.schoolId);
  }

  async function fetchBroadcasts(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("broadcasts")
      .select("*")
      .eq("school_id", currentSchoolId)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setBroadcasts((data || []) as BroadcastItem[]);
  }

  async function createBroadcast() {
    if (!title.trim() || !message.trim() || !schoolId) {
      alert("Please complete broadcast title and message");
      return;
    }

    setLoading(true);
    setLastSavedSuccess(false);

    const { error } = await supabase.from("broadcasts").insert([
      {
        title: title.trim(),
        message: message.trim(),
        school_id: Number(schoolId),
      },
    ]);

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setTitle("");
    setMessage("");

    await fetchBroadcasts(Number(schoolId));
    setLoading(false);
    setLastSavedSuccess(true);
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: "20px 22px", marginBottom: "24px" }}>
        <h2 className="db-page-title">Broadcasts</h2>
        <p className="db-page-subtitle">
          Create and manage parent broadcasts for this school.
        </p>
      </div>

      <div
        ref={formRef}
        className="db-card db-card-lavender"
        style={{
          padding: "20px",
          marginBottom: "24px",
          border: highlightCreateForm ? "2px solid #7CCCF3" : "1px solid rgba(0,0,0,0.06)",
          boxShadow: highlightCreateForm
            ? "0 0 0 4px rgba(124, 204, 243, 0.18)"
            : undefined,
          transition: "all 0.2s ease",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
            marginBottom: "14px",
          }}
        >
          <h3 style={sectionTitle}>Create Broadcast</h3>

          <button
            type="button"
            className="db-button-secondary"
            style={{ minHeight: "38px", padding: "8px 12px" }}
            onClick={() => setShowCreateForm((prev) => !prev)}
          >
            {showCreateForm ? "Hide Form" : "Show Form"}
          </button>
        </div>

        {lastSavedSuccess && (
          <div
            style={{
              background: "#EEF9EE",
              border: "1px solid #D3EDD4",
              borderRadius: "14px",
              padding: "12px 14px",
              marginBottom: "14px",
            }}
          >
            <p
              style={{
                margin: 0,
                color: "#2D2A3E",
                fontSize: "14px",
                fontWeight: 700,
              }}
            >
              Broadcast created successfully.
            </p>

            {shouldShowBackToOverview && (
              <button
                type="button"
                className="db-button-primary"
                style={{ marginTop: "10px" }}
                onClick={() => router.push(`/master/school/${schoolId}`)}
              >
                Back to School Overview
              </button>
            )}

            {shouldShowBackToDashboard && (
              <button
                type="button"
                className="db-button-primary"
                style={{ marginTop: "10px" }}
                onClick={() => router.push("/dashboard")}
              >
                Back to Dashboard
              </button>
            )}
          </div>
        )}

        {showCreateForm ? (
          <>
            <input
              ref={titleInputRef}
              className="db-input"
              placeholder="Broadcast Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <textarea
              className="db-input"
              placeholder="Write your broadcast message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              style={textAreaStyle}
            />

            <button
              className="db-button-primary"
              style={{ width: "100%" }}
              onClick={createBroadcast}
              disabled={loading}
            >
              {loading ? "Saving..." : "Create Broadcast"}
            </button>
          </>
        ) : (
          <p className="db-helper">The create broadcast form is hidden.</p>
        )}
      </div>

      <div className="db-card db-card-yellow" style={{ padding: "20px" }}>
        <h3 style={sectionTitle}>Broadcast History ({broadcasts.length})</h3>

        {broadcasts.length === 0 ? (
          <p className="db-helper">No broadcasts created yet.</p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {broadcasts.map((broadcast) => (
              <div key={broadcast.id} className="db-list-card">
                <strong style={{ fontSize: "17px" }}>
                  {broadcast.title || "Untitled broadcast"}
                </strong>
                <p style={textStyle}>
                  {broadcast.message || "No message"}
                </p>
                <p style={metaTextStyle}>
                  {broadcast.created_at
                    ? new Date(broadcast.created_at).toLocaleString()
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
  margin: "8px 0 0 0",
  color: "var(--db-text-soft)",
  lineHeight: 1.6,
};

const metaTextStyle = {
  margin: "10px 0 0 0",
  color: "#8A84A3",
  fontSize: "12px",
};

const textAreaStyle = {
  width: "100%",
  minHeight: "120px",
  resize: "vertical" as const,
  borderRadius: "14px",
  border: "1px solid #E5D7CB",
  padding: "12px 14px",
  fontSize: "14px",
  color: "#2D2A3E",
  background: "#FFFFFF",
  marginBottom: "12px",
  outline: "none",
  boxSizing: "border-box" as const,
};