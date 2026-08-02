import type { StakeholderPresetKey } from "./types";

export const reportGroups = [
  {
    label: "Executive and Stakeholder",
    reports: ["Executive Dashboard Report"],
  },
  {
    label: "Schools and Adoption",
    reports: [
      "Schools Report",
      "School Growth",
      "Learners by School",
      "Practitioners by School",
      "School Activity Report",
      "School Usage Report",
      "Platform Overview",
      "Feature Usage",
      "User Activity",
      "Adoption Trends",
      "Active Schools",
      "Active Practitioners",
      "Active Parents",
      "Active Learners",
    ],
  },
  {
    label: "Financial Sustainability",
    reports: [
      "Revenue Report",
      "Subscriptions Report",
      "Package Breakdown",
      "Overdue Schools",
    ],
  },
  {
    label: "Communication and Safeguarding",
    reports: [
      "Daily Summaries Report",
      "Broadcast Report",
      "Payment Reminder Report",
      "SMS Delivery Report",
      "Homework Activity Report",
      "Learner Support Activity Report",
      "Achievement Awards Report",
      "Learner Requirements Report",
      "Parent Consent Report",
      "Incident Report Activity",
    ],
  },
  {
    label: "Learning and Readiness",
    reports: [
      "Progress Report Analytics",
      "Grade R Learner Reports",
      "Grade RR Progress Reports",
      "Developmental Progress Reports",
    ],
  },
  {
    label: "Sponsorship and Impact",
    reports: [
      "Sponsored Schools",
      "Sponsor Impact Report",
      "Learners Supported",
      "Practitioners Supported",
      "Attendance Impact",
      "Parent Engagement Impact",
    ],
  },
  {
    label: "WageFlow",
    reports: [
      "WageFlow Enabled Schools",
      "WageFlow Activity",
      "WageFlow Usage Trends",
      "WageFlow Adoption Report",
    ],
  },
] as const;

export const stakeholderPresets: Array<{
  key: StakeholderPresetKey;
  label: string;
  description: string;
  categories: string[];
}> = [
  {
    key: "executive",
    label: "Executive overview",
    description:
      "A balanced portfolio view of reach, learning, safeguarding, adoption and sustainability.",
    categories: [
      "Reach & Capacity",
      "Learning & Readiness",
      "Parent Engagement",
      "Safeguarding & Support",
      "Adoption & Data Quality",
      "Financial Sustainability",
      "Sponsorship & Impact",
    ],
  },
  {
    key: "dbe",
    label: "DBE / ECD",
    description:
      "School readiness, attendance, learner support, safeguarding and reliable operational data.",
    categories: [
      "Reach & Capacity",
      "Learning & Readiness",
      "Safeguarding & Support",
      "Adoption & Data Quality",
    ],
  },
  {
    key: "sponsor",
    label: "Sponsor / CSI",
    description:
      "Reach, learner participation, parent engagement and evidence of programme activity.",
    categories: [
      "Reach & Capacity",
      "Learning & Readiness",
      "Parent Engagement",
      "Sponsorship & Impact",
    ],
  },
  {
    key: "operations",
    label: "DailyBloom operations",
    description:
      "Platform adoption, school attention areas, communication and data completeness.",
    categories: [
      "Reach & Capacity",
      "Parent Engagement",
      "Safeguarding & Support",
      "Adoption & Data Quality",
    ],
  },
  {
    key: "financial",
    label: "Financial",
    description:
      "Expected recurring revenue, actual billing activity and portfolio payment position.",
    categories: ["Financial Sustainability", "Adoption & Data Quality"],
  },
];

