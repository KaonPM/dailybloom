"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { supabase } from "../lib/supabase";

type SponsorProgramme = {
  id: number;
  sponsor_name: string;
  programme_name: string;
};

const packages = [
  {
    name: "Bloom",
    description: "Core school admin tools for getting started.",
  },
  {
    name: "Bloom Pro",
    description: "More complete daily operations and communication support.",
  },
  {
    name: "Bloom Elite",
    description: "Full DailyBloom experience for growing schools.",
  },
];

export default function SignUpPage() {
  const [schoolName, setSchoolName] = useState("");
  const [schoolEmail, setSchoolEmail] = useState("");
  const [schoolPhone, setSchoolPhone] = useState("");
  const [schoolAddress, setSchoolAddress] = useState("");
  const [province, setProvince] = useState("");

  const [fullName, setFullName] = useState("");
  const [principalEmail, setPrincipalEmail] = useState("");
  const [principalPhone, setPrincipalPhone] = useState("");

  const [packageSelected, setPackageSelected] = useState("Bloom");

  const [isSponsored, setIsSponsored] = useState(false);
  const [sponsorProgrammeId, setSponsorProgrammeId] = useState("");
  const [sponsorProgrammes, setSponsorProgrammes] = useState<
    SponsorProgramme[]
  >([]);

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [permissionToContact, setPermissionToContact] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchSponsorProgrammes();
  }, []);

  async function fetchSponsorProgrammes() {
    const { data, error } = await supabase
      .from("sponsor_programmes")
      .select("*")
      .eq("status", "Active")
      .order("sponsor_name", { ascending: true });

    if (!error) {
      setSponsorProgrammes(data || []);
    }
  }

  async function handleSignUp(event: FormEvent) {
    event.preventDefault();
    setMessage("");

   if (
   !schoolName.trim() ||
   !schoolEmail.trim() ||
   !schoolPhone.trim() ||
   !schoolAddress.trim() ||
   !province.trim() ||
   !fullName.trim() ||
   !principalEmail.trim() ||
   !principalPhone.trim() ||
   !packageSelected
 ) {
      setMessage("Please complete all required fields.");
      return;
    }

    if (isSponsored && !sponsorProgrammeId) {
      setMessage("Please select the sponsor programme for this school.");
      return;
    }

    if (!acceptedTerms || !acceptedPrivacy || !permissionToContact) {
      setMessage(
        "Please accept the terms, privacy policy, and permission to be contacted."
      );
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("school_signup_requests").insert([
      {
        school_name: schoolName.trim(),
        school_email: schoolEmail.trim().toLowerCase(),
        school_phone: schoolPhone.trim(),
        school_address: schoolAddress.trim(),
        province: province.trim(),

        principal_full_name: fullName.trim(),
        principal_email: principalEmail.trim().toLowerCase(),
        principal_phone: principalPhone.trim(),

        package_selected: packageSelected,
        is_sponsored: isSponsored,
        sponsor_programme_id:
          isSponsored && sponsorProgrammeId ? Number(sponsorProgrammeId) : null,
        accepted_terms: true,
        accepted_privacy: true,
        permission_to_contact: true,

        status: "pending",
        onboarding_status: "application_received",
      },
    ]);

    if (error) {
      setMessage(error.message || "Could not submit request.");
      setLoading(false);
      return;
    }

    setSchoolName("");
    setSchoolEmail("");
    setSchoolPhone("");
    setSchoolAddress("");
    setProvince("");
    setFullName("");
    setPrincipalEmail("");
    setPrincipalPhone("");
    setPackageSelected("Bloom");
    setIsSponsored(false);
    setSponsorProgrammeId("");
    setAcceptedTerms(false);
    setAcceptedPrivacy(false);
    setPermissionToContact(false);

    setMessage(
      "Your sign-up request has been submitted. DailyBloom will review your application and contact you after approval."
    );

    setLoading(false);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#FFF8F2",
        padding: "32px 20px",
      }}
    >
      <div style={{ maxWidth: "680px", margin: "0 auto" }}>
        <Link
          href="/"
          style={{
            textDecoration: "none",
            color: "#6D6888",
            fontWeight: 700,
            fontSize: "14px",
          }}
        >
          {"<- Back to Home"}
        </Link>

        <div
          style={{
            marginTop: "18px",
            background: "#FFFFFF",
            border: "1px solid #E9E0D4",
            borderRadius: "24px",
            padding: "26px",
            boxShadow: "0 10px 24px rgba(86, 118, 158, 0.06)",
          }}
        >
          <p
            style={{
              margin: 0,
              color: "#F66BA0",
              fontWeight: 800,
              fontSize: "14px",
            }}
          >
            DailyBloom
          </p>

          <h1
            style={{
              margin: "10px 0 8px 0",
              fontSize: "34px",
              lineHeight: 1.1,
              color: "#2D2A3E",
              fontWeight: 800,
            }}
          >
            Sign up your school
          </h1>

          <p
            style={{
              margin: 0,
              color: "#5F6275",
              fontSize: "15px",
              lineHeight: 1.6,
            }}
          >
            Submit your school and principal details for review. After approval,
            DailyBloom will send your login details and onboarding requirements.
          </p>

          <form onSubmit={handleSignUp} style={{ marginTop: "22px" }}>
            <SectionTitle title="School Information" />

            <Input
              placeholder="School Name"
              value={schoolName}
              onChange={setSchoolName}
            />

            <Input
              placeholder="School Email Address"
              value={schoolEmail}
              onChange={setSchoolEmail}
              type="email"
            />

            <Input
              placeholder="School Phone Number"
              value={schoolPhone}
              onChange={setSchoolPhone}
            />

            <Input
              placeholder="School Physical Address"
              value={schoolAddress}
              onChange={setSchoolAddress}
            />

            <select
              value={province}
              onChange={(event) => setProvince(event.target.value)}
              style={inputStyle}
            >
              <option value="">Select Province</option>
              <option value="Eastern Cape">Eastern Cape</option>
              <option value="Free State">Free State</option>
              <option value="Gauteng">Gauteng</option>
              <option value="KwaZulu-Natal">KwaZulu-Natal</option>
              <option value="Limpopo">Limpopo</option>
              <option value="Mpumalanga">Mpumalanga</option>
              <option value="Northern Cape">Northern Cape</option>
              <option value="North West">North West</option>
              <option value="Western Cape">Western Cape</option>
            </select>

            <Checkbox
              checked={isSponsored}
              onChange={(checked) => {
                setIsSponsored(checked);
                if (!checked) {
                  setSponsorProgrammeId("");
                }
              }}
              label="School is part of a sponsored programme"
            />

            {isSponsored && (
              <select
                value={sponsorProgrammeId}
                onChange={(event) => setSponsorProgrammeId(event.target.value)}
                style={inputStyle}
              >
                <option value="">Select sponsor</option>
                {sponsorProgrammes.map((programme) => (
                  <option key={programme.id} value={programme.id}>
                    {programme.sponsor_name} - {programme.programme_name}
                  </option>
                ))}
              </select>
            )}

            <SectionTitle title="Principal Details" />

            <Input
              placeholder="Principal Full Name"
              value={fullName}
              onChange={setFullName}
            />

            <Input
              placeholder="Principal Email Address"
              value={principalEmail}
              onChange={setPrincipalEmail}
              type="email"
            />

            <Input
              placeholder="Principal Phone Number"
              value={principalPhone}
              onChange={setPrincipalPhone}
            />

            <SectionTitle title="Package Selection" />

            <div style={{ display: "grid", gap: "10px", marginBottom: "16px" }}>
              {packages.map((item) => (
                <label
                  key={item.name}
                  style={{
                    display: "flex",
                    gap: "12px",
                    alignItems: "flex-start",
                    border:
                      packageSelected === item.name
                        ? "2px solid #7CCCF3"
                        : "1px solid #E3D9CD",
                    borderRadius: "16px",
                    padding: "14px",
                    cursor: "pointer",
                    background:
                      packageSelected === item.name ? "#EAF7FD" : "#FFFFFF",
                  }}
                >
                  <input
                    type="radio"
                    name="package"
                    value={item.name}
                    checked={packageSelected === item.name}
                    onChange={(event) => setPackageSelected(event.target.value)}
                    style={{ marginTop: "4px" }}
                  />

                  <span>
                    <strong style={{ color: "#2D2A3E", fontSize: "15px" }}>
                      {item.name}
                    </strong>

                    <span
                      style={{
                        display: "block",
                        marginTop: "4px",
                        color: "#6D6888",
                        fontSize: "13px",
                        lineHeight: 1.5,
                      }}
                    >
                      {item.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <SectionTitle title="Agreement" />

            <Checkbox
              checked={acceptedTerms}
              onChange={setAcceptedTerms}
              label={
                <>
                  I accept the{" "}
                  <Link href="/terms" style={linkStyle}>
                    Terms and Conditions
                  </Link>
                  .
                </>
              }
            />

            <Checkbox
              checked={acceptedPrivacy}
              onChange={setAcceptedPrivacy}
              label={
                <>
                  I accept the{" "}
                  <Link href="/privacy" style={linkStyle}>
                    Privacy Policy
                  </Link>{" "}
                  and consent to DailyBloom processing the information submitted
                  in this form.
                </>
              }
            />

            <Checkbox
              checked={permissionToContact}
              onChange={setPermissionToContact}
              label="I give DailyBloom permission to contact me about my sign-up request, approval, payment and onboarding."
            />

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                height: "48px",
                border: "none",
                borderRadius: "14px",
                background: "#7CCCF3",
                color: "#24324A",
                fontWeight: 800,
                fontSize: "15px",
                cursor: "pointer",
                marginTop: "12px",
              }}
            >
              {loading ? "Submitting..." : "Submit Request"}
            </button>
          </form>

          {message ? (
            <p
              style={{
                margin: "14px 0 0 0",
                fontSize: "14px",
                color: "#6D6888",
                lineHeight: 1.6,
              }}
            >
              {message}
            </p>
          ) : null}

          <p
            style={{
              margin: "18px 0 0 0",
              fontSize: "14px",
              color: "#6D6888",
            }}
          >
            Already have login details?{" "}
            <Link
              href="/login"
              style={{
                color: "#F66BA0",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Login
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h2
      style={{
        margin: "22px 0 12px 0",
        color: "#2D2A3E",
        fontSize: "18px",
        fontWeight: 800,
      }}
    >
      {title}
    </h2>
  );
}

function Input({
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      style={inputStyle}
    />
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: ReactNode;
}) {
  return (
    <label
      style={{
        display: "flex",
        gap: "10px",
        alignItems: "flex-start",
        marginBottom: "10px",
        color: "#5F6275",
        fontSize: "14px",
        lineHeight: 1.5,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        style={{ marginTop: "3px" }}
      />
      <span>{label}</span>
    </label>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  height: "46px",
  padding: "0 14px",
  marginBottom: "12px",
  borderRadius: "14px",
  border: "1px solid #E3D9CD",
  fontSize: "15px",
  outline: "none",
  color: "#2D2A3E",
  background: "#FFFFFF",
};

const linkStyle: CSSProperties = {
  color: "#F66BA0",
  fontWeight: 700,
  textDecoration: "none",
};
