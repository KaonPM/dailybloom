"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function LandingPage() {
  const [isMobile, setIsMobile] = useState(false);
  const [openPackage, setOpenPackage] = useState<string | null>(null);

  const [contactName, setContactName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [sending, setSending] = useState(false);

  const dailyBloomPhoneDisplay = "076 361 6044";
  const dailyBloomPhoneCall = "+27763616044";
  const dailyBloomWhatsApp = "27763616044";

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= 768);
    }

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  async function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!contactName || !contactEmail || !contactMessage) {
      alert("Please add your name, email address and message.");
      return;
    }

    setSending(true);

    const response = await fetch("/api/dailybloom-contact", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: contactName,
        schoolName,
        phone: contactPhone,
        email: contactEmail,
        message: contactMessage,
      }),
    });

    if (!response.ok) {
      alert("Could not send your message. Please try again.");
      setSending(false);
      return;
    }

    setContactName("");
    setSchoolName("");
    setContactPhone("");
    setContactEmail("");
    setContactMessage("");
    setSending(false);

    alert("Message sent successfully.");
  }

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
                <Link href="/legal" style={{ ...primaryButton, width: isMobile ? "100%" : "auto" }}>
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

        <details style={contactDetailsBox(isMobile)}>
          <summary style={contactSummary(isMobile)}>Packages</summary>

          <p style={paragraph(isMobile)}>
            Choose the level of support that fits your school. Click view offering to see what is included.
          </p>

          <div style={{ marginTop: 18 }}>
            <div style={packageGrid(isMobile)}>
              <PackageCard
                name="Bloom"
                price="R299/month"
                learners="0 to 30 learners"
                summary="For small preschools ready to replace paper registers with a simple daily system."
                accent="#7CCCF3"
                isMobile={isMobile}
                isOpen={openPackage === "Bloom"}
                onClick={() => setOpenPackage(openPackage === "Bloom" ? null : "Bloom")}
                items={[
                  "Learner profiles and parent contact records",
                  "Daily attendance tracking",
                  "Birthdays and school events",
                  "Daily learner summaries",
                  "Basic broadcasts",
                  "Simple payment reminders",
                  "Standard setup support",
                ]}
              />

              <PackageCard
                name="Bloom Pro"
                price="R399/month"
                learners="31 to 60 learners"
                summary="For growing schools that need better structure, smoother admin, and clearer oversight."
                accent="#FFD166"
                isMobile={isMobile}
                isOpen={openPackage === "Bloom Pro"}
                onClick={() => setOpenPackage(openPackage === "Bloom Pro" ? null : "Bloom Pro")}
                badge="Popular"
                items={[
                  "Everything in Bloom",
                  "Classroom-based organisation",
                  "Principal overview dashboard",
                  "Teacher daily workflows",
                  "Export-ready school records",
                  "Stronger parent communication tools",
                  "Priority setup support",
                ]}
              />

              <PackageCard
                name="Bloom Elite"
                price="R499/month"
                learners="60+ learners"
                summary="For schools that want fuller operational support across school admin, staff, and payroll records."
                accent="#57C785"
                isMobile={isMobile}
                isOpen={openPackage === "Bloom Elite"}
                onClick={() => setOpenPackage(openPackage === "Bloom Elite" ? null : "Bloom Elite")}
                items={[
                  "Everything in Bloom Pro",
                  "WageFlow payroll support",
                  "Staff records",
                  "HR notes and staff admin support",
                  "Payslip-ready payroll records",
                  "Premium onboarding",
                  "Priority admin assistance",
                ]}
              />
            </div>

            <div style={noticeBox(isMobile)}>
              <h3 style={smallHeading(isMobile)}>Once-off setup fee</h3>
              <p style={paragraph(isMobile)}>
                R599 once off. This includes onboarding, school setup, administrative configuration
                and ongoing administrative assistance while your school remains subscribed.
              </p>
              <p style={paragraph(isMobile)}>
                After the first six months from launch date, monthly package prices may increase per plan.
                The setup fee remains R599.
              </p>
            </div>
          </div>
        </details>

        <details style={contactDetailsBox(isMobile)}>
          <summary style={contactSummary(isMobile)}>Contact DailyBloom</summary>

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

              <p style={paragraph(isMobile)}>
                Phone:{" "}
                <a href={`tel:${dailyBloomPhoneCall}`} style={contactLink}>
                  {dailyBloomPhoneDisplay}
                </a>
              </p>

              <p style={paragraph(isMobile)}>
                WhatsApp:{" "}
                <a
                  href={`https://wa.me/${dailyBloomWhatsApp}?text=Hello%20DailyBloom%2C%20I%20would%20like%20to%20find%20out%20more.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={contactLink}
                >
                  {dailyBloomPhoneDisplay}
                </a>
              </p>

              <p style={paragraph(isMobile)}>
                Email:{" "}
                <a href="mailto:info@dailybloom.co.za" style={contactLink}>
                  info@dailybloom.co.za
                </a>
              </p>
            </div>

            <form style={card(isMobile)} onSubmit={handleContactSubmit}>
              <h3 style={smallHeading(isMobile)}>Contact form</h3>

              <input style={inputStyle} placeholder="Your name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
              <input style={inputStyle} placeholder="School name" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
              <input style={inputStyle} placeholder="Phone number" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
              <input style={inputStyle} placeholder="Email address" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
              <textarea style={{ ...inputStyle, minHeight: 100, resize: "vertical" }} placeholder="Tell us what you need help with" value={contactMessage} onChange={(e) => setContactMessage(e.target.value)} />

              <button type="submit" style={{ ...primaryButton, width: "100%", marginTop: 8, cursor: "pointer" }} disabled={sending}>
                {sending ? "Sending..." : "Send Message"}
              </button>
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
              <Link href="/terms" style={footerLink}>Terms & Conditions</Link>
            </p>
            <p style={footerText}>© 2026 DailyBloom. All rights reserved.</p>
            <p style={footerText}>
              DailyBloom is a preschool management and parent communication platform for learner records,
              attendance, classroom activities, daily summaries, announcements and payment reminders.
            </p>
            <p style={footerText}>
              DailyBloom may help schools communicate with parents or guardians by WhatsApp, SMS, email
              or other approved communication channels.
            </p>
            <p style={footerText}>
              Schools remain responsible for obtaining parent or guardian consent and for ensuring that
              learner, parent and guardian information submitted to DailyBloom is accurate and lawfully collected.
            </p>
            <p style={footerText}>
              DailyBloom does not replace professional legal, financial, educational, medical, accounting
              or regulatory advice.
            </p>
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

function PackageCard({
  name,
  price,
  learners,
  summary,
  accent,
  isMobile,
  isOpen,
  onClick,
  items,
  badge,
}: {
  name: string;
  price: string;
  learners: string;
  summary: string;
  accent: string;
  isMobile: boolean;
  isOpen: boolean;
  onClick: () => void;
  items: string[];
  badge?: string;
}) {
  return (
    <div
      style={{
        ...card(isMobile),
        borderTop: `8px solid ${accent}`,
        transform: isOpen ? "translateY(-3px)" : "none",
        transition: "all 0.2s ease",
        outline: isOpen ? `2px solid ${accent}` : "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <div>
          <h3 style={smallHeading(isMobile)}>{name}</h3>
          <h2 style={{ margin: "8px 0", color: "#2D2A3E" }}>{price}</h2>
        </div>

        {badge && (
          <span
            style={{
              background: "#F66BA0",
              color: "#FFFFFF",
              borderRadius: 999,
              padding: "6px 10px",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            {badge}
          </span>
        )}
      </div>

      <p style={paragraph(isMobile)}>{learners}</p>
      <p style={paragraph(isMobile)}>{summary}</p>

      <button type="button" onClick={onClick} style={offeringButton}>
        {isOpen ? "Hide offering" : "View offering"}
      </button>

      {isOpen && (
        <ul style={{ margin: "12px 0 0 18px", padding: 0, color: "#5F6275", lineHeight: 1.7, fontSize: isMobile ? 14 : 15 }}>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
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

const offeringButton = {
  marginTop: 12,
  padding: 0,
  background: "transparent",
  border: "none",
  color: "#2D2A3E",
  fontWeight: 800,
  cursor: "pointer",
  fontSize: 15,
  textAlign: "left" as const,
};

const contactLink = {
  color: "#2D2A3E",
  fontWeight: 800,
  textDecoration: "none",
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
    alignItems: "start",
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