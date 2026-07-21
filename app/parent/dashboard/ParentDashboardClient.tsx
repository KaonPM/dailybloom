"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";

type PersonRelation = {
  full_name?: string | null;
  name?: string | null;
};

type ClassroomRelation = {
  id?: number | null;
  classroom_name?: string | null;
  teacher_name?: string | null;
  age_group?: string | null;
  teacher?: PersonRelation | null;
  teachers?: PersonRelation | null;
  profiles?: PersonRelation | null;
};

type SchoolRelation = {
  id?: number | null;
  school_name?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
};

type Child = {
  id: string | number;
  name?: string | null;
  school_id?: number | null;
  classroom_id?: number | null;
  parent_name?: string | null;
  parent_phone?: string | null;
  date_of_birth?: string | null;
  classrooms?: ClassroomRelation | ClassroomRelation[] | null;
  schools?: SchoolRelation | SchoolRelation[] | null;
};

type SummaryRow = {
  id: number;
  learner_id?: string | null;
  learner_name?: string | null;
  mood?: string | null;
  meals?: string | null;
  rest?: string | null;
  health_safety?: string | null;
  today_highlight?: string | null;
  teacher_notes?: string | null;
  created_at?: string | null;
};

type AttendanceRow = {
  id: number;
  learner_id?: string | null;
  learner_name?: string | null;
  status?: string | null;
  absence_reason?: string | null;
  attendance_date?: string | null;
  created_at?: string | null;
};

type BroadcastRow = {
  id: number;
  school_id?: number | null;
  title?: string | null;
  message?: string | null;
  audience?: string | null;
  recipient_count?: number | null;
  created_at?: string | null;
};

type EventRow = {
  id: number;
  school_id?: number | null;
  title?: string | null;
  event_date?: string | null;
  description?: string | null;
  created_at?: string | null;
};

type MessageRow = {
  id: number;
  school_id?: number | null;
  learner_id?: string | null;
  sender_id?: string | null;
  sender_name?: string | null;
  recipient_id?: string | null;
  recipient_role?: string | null;
  message?: string | null;
  is_read?: boolean | null;
  created_at?: string | null;
};

type IncidentRow = {
  id: number;
  learner_id?: string | null;
  incident_type?: string | null;
  incident_date?: string | null;
  parent_portal_published_at?: string | null;
  parent_acknowledged_at?: string | null;
};

type ParentContext = {
  phone?: string | null;
  name?: string | null;
};

const PAGE_SIZE = 5;

export default function ParentDashboardClient({
  learners,
  parent,
}: {
  learners: Child[];
  parent: ParentContext;
}) {
  const children = learners;
  const [selectedChildId, setSelectedChildId] = useState(
    String(children[0]?.id || "")
  );

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [openSection, setOpenSection] = useState("");
  const [seenUpdateTypes, setSeenUpdateTypes] = useState<Record<string, boolean>>({});
  const [summaryRange, setSummaryRange] = useState("Today");
  const [broadcastRange, setBroadcastRange] = useState("Today");
  const [attendanceRange, setAttendanceRange] = useState("Today");
  const [eventRange, setEventRange] = useState("Today");

  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaries, setSummaries] = useState<SummaryRow[]>([]);
  const [summaryPage, setSummaryPage] = useState(0);
  const [hasMoreSummaries, setHasMoreSummaries] = useState(false);

  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [attendancePage, setAttendancePage] = useState(0);
  const [hasMoreAttendance, setHasMoreAttendance] = useState(false);

  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [broadcastRows, setBroadcastRows] = useState<BroadcastRow[]>([]);
  const [broadcastPage, setBroadcastPage] = useState(0);
  const [hasMoreBroadcasts, setHasMoreBroadcasts] = useState(false);

  const [eventLoading, setEventLoading] = useState(false);
  const [eventRows, setEventRows] = useState<EventRow[]>([]);
  const [eventPage, setEventPage] = useState(0);
  const [hasMoreEvents, setHasMoreEvents] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const [dashboardMessages, setDashboardMessages] = useState<MessageRow[]>([]);
  const [incidentLoading, setIncidentLoading] = useState(false);
  const [incidentReports, setIncidentReports] = useState<IncidentRow[]>([]);

  const child =
    children.find((item) => String(item.id) === selectedChildId) ||
    children[0]!;

  const school = Array.isArray(child.schools)
    ? child.schools[0]
    : child.schools;

  const classroom = Array.isArray(child.classrooms)
    ? child.classrooms[0]
    : child.classrooms;

  useEffect(() => {
    fetchSummaries();
  }, [selectedChildId, summaryRange, summaryPage]);

  useEffect(() => {
    fetchAttendanceRecords();
  }, [selectedChildId, attendanceRange, attendancePage]);

  useEffect(() => {
    fetchBroadcasts();
  }, [selectedChildId, broadcastRange, broadcastPage]);

  useEffect(() => {
    fetchEvents();
  }, [selectedChildId, eventRange, eventPage]);

  useEffect(() => {
    function refreshParentUpdates() {
      if (document.visibilityState === "visible") {
        fetchSummaries();
        fetchBroadcasts();
        fetchMessageSummary();
        fetchIncidentSummary();
      }
    }

    document.addEventListener("visibilitychange", refreshParentUpdates);
    window.addEventListener("focus", refreshParentUpdates);

    return () => {
      document.removeEventListener("visibilitychange", refreshParentUpdates);
      window.removeEventListener("focus", refreshParentUpdates);
    };
  }, [
    selectedChildId,
    school?.id,
    parent?.phone,
    summaryRange,
    summaryPage,
    broadcastRange,
    broadcastPage,
  ]);

  const getTeacherName = (classroom: ClassroomRelation | null | undefined) => {
    if (!classroom) return "Not assigned";

    if (classroom.teacher_name) return classroom.teacher_name;
    if (classroom.teacher?.full_name) return classroom.teacher.full_name;
    if (classroom.teachers?.full_name) return classroom.teachers.full_name;
    if (classroom.profiles?.full_name) return classroom.profiles.full_name;
    if (classroom.teacher?.name) return classroom.teacher.name;
    if (classroom.teachers?.name) return classroom.teachers.name;
    if (classroom.profiles?.name) return classroom.profiles.name;

    return "Not assigned";
  };

  async function fetchSummaries() {
    if (!child?.id || !school?.id) return;

    setSummaryLoading(true);

    const params = new URLSearchParams({
      learner_id: String(child.id),
      school_id: String(school.id),
      summary_range: summaryRange,
      summary_page: String(summaryPage),
      broadcast_range: broadcastRange,
      broadcast_page: String(broadcastPage),
      t: String(Date.now()),
    });

    const response = await fetch(`/api/parent-dashboard/updates?${params}`, {
      cache: "no-store",
    });
    const result = await response.json();

    if (!response.ok) {
      console.error("Parent summary fetch error:", result.error);
      setSummaries([]);
      setHasMoreSummaries(false);
      setSummaryLoading(false);
      return;
    }

    const rows = result.summaries || [];

    if (summaryRange === "Today") {
      setSummaries(rows.slice(0, 1));
      setHasMoreSummaries(false);
    } else {
      const visibleRows = rows.slice(0, PAGE_SIZE);

      setSummaries((current) =>
        summaryPage === 0 ? visibleRows : [...current, ...visibleRows]
      );

      setHasMoreSummaries(Boolean(result.hasMoreSummaries));
    }

    setSummaryLoading(false);
  }

  async function fetchAttendanceRecords() {
    if (!child?.id) return;

    setAttendanceLoading(true);

    const from = attendancePage * PAGE_SIZE;
    const to = from + PAGE_SIZE;

    let query = supabase
      .from("attendance")
      .select(
        `
          id,
          learner_id,
          learner_name,
          status,
          absence_reason,
          attendance_date,
          created_at
        `
      )
      .eq("learner_id", child.id)
      .order("attendance_date", { ascending: false });

    const startDate = getAttendanceStartDate(attendanceRange);

    if (attendanceRange === "Today") {
      query = query.eq("attendance_date", getTodayDate()).limit(1);
    } else {
      if (startDate) {
        query = query.gte("attendance_date", startDate);
      }

      query = query.range(from, to);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Parent attendance fetch error:", error);
      setAttendanceRows([]);
      setHasMoreAttendance(false);
      setAttendanceLoading(false);
      return;
    }

    const rows = data || [];

    if (attendanceRange === "Today") {
      setAttendanceRows(rows.slice(0, 1));
      setHasMoreAttendance(false);
    } else {
      const visibleRows = rows.slice(0, PAGE_SIZE);

      setAttendanceRows((current) =>
        attendancePage === 0 ? visibleRows : [...current, ...visibleRows]
      );

      setHasMoreAttendance(rows.length > PAGE_SIZE);
    }

    setAttendanceLoading(false);
  }

  async function fetchBroadcasts() {
    if (!child?.id || !school?.id) return;

    setBroadcastLoading(true);

    const params = new URLSearchParams({
      learner_id: String(child.id),
      school_id: String(school.id),
      summary_range: summaryRange,
      summary_page: String(summaryPage),
      broadcast_range: broadcastRange,
      broadcast_page: String(broadcastPage),
      t: String(Date.now()),
    });

    const response = await fetch(`/api/parent-dashboard/updates?${params}`, {
      cache: "no-store",
    });
    const result = await response.json();

    if (!response.ok) {
      console.error("Parent broadcast fetch error:", result.error);
      setBroadcastRows([]);
      setHasMoreBroadcasts(false);
      setBroadcastLoading(false);
      return;
    }

    const rows = result.broadcasts || [];
    const visibleRows = rows.slice(0, PAGE_SIZE);

    setBroadcastRows((current) =>
      broadcastPage === 0 ? visibleRows : [...current, ...visibleRows]
    );

    setHasMoreBroadcasts(Boolean(result.hasMoreBroadcasts));
    setBroadcastLoading(false);
  }

  async function fetchEvents() {
    if (!school?.id) return;

    setEventLoading(true);

    const from = eventPage * PAGE_SIZE;
    const to = from + PAGE_SIZE;

    let query = supabase
      .from("events")
      .select(
        `
          id,
          school_id,
          title,
          event_date,
          description,
          created_at
        `
      )
      .eq("school_id", school.id)
      .order("event_date", { ascending: true })
      .order("created_at", { ascending: true });

    const dateFilter = getEventDateFilter(eventRange);

    if (dateFilter.from) {
      query = query.gte("event_date", dateFilter.from);
    }

    if (dateFilter.to) {
      query = query.lte("event_date", dateFilter.to);
    }

    query = query.range(from, to);

    const { data, error } = await query;

    if (error) {
      console.error("Parent event fetch error:", error);
      setEventRows([]);
      setHasMoreEvents(false);
      setEventLoading(false);
      return;
    }

    const rows = data || [];
    const visibleRows = rows.slice(0, PAGE_SIZE);

    setEventRows((current) =>
      eventPage === 0 ? visibleRows : [...current, ...visibleRows]
    );

    setHasMoreEvents(rows.length > PAGE_SIZE);
    setEventLoading(false);
  }

  async function fetchMessageSummary() {
    if (!child?.id || !school?.id || !parent?.phone) return;

    setMessageLoading(true);

    const response = await fetch("/api/messages/parent-summary", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        school_id: school.id,
        learner_id: child.id,
        parent_phone: parent.phone,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Parent message summary fetch error:", result.error);
      setDashboardMessages([]);
      setMessageLoading(false);
      return;
    }

    setDashboardMessages((result.messages || []) as MessageRow[]);
    setMessageLoading(false);
  }

  async function fetchIncidentSummary() {
    if (!child?.id) return;
    setIncidentLoading(true);
    try {
      const response = await fetch("/api/parent-incidents", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) {
        console.error("Parent incident summary fetch error:", result.error);
        setIncidentReports([]);
        return;
      }
      setIncidentReports((result.reports || []).filter(
        (report: IncidentRow) => String(report.learner_id) === String(child.id)
      ));
    } finally {
      setIncidentLoading(false);
    }
  }

  useEffect(() => {
    fetchMessageSummary();
    fetchIncidentSummary();
  }, [selectedChildId]);

  useEffect(() => {
    if (!school?.id || !parent?.phone) return;

    const channel = supabase
      .channel(`parent-dashboard-messages-${school.id}-${parent.phone}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const nextMessage = payload.new as MessageRow | null;

          if (!nextMessage || Number(nextMessage.school_id) !== Number(school.id)) {
            return;
          }

          const isParentMessage =
            String(nextMessage.sender_id || "") === String(parent.phone) ||
            String(nextMessage.recipient_id || "") === String(parent.phone);

          if (isParentMessage) {
            fetchMessageSummary();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [school?.id, parent?.phone, selectedChildId]);

  function getSummaryStartDate(range: string) {
    const now = new Date();

    if (range === "Today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return start.toISOString();
    }

    if (range === "Week") {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      return start.toISOString();
    }

    if (range === "Month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return start.toISOString();
    }

    return null;
  }

  function getTodayDate() {
    return new Date().toISOString().split("T")[0];
  }

  function getTomorrowDate() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  }

  function getAttendanceStartDate(range: string) {
    const now = new Date();

    if (range === "Week") {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      return start.toISOString().split("T")[0];
    }

    if (range === "Month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return start.toISOString().split("T")[0];
    }

    return null;
  }

  function getBroadcastStartDate(range: string) {
    const now = new Date();

    if (range === "Today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return start.toISOString();
    }

    if (range === "Week") {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      return start.toISOString();
    }

    if (range === "Month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return start.toISOString();
    }

    return null;
  }

  function getEventDateFilter(range: string) {
    const now = new Date();
    const todayValue = getTodayDate();

    if (range === "Today") {
      return {
        from: todayValue,
        to: todayValue,
      };
    }

    if (range === "This Week") {
      const end = new Date(now);
      end.setDate(end.getDate() + 7);

      return {
        from: todayValue,
        to: end.toISOString().split("T")[0],
      };
    }

    if (range === "This Month") {
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      return {
        from: todayValue,
        to: end.toISOString().split("T")[0],
      };
    }

    const endOfYear = new Date(now.getFullYear(), 11, 31);

    return {
      from: todayValue,
      to: endOfYear.toISOString().split("T")[0],
    };
  }

  function formatSummaryDate(dateValue?: string | null) {
    if (!dateValue) return "";

    return new Date(dateValue).toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function formatAttendanceDate(dateValue?: string | null) {
    if (!dateValue) return "";

    return new Date(dateValue).toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function formatBroadcastDate(dateValue?: string | null) {
    if (!dateValue) return "";

    return new Date(dateValue).toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function formatEventDate(dateValue?: string | null) {
    if (!dateValue) return "";

    return new Date(`${dateValue}T00:00:00`).toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function getAttendanceLabel(status?: string | null) {
    const value = String(status || "").toLowerCase();

    if (value === "present") return "Present ✓";
    if (value === "absent") return "Absent";

    return "Not marked";
  }

  function getAttendancePercentage() {
    if (attendanceRows.length === 0) return "0%";

    const present = attendanceRows.filter(
      (row) => String(row.status || "").toLowerCase() === "present"
    ).length;

    return `${Math.round((present / attendanceRows.length) * 100)}%`;
  }

  function handleAttendanceRangeChange(value: string) {
    setAttendanceRange(value);
    setAttendancePage(0);
    setAttendanceRows([]);
  }

  function handleBroadcastRangeChange(value: string) {
    setBroadcastRange(value);
    setBroadcastPage(0);
    setBroadcastRows([]);
  }

  function handleEventRangeChange(value: string) {
    setEventRange(value);
    setEventPage(0);
    setEventRows([]);
  }

  function getPresentCount() {
    return attendanceRows.filter(
      (row) => String(row.status || "").toLowerCase() === "present"
    ).length;
  }

  function getAbsentCount() {
    return attendanceRows.filter(
      (row) => String(row.status || "").toLowerCase() === "absent"
    ).length;
  }

  function getGreeting() {
    const hour = new Date().getHours();

    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";

    return "Good evening";
  }

  function formatLower(value?: string | null) {
    return String(value || "").trim().toLowerCase();
  }

  function buildSummaryMessage(summary: SummaryRow) {
    const learnerName = child?.name || summary.learner_name || "Your child";

    const moodText = formatLower(summary.mood);
    const mealsText = formatLower(summary.meals);
    const restText = formatLower(summary.rest);
    const healthText = formatLower(summary.health_safety);
    const highlightText = formatLower(summary.today_highlight);

    return (
      <>
        <p style={styles.summaryText}>
          {getGreeting()} 👋
          <br />
          <br />
          {learnerName}
          {moodText
            ? ` had a ${moodText} day today.`
            : " had a lovely day today."}
          {mealsText ? ` ${learnerName} ${mealsText}.` : ""}
          {restText ? ` ${learnerName} had a ${restText}.` : ""}
          {healthText ? ` Health and safety update: ${healthText}.` : ""}
          {highlightText
            ? ` Today's highlight was that ${learnerName} ${highlightText}.`
            : ""}
          <br />
          <br />
          Thank you for trusting us with another beautiful day.
          <br />
          <br />
          {getTeacherName(classroom)}
          <br />
          {school?.school_name || "DailyBloom"}
        </p>

        {summary.teacher_notes ? (
          <div style={styles.noteBox}>
            <strong style={styles.noteTitle}>Additional note</strong>
            <p style={styles.noteText}>{summary.teacher_notes}</p>
          </div>
        ) : null}
      </>
    );
  }

  const toggleSection = (section: string) => {
    if (openSection !== section) {
      markUpdateTypeSeen(section);
    }

    setOpenSection(openSection === section ? "" : section);
  };

  function markUpdateTypeSeen(type: string) {
    setSeenUpdateTypes((current) => ({
      ...current,
      [type]: true,
    }));
  }

  const handleSummaryRangeChange = (value: string) => {
    setSummaryRange(value);
    setSummaryPage(0);
    setSummaries([]);
  };

  const RangeTabs = ({
    active,
    setActive,
  }: {
    active: string;
    setActive: (value: string) => void;
  }) => (
    <div style={styles.tabs}>
      {["Today", "Week", "Month", "To Date"].map((item) => (
        <button
          key={item}
          onClick={() => setActive(item)}
          style={{
            ...styles.tab,
            ...(active === item ? styles.activeTab : {}),
          }}
        >
          {item}
        </button>
      ))}
    </div>
  );


  const EventTabs = ({
    active,
    setActive,
  }: {
    active: string;
    setActive: (value: string) => void;
  }) => (
    <div style={styles.tabs}>
      {["Today", "This Week", "This Month", "Upcoming"].map((item) => (
        <button
          key={item}
          onClick={() => setActive(item)}
          style={{
            ...styles.tab,
            ...(active === item ? styles.activeTab : {}),
          }}
        >
          {item}
        </button>
      ))}
    </div>
  );

  const Section = ({
    id,
    title,
    children,
  }: {
    id: string;
    title: string;
    children: React.ReactNode;
  }) => {
    const isOpen = openSection === id;

    return (
      <div className="db-soft-card" style={styles.section}>
        <button onClick={() => toggleSection(id)} style={styles.sectionHeader}>
          <span>{title}</span>
          <span>{isOpen ? "▲" : "▼"}</span>
        </button>

        {isOpen && <div style={styles.sectionBody}>{children}</div>}
      </div>
    );
  };

  const unreadMessages = dashboardMessages.filter((message) => {
    const sentToParent = String(message.recipient_id || "") === String(parent?.phone);
    return sentToParent && message.is_read === false;
  });

  const unreadCount = unreadMessages.length;
  const lastMessage = dashboardMessages[0] || null;
  const lastMessagePreview = lastMessage?.message || "";
  const lastMessageSender =
    lastMessage?.sender_name || (lastMessage?.sender_id === parent?.phone ? "You" : "School");
  const lastMessageContactId = lastMessage
    ? String(lastMessage.sender_id) === String(parent?.phone)
      ? lastMessage.recipient_id
      : lastMessage.sender_id
    : null;
  const unacknowledgedIncidents = incidentReports.filter(
    (report) => !report.parent_acknowledged_at
  );
  const tomorrowEvents = eventRows.filter(
    (event) => String(event.event_date || "") === getTomorrowDate()
  );
  const notifications = [
    ...(summaries.length > 0 && !seenUpdateTypes.summary
      ? [{ type: "summary", text: "Daily summary shared" }]
      : []),
    ...(!seenUpdateTypes.messages
      ? unreadMessages.map((message) => ({
          type: "messages",
          text: `New message from ${message.sender_name || "DailyBloom"}`,
        }))
      : []),
    ...(broadcastRows.length > 0 && !seenUpdateTypes.broadcasts
      ? [{ type: "broadcasts", text: "New school broadcast available" }]
      : []),
    ...(tomorrowEvents.length > 0 && !seenUpdateTypes.events
      ? [
          {
            type: "events",
            text: `${tomorrowEvents[0]?.title || "School event"} is tomorrow`,
          },
        ]
      : []),
    ...(unacknowledgedIncidents.length > 0 && !seenUpdateTypes.incidents
      ? [{
          type: "incidents",
          text: `${unacknowledgedIncidents.length} incident report${unacknowledgedIncidents.length === 1 ? "" : "s"} require${unacknowledgedIncidents.length === 1 ? "s" : ""} acknowledgement`,
        }]
      : []),
  ];

  return (
    <div style={styles.page}>
      <div
        className="db-soft-card"
        style={{
          ...styles.contextBanner,
          borderTop: `4px solid ${school?.primary_color || "#7CCCF3"}`,
        }}
      >
        <div className="parent-dashboard-context" style={styles.contextInner}>
          <div>
            {children.length > 1 && (
              <select
                value={selectedChildId}
                onChange={(e) => {
                  setSelectedChildId(e.target.value);
                  setSummaryPage(0);
                  setSummaries([]);
                  setAttendancePage(0);
                  setAttendanceRows([]);
                  setBroadcastPage(0);
                  setBroadcastRows([]);
                  setEventPage(0);
                  setEventRows([]);
                  setSeenUpdateTypes({});
                }}
                style={styles.childSelect}
              >
                {children.map((learner) => (
                  <option key={learner.id} value={String(learner.id)}>
                    {learner.name}
                  </option>
                ))}
              </select>
            )}

            <h1 style={styles.schoolName}>
              {school?.school_name || "DailyBloom"}
            </h1>

            <p style={styles.muted}>Viewing updates for {child.name}</p>

            <p style={styles.muted}>
              Class: {classroom?.classroom_name || "Not assigned"}
            </p>

            <p style={styles.muted}>Teacher: {getTeacherName(classroom)}</p>
          </div>

          <img
            className="parent-dashboard-logo"
            src={school?.logo_url || "/school-placeholder.png"}
            alt="School"
            style={styles.logo}
          />
        </div>
      </div>

      <div className="db-soft-card" style={styles.notifications}>
        <button
          onClick={() => setNotificationsOpen(!notificationsOpen)}
          style={styles.notificationHeader}
        >
          <span>🔔 New Updates ({notifications.length})</span>
          <span>{notificationsOpen ? "▲" : "▼"}</span>
        </button>

        {notificationsOpen && (
          <div style={styles.notificationList}>
            {notifications.length > 0 ? (
              notifications.map((item, index) => (
                <p key={index} style={styles.notificationItem}>
                  • {item.text}
                </p>
              ))
            ) : (
              <p style={styles.notificationItem}>No new updates.</p>
            )}
          </div>
        )}
      </div>

      <Section id="summary" title={`📝 Today's Summary`}>
        <RangeTabs active={summaryRange} setActive={handleSummaryRangeChange} />

        <h3 style={styles.contentTitle}>{`${summaryRange}'s Summary`}</h3>

        {summaryLoading && summaries.length === 0 ? (
          <p style={styles.emptyText}>Loading summary...</p>
        ) : summaries.length > 0 ? (
          <div style={styles.summaryTimeline}>
            {summaries.map((summary) => (
              <div key={summary.id} style={styles.summaryCard}>
                {summary.created_at ? (
                  <p style={styles.summaryDate}>
                    {summaryRange === "Today"
                      ? `Shared on ${formatSummaryDate(summary.created_at)}`
                      : formatSummaryDate(summary.created_at)}
                  </p>
                ) : null}

                {buildSummaryMessage(summary)}
              </div>
            ))}

            {summaryRange !== "Today" && hasMoreSummaries ? (
              <button
                type="button"
                onClick={() => setSummaryPage((current) => current + 1)}
                style={styles.loadMoreButton}
                disabled={summaryLoading}
              >
                {summaryLoading ? "Loading..." : "Load next 5"}
              </button>
            ) : null}
          </div>
        ) : (
          <div style={styles.emptyState}>
            <p style={styles.emptyTitle}>No summary shared yet.</p>
            <p style={styles.emptyText}>
              When the teacher sends a summary for {child.name}, it will appear
              here.
            </p>
          </div>
        )}
      </Section>

      <Section id="messages" title="💬 Messages">
        <div style={styles.parentMessageIntro}>
          <h3 style={styles.contentTitle}>
            Messages{unreadCount > 0 ? ` (${unreadCount} unread)` : ""}
          </h3>
          <p style={styles.emptyText}>
            {messageLoading
              ? "Checking messages..."
              : unreadCount > 0
                ? `You have ${unreadCount} unread message${unreadCount === 1 ? "" : "s"}.`
                : "No unread messages."}
          </p>
        </div>

        <div style={styles.parentMessageSummaryBox}>
          <strong style={styles.emptyTitle}>Last message</strong>
          {lastMessage ? (
            <>
              <p style={styles.parentMessageSender}>{lastMessageSender}</p>
              <p style={styles.parentMessagePreview}>{lastMessagePreview}</p>
            </>
          ) : (
            <p style={styles.parentContactText}>
              New messages from the teacher or principal will appear here.
            </p>
          )}
        </div>

        <a
          href={lastMessageContactId ? `/parent/messages?contact=${encodeURIComponent(String(lastMessageContactId))}&learner=${encodeURIComponent(String(lastMessage?.learner_id || child?.id || ""))}` : "/parent/messages"}
          onClick={() => markUpdateTypeSeen("messages")}
          style={styles.openMessagesButton}
        >
          Open Messages →
        </a>
      </Section>

      <Section id="broadcasts" title={`📢 Broadcasts (${broadcastRows.length})`}>
        <RangeTabs
          active={broadcastRange}
          setActive={handleBroadcastRangeChange}
        />

        <div style={styles.schoolAnnouncementBadge}>
          <strong>📢 School Announcement</strong>
        </div>

        <h3 style={styles.contentTitle}>{broadcastRange} Broadcasts</h3>

        {broadcastLoading && broadcastRows.length === 0 ? (
          <p style={styles.emptyText}>Loading broadcasts...</p>
        ) : broadcastRows.length > 0 ? (
          <div style={styles.broadcastTimeline}>
            {broadcastRows.map((broadcast) => (
              <div key={broadcast.id} style={styles.broadcastCard}>
                <div style={styles.broadcastHeader}>
                  <div>
                    <p style={styles.broadcastDate}>
                      {broadcast.created_at
                        ? formatBroadcastDate(broadcast.created_at)
                        : "No date"}
                    </p>

                    <h4 style={styles.broadcastTitle}>
                      📢 {broadcast.title || "School announcement"}
                    </h4>
                  </div>

                  <span style={styles.broadcastAudience}>All parents</span>
                </div>

                <p style={styles.broadcastMessage}>
                  {broadcast.message || "No message saved."}
                </p>
              </div>
            ))}

            {hasMoreBroadcasts ? (
              <button
                type="button"
                onClick={() => setBroadcastPage((current) => current + 1)}
                style={styles.loadMoreButton}
                disabled={broadcastLoading}
              >
                {broadcastLoading ? "Loading..." : "Load next 5"}
              </button>
            ) : null}
          </div>
        ) : (
          <div style={styles.emptyState}>
            <p style={styles.emptyTitle}>No school announcements yet.</p>
            <p style={styles.emptyText}>
              When your school shares an announcement, it will appear here.
            </p>
          </div>
        )}
      </Section>

      <Section id="attendance" title="✔ Attendance">
        <RangeTabs
          active={attendanceRange}
          setActive={handleAttendanceRangeChange}
        />

        <h3 style={styles.contentTitle}>{attendanceRange} Attendance</h3>

        {attendanceLoading && attendanceRows.length === 0 ? (
          <p style={styles.emptyText}>Loading attendance...</p>
        ) : attendanceRows.length > 0 ? (
          <>
            <div style={styles.attendanceGrid}>
              <div>
                <p style={styles.muted}>
                  {attendanceRange === "Today" ? "Today" : "Present"}
                </p>

                <h3
                  style={
                    attendanceRows[0]?.status === "absent"
                      ? styles.absent
                      : styles.present
                  }
                >
                  {attendanceRange === "Today"
                    ? getAttendanceLabel(attendanceRows[0]?.status)
                    : `${getPresentCount()} / ${attendanceRows.length}`}
                </h3>
              </div>

              <div>
                <p style={styles.muted}>Attendance</p>
                <h3>{getAttendancePercentage()}</h3>
              </div>
            </div>

            <div style={styles.attendanceTimeline}>
              {attendanceRows.map((row) => (
                <div key={row.id} style={styles.attendanceRow}>
                  <div>
                    <strong>{formatAttendanceDate(row.attendance_date)}</strong>

                    <p style={styles.attendanceStatus}>
                      {getAttendanceLabel(row.status)}
                    </p>

                    {row.absence_reason ? (
                      <p style={styles.attendanceReason}>
                        Reason: {row.absence_reason}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {attendanceRange !== "Today" && hasMoreAttendance ? (
              <button
                type="button"
                onClick={() => setAttendancePage((current) => current + 1)}
                style={styles.loadMoreButton}
                disabled={attendanceLoading}
              >
                {attendanceLoading ? "Loading..." : "Load next 5"}
              </button>
            ) : null}
          </>
        ) : (
          <div style={styles.emptyState}>
            <p style={styles.emptyTitle}>No attendance marked yet.</p>
            <p style={styles.emptyText}>
              When attendance is saved for {child.name}, it will appear here.
            </p>
          </div>
        )}
      </Section>

      <Section id="incidents" title={`⚠ Incident Reports${unacknowledgedIncidents.length ? ` (${unacknowledgedIncidents.length} new)` : ""}`}>
        <div style={styles.parentMessageIntro}>
          <h3 style={styles.contentTitle}>Incident Reports</h3>
          <p style={styles.emptyText}>
            {incidentLoading
              ? "Checking for incident updates..."
              : unacknowledgedIncidents.length > 0
                ? `${unacknowledgedIncidents.length} report${unacknowledgedIncidents.length === 1 ? " is" : "s are"} waiting for your acknowledgement.`
                : incidentReports.length > 0
                  ? "All shared incident reports have been acknowledged."
                  : "No incident reports have been shared."}
          </p>
        </div>
        {incidentReports[0] ? (
          <div style={styles.parentMessageSummaryBox}>
            <strong style={styles.emptyTitle}>{incidentReports[0].incident_type || "Incident report"}</strong>
            <p style={styles.parentContactText}>
              {incidentReports[0].incident_date || "Date not recorded"} · {incidentReports[0].parent_acknowledged_at ? "Acknowledged" : "Acknowledgement required"}
            </p>
          </div>
        ) : null}
        <a href="/parent/incidents" onClick={() => markUpdateTypeSeen("incidents")} style={styles.openMessagesButton}>
          View Incident Reports →
        </a>
      </Section>

      <Section id="events" title={`📅 Events (${eventRows.length})`}>
        <EventTabs active={eventRange} setActive={handleEventRangeChange} />

        <div style={styles.schoolEventBadge}>
          <strong>📅 School Event</strong>
        </div>

        <h3 style={styles.contentTitle}>{eventRange} Events</h3>

        {eventLoading && eventRows.length === 0 ? (
          <p style={styles.emptyText}>Loading events...</p>
        ) : eventRows.length > 0 ? (
          <div style={styles.eventTimeline}>
            {eventRows.map((event) => (
              <div key={event.id} style={styles.eventCard}>
                <p style={styles.eventDate}>
                  {event.event_date ? formatEventDate(event.event_date) : "No date"}
                </p>

                <h4 style={styles.eventTitle}>
                  📅 {event.title || "School event"}
                </h4>

                <p style={styles.eventDescription}>
                  {event.description || "No description added."}
                </p>
              </div>
            ))}

            {hasMoreEvents ? (
              <button
                type="button"
                onClick={() => setEventPage((current) => current + 1)}
                style={styles.loadMoreButton}
                disabled={eventLoading}
              >
                {eventLoading ? "Loading..." : "Load next 5"}
              </button>
            ) : null}
          </div>
        ) : (
          <div style={styles.emptyState}>
            <p style={styles.emptyTitle}>No upcoming school events.</p>
            <p style={styles.emptyText}>
              When your school creates an event, it will appear here.
            </p>
          </div>
        )}
      </Section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    width: "100%",
  },

  contextBanner: {
    padding: "24px",
    marginBottom: "18px",
  },

  contextInner: {
    display: "flex",
    justifyContent: "space-between",
    gap: "18px",
    alignItems: "center",
  },

  childSelect: {
    marginBottom: "12px",
    border: "1px solid #e6efed",
    borderRadius: "999px",
    padding: "9px 14px",
    background: "#fff",
    color: "#2D2A3E",
    fontWeight: 700,
    cursor: "pointer",
  },

  logo: {
    width: "72px",
    height: "72px",
    borderRadius: "18px",
    objectFit: "cover",
    border: "1px solid #eee",
  },

  schoolName: {
    margin: "0 0 12px",
    color: "#2D2A3E",
  },

  muted: {
    margin: "6px 0",
    color: "#666",
  },

  notifications: {
    marginBottom: "18px",
    borderTop: "4px solid #FFC857",
    overflow: "hidden",
  },

  notificationHeader: {
    width: "100%",
    padding: "24px 32px",
    border: "none",
    background: "transparent",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "18px",
    fontWeight: 700,
    cursor: "pointer",
    color: "#12304a",
  },

  notificationList: {
    padding: "0 32px 24px",
  },

  notificationItem: {
    margin: "10px 0",
    color: "#444",
  },

  section: {
    marginBottom: "18px",
    overflow: "hidden",
    borderTop: "4px solid #7CCCF3",
  },

  sectionHeader: {
    width: "100%",
    padding: "24px 32px",
    border: "none",
    background: "transparent",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "18px",
    fontWeight: 700,
    cursor: "pointer",
    color: "#12304a",
  },

  sectionBody: {
    padding: "0 32px 26px",
  },

  tabs: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    marginBottom: "20px",
  },

  tab: {
    border: "1px solid #d9e7e4",
    background: "#fff",
    color: "#345",
    borderRadius: "999px",
    padding: "8px 14px",
    cursor: "pointer",
    fontWeight: 600,
  },

  activeTab: {
    background: "#7CCCF3",
    color: "#fff",
    borderColor: "#7CCCF3",
  },

  contentTitle: {
    marginBottom: "10px",
  },

  summaryTimeline: {
    display: "grid",
    gap: "16px",
  },

  summaryCard: {
    border: "1px solid #e2ece9",
    borderRadius: "16px",
    padding: "18px 20px",
    background: "#fff",
  },

  summaryDate: {
    margin: "0 0 14px",
    color: "#6D6888",
    fontSize: "13px",
    fontWeight: 800,
  },

  summaryText: {
    margin: 0,
    lineHeight: 1.7,
    color: "#333",
    whiteSpace: "pre-line",
  },

  noteBox: {
    marginTop: "18px",
    padding: "14px 16px",
    background: "#FFF8E8",
    border: "1px solid #FFE3A3",
    borderRadius: "14px",
  },

  noteTitle: {
    display: "block",
    marginBottom: "6px",
    color: "#7A5600",
  },

  noteText: {
    margin: 0,
    color: "#4A3A12",
    lineHeight: 1.6,
  },

  loadMoreButton: {
    border: "1px solid #d9e7e4",
    background: "#fff",
    color: "#12304a",
    borderRadius: "999px",
    padding: "10px 16px",
    cursor: "pointer",
    fontWeight: 700,
    width: "fit-content",
  },

  emptyState: {
    padding: "16px",
    background: "#FFFDFB",
    border: "1px solid #F0E3D8",
    borderRadius: "14px",
  },

  emptyTitle: {
    margin: "0 0 6px",
    color: "#2D2A3E",
    fontWeight: 800,
  },

  emptyText: {
    margin: 0,
    color: "#6D6888",
    lineHeight: 1.6,
  },

  parentMessageIntro: {
    marginBottom: "16px",
  },

  parentMessageSummaryBox: {
    border: "1px solid #e2ece9",
    borderRadius: "16px",
    padding: "16px",
    background: "#fff",
    color: "#2D2A3E",
    marginBottom: "16px",
  },

  parentMessageGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
    marginBottom: "16px",
  },

  parentContactCard: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    border: "1px solid #e2ece9",
    borderRadius: "16px",
    padding: "16px",
    background: "#fff",
    color: "#2D2A3E",
  },

  parentContactIcon: {
    width: "42px",
    height: "42px",
    borderRadius: "14px",
    background: "#EAF7FD",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px",
  },

  parentContactText: {
    margin: "5px 0 0",
    color: "#6D6888",
    fontSize: "13px",
    lineHeight: 1.5,
  },

  parentMessageSender: {
    margin: "10px 0 6px",
    color: "#2D2A3E",
    fontSize: "14px",
    fontWeight: 800,
  },

  parentMessagePreview: {
    margin: 0,
    color: "#6D6888",
    fontSize: "15px",
    lineHeight: 1.5,
  },

  openMessagesButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    borderRadius: "14px",
    background: "#7CCCF3",
    color: "#fff",
    padding: "13px 18px",
    fontWeight: 800,
    cursor: "pointer",
    textDecoration: "none",
  },

  chat: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    marginBottom: "18px",
  },

  messageTeacher: {
    background: "#f5f8fa",
    padding: "14px",
    borderRadius: "14px",
    maxWidth: "80%",
  },

  messageParent: {
    background: "#e8f7ee",
    padding: "14px",
    borderRadius: "14px",
    maxWidth: "80%",
    alignSelf: "flex-end",
  },

  replyBox: {
    display: "flex",
    gap: "10px",
    alignItems: "flex-end",
  },

  textarea: {
    flex: 1,
    minHeight: "70px",
    borderRadius: "14px",
    border: "1px solid #d9e7e4",
    padding: "12px",
    resize: "vertical",
    fontFamily: "inherit",
  },

  sendButton: {
    border: "none",
    borderRadius: "14px",
    background: "#7CCCF3",
    color: "#fff",
    padding: "13px 20px",
    fontWeight: 700,
    cursor: "pointer",
  },

  schoolAnnouncementBadge: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
    background: "#FFF8E8",
    border: "1px solid #FFE3A3",
    borderRadius: "14px",
    padding: "12px 14px",
    color: "#4A3A12",
    marginBottom: "18px",
  },

  broadcastTimeline: {
    display: "grid",
    gap: "16px",
  },

  broadcastCard: {
    border: "1px solid #e2ece9",
    borderRadius: "16px",
    padding: "18px 20px",
    background: "#fff",
  },

  broadcastHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "12px",
  },

  broadcastDate: {
    margin: "0 0 8px",
    color: "#6D6888",
    fontSize: "13px",
    fontWeight: 800,
  },

  broadcastTitle: {
    margin: 0,
    color: "#2D2A3E",
    fontSize: "17px",
    fontWeight: 800,
  },

  broadcastAudience: {
    background: "#EAF7FD",
    border: "1px solid #CBEAF7",
    borderRadius: "999px",
    padding: "5px 10px",
    color: "#2D2A3E",
    fontSize: "12px",
    fontWeight: 800,
  },

  broadcastMessage: {
    margin: 0,
    color: "#333",
    lineHeight: 1.7,
    whiteSpace: "pre-line",
  },

  list: {
    color: "#333",
    lineHeight: 1.6,
  },

  attendanceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "16px",
    marginBottom: "18px",
  },

  present: {
    color: "#2f9e44",
  },

  absent: {
    color: "#d94848",
  },

  attendanceTimeline: {
    display: "grid",
    gap: "10px",
    marginTop: "14px",
  },

  attendanceRow: {
    border: "1px solid #e2ece9",
    borderRadius: "14px",
    padding: "12px 14px",
    background: "#fff",
  },

  attendanceStatus: {
    margin: "6px 0 0",
    color: "#2D2A3E",
    fontWeight: 700,
    textTransform: "capitalize",
  },

  attendanceReason: {
    margin: "6px 0 0",
    color: "#6D6888",
    fontSize: "13px",
  },

  calendar: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },

  calendarDay: {
    width: "42px",
    height: "42px",
    borderRadius: "12px",
    background: "#f5f8fa",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
  },

  schoolEventBadge: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
    background: "#FFF8E8",
    border: "1px solid #FFE3A3",
    borderRadius: "14px",
    padding: "12px 14px",
    color: "#4A3A12",
    marginBottom: "18px",
  },

  eventTimeline: {
    display: "grid",
    gap: "16px",
  },

  eventCard: {
    border: "1px solid #e2ece9",
    borderRadius: "16px",
    padding: "18px 20px",
    background: "#fff",
  },

  eventDate: {
    margin: "0 0 8px",
    color: "#6D6888",
    fontSize: "13px",
    fontWeight: 800,
  },

  eventTitle: {
    margin: "0 0 10px",
    color: "#2D2A3E",
    fontSize: "17px",
    fontWeight: 800,
  },

  eventDescription: {
    margin: 0,
    color: "#333",
    lineHeight: 1.7,
    whiteSpace: "pre-line",
  },

  events: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },

  eventChip: {
    border: "1px solid #e2ece9",
    borderRadius: "16px",
    padding: "14px 16px",
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    background: "#fff",
  },
};
