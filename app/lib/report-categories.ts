export const reportCategories = [
  {
    key: "early_literacy",
    label: "Early Literacy",
    description: "Letter recognition, listening skills, vocabulary, story participation",
  },
  {
    key: "numeracy",
    label: "Numeracy",
    description: "Number recognition, counting, shapes, basic patterns",
  },
  {
    key: "motor_skills",
    label: "Motor Skills",
    description: "Pencil grip, cutting, coordination, physical movement",
  },
  {
    key: "social_development",
    label: "Social Development",
    description: "Sharing, team participation, confidence, emotional expression",
  },
  {
    key: "communication",
    label: "Communication",
    description: "Speaking clearly, following instructions, participation",
  },
  {
    key: "personal_development",
    label: "Personal Development",
    description: "Independence, hygiene habits, responsibility, classroom behavior",
  },
  {
    key: "creativity",
    label: "Creativity",
    description: "Drawing, music participation, imagination, art engagement",
  },
];

export const reportLevels = [
  {
    value: "needs_support",
    label: "Needs Support",
  },
  {
    value: "progressing",
    label: "Progressing",
  },
  {
    value: "meeting_expectations",
    label: "Meeting Expectations",
  },
  {
    value: "exceeding_expectations",
    label: "Exceeding Expectations",
  },
];

export function formatReportLevel(value: string) {
  return reportLevels.find((level) => level.value === value)?.label || value;
}

export function formatReportCategory(value: string) {
  return reportCategories.find((category) => category.key === value)?.label || value;
}