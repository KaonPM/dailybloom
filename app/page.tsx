"use client";

import Link from "next/link";

export default function LandingPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#FFF8F2",
        color: "#2D2A3E",
      }}
    >
      <section
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "32px 24px 80px 24px",
        }}
      >
        <div
          style={{
            background: "#F8E8F0",
            border: "1px solid #EBC9D8",
            borderRadius: "28px",
            padding: "24px 28px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "36px",
            flexWrap: "wrap",
            gap: "18px",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "56px",
                lineHeight: 1,
                fontWeight: 800,
                color: "#2D2A3E",
              }}
            >
              Daily<span style={{ color: "#F66BA0" }}>Bloom</span>
            </h1>

            <p
              style={{
                margin: "10px 0 0 0",
                color: "#7A6F86",
                fontSize: "14px",
                fontWeight: 700,
                letterSpacing: "0.3px",
              }}
            >
              WHERE PRESCHOOLS BLOOM EVERY DAY
            </p>
          </div>

          <div style={{ textAlign: "right" }}>
            <h2
              style={{
                margin: 0,
                fontSize: "24px",
                color: "#F66BA0",
                fontWeight: 800,
              }}
            >
              Preschool Management App
            </h2>
            <p
              style={{
                margin: "6px 0 0 0",
                color: "#7A6F86",
                fontSize: "15px",
              }}
            ></p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 0.8fr",
            gap: "28px",
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E9E0D4",
              borderRadius: "22px",
              padding: "22px 22px",
              boxShadow: "0 10px 24px rgba(86, 118, 158, 0.06)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "-30px",
                right: "-20px",
                width: "180px",
                height: "180px",
                background: "#FFD166",
                borderRadius: "50%",
                opacity: 0.22,
              }}
            />

            <div
              style={{
                position: "absolute",
                bottom: "-50px",
                left: "-40px",
                width: "180px",
                height: "180px",
                background: "#57C785",
                borderRadius: "50%",
                opacity: 0.2,
              }}
            />

            <div style={{ position: "relative", zIndex: 1 }}>
              <p
                style={{
                  margin: 0,
                  color: "#F66BA0",
                  fontWeight: 800,
                  fontSize: "15px",
                }}
              >
                Preschool operations, simplified
              </p>

              <h2
                style={{
                  margin: "12px 0 14px 0",
                  fontSize: "40px",
                  lineHeight: 1.05,
                  color: "#2D2A3E",
                  fontWeight: 800,
                  maxWidth: "680px",
                }}
              >
                Where Preschools Bloom Every Day
              </h2>

              <p
                style={{
                  margin: 0,
                  maxWidth: "620px",
                  fontSize: "16px",
                  lineHeight: 1.6,
                  color: "#5F6275",
                }}
              >
                Simplify daily school operations, keep parents informed and
                bring warmth to every preschool day.
              </p>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  marginTop: "18px",
                  flexWrap: "wrap",
                }}
              >
                <Link href="/signup" style={primaryButton}>
                  Sign Up
                </Link>

                <Link href="/login" style={secondaryButton}>
                  Login
                </Link>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: "18px",
            }}
          >
            <FeatureCard
              title="Save time with smarter daily admin"
              body="Manage learners, attendance, birthdays, events and daily summaries without the clutter of a traditional admin system."
              accent="#7CCCF3"
            />
            <FeatureCard
              title="Keep parents connected"
              body="Create a warmer parent experience through clear updates, school notices and end-of-day communication that feels personal and professional."
              accent="#FFD166"
            />
            <FeatureCard
              title="Built for growing preschools"
              body="DailyBloom is designed for real preschool workflows, with classrooms, school branding and tools that support a calm, organised school day."
              accent="#57C785"
            />
          </div>
        </div>

        <div
          style={{
            marginTop: "34px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "18px",
          }}
        >
          <InfoBlock
            title="Everything your preschool needs in one place"
            text="Bring together attendance, learners, events, birthdays, daily summaries and school-wide messages in one calm workspace."
            border="#F66BA0"
            bg="#FDF1F7"
          />
          <InfoBlock
            title="Warm, professional parent communication"
            text="Help your school look organised, caring and consistent every day with updates that are simple to manage and easy for parents to understand."
            border="#FFD166"
            bg="#FFF8DD"
          />
          <InfoBlock
            title="Made for modern preschool teams"
            text="Designed for principals, admins and teachers who need a system that feels friendly and simple enough for daily use and structured enough to trust."
            border="#57C785"
            bg="#EAF8EF"
          />
        </div>

        <div
          style={{
            marginTop: "34px",
            background: "#F8E8F0",
            border: "1px solid #EBC9D8",
            borderRadius: "24px",
            padding: "22px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "14px",
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                color: "#2D2A3E",
                fontWeight: 800,
                fontSize: "18px",
              }}
            >
              DailyBloom
            </p>
            <p
              style={{
                margin: "4px 0 0 0",
                color: "#7A6F86",
                fontSize: "14px",
              }}
            >
              Where preschools bloom every day
            </p>
          </div>

          <p
            style={{
              margin: 0,
              color: "#7A6F86",
              fontSize: "14px",
            }}
          >
            Built for a mordern and organised preschool
          </p>
        </div>
      </section>
    </main>
  );
}

function FeatureCard({
  title,
  body,
  accent,
}: {
  title: string;
  body: string;
  accent: string;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E9E0D4",
        borderTop: `8px solid ${accent}`,
        borderRadius: "24px",
        padding: "22px",
        boxShadow: "0 10px 24px rgba(86, 118, 158, 0.06)",
      }}
    >
      <h3
        style={{
          margin: "0 0 10px 0",
          color: "#2D2A3E",
          fontSize: "22px",
          lineHeight: 1.25,
          fontWeight: 800,
        }}
      >
        {title}
      </h3>

      <p
        style={{
          margin: 0,
          color: "#5F6275",
          lineHeight: 1.6,
          fontSize: "16px",
        }}
      >
        {body}
      </p>
    </div>
  );
}

function InfoBlock({
  title,
  text,
  border,
  bg,
}: {
  title: string;
  text: string;
  border: string;
  bg: string;
}) {
  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: "22px",
        padding: "22px",
      }}
    >
      <h3
        style={{
          margin: "0 0 10px 0",
          color: "#2D2A3E",
          fontSize: "22px",
          fontWeight: 800,
        }}
      >
        {title}
      </h3>

      <p
        style={{
          margin: 0,
          color: "#5F6275",
          fontSize: "16px",
          lineHeight: 1.6,
        }}
      >
        {text}
      </p>
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