export type GradeRRIndicator = {
  key: string;
  label: string;
};

export type GradeRRSection = {
  key: string;
  label: string;
  indicators: GradeRRIndicator[];
};

export type GradeRRCategory = {
  key: string;
  label: string;
  description: string;
  sections: GradeRRSection[];
};

export const gradeRRCategories: GradeRRCategory[] = [
  {
    key: "language",
    label: "Language",
    description: "Listening, speaking, reading, phonics and emergent writing.",
    sections: [
      {
        key: "listening_and_speaking",
        label: "Listening and Speaking",
        indicators: [
          {
            key: "listening_responding_simple_questions",
            label: "Listening and responding to simple questions",
          },
          {
            key: "naming_pointing_body_parts",
            label: "Naming and pointing to body parts",
          },
          {
            key: "singing_simple_songs_rhymes",
            label: "Singing simple songs and rhymes",
          },
        ],
      },
      {
        key: "reading_and_phonics",
        label: "Reading and Phonics",
        indicators: [
          {
            key: "recognises_own_name",
            label: "Recognises own name",
          },
          {
            key: "independent_reading_pictures",
            label: "Independent reading, reading pictures",
          },
        ],
      },
      {
        key: "emergent_writing",
        label: "Emergent Writing",
        indicators: [
          {
            key: "draws_paints_message",
            label: "Draws or paints pictures to convey a message",
          },
          {
            key: "forms_phonic_sounds_taught",
            label: "Forms phonic sounds taught",
          },
          {
            key: "writes_left_to_right_top_to_bottom",
            label: "Writes from left to right and top to bottom",
          },
        ],
      },
    ],
  },
  {
    key: "mathematics",
    label: "Mathematics",
    description:
      "Numbers, operations, patterns, space, shape, comparison, classification and measurement.",
    sections: [
      {
        key: "numbers_operations_relationships",
        label: "Numbers, Operations and Relationships",
        indicators: [
          {
            key: "estimates_rote_counts_to_5",
            label: "Estimates and rote counts up to 5",
          },
          {
            key: "recognises_numbers_familiar_context",
            label: "Recognises numbers in familiar context",
          },
          {
            key: "uses_concrete_apparatus",
            label: "Uses concrete apparatus",
          },
        ],
      },
      {
        key: "patterns_and_functions",
        label: "Patterns and Functions",
        indicators: [
          {
            key: "identifies_patterns_environment",
            label: "Identifies patterns in the environment",
          },
        ],
      },
      {
        key: "space_and_shape",
        label: "Space and Shape",
        indicators: [
          {
            key: "recognises_identifies_names_balls",
            label: "Recognises, identifies and names balls",
          },
          {
            key: "recognises_names_own_symbol",
            label: "Recognises and names own symbol",
          },
        ],
      },
      {
        key: "comparison_and_classification",
        label: "Comparison and Classification",
        indicators: [
          {
            key: "compares_objects",
            label: "Compares objects",
          },
          {
            key: "sorts_compares_size",
            label: "Sorts and compares according to size",
          },
          {
            key: "sorts_compares_colour",
            label: "Sorts and compares according to colour",
          },
          {
            key: "recognises_symmetry_self",
            label: "Recognises line of symmetry in self",
          },
          {
            key: "knows_position_words",
            label: "Knows in front of, behind, in and out",
          },
        ],
      },
      {
        key: "measurement",
        label: "Measurement",
        indicators: [
          {
            key: "orders_recurring_daily_events",
            label: "Orders recurring events in daily life",
          },
        ],
      },
    ],
  },
  {
    key: "life_skills",
    label: "Life Skills",
    description:
      "Knowledge concepts, creative arts, physical education, and social, personal and emotional development.",
    sections: [
      {
        key: "knowledge_concepts",
        label: "Knowledge and Concepts",
        indicators: [
          {
            key: "social_science",
            label: "Social Science",
          },
          {
            key: "natural_science_concepts",
            label: "Natural Science Concepts",
          },
          {
            key: "scientific_process_skills",
            label: "Scientific Process Skills",
          },
        ],
      },
      {
        key: "creative_arts",
        label: "Creative Arts",
        indicators: [
          {
            key: "two_d_activities",
            label: "2D Activities",
          },
          {
            key: "creative_games_and_skills",
            label: "Creative Games and Skills",
          },
        ],
      },
      {
        key: "physical_education",
        label: "Physical Education",
        indicators: [
          {
            key: "gross_and_fine_motor_skills",
            label: "Gross and Fine Motor Skills",
          },
        ],
      },
      {
        key: "social_personal_emotional_development",
        label: "Social, Personal and Emotional Development",
        indicators: [
          {
            key: "balance_and_laterality",
            label: "Balance and Laterality",
          },
          {
            key: "perceptual_skills",
            label: "Perceptual Skills",
          },
        ],
      },
    ],
  },
];

export const gradeRRRatingScale = [
  {
    value: 4,
    label: "Exceeded expectations",
  },
  {
    value: 3,
    label: "Achieved expectations",
  },
  {
    value: 2,
    label: "Partially achieved expectations",
  },
  {
    value: 1,
    label: "Not yet achieved expectations",
  },
];