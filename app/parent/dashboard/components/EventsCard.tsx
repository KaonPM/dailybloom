export default function EventsCard() {
  const events = [
    { date: "10 JUL", title: "Sports Day", time: "09:00" },
    { date: "14 JUL", title: "Parent Meeting", time: "18:00" },
    { date: "25 JUL", title: "Pyjama Day", time: "" },
  ];

  return (
    <section className="db-soft-card" style={cardStyle}>
      <h2>📅 Events This Month</h2>

      {events.map((event) => (
        <div key={event.title} style={eventStyle}>
          <strong style={{ color: "#7CCCF3" }}>{event.date}</strong>
          <h3 style={{ margin: "6px 0", wordBreak: "break-word" }}>
            {event.title}
          </h3>
          {event.time && <p style={{ margin: 0 }}>{event.time}</p>}
        </div>
      ))}
    </section>
  );
}

const cardStyle = {
  padding: "22px",
  marginBottom: "18px",
} as const;

const eventStyle = {
  padding: "14px 0",
  borderBottom: "1px solid #e6efed",
} as const;