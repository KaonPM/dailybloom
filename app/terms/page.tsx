import Link from "next/link";

export default function TermsPage() {
  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <h1 style={titleStyle}>DailyBloom Service Agreement and Terms of Use</h1>
        <p style={dateStyle}>Last updated: 28 April 2026</p>

        <Section title="1. Parties">
          This Agreement is entered into between Lesedi Smart Solutions (Pty) Ltd,
          trading as DailyBloom and the preschool, early childhood development
          centre or school subscribing to the service.
        </Section>

        <Section title="2. Nature of Service">
          DailyBloom provides a digital platform designed to support preschool
          operations, including learner records, attendance, daily summaries,
          events, broadcasts, payment reminders, classroom organisation, staff
          records, payroll tools where applicable, onboarding and administrative
          support.
        </Section>

        <Section title="3. Contract Term">
          This Agreement runs for a fixed term of twelve (12) months from the
          agreed service start date.
        </Section>

        <Section title="4. Subscription Packages">
          Bloom: R299 per month
          <br />
          Bloom Pro: R399 per month
          <br />
          Bloom Elite: R499 per month
        </Section>

        <Section title="5. Setup Fee and First Payment">
          Before onboarding, account setup, or service activation can begin,
          payment must first be received. The first payment includes the once-off
          setup fee of R599 and the first month subscription fee for the selected
          package.
          <br />
          <br />
          No onboarding or activation work will commence until cleared payment
          reflects.
        </Section>

        <Section title="6. What the Setup Fee Covers">
          The setup fee includes onboarding support, school profile creation,
          administrative configuration, basic branding setup where applicable,
          user access preparation, account readiness checks and initial assistance
          during launch.
        </Section>

        <Section title="7. Billing Model">
          All subscriptions are billed in advance. Monthly subscription fees are
          payable on the agreed billing date each month.
        </Section>

        <Section title="8. Payment Details">
          Account Name: Lesedi Smart Solutions
          <br />
          Bank: Capitec Bank
          <br />
          Account Number: 1055241094
          <br />
          Reference: Preschool Name
        </Section>

        <Section title="9. Late Payment and Suspension">
          If payment is not received within fourteen (14) days of the agreed
          payment date, DailyBloom may suspend platform access, pause support
          services, restrict selected features, delay updates or assistance or
          discontinue services until the account is brought up to date.
        </Section>

        <Section title="10. Pricing Changes">
          After the first six (6) months from launch date, monthly package prices
          may increase by up to R100 per plan for new schools. The once-off setup
          fee remains R599 unless otherwise communicated. Prices are reviewed
          annually.
        </Section>

        <Section title="11. School Responsibilities">
          The school agrees to provide accurate information, keep contact details
          updated, ensure authorised use of the system, protect login credentials,
          maintain consent where required for learner or parent data, use the
          platform lawfully and pay fees on time.
        </Section>

        <Section title="12. Data Responsibility">
          The school remains responsible for the accuracy, legality, and suitability
          of all information entered into DailyBloom.
        </Section>

        <Section title="13. Privacy and POPIA">
          DailyBloom will apply reasonable safeguards to protect information stored
          on the platform. Where applicable, both parties must act consistently with
          the Protection of Personal Information Act, 2013 (POPIA).
        </Section>

        <Section title="14. Communication Tools">
          DailyBloom may support or integrate with WhatsApp, SMS, email, or future
          approved messaging tools. Delivery may depend on third-party providers,
          internet availability, network performance and correct recipient details.
        </Section>

        <Section title="15. Availability and Support">
          DailyBloom aims to provide a stable service. However, uninterrupted access
          cannot be guaranteed due to maintenance, software updates, internet
          outages, hosting issues, third-party failures or unforeseen technical
          faults.
        </Section>

        <Section title="16. Acceptable Use">
          The school may not use DailyBloom to store unlawful content, access
          another school’s data, attempt unauthorised system access, distribute
          malicious software, misuse communication tools or damage the platform.
        </Section>

        <Section title="17. Cancellation">
          A school that wishes to cancel must provide at least thirty (30) days
          written notice before the intended cancellation date. Cancellation does
          not remove any outstanding amounts already due.
        </Section>

        <Section title="18. Termination by DailyBloom">
          DailyBloom may terminate or suspend this Agreement for non-payment,
          repeated breach of these Terms, unlawful use, abuse of staff or systems,
          fraudulent conduct or operational impossibility.
        </Section>

        <Section title="19. Limitation of Liability">
          DailyBloom is an administrative support platform. The school remains
          responsible for operational decisions, legal compliance, financial
          decisions, HR matters, payroll submissions, and communication sent in its
          name.
        </Section>

        <Section title="20. Contact Details">
          DailyBloom
          <br />
          Lesedi Smart Solutions (Pty) Ltd
          <br />
          Email: info@dailybloom.co.za
          <br />
          Phone / WhatsApp: 076 361 6044
        </Section>

        <div style={{ marginTop: 32 }}>
          <Link href="/privacy?from=legal" style={primaryLink}>
            I have read the Terms of Use. Continue to Privacy Policy
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
  maxWidth: "950px",
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
  fontSize: "34px",
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