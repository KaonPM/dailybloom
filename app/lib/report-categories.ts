export const reportCategories = [
  {
    key: "wellbeing",
    label: "Well-being",
    description:
      "Physical development, emotional well-being, self-care and healthy participation in daily activities",

    indicators: [
      { key: "gross_motor_abilities", label: "Gross motor abilities" },
      { key: "fine_motor_abilities", label: "Fine motor abilities" },
      { key: "movement_and_coordination", label: "Movement and coordination" },
      { key: "self_care_and_independence", label: "Self-care and independence" },
      {
        key: "healthy_participation_in_activities",
        label: "Healthy participation in activities",
      },
    ],

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

    indicators: [
      { key: "confidence_and_independence", label: "Confidence and independence" },
      { key: "social_interaction", label: "Social interaction" },
      { key: "respect_for_others", label: "Respect for others" },
      { key: "classroom_participation", label: "Classroom participation" },
      { key: "emotional_development", label: "Emotional development" },
    ],

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

    indicators: [
      { key: "listening_skills", label: "Listening skills" },
      { key: "speaking_and_pronunciation", label: "Speaking and pronunciation" },
      { key: "storytelling_and_discussion", label: "Storytelling and discussion" },
      { key: "following_instructions", label: "Following instructions" },
      { key: "emergent_literacy", label: "Emergent literacy" },
    ],

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

    indicators: [
      { key: "drawing_and_colouring", label: "Drawing and colouring" },
      { key: "music_and_rhythm", label: "Music and rhythm" },
      { key: "creative_play", label: "Creative play" },
      { key: "art_expression", label: "Art expression" },
      { key: "imaginative_participation", label: "Imaginative participation" },
    ],

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

    indicators: [
      { key: "shapes_and_colours", label: "Shapes and colours" },
      { key: "patterns_and_sequencing", label: "Patterns and sequencing" },
      { key: "observation_skills", label: "Observation skills" },
      { key: "environmental_awareness", label: "Environmental awareness" },
      { key: "perceptual_development", label: "Perceptual development" },
    ],

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

    indicators: [
      { key: "counting", label: "Counting" },
      { key: "number_recognition", label: "Number recognition" },
      { key: "sorting_and_matching", label: "Sorting and matching" },
      { key: "patterns_and_sequencing", label: "Patterns and sequencing" },
      { key: "early_problem_solving", label: "Early problem-solving" },
    ],

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

export function formatReportIndicator(categoryKey: string, indicatorKey: string) {
  const category = reportCategories.find(
    (item) => item.key === categoryKey
  );

  return (
    category?.indicators.find((indicator) => indicator.key === indicatorKey)
      ?.label || indicatorKey
  );
}