"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

const CERTIFICATE_WIDTH = 1122;
const CERTIFICATE_HEIGHT = 794;

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

function AwardBadge() {
  const points = Array.from({ length: 32 }, (_, index) => {
    const angle = (-Math.PI / 2) + (index * Math.PI / 16);
    const radius = index % 2 === 0 ? 136 : 108;
    return `${155 + Math.cos(angle) * radius},${140 + Math.sin(angle) * radius}`;
  }).join(" ");

  return (
    <svg className="award-certificate-badge" viewBox="0 0 310 400" role="img" aria-label="Best Award">
      <defs>
        <linearGradient id="award-badge-gold" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#f5dc76" />
          <stop offset=".48" stopColor="#c49a2d" />
          <stop offset="1" stopColor="#f0ce5a" />
        </linearGradient>
      </defs>
      <path d="M87 223 50 361 106 338 138 381 166 243Z" fill="var(--award-primary)" stroke="var(--award-gold)" strokeWidth="5" strokeLinejoin="round" />
      <path d="m223 223 37 138-56-23-32 43-28-138Z" fill="var(--award-primary)" stroke="var(--award-gold)" strokeWidth="5" strokeLinejoin="round" />
      <polygon points={points} fill="url(#award-badge-gold)" />
      <circle cx="155" cy="140" r="113" fill="var(--award-primary)" stroke="var(--award-gold)" strokeWidth="5" />
      <circle cx="155" cy="140" r="101" fill="none" stroke="var(--award-gold)" strokeWidth="3" />
      <circle cx="155" cy="140" r="95" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="2" />
      <text x="155" y="74" textAnchor="middle" fill="var(--award-gold)" fontSize="17" letterSpacing="4">★★★★★</text>
      <text x="155" y="143" textAnchor="middle" fill="#fff" fontFamily="Montserrat, Arial, sans-serif" fontSize="44" fontWeight="900" letterSpacing="2">BEST</text>
      <text x="155" y="181" textAnchor="middle" fill="#fff" fontFamily="Montserrat, Arial, sans-serif" fontSize="28" fontWeight="400" letterSpacing="1">AWARD</text>
      <text x="155" y="213" textAnchor="middle" fill="var(--award-gold)" fontSize="17" letterSpacing="4">★★★★★</text>
    </svg>
  );
}

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
  const previewShellRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [learnerSize, setLearnerSize] = useState(112);
  const primary = school?.primary_color || "#4f6fbd";
  const secondary = school?.secondary_color || "#D4AF37";
  const displayLearnerName = learnerName || "Learner Name";

  useEffect(() => {
    const shell = previewShellRef.current;
    if (!shell) return;

    const updateScale = () => {
      const nextScale = Math.min(1, shell.clientWidth / CERTIFICATE_WIDTH);
      setPreviewScale((currentScale) => Math.abs(currentScale - nextScale) < 0.001 ? currentScale : nextScale);
    };

    const observer = new ResizeObserver(updateScale);
    observer.observe(shell);
    updateScale();

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const content = mainContentRef.current;
    if (!content) return;
    let cancelled = false;

    void content.ownerDocument.fonts.ready.then(() => {
      if (cancelled) return;

      const context = content.ownerDocument.createElement("canvas").getContext("2d");
      if (!context) {
        console.error("Could not measure the certificate learner name.");
        return;
      }

      const maxFontSize = 112;
      context.font = `${maxFontSize}px "Great Vibes", "Brush Script MT", cursive`;
      const textWidth = context.measureText(displayLearnerName).width;
      const availableWidth = Math.max(1, content.clientWidth - 48);
      const fittedSize = Math.max(40, Math.min(maxFontSize, maxFontSize * availableWidth / Math.max(textWidth, 1)));
      setLearnerSize(fittedSize);
    });

    return () => {
      cancelled = true;
    };
  }, [displayLearnerName]);

  return (
    <div
      ref={previewShellRef}
      className="award-certificate-preview-shell"
      style={{ height: `${CERTIFICATE_HEIGHT * previewScale}px` }}
    >
      <div
        className="award-certificate-preview-canvas"
        style={{ transform: `scale(${previewScale})` }}
      >
        <div
          className="award-certificate-document"
          style={{ "--award-primary": primary, "--award-secondary": secondary } as CSSProperties}
        >
          <div className="award-certificate-inner-border" />
          <div className="award-certificate-ribbon" />
          <div className="award-certificate-corner award-certificate-corner-top" />
          <div className="award-certificate-corner award-certificate-corner-bottom" />
          <AwardBadge />

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
            <div ref={mainContentRef} className="award-certificate-main-content">
              <h1 className="award-certificate-title">CERTIFICATE</h1>
              <h2 className="award-certificate-subtitle">{awardSubtitle}</h2>
              <p className="award-certificate-presented">PROUDLY PRESENTED TO</p>
              <h2 className="award-certificate-learner" style={{ fontSize: `${learnerSize}px` }}>{displayLearnerName}</h2>
              <p className="award-certificate-reason">
                FOR {(awardReason || "AWARD REASON").toUpperCase()}
                <br />YEAR {academicYear}
              </p>
              {!school?.logo_url ? <p className="award-certificate-school">{school?.school_name || "School Name"}</p> : null}
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
      </div>
    </div>
  );
}
