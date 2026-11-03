"use client";

import type { CSSProperties } from "react";

type AwardCertificateProps = {
  school?: {
    school_name?: string | null;
    logo_url?: string | null;
    primary_color?: string | null;
    secondary_color?: string | null;
  } | null;
  learnerName: string;
  awardName: string;
  awardSubtitle: string;
  awardReason: string;
  academicYear: number | string;
  teacherName: string;
  principalName: string;
  preview?: boolean;
};

export function AwardCertificate({
  school,
  learnerName,
  awardSubtitle,
  awardReason,
  academicYear,
  teacherName,
  principalName,
  preview = false,
}: AwardCertificateProps) {
  const primary = school?.primary_color || "#4f6fbd";
  const secondary = school?.secondary_color || "#D4AF37";
  const learnerSize = learnerName.length > 60 ? 40 : learnerName.length > 40 ? 48 : 58;

  return (
    <div
      className="award-certificate-document"
      style={{ "--award-primary": primary, "--award-secondary": secondary } as CSSProperties}
    >
      <div className="award-certificate-inner-border" />
      <div className="award-certificate-ribbon" />
      <div className="award-certificate-corner award-certificate-corner-top" />
      <div className="award-certificate-corner award-certificate-corner-bottom" />

      {school?.logo_url ? (
        <img
          src={school.logo_url}
          alt="School logo"
          className="award-certificate-logo"
        />
      ) : null}

      {preview ? (
        <div className="award-certificate-draft">
          DRAFT PREVIEW
        </div>
      ) : null}

      <div className="award-certificate-content">
        <div>
          <h1 className="award-certificate-title">CERTIFICATE</h1>
          <h2 className="award-certificate-subtitle">{awardSubtitle}</h2>
          <p className="award-certificate-presented">PROUDLY PRESENTED TO</p>
          <h2 className="award-certificate-learner" style={{ "--award-learner-size": `${learnerSize}px` } as CSSProperties}>{learnerName || "Learner Name"}</h2>
          <p className="award-certificate-reason">
            FOR {(awardReason || "AWARD REASON").toUpperCase()}
            <br />YEAR {academicYear}
          </p>
          <p className="award-certificate-school">{school?.school_name || "School Name"}</p>
        </div>

        <div className="award-certificate-signatures">
          {[{ name: teacherName, label: "CLASS PRACTITIONER" }, { name: principalName, label: "PRINCIPAL" }].map((signature) => (
            <div key={signature.label}>
              <p className="award-certificate-signature-name">{signature.name || "Not recorded"}</p>
              <p className="award-certificate-signature-label">{signature.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
