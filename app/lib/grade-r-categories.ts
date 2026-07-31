import type {
  ProgressReportCategory,
  ProgressReportRatingLevel,
} from "./progress-report-types";

export const gradeRCategories: ProgressReportCategory[] = [
  {
    key: "english_home_language",
    label: "English Home Language",
    description:
      "Listening and speaking, phonics, emergent reading, handwriting and early writing.",
    indicators: [
      { key: "listens_and_responds", label: "Listens and responds appropriately" },
      { key: "speaks_with_confidence", label: "Speaks clearly and shares ideas" },
      { key: "recognises_sounds", label: "Recognises and works with taught sounds" },
      { key: "reads_pictures_and_words", label: "Reads pictures and familiar words" },
      { key: "forms_letters", label: "Forms letters and writes own name" },
    ],
  },
  {
    key: "mathematics",
    label: "Mathematics",
    description:
      "Numbers, operations, patterns, space and shape, measurement and data handling.",
    indicators: [
      { key: "counts_and_recognises_numbers", label: "Counts and recognises numbers" },
      { key: "solves_practical_number_problems", label: "Solves practical number problems" },
      { key: "continues_patterns", label: "Recognises and continues patterns" },
      { key: "identifies_shapes_and_position", label: "Identifies shapes and position" },
      { key: "compares_and_measures", label: "Compares, sorts and measures objects" },
    ],
  },
  {
    key: "life_skills",
    label: "Life Skills",
    description:
      "Beginning knowledge, personal and social wellbeing, creative arts and physical education.",
    indicators: [
      { key: "applies_beginning_knowledge", label: "Applies beginning knowledge to familiar situations" },
      { key: "personal_social_wellbeing", label: "Shows personal and social responsibility" },
      { key: "creative_expression", label: "Participates confidently in creative arts" },
      { key: "gross_motor_control", label: "Demonstrates gross-motor control" },
      { key: "fine_motor_control", label: "Demonstrates fine-motor control" },
    ],
  },
  {
    key: "first_additional_language",
    label: "First Additional Language",
    description:
      "Listening, speaking and emerging language skills in the school's selected additional language.",
    indicators: [
      { key: "understands_simple_instructions", label: "Understands simple instructions" },
      { key: "uses_familiar_words", label: "Uses familiar words and phrases" },
      { key: "participates_in_songs_and_rhymes", label: "Participates in songs, stories and rhymes" },
    ],
  },
];

export const gradeRRatingScale: ProgressReportRatingLevel[] = [
  { value: 7, label: "Outstanding achievement (80–100%)" },
  { value: 6, label: "Meritorious achievement (70–79%)" },
  { value: 5, label: "Substantial achievement (60–69%)" },
  { value: 4, label: "Adequate achievement (50–59%)" },
  { value: 3, label: "Moderate achievement (40–49%)" },
  { value: 2, label: "Elementary achievement (30–39%)" },
  { value: 1, label: "Not achieved (0–29%)" },
];
