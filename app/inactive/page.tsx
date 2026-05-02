import Link from "next/link";

export default function InactivePage() {
  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>Subscription Inactive</h1>

        <p style={textStyle}>
          Your school’s DailyBloom subscription is no longer active.
        </p>

        <p style={textStyle}>
          You can reactivate your subscription at any time to regain full access
          to your school data and features.
        </p>

        <div style={{ marginTop: "20px" }}>
          <Link href="/billing" style={primaryButton}>
            Reactivate Subscription
          </Link>

          <Link href="/login" style={secondaryButton}>
            Back to Login
          </Link>
        </div>
      </div>
    </main>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "#FFF8F2",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
};

const cardStyle = {
  background: "#FFFFFF",
  border: "1px solid #F0E3D8",
  borderRadius: "24px",
  padding: "28px",
  maxWidth: "420px",
  width: "100%",
  textAlign: "center" as const,
  boxShadow: "0 10px 24px rgba(45, 42, 62, 0.06)",
};

const titleStyle = {
  margin: 0,
  marginBottom: "12px",
  fontSize: "24px",
  fontWeight: 800,
  color: "#2D2A3E",
};

const textStyle = {
  margin: "8px 0",
  color: "#5B5675",
  fontSize: "15px",
  lineHeight: 1.6,
};

const primaryButton = {
  display: "block",
  textDecoration: "none",
  background: "#7CCCF3",
  color: "#2D2A3E",
  padding: "12px",
  borderRadius: "12px",
  fontWeight: 700,
  marginBottom: "10px",
};

const secondaryButton = {
  display: "block",
  textDecoration: "none",
  background: "#FFFFFF",
  color: "#5B5675",
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid #E3D9CD",
  fontWeight: 600,
};