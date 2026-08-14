import Link from "next/link";
import styles from "./trust-security.module.css";

type Scope = "school" | "platform";

type Section = {
  title: string;
  description: string;
  points: string[];
  href: string;
  linkLabel: string;
};

function sectionsFor(scope: Scope): Section[] {
  const platformReports = "/master/reports";

  return [
    {
      title: "Access and roles",
      description: "See how access is separated by responsibility and delegated permission.",
      points: [
        "Role-based access separates practitioners, administrators, principals, owners and platform teams.",
        "Delegated permissions control which tools a user may open and use.",
        "Historical records retain their original attribution when staff access changes.",
      ],
      href: scope === "platform" ? "/platform-access" : "/staff-access",
      linkLabel: "Review access",
    },
    {
      title: "Parent consent",
      description: "Track clear, learner-specific consent decisions.",
      points: [
        "Photo, video, general and excursion consent is recorded per learner.",
        "Pending, approved and declined responses remain visible for accountability.",
        "No response is not treated as permission granted.",
      ],
      href: scope === "platform" ? platformReports : "/parent-permissions",
      linkLabel: scope === "platform" ? "Open platform reports" : "Open Parent Consent",
    },
    {
      title: "Communication delivery",
      description: "Keep an auditable view of parent communication across supported channels.",
      points: [
        "Parent portal, push, SMS, WhatsApp and email records are brought into one history.",
        "Delivery states can include queued, sent, delivered, read, failed and retried.",
        "Communication records help schools confirm when and how families were informed.",
      ],
      href: scope === "platform" ? platformReports : "/communications",
      linkLabel: scope === "platform" ? "Open platform reports" : "Open Communication Centre",
    },
    {
      title: "Incidents and safeguarding",
      description: "Support consistent incident recording, review and acknowledgement.",
      points: [
        "Incident records can include injury mapping, first-aid details and supporting evidence.",
        "Principal review and parent acknowledgement create a clear follow-up trail.",
        "Access remains limited by school context and assigned role permissions.",
      ],
      href: scope === "platform" ? platformReports : "/incident-reports",
      linkLabel: scope === "platform" ? "Open platform reports" : "Open Incident Reports",
    },
    {
      title: "Data rights and retention",
      description: "Make privacy choices and data-handling responsibilities easy to find.",
      points: [
        "Privacy, terms and data-deletion information is publicly available.",
        "Exports, retention and deletion follow documented operational procedures.",
        "Requests should be verified before learner or family information is released or removed.",
      ],
      href: "/data-deletion",
      linkLabel: "View data-deletion information",
    },
    {
      title: "Audit, backup and recovery",
      description: "Understand the controls that support trustworthy and recoverable records.",
      points: [
        "Reports and historical records support operational review and accountability.",
        "Database and document backups follow the documented backup procedure.",
        "Restoration is a controlled operational process and should be tested periodically.",
      ],
      href: scope === "platform" ? platformReports : "/reports",
      linkLabel: scope === "platform" ? "Open platform reports" : "Open school reports",
    },
  ];
}

export default function TrustSecurityCentre({ scope }: { scope: Scope }) {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Governance overview</p>
          <h1 className="db-page-title">Trust &amp; Security Centre</h1>
          <p className={styles.intro}>
            A clear view of how DailyBloom protects access, consent, communication and accountable records.
          </p>
        </div>
        <span className={styles.badge}>Read-only overview</span>
      </section>

      <section className={styles.grid} aria-label="Trust and security topics">
        {sectionsFor(scope).map((section, index) => (
          <details className={styles.section} key={section.title} open={index === 0}>
            <summary className={styles.summary}>
              <span>
                <strong>{section.title}</strong>
                <small>{section.description}</small>
              </span>
              <span className={styles.toggle} aria-hidden="true">+</span>
            </summary>
            <div className={styles.content}>
              <ul className={styles.points}>
                {section.points.map((point) => <li key={point}>{point}</li>)}
              </ul>
              <Link className={styles.action} href={section.href}>{section.linkLabel}</Link>
            </div>
          </details>
        ))}
      </section>
    </main>
  );
}
