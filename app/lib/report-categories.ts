export const reportCategories = [
  {
    key: "wellbeing",
    label: "Well-being",
    description:
      "Physical development, emotional well-being, self-care and healthy participation in daily activities",
  },

  {
    key: "identity_belonging",
    label: "Identity and Belonging",
    description:
      "Self-awareness, confidence, social identity, independence and sense of belonging",
  },

  {
    key: "communication",
    label: "Communication",
    description:
      "Language, listening, speaking and early literacy foundations",
  },

  {
    key: "creativity",
    label: "Creativity",
    description:
      "Creative expression through art, music, movement and imaginative play",
  },

  {
    key: "knowledge_world",
    label: "Knowledge and Understanding of the World",
    description:
      "Awareness of the environment, community, nature and everyday experiences",
  },

  {
    key: "mathematical_literacy",
    label: "Mathematical Literacy Foundations",
    description:
      "Early numeracy, patterns, counting, sorting and problem-solving foundations",
  },
];

export const reportLevels = [
  {
    value: "needs_support",
    label: "Needs Support",
  },

  {
    value: "emerging",
    label: "Emerging",
  },

  {
    value: "developing",
    label: "Developing",
  },

  {
    value: "achieved",
    label: "Achieved",
  },
];

export function formatReportLevel(value: string) {
  return (
    reportLevels.find((level) => level.value === value)?.label || value
  );
}

export function formatReportCategory(value: string) {
  return (
    reportCategories.find((category) => category.key === value)?.label || value
  );
}