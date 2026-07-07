export default function BroadcastsCard() {
  return (
    <section className="db-soft-card" style={cardStyle}>
      <h2>📢 Broadcasts</h2>

      <p>School closes early Friday.</p>
      <hr />

      <p>Sports Day uniforms available.</p>
      <hr />

      <p>Parent Meeting 16 July.</p>
    </section>
  );
}

const cardStyle = {
  padding: "22px",
  marginBottom: "18px",
  lineHeight: 1.6,
} as const;