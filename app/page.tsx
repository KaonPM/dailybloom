"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function LandingPage() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= 768);
    }

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <main style={{ minHeight: "100vh", background: "#FFF8F2", color: "#2D2A3E" }}>
      <section
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: isMobile ? "18px 14px 42px" : "32px 24px 80px",
        }}
      >
        <div style={topBar(isMobile)}>
          <div>
            <h1 style={logoText(isMobile)}>
              Daily<span style={{ color: "#F66BA0" }}>Bloom</span>
            </h1>
            <p style={tagline(isMobile)}>WHERE PRESCHOOLS BLOOM EVERY DAY</p>
          </div>

          <div style={{ textAlign: isMobile ? "left" : "right", width: isMobile ? "100%" : "auto" }}>
            <h2 style={appTitle(isMobile)}>Preschool Management App</h2>
            <p style={subtleText(isMobile)}>Powered by Lesedi Smart Solutions</p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 0.8fr", gap: isMobile ? 14 : 28 }}>
          <div style={heroCard(isMobile)}>
            <div style={sunShape(isMobile)} />
            <div style={greenShape(isMobile)} />

            <div style={{ position: "relative", zIndex: 1 }}>
              <p style={pinkEyebrow(isMobile)}>Preschool operations, simplified</p>

              <h2 style={heroHeading(isMobile)}>Where Preschools Bloom Every Day</h2>

              <p style={heroBody(isMobile)}>
                DailyBloom helps preschools manage learners, attendance, summaries, events, broadcasts,
                payments and parent communication from one warm and organised workspace.
              </p>

              <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
                <Link href="/signup" style={{ ...primaryButton, width: isMobile ? "100%" : "auto" }}>
                  Sign Up
                </Link>

                <Link href="/login" style={{ ...secondaryButton, width: isMobile ? "100%" : "auto" }}>
                  Login
                </Link>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: isMobile ? 10 : 18 }}>
            <FeatureCard title="Daily admin in one place" body="Manage learners, attendance, birthdays, activities, events, summaries, broadcasts, and payments without scattered paperwork." accent="#7CCCF3" isMobile={isMobile} />
            <FeatureCard title="WhatsApp-ready communication" body="Prepare parent summaries, broadcasts, and payment reminders now, with WhatsApp API sending planned for integration." accent="#FFD166" isMobile={isMobile} />
            <FeatureCard title="Built for preschool teams" body="Principals get full school oversight. Teachers see only their assigned classroom and daily workflows." accent="#57C785" isMobile={isMobile} />
          </div>
        </div>

        <SectionTitle title="Packages" subtitle="Launch pricing available for the first six months from launch date." isMobile={isMobile} />

        <div style={packageGrid(isMobile)}>
          <PackageCard name="Bloom" price="R299/month" learners="0 to 30 learners" details="Core preschool management for smaller schools." accent="#7CCCF3" isMobile={isMobile} />
          <PackageCard name="Bloom Pro" price="R399/month" learners="31 to 60 learners" details="For growing preschools that need more learner capacity." accent="#FFD166" isMobile={isMobile} />
          <PackageCard name="Bloom Elite" price="R499/month" learners="60+ learners" details="Includes WageFlow payroll and HR support for staff records." accent="#57C785" isMobile={isMobile} />
        </div>

        <div style={noticeBox(isMobile)}>
          <h3 style={smallHeading(isMobile)}>Once-off setup fee</h3>
          <p style={paragraph(isMobile)}>
            R599 once off. This includes onboarding, school setup, administrative configuration,
            and ongoing administrative assistance while your school remains subscribed.
          </p>
          <p style={paragraph(isMobile)}>
            After the first six months from launch date, monthly package prices may increase by R100 per plan.
            The setup fee remains R599.
          </p>
        </div>

        <details style={contactDetailsBox(isMobile)}>
          <summary style={contactSummary(isMobile)}>
            Contact DailyBloom
          </summary>

          <p style={paragraph(isMobile)}>
            Send us your details and we will guide you through onboarding.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: 18,
              marginTop: 16,
            }}
          >
            <div style={card(isMobile)}>
              <h3 style={smallHeading(isMobile)}>Contact details</h3>
              <p style={paragraph(isMobile)}>Phone: 076 361 6044</p>
              <p style={paragraph(isMobile)}>WhatsApp: 076 361 6044</p>
              <p style={paragraph(isMobile)}>Email: info@dailybloom.co.za</p>
            </div>

            <form style={card(isMobile)}>
              <h3 style={smallHeading(isMobile)}>Contact form</h3>

              <input style={inputStyle} placeholder="Your name" />
              <input style={inputStyle} placeholder="School name" />
              <input style={inputStyle} placeholder="Phone number" />
              <input style={inputStyle} placeholder="Email address" />
              <textarea style={{ ...inputStyle, minHeight: 100, resize: "vertical" }} placeholder="Tell us what you need help with" />

              <a href="mailto:info@dailybloom.co.za" style={{ ...primaryButton, width: "100%", marginTop: 8 }}>
                Email DailyBloom
              </a>
            </form>
          </div>
        </details>

        <footer style={footer(isMobile)}>
          <div>
            <strong>DailyBloom</strong>
            <p style={footerText}>Powered by Lesedi Smart Solutions (Pty) Ltd</p>
            <p style={footerText}>Business registration number: 2026/315790/07</p>
            <p style={footerText}>Registered with the Information Regulator South Africa</p>
            <p style={footerText}>POPIA registration number: 2026-010141</p>
          </div>

          <div>
            <p style={footerText}>
              <Link href="/privacy" style={footerLink}>Privacy Policy</Link>
              <span style={{ margin: "0 8px" }}>|</span>
              <Link href="/terms" style={footerLink}>Terms of Use</Link>
            </p>
            <p style={footerText}>© 2026 DailyBloom. All rights reserved.</p>
          </div>
        </footer>
      </section>
    </main>
  );
}

function FeatureCard({ title, body, accent, isMobile }: { title: string; body: string; accent: string; isMobile: boolean }) {
  return (
    <div style={{ ...card(isMobile), borderTop: `8px solid ${accent}` }}>
      <h3 style={smallHeading(isMobile)}>{title}</h3>
      <p style={paragraph(isMobile)}>{body}</p>
    </div>
  );
}

function PackageCard({ name, price, learners, details, accent, isMobile }: { name: string; price: string; learners: string; details: string; accent: string; isMobile: boolean }) {
  return (
    <div style={{ ...card(isMobile), borderTop: `8px solid ${accent}` }}>
      <h3 style={smallHeading(isMobile)}>{name}</h3>
      <h2 style={{ margin: "8px 0", color: "#2D2A3E" }}>{price}</h2>
      <p style={paragraph(isMobile)}>{learners}</p>
      <p style={paragraph(isMobile)}>{details}</p>
    </div>
  );
}

function SectionTitle({ title, subtitle, isMobile }: { title: string; subtitle: string; isMobile: boolean }) {
  return (
    <div style={{ marginTop: isMobile ? 24 : 42, marginBottom: 16 }}>
      <h2 style={{ margin: 0, fontSize: isMobile ? 26 : 34, color: "#2D2A3E" }}>{title}</h2>
      <p style={paragraph(isMobile)}>{subtitle}</p>
    </div>
  );
}

const primaryButton = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "48px",
  padding: "12px 22px",
  borderRadius: "16px",
  background: "#7CCCF3",
  color: "#24324A",
  fontWeight: 800,
  textDecoration: "none",
  border: "none",
};

const secondaryButton = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "48px",
  padding: "12px 22px",
  borderRadius: "16px",
  background: "#FFF1BA",
  color: "#2D2A3E",
  fontWeight: 800,
  textDecoration: "none",
  border: "1px solid #F0D98A",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  marginBottom: 10,
  border: "1px solid #E9E0D4",
  borderRadius: 14,
  padding: "12px 14px",
  fontSize: 14,
  background: "#FFFDFB",
};

const footerText = {
  margin: "6px 0 0 0",
  color: "#7A6F86",
  fontSize: 13,
};

const footerLink = {
  color: "#7A6F86",
  fontSize: 13,
  fontWeight: 700,
  textDecoration: "none",
};

function topBar(isMobile: boolean): React.CSSProperties {
  return {
    background: "#F8E8F0",
    border: "1px solid #EBC9D8",
    borderRadius: isMobile ? 20 : 28,
    padding: isMobile ? "16px" : "24px 28px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: isMobile ? "flex-start" : "center",
    marginBottom: isMobile ? 20 : 36,
    flexWrap: "wrap",
    gap: isMobile ? 12 : 18,
  };
}

function logoText(isMobile: boolean): React.CSSProperties {
  return {
    margin: 0,
    fontSize: isMobile ? 34 : 56,
    lineHeight: 1,
    fontWeight: 800,
    color: "#2D2A3E",
  };
}

function tagline(isMobile: boolean): React.CSSProperties {
  return {
    margin: isMobile ? "8px 0 0 0" : "10px 0 0 0",
    color: "#7A6F86",
    fontSize: isMobile ? 11 : 14,
    fontWeight: 700,
    letterSpacing: "0.3px",
  };
}

function appTitle(isMobile: boolean): React.CSSProperties {
  return {
    margin: 0,
    fontSize: isMobile ? 18 : 24,
    color: "#F66BA0",
    fontWeight: 800,
  };
}

function subtleText(isMobile: boolean): React.CSSProperties {
  return {
    margin: "6px 0 0 0",
    color: "#7A6F86",
    fontSize: isMobile ? 13 : 15,
  };
}

function heroCard(isMobile: boolean): React.CSSProperties {
  return {
    background: "#FFFFFF",
    border: "1px solid #E9E0D4",
    borderRadius: isMobile ? 18 : 22,
    padding: isMobile ? "18px 16px" : "22px",
    boxShadow: "0 10px 24px rgba(86, 118, 158, 0.06)",
    position: "relative",
    overflow: "hidden",
  };
}

function sunShape(isMobile: boolean): React.CSSProperties {
  return {
    position: "absolute",
    top: -30,
    right: -20,
    width: isMobile ? 120 : 180,
    height: isMobile ? 120 : 180,
    background: "#FFD166",
    borderRadius: "50%",
    opacity: 0.22,
  };
}

function greenShape(isMobile: boolean): React.CSSProperties {
  return {
    position: "absolute",
    bottom: -50,
    left: -40,
    width: isMobile ? 120 : 180,
    height: isMobile ? 120 : 180,
    background: "#57C785",
    borderRadius: "50%",
    opacity: 0.2,
  };
}

function pinkEyebrow(isMobile: boolean): React.CSSProperties {
  return {
    margin: 0,
    color: "#F66BA0",
    fontWeight: 800,
    fontSize: isMobile ? 13 : 15,
  };
}

function heroHeading(isMobile: boolean): React.CSSProperties {
  return {
    margin: isMobile ? "10px 0 12px" : "12px 0 14px",
    fontSize: isMobile ? 30 : 40,
    lineHeight: 1.05,
    color: "#2D2A3E",
    fontWeight: 800,
    maxWidth: isMobile ? "100%" : 680,
  };
}

function heroBody(isMobile: boolean): React.CSSProperties {
  return {
    margin: 0,
    maxWidth: isMobile ? "100%" : 620,
    fontSize: isMobile ? 15 : 16,
    lineHeight: 1.6,
    color: "#5F6275",
  };
}

function card(isMobile: boolean): React.CSSProperties {
  return {
    background: "#FFFFFF",
    border: "1px solid #E9E0D4",
    borderRadius: isMobile ? 18 : 24,
    padding: isMobile ? 16 : 22,
    boxShadow: "0 10px 24px rgba(86, 118, 158, 0.06)",
  };
}

function smallHeading(isMobile: boolean): React.CSSProperties {
  return {
    margin: "0 0 10px 0",
    color: "#2D2A3E",
    fontSize: isMobile ? 18 : 22,
    fontWeight: 800,
  };
}

function paragraph(isMobile: boolean): React.CSSProperties {
  return {
    margin: "6px 0 0 0",
    color: "#5F6275",
    fontSize: isMobile ? 14 : 16,
    lineHeight: 1.6,
  };
}

function packageGrid(isMobile: boolean): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
    gap: isMobile ? 12 : 18,
  };
}

function noticeBox(isMobile: boolean): React.CSSProperties {
  return {
    marginTop: isMobile ? 18 : 24,
    background: "#F8E8F0",
    border: "1px solid #EBC9D8",
    borderRadius: isMobile ? 18 : 24,
    padding: isMobile ? 16 : 22,
  };
}

function contactDetailsBox(isMobile: boolean): React.CSSProperties {
  return {
    marginTop: isMobile ? 24 : 42,
    background: "#FFFFFF",
    border: "1px solid #E9E0D4",
    borderRadius: isMobile ? 18 : 24,
    padding: isMobile ? 16 : 22,
    boxShadow: "0 10px 24px rgba(86, 118, 158, 0.06)",
  };
}

function contactSummary(isMobile: boolean): React.CSSProperties {
  return {
    cursor: "pointer",
    color: "#2D2A3E",
    fontSize: isMobile ? 20 : 26,
    fontWeight: 800,
  };
}

function footer(isMobile: boolean): React.CSSProperties {
  return {
    marginTop: isMobile ? 26 : 42,
    background: "#F8E8F0",
    border: "1px solid #EBC9D8",
    borderRadius: isMobile ? 18 : 24,
    padding: isMobile ? 16 : 22,
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  };
}