export const reportCategories = [
  {
    key: "wellbeing",
    label: "Well-being",
    description:
      "Physical development, emotional well-being, self-care and healthy participation in daily activities",

    mappedAreas: [
      "Gross motor abilities",
      "Fine motor abilities",
      "Movement and coordination",
      "Self-care and independence",
      "Healthy participation in activities",
    ],
  },

  {
    key: "identity_belonging",
    label: "Identity and Belonging",
    description:
      "Self-awareness, confidence, social identity, independence and sense of belonging",

    mappedAreas: [
      "Confidence and independence",
      "Social interaction",
      "Respect for others",
      "Classroom participation",
      "Emotional development",
    ],
  },

  {
    key: "communication",
    label: "Communication",
    description:
      "Language, listening, speaking and early literacy foundations",

    mappedAreas: [
      "Listening skills",
      "Speaking and pronunciation",
      "Storytelling and discussion",
      "Following instructions",
      "Emergent literacy",
    ],
  },

  {
    key: "creativity",
    label: "Creativity",
    description:
      "Creative expression through art, music, movement and imaginative play",

    mappedAreas: [
      "Drawing and colouring",
      "Music and rhythm",
      "Creative play",
      "Art expression",
      "Imaginative participation",
    ],
  },

  {
    key: "knowledge_world",
    label: "Knowledge and Understanding of the World",
    description:
      "Awareness of the environment, community, nature and everyday experiences",

    mappedAreas: [
      "Shapes and colours",
      "Patterns and sequencing",
      "Observation skills",
      "Environmental awareness",
      "Perceptual development",
    ],
  },

  {
    key: "mathematical_literacy",
    label: "Mathematical Literacy Foundations",
    description:
      "Early numeracy, patterns, counting, sorting and problem-solving foundations",

    mappedAreas: [
      "Counting",
      "Number recognition",
      "Sorting and matching",
      "Patterns and sequencing",
      "Early problem-solving",
    ],
  },
];

export const reportLevels = [
  {
    value: "needs_practice",
    label: "NP - Needs Practice",
  },

  {
    value: "partially_achieved",
    label: "PA - Partially Achieved",
  },

  {
    value: "achieved",
    label: "A - Achieved",
  },

  {
    value: "good",
    label: "G - Good",
  },

  {
    value: "very_good",
    label: "VG - Very Good",
  },
];

export function formatReportLevel(value: string) {
  const formatted = reportLevels.find(
    (level) => level.value === value
  )?.label;

  if (formatted) return formatted;

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatReportCategory(value: string) {
  return (
    reportCategories.find((category) => category.key === value)?.label || value
  );
}