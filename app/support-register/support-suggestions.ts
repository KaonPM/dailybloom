export type SupportNeedSuggestion = {
  label: string;
  interventions: string[];
};

const otherSuggestion: SupportNeedSuggestion = {
  label: "Other support need",
  interventions: ["Other intervention"],
};

const suggestionGroups: Record<string, SupportNeedSuggestion[]> = {
  language: [
    {
      label: "Difficulty listening or following instructions",
      interventions: [
        "Give one instruction at a time",
        "Use pictures or gestures as prompts",
        "Ask the learner to repeat the instruction",
        "Repeat the instruction individually",
      ],
    },
    {
      label: "Difficulty recognising sounds",
      interventions: [
        "Use sound and picture matching",
        "Repeat the sound with the learner",
        "Identify objects beginning with the sound",
        "Use songs and rhymes to practise sounds",
      ],
    },
    {
      label: "Limited vocabulary or difficulty expressing ideas",
      interventions: [
        "Use picture naming activities",
        "Model and repeat new words in context",
        "Use guided conversation prompts",
        "Retell a short familiar story together",
      ],
    },
    {
      label: "Difficulty forming letters or making marks",
      interventions: [
        "Practise air-writing",
        "Trace letters in sand or textured material",
        "Use dotted-letter tracing",
        "Provide guided pencil practice",
      ],
    },
    otherSuggestion,
  ],
  mathematics: [
    {
      label: "Difficulty recognising numbers",
      interventions: [
        "Use number cards",
        "Match numerals to quantities",
        "Use a classroom number hunt",
        "Trace and name numbers",
      ],
    },
    {
      label: "Difficulty counting accurately",
      interventions: [
        "Count physical objects",
        "Use touch-and-count practice",
        "Use counting songs and movement",
        "Practise one-to-one correspondence",
      ],
    },
    {
      label: "Difficulty copying or extending patterns",
      interventions: [
        "Copy a simple two-part pattern",
        "Build patterns with blocks or beads",
        "Say the pattern aloud",
        "Extend the pattern one step at a time",
      ],
    },
    {
      label: "Difficulty recognising shapes, size or position",
      interventions: [
        "Sort and name shapes",
        "Use a classroom shape hunt",
        "Compare objects by size",
        "Use practical position instructions",
      ],
    },
    otherSuggestion,
  ],
  fineMotor: [
    {
      label: "Difficulty holding or controlling a pencil",
      interventions: [
        "Use a pencil grip or thicker crayons",
        "Practise short guided tracing",
        "Use vertical-surface drawing",
        "Strengthen hands with playdough",
      ],
    },
    {
      label: "Difficulty cutting, threading or manipulating objects",
      interventions: [
        "Use peg activities",
        "Practise threading with larger beads",
        "Use tearing and pasting activities",
        "Provide guided cutting practice",
      ],
    },
    otherSuggestion,
  ],
  grossMotor: [
    {
      label: "Difficulty with balance or coordination",
      interventions: [
        "Use a supported balance path",
        "Practise simple stepping patterns",
        "Repeat movement demonstrations",
        "Use a simplified obstacle course",
      ],
    },
    {
      label: "Difficulty throwing, catching or kicking",
      interventions: [
        "Use a larger soft ball",
        "Reduce the throwing distance",
        "Practise one movement at a time",
        "Use paired ball practice",
      ],
    },
    otherSuggestion,
  ],
  socialEmotional: [
    {
      label: "Difficulty taking turns or participating with others",
      interventions: [
        "Use a structured turn-taking game",
        "Pair the learner with a supportive buddy",
        "Use a visual turn reminder",
        "Begin with a smaller group",
      ],
    },
    {
      label: "Difficulty recognising or managing emotions",
      interventions: [
        "Use emotion picture cards",
        "Practise a calming routine",
        "Model words for expressing feelings",
        "Use guided role play",
      ],
    },
    {
      label: "Difficulty separating or joining the routine",
      interventions: [
        "Use a predictable arrival routine",
        "Provide a visual timetable",
        "Offer a familiar transition activity",
        "Gradually increase independent participation",
      ],
    },
    otherSuggestion,
  ],
  schoolReadiness: [
    {
      label: "Difficulty concentrating or remaining engaged",
      interventions: [
        "Shorten the activity",
        "Reduce nearby distractions",
        "Break the activity into smaller steps",
        "Include a short movement break",
      ],
    },
    {
      label: "Difficulty completing tasks independently",
      interventions: [
        "Model the first step",
        "Use a simple visual sequence",
        "Offer one prompt at a time",
        "Gradually reduce adult assistance",
      ],
    },
    {
      label: "Difficulty remembering the activity routine",
      interventions: [
        "Repeat the same activity sequence",
        "Use picture-based routine prompts",
        "Let the learner demonstrate the next step",
        "Provide regular short practice",
      ],
    },
    otherSuggestion,
  ],
  creativeSensory: [
    {
      label: "Reluctance to explore materials or sensory experiences",
      interventions: [
        "Introduce one material at a time",
        "Allow observation before participation",
        "Offer a preferred tool or texture",
        "Use brief supported exploration",
      ],
    },
    {
      label: "Difficulty copying rhythm, movement or a creative sequence",
      interventions: [
        "Slow down the sequence",
        "Model one step at a time",
        "Use repeated rhythm patterns",
        "Practise alongside a peer",
      ],
    },
    otherSuggestion,
  ],
};

function suggestionKey(developmentalArea: string, activityName: string) {
  const value = `${developmentalArea} ${activityName}`.toLowerCase();

  if (/language|communication|phonics|sound|letter|story|vocabulary|english/.test(value)) return "language";
  if (/math|number|count|shape|pattern|measure|position/.test(value)) return "mathematics";
  if (/fine motor|pencil|cut|thread|peg|draw|write|trace/.test(value)) return "fineMotor";
  if (/gross motor|outdoor|balance|coordination|ball|movement/.test(value)) return "grossMotor";
  if (/social|emotional|emotion|turn|relationship|participation/.test(value)) return "socialEmotional";
  if (/creative|sensory|music|rhythm|art/.test(value)) return "creativeSensory";

  return "schoolReadiness";
}

export function supportSuggestionsFor(developmentalArea?: string | null, activityName?: string | null) {
  return suggestionGroups[suggestionKey(developmentalArea || "", activityName || "")];
}
