import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <h1 style={titleStyle}>DailyBloom Privacy Policy</h1>
        <p style={dateStyle}>Last updated: 28 April 2026</p>

        <Section title="1. Introduction">
          DailyBloom is a preschool management platform operated by Lesedi Smart
          Solutions (Pty) Ltd. This Privacy Policy explains how information is
          collected, used, stored and protected.
        </Section>

        <Section title="2. Information We Collect">
          We may collect school details, principal details, teacher details,
          learner records, parent or guardian contact details, attendance records,
          daily summaries, event information, payment reminder records and
          communication records.
        </Section>

        <Section title="3. Why We Collect Information">
          We use information to provide the DailyBloom service, manage school
          accounts, support onboarding, organise school administration, prepare
          communications and improve the platform.
        </Section>

        <Section title="4. Legal Responsibility of the School">
          The school confirms that it has the authority and lawful basis to provide
          learner, parent, guardian and staff information to DailyBloom.
        </Section>

        <Section title="5. Access to Information">
          Access is limited according to user roles. Principals may access
          school-level information. Teachers may access information linked to
          assigned classrooms. DailyBloom administrators may access information
          needed for setup, support and account management.
        </Section>

        <Section title="6. Security">
          DailyBloom applies reasonable safeguards, including role-based access
          controls, secure systems and limited operational access.
        </Section>

        <Section title="7. Third-Party Services">
          Some communications may be processed through email, WhatsApp, SMS,
          hosting providers or related technology partners where needed to deliver
          the service.
        </Section>

        <Section title="8. Retention and Correction">
          Information may be retained for operational, legal, backup and support
          purposes. Schools may request correction of inaccurate information.
        </Section>

        <Section title="9. POPIA">
          Where applicable, DailyBloom aims to act consistently with the Protection
          of Personal Information Act, 2013 (POPIA).
        </Section>

        <Section title="10. Contact">
          Email: info@dailybloom.co.za
          <br />
          Phone / WhatsApp: 076 361 6044
        </Section>

        <div style={{ marginTop: 32 }}>
          <Link href="/legal?reviewed=true" style={primaryLink}>
            I have read the Privacy Policy. Continue to Acceptance
          </Link>
        </div>
      </section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 24 }}>
      <h2 style={sectionTitleStyle}>{title}</h2>
      <p style={paragraphStyle}>{children}</p>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "#FFF8F2",
  color: "#2D2A3E",
  padding: "32px 18px",
};

const cardStyle = {
  maxWidth: "900px",
  margin: "0 auto",
  background: "#FFFFFF",
  border: "1px solid #E9E0D4",
  borderRadius: "24px",
  padding: "28px",
  boxShadow: "0 10px 24px rgba(86, 118, 158, 0.06)",
};

const titleStyle = {
  marginTop: "0",
  marginBottom: "8px",
  fontSize: "36px",
};

const dateStyle = {
  color: "#7A6F86",
  marginBottom: "28px",
};

const sectionTitleStyle = {
  fontSize: "22px",
  marginBottom: "8px",
};

const paragraphStyle = {
  color: "#5F6275",
  lineHeight: 1.7,
  fontSize: "16px",
};

const primaryLink = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "48px",
  padding: "12px 18px",
  borderRadius: "16px",
  background: "#7CCCF3",
  color: "#24324A",
  fontWeight: 800,
  textDecoration: "none",
};