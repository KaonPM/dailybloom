export default function MessagesCard() {
  return (
    <section className="db-soft-card" style={cardStyle}>
      <h2>💬 Messages (3)</h2>

      <div style={messageStyle}>
        <strong>Teacher Sarah</strong>
        <p>Please remember to bring crayons.</p>
        <small>Today, 09:15 · Unread</small>
        <br />
        <button style={replyButton}>Reply</button>
      </div>

      <hr />

      <div style={messageStyle}>
        <strong>Principal</strong>
        <p>School closes at 12:00 tomorrow.</p>
        <small>Yesterday, 14:30 · Read</small>
        <br />
        <button style={replyButton}>Reply</button>
      </div>
    </section>
  );
}

const cardStyle = {
  padding: "22px",
  marginBottom: "18px",
} as const;

const messageStyle = {
  padding: "10px 0",
  lineHeight: 1.6,
} as const;

const replyButton = {
  marginTop: "10px",
  border: "none",
  background: "#7CCCF3",
  color: "#fff",
  borderRadius: "999px",
  padding: "8px 14px",
  fontWeight: 700,
  cursor: "pointer",
} as const;