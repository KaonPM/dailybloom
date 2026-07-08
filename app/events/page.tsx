"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { resolveSchoolContext } from "../lib/school-context";

type EventRow = {
  id: number;
  school_id?: number | null;
  title?: string | null;
  event_date?: string | null;
  description?: string | null;
  created_at?: string | null;
};

export default function EventsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolParam = searchParams.get("school");

  const today = new Date().toISOString().split("T")[0];

  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventRow | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [eventDate, setEventDate] = useState(today);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

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
    await fetchEvents(context.schoolId);
    setLoading(false);
  }

  async function fetchEvents(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("school_id", currentSchoolId)
      .gte("event_date", today)
      .order("event_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setEvents((data || []) as EventRow[]);
  }

  function resetForm() {
    setEventDate(today);
    setTitle("");
    setDescription("");
    setEditingId(null);
  }

  function startEdit(event: EventRow) {
    setEditingId(event.id);
    setEventDate(event.event_date || today);
    setTitle(event.title || "");
    setDescription(event.description || "");
    setSelectedEvent(event);
    setShowForm(true);
  }

  async function saveEvent() {
    if (!schoolId) return;

    if (!eventDate || !title.trim()) {
      alert("Please complete event date and event title.");
      return;
    }

    setSaving(true);

    if (editingId) {
      const { error } = await supabase
        .from("events")
        .update({
          event_date: eventDate,
          title: title.trim(),
          description: description.trim() || null,
        })
        .eq("id", editingId);

      if (error) {
        alert(error.message);
        setSaving(false);
        return;
      }

      resetForm();
      setShowForm(false);
      await fetchEvents(schoolId);

      setSaving(false);
      alert("School event updated.");
      return;
    }

    const { error } = await supabase.from("events").insert([
      {
        school_id: schoolId,
        event_date: eventDate,
        title: title.trim(),
        description: description.trim() || null,
      },
    ]);

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    resetForm();
    setShowForm(false);
    await fetchEvents(schoolId);

    setSaving(false);
    alert("School event published to the Parent Portal.");
  }

  async function deleteEvent(eventId: number) {
    const confirmed = confirm("Delete this school event?");
    if (!confirmed) return;

    const { error } = await supabase.from("events").delete().eq("id", eventId);

    if (error) {
      alert(error.message);
      return;
    }

    if (selectedEvent?.id === eventId) {
      setSelectedEvent(null);
    }

    if (schoolId) {
      await fetchEvents(schoolId);
    }

    alert("School event deleted.");
  }

  if (loading) {
    return <p>Loading events...</p>;
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
            <h2 className="db-page-title">Events</h2>
            <p className="db-page-subtitle">
              Create and manage upcoming school events for parents.
            </p>

            {schoolParam && schoolId ? (
              <Link href={`/master/school/${schoolId}`} style={backButton}>
                Back to School Overview
              </Link>
            ) : null}
          </div>

          <button
            type="button"
            className="db-button-primary"
            onClick={() => {
              resetForm();
              setShowForm((prev) => !prev);
            }}
          >
            {showForm ? "Close" : "Create School Event"}
          </button>
        </div>
      </div>

      {showForm ? (
        <div
          className="db-card db-card-blue"
          style={{ padding: 16, marginBottom: 18 }}
        >
          <h3 style={sectionTitle}>{editingId ? "Edit School Event" : "Create School Event"}</h3>

          <div style={grid2}>
            <div>
              <p style={labelText}>Date</p>
              <input
                type="date"
                className="db-input"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>

            <div>
              <p style={labelText}>Event Title</p>
              <input
                className="db-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Sports Day, Pyjama Day, Parent Meeting..."
              />
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <p style={labelText}>Short Description Optional</p>
            <textarea
              className="db-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a short note about the event..."
              style={{ minHeight: 90, resize: "vertical" }}
            />
          </div>

          <button
            type="button"
            className="db-button-primary"
            style={{ width: "100%", marginTop: 12 }}
            onClick={saveEvent}
            disabled={saving}
          >
            {saving ? "Saving..." : editingId ? "Update School Event" : "Publish School Event"}
          </button>
        </div>
      ) : null}

      <div className="db-card db-card-green" style={{ padding: 16 }}>
        <h3 style={sectionTitle}>Upcoming School Events ({events.length})</h3>

        {events.length === 0 ? (
          <p className="db-helper">No upcoming events added yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {events.map((event) => {
              const active = selectedEvent?.id === event.id;

              return (
                <div key={event.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedEvent(active ? null : event)}
                    style={{
                      width: "100%",
                      display: "grid",
                      gridTemplateColumns: "160px 1fr",
                      gap: 8,
                      alignItems: "center",
                      background: active ? "#EAF7FD" : "#FFFDFB",
                      border: active
                        ? "1px solid #CBEAF7"
                        : "1px solid #F0E3D8",
                      borderRadius: 12,
                      padding: "10px 12px",
                      color: "#2D2A3E",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={pillBlue}>
                      {event.event_date || "No date"}
                    </span>

                    <strong>{event.title || "Untitled event"}</strong>
                  </button>

                  {active ? (
                    <div
                      style={{
                        background: "#FFFDFB",
                        border: "1px solid #F0E3D8",
                        borderRadius: 12,
                        padding: 12,
                        marginTop: 8,
                      }}
                    >
                      <p style={smallText}>
                        Date: {event.event_date || "Not added"}
                      </p>

                      <p style={smallText}>
                        Description: {event.description || "No description added"}
                      </p>

                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          flexWrap: "wrap",
                          marginTop: 12,
                        }}
                      >
                        <button
                          type="button"
                          className="db-button-secondary"
                          onClick={() => startEdit(event)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="db-button-secondary"
                          onClick={() => deleteEvent(event.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
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

const grid2 = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
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

const backButton = {
  display: "inline-block",
  marginTop: 12,
  textDecoration: "none",
  background: "#FFFFFF",
  color: "#2D2A3E",
  border: "1px solid #E3D9CD",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 700,
  fontSize: 13,
};