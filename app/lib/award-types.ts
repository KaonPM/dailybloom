export type AwardDefinition = {
  name: string;
  category: string;
  subtitle: string;
  reasons: string[];
};

export const awardDefinitions: AwardDefinition[] = [
  {
    name: "Certificate of Achievement",
    category: "Academic",
    subtitle: "OF ACHIEVEMENT",
    reasons: [
      "Having achieved above average",
      "Outstanding academic achievement",
      "Excellent classroom performance",
      "Consistent hard work and dedication",
    ],
  },
  {
    name: "Certificate of Participation",
    category: "Participation",
    subtitle: "OF PARTICIPATION",
    reasons: [
      "Active participation in class activities",
      "Positive participation and teamwork",
      "Enthusiastic involvement in school activities",
      "Taking part with confidence and effort",
    ],
  },
  {
    name: "Certificate of Excellence",
    category: "Academic",
    subtitle: "OF EXCELLENCE",
    reasons: [
      "Excellent achievement and effort",
      "Outstanding excellence in learning",
      "Exceptional progress and dedication",
      "Excellent behaviour and leadership",
    ],
  },
  {
    name: "Certificate of Good Progress",
    category: "Progress",
    subtitle: "OF GOOD PROGRESS",
    reasons: [
      "Good progress throughout the year",
      "Steady improvement and commitment",
      "Growing confidence and effort",
      "Positive progress in learning",
    ],
  },
  { name: "Reading Star", category: "Academic", subtitle: "READING STAR", reasons: ["Outstanding progress and enthusiasm in reading"] },
  { name: "Mathematics Star", category: "Academic", subtitle: "MATHEMATICS STAR", reasons: ["Outstanding progress and confidence in mathematics"] },
  { name: "Creative Arts Star", category: "Creativity", subtitle: "CREATIVE ARTS STAR", reasons: ["Creativity, imagination and excellent artistic effort"] },
  { name: "Excellent Behaviour", category: "Behaviour", subtitle: "EXCELLENT BEHAVIOUR", reasons: ["Consistently demonstrating kindness, respect and responsibility"] },
  { name: "Outstanding Leadership", category: "Leadership", subtitle: "OUTSTANDING LEADERSHIP", reasons: ["Positive leadership and support for others"] },
  { name: "Best Attendance", category: "Attendance", subtitle: "BEST ATTENDANCE", reasons: ["Excellent and consistent school attendance"] },
  { name: "Helping Hands Award", category: "Behaviour", subtitle: "HELPING HANDS AWARD", reasons: ["Always being willing to help classmates and practitioners"] },
  { name: "Perseverance Award", category: "Progress", subtitle: "PERSEVERANCE AWARD", reasons: ["Showing determination and never giving up"] },
  { name: "Principal's Award", category: "General", subtitle: "PRINCIPAL'S AWARD", reasons: ["Outstanding contribution to the school community"] },
];

export const awardTypes = awardDefinitions.map((award) => award.name);
export const awardCategories = Array.from(
  new Set(awardDefinitions.map((award) => award.category))
);

export function getAwardDefinition(name: string) {
  return awardDefinitions.find((award) => award.name === name) || null;
}
