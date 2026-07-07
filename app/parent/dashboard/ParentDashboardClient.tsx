"use client";

import { useState } from "react";

type Child = any;

export default function ParentDashboardClient({
  children,
}: {
  children: Child[];
}) {
  const [selectedChildId, setSelectedChildId] = useState(
    String(children[0]?.id || "")
  );

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [openSection, setOpenSection] = useState("");
  const [summaryRange, setSummaryRange] = useState("Today");
  const [broadcastRange, setBroadcastRange] = useState("Today");
  const [attendanceRange, setAttendanceRange] = useState("Today");
  const [reply, setReply] = useState("");

  const child =
    children.find((item) => String(item.id) === selectedChildId) ||
    children[0];

  const school = Array.isArray(child.schools)
    ? child.schools[0]
    : child.schools;

  const classroom = Array.isArray(child.classrooms)
    ? child.classrooms[0]
    : child.classrooms;

  const getTeacherName = (classroom: any) => {
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

  const notifications = [
    "Daily summary shared",
    "Attendance marked Present",
    "Teacher Sarah sent a message",
    "New school broadcast available",
    "Sports Day is tomorrow",
    "Activity completed",
    "Storybook uploaded",
    "Attendance updated",
  ];

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? "" : section);
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

  return (
    <div style={styles.page}>
      <div
        className="db-soft-card"
        style={{
          ...styles.contextBanner,
          borderTop: `4px solid ${school?.primary_color || "#7CCCF3"}`,
        }}
      >
        <div style={styles.contextInner}>
          <div>
            {children.length > 1 && (
              <select
                value={selectedChildId}
                onChange={(e) => setSelectedChildId(e.target.value)}
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
            {notifications.map((item, index) => (
              <p key={index} style={styles.notificationItem}>
                • {item}
              </p>
            ))}
          </div>
        )}
      </div>

      <Section id="summary" title="📝 Today's Summary">
        <RangeTabs active={summaryRange} setActive={setSummaryRange} />

        <h3 style={styles.contentTitle}>{summaryRange}'s Summary</h3>

        <p style={styles.summaryText}>
          Good afternoon 👋
          <br />
          <br />
          {child.name} had a cheerful and active day today. He enjoyed painting
          and outdoor play with friends. He participated well in class
          activities and interacted positively with others.
          <br />
          <br />
          Thank you for trusting us with another beautiful day.
          <br />
          <br />
          {getTeacherName(classroom)}
          <br />
          {school?.school_name || "DailyBloom"}
        </p>
      </Section>

      <Section id="messages" title="💬 Messages (2 unread)">
        <div style={styles.chat}>
          <div style={styles.messageTeacher}>
            <strong>{getTeacherName(classroom)}</strong>
            <p>Please bring crayons tomorrow.</p>
          </div>

          <div style={styles.messageParent}>
            <strong>You</strong>
            <p>Thank you.</p>
          </div>

          <div style={styles.messageTeacher}>
            <strong>{getTeacherName(classroom)}</strong>
            <p>Perfect.</p>
          </div>
        </div>

        <div style={styles.replyBox}>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Reply..."
            style={styles.textarea}
          />

          <button style={styles.sendButton}>Send</button>
        </div>
      </Section>

      <Section id="broadcasts" title="📢 Broadcasts (3)">
        <RangeTabs active={broadcastRange} setActive={setBroadcastRange} />

        <div style={styles.list}>
          <p>School closes early Friday.</p>
          <hr />
          <p>Pyjama Day</p>
          <hr />
          <p>Parent Meeting</p>
        </div>
      </Section>

      <Section id="attendance" title="✔ Attendance">
        <RangeTabs active={attendanceRange} setActive={setAttendanceRange} />

        <div style={styles.attendanceGrid}>
          <div>
            <p style={styles.muted}>Today</p>
            <h3 style={styles.present}>Present ✓</h3>
          </div>

          <div>
            <p style={styles.muted}>Attendance</p>
            <h3>94%</h3>
          </div>
        </div>

        <div style={styles.calendar}>
          {["P", "A", "P", "P", "P"].map((day, index) => (
            <span key={index} style={styles.calendarDay}>
              {day}
            </span>
          ))}
        </div>
      </Section>

      <Section id="events" title="📅 Events">
        <div style={styles.events}>
          {[
            ["Sports Day", "10 July"],
            ["Parent Meeting", "14 July"],
            ["Pyjama Day", "25 July"],
          ].map(([title, date]) => (
            <div key={title} style={styles.eventChip}>
              <strong>{title}</strong>
              <span>{date}</span>
            </div>
          ))}
        </div>
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
    padding: "18px 20px",
    border: "none",
    background: "transparent",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "17px",
    fontWeight: 700,
    cursor: "pointer",
    color: "#12304a",
  },

  notificationList: {
    padding: "0 20px 18px",
  },

  notificationItem: {
    margin: "10px 0",
    color: "#444",
  },

  section: {
    marginBottom: "14px",
    overflow: "hidden",
  },

  sectionHeader: {
    width: "100%",
    padding: "18px 20px",
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
    padding: "0 20px 22px",
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

  summaryText: {
    lineHeight: 1.7,
    color: "#333",
    whiteSpace: "pre-line",
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