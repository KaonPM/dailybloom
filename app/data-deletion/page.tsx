import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "User Data Deletion | DailyBloom",
  description:
    "Instructions for requesting deletion of personal information held through DailyBloom.",
};

export default function DataDeletionPage() {
  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <Link href="/" style={backLinkStyle}>
          &larr; Back to Home
        </Link>

        <div style={eyebrowStyle}>PRIVACY &amp; POPIA</div>
        <h1 style={titleStyle}>User Data Deletion</h1>
        <p style={leadStyle}>
          You may ask DailyBloom to delete personal information associated with
          your account, learner profile or school, subject to identity
          verification and applicable legal retention requirements.
        </p>

        <div style={noticeStyle}>
          <strong>How to submit a request</strong>
          <p style={noticeParagraphStyle}>
            Email your request to{" "}
            <a
              href="mailto:kaone.setae@dailybloom.co.za?subject=DailyBloom%20User%20Data%20Deletion%20Request"
              style={inlineLinkStyle}
            >
              kaone.setae@dailybloom.co.za
            </a>{" "}
            using the subject <em>DailyBloom User Data Deletion Request</em>.
          </p>
        </div>

        <Section title="1. Information to include">
          Provide your full name, contact number, email address, the name of the
          preschool and, where relevant, the learner&apos;s full name. Please
          describe the information or account you want deleted. Do not email
          passwords, PINs or copies of identity documents unless DailyBloom
          requests them through an approved secure process.
        </Section>

        <Section title="2. Identity and authority verification">
          To protect children, parents, practitioners and schools, DailyBloom
          will verify your identity and authority before deleting information.
          A parent or guardian may request deletion of information connected to
          their learner. A school representative may request deletion of a
          school account where they are authorised to do so.
        </Section>

        <Section title="3. What happens next">
          We will acknowledge the request and provide a reference or
          confirmation. Once verification is complete, we will assess the
          request and communicate the outcome. Valid requests are normally
          completed within 30 days, unless the request is complex or the law
          permits a longer period.
        </Section>

        <Section title="4. Information that may be retained">
          Some records may need to be retained for legal, safeguarding,
          financial, audit, dispute-resolution, fraud-prevention or legitimate
          operational purposes. Where complete deletion is not permitted, access
          will be restricted and the information will only be retained for the
          required period. Backup copies may remain temporarily until the normal
          secure backup-retention cycle completes.
        </Section>

        <Section title="5. School-managed information">
          Schools use DailyBloom to manage learner and parent information. If
          your request concerns information controlled by a preschool, we may
          refer the request to that school or work with it to complete the
          request. Deleting a DailyBloom login does not automatically erase
          records that the school is legally required to retain.
        </Section>

        <Section title="6. Meta and WhatsApp information">
          If you used WhatsApp to receive a DailyBloom enrolment message, access
          code or secure form link, include the mobile number that received the
          message. DailyBloom will identify and delete eligible records under its
          control. Messages or records retained independently by Meta, your
          mobile network or your device are governed by those providers&apos;
          policies.
        </Section>

        <Section title="7. Questions or complaints">
          DailyBloom is operated by Lesedi Smart Solutions (Pty) Ltd and aims to
          process requests consistently with the Protection of Personal
          Information Act, 2013 (POPIA). You may contact us at
          kaone.setae@dailybloom.co.za. You may also approach South Africa&apos;s
          Information Regulator if you believe your personal information has not
          been handled appropriately.
        </Section>

        <div style={actionsStyle}>
          <a
            href="mailto:kaone.setae@dailybloom.co.za?subject=DailyBloom%20User%20Data%20Deletion%20Request"
            style={primaryLinkStyle}
          >
            Request data deletion
          </a>
          <Link href="/privacy" style={secondaryLinkStyle}>
            Read Privacy Policy
          </Link>
        </div>

        <p style={updatedStyle}>Last updated: 12 August 2026</p>
      </section>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={sectionStyle}>
      <h2 style={sectionTitleStyle}>{title}</h2>
      <p style={paragraphStyle}>{children}</p>
    </section>
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
  padding: "clamp(22px, 5vw, 42px)",
  boxShadow: "0 10px 24px rgba(86, 118, 158, 0.06)",
};

const backLinkStyle = {
  display: "inline-flex",
  marginBottom: "24px",
  color: "#2D2A3E",
  textDecoration: "none",
  fontWeight: 700,
  fontSize: "14px",
};

const eyebrowStyle = {
  color: "#A74468",
  fontWeight: 800,
  letterSpacing: "0.08em",
  fontSize: "13px",
};

const titleStyle = {
  margin: "8px 0 12px",
  fontSize: "clamp(32px, 6vw, 46px)",
  lineHeight: 1.1,
};

const leadStyle = {
  color: "#5F6275",
  lineHeight: 1.7,
  fontSize: "18px",
  marginBottom: "28px",
};

const noticeStyle = {
  padding: "20px",
  borderRadius: "18px",
  border: "1px solid #B9E2F7",
  borderLeft: "6px solid #7CCCF3",
  background: "#F1FAFF",
  lineHeight: 1.6,
};

const noticeParagraphStyle = { margin: "6px 0 0", color: "#4F566A" };
const inlineLinkStyle = { color: "#8F3658", fontWeight: 800 };
const sectionStyle = { marginTop: "26px" };
const sectionTitleStyle = { fontSize: "21px", marginBottom: "8px" };
const paragraphStyle = { color: "#5F6275", lineHeight: 1.75, fontSize: "16px" };

const actionsStyle = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "12px",
  marginTop: "32px",
};

const primaryLinkStyle = {
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

const secondaryLinkStyle = {
  ...primaryLinkStyle,
  background: "#F9E8F0",
  border: "1px solid #EBC7D7",
};

const updatedStyle = { color: "#84778B", fontSize: "13px", marginTop: "28px" };
