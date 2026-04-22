"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { resolveSchoolContext } from "../lib/school-context";

type EventItem = {
  id: number;
  title?: string | null;
  event_date?: string | null;
  school_id?: number | null;
  created_at?: string | null;
};

export default function EventsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<EventItem[]>([]);
  const [schoolId, setSchoolId] = useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [loading, setLoading] = useState(false);

  const [showAddForm, setShowAddForm] = useState(true);
  const [highlightAddForm, setHighlightAddForm] = useState(false);
  const [lastSavedSuccess, setLastSavedSuccess] = useState(false);

  const formRef = useRef<HTMLDivElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const action = searchParams.get("action");
  const schoolParam = searchParams.get("school");
  const activeFilter = searchParams.get("filter");
  const returnTo = searchParams.get("returnTo");

  const shouldShowBackToOverview =
    returnTo === "school-overview" && schoolId !== null;
  const shouldShowBackToDashboard = returnTo === "dashboard";

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    applyFilter();
  }, [events, activeFilter]);

  useEffect(() => {
    if (action === "add") {
      setShowAddForm(true);
      setHighlightAddForm(true);

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
          router.replace(nextQuery ? `/events?${nextQuery}` : "/events", { scroll: false });
        }, 350);
      }, 250);

      return () => window.clearTimeout(timer);
    }
  }, [action, router, searchParams]);

  useEffect(() => {
    if (!highlightAddForm) return;

    const timer = window.setTimeout(() => {
      setHighlightAddForm(false);
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [highlightAddForm]);

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
    await fetchEvents(context.schoolId);
  }

  async function fetchEvents(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("school_id", currentSchoolId)
      .order("event_date", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setEvents((data || []) as EventItem[]);
  }

  function applyFilter() {
    if (activeFilter === "today") {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      const todayDate = `${yyyy}-${mm}-${dd}`;

      const todaysEvents = events.filter((event) => event.event_date === todayDate);
      setFilteredEvents(todaysEvents);
      return;
    }

    setFilteredEvents(events);
  }

  async function addEvent() {
    if (!title.trim() || !eventDate || !schoolId) {
      alert("Please complete event title and date");
      return;
    }

    setLoading(true);
    setLastSavedSuccess(false);

    const { error } = await supabase.from("events").insert([
      {
        title: title.trim(),
        event_date: eventDate,
        school_id: Number(schoolId),
      },
    ]);

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setTitle("");
    setEventDate("");

    await fetchEvents(Number(schoolId));
    setLoading(false);
    setLastSavedSuccess(true);
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: "20px 22px", marginBottom: "24px" }}>
        <h2 className="db-page-title">
          {activeFilter === "today" ? "Today’s Events" : "Events"}
        </h2>
        <p className="db-page-subtitle">
          {activeFilter === "today"
            ? "Events happening today for this school."
            : "Add and manage events for this school."}
        </p>
      </div>

      <div
        ref={formRef}
        className="db-card db-card-yellow"
        style={{
          padding: "20px",
          marginBottom: "24px",
          border: highlightAddForm ? "2px solid #7CCCF3" : "1px solid rgba(0,0,0,0.06)",
          boxShadow: highlightAddForm
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
          <h3 style={sectionTitle}>Add Event</h3>

          <button
            type="button"
            className="db-button-secondary"
            style={{ minHeight: "38px", padding: "8px 12px" }}
            onClick={() => setShowAddForm((prev) => !prev)}
          >
            {showAddForm ? "Hide Form" : "Show Form"}
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
              Event added successfully.
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

        {showAddForm ? (
          <>
            <input
              ref={titleInputRef}
              className="db-input"
              placeholder="Event Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <input
              className="db-input"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />

            <button
              className="db-button-primary"
              style={{ width: "100%" }}
              onClick={addEvent}
              disabled={loading}
            >
              {loading ? "Saving..." : "Add Event"}
            </button>
          </>
        ) : (
          <p className="db-helper">The add event form is hidden.</p>
        )}
      </div>

      <div className="db-card db-card-lavender" style={{ padding: "20px" }}>
        <h3 style={sectionTitle}>
          {activeFilter === "today"
            ? `Today’s Events (${filteredEvents.length})`
            : `Events (${filteredEvents.length})`}
        </h3>

        {filteredEvents.length === 0 ? (
          <p className="db-helper">
            {activeFilter === "today"
              ? "No events today."
              : "No events added yet."}
          </p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {filteredEvents.map((event) => (
              <div key={event.id} className="db-list-card">
                <strong style={{ fontSize: "17px" }}>
                  {event.title || "Untitled event"}
                </strong>
                <p style={textStyle}>
                  Date: {event.event_date || "Not set"}
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
};