export type ZurotApp = {
  id: string;
  name: string;
  emoji: string;
  shortDescription: string;
  description: string;
  subject: string;
  ageRange: string;
  lessonCount: number;
  tags: string[];
  isNew?: boolean;
  launchPath?: string;
};

export const APP_CATALOG: ZurotApp[] = [
  {
    id: "tzura-creator",
    name: "Tzura Creator",
    emoji: "🎮",
    shortDescription: "Create a playable Tzura from spoken ideas.",
    description:
      "A child-facing creator where voice-style instructions update a live game draft, then publish a frozen Tzura post.",
    subject: "Creative Coding",
    ageRange: "6-12",
    lessonCount: 1,
    tags: ["Creation", "Games", "Voice"],
    isNew: true,
    launchPath: "/tzura/create",
  },
  {
    id: "mall-hebrew-adventures",
    name: "Mall Hebrew Adventures",
    emoji: "🛍️",
    shortDescription: "Hebrew stories through playful mall quests.",
    description:
      "A guided Hebrew adventure with short missions, spoken prompts, and collectible rewards.",
    subject: "Hebrew Language",
    ageRange: "6-11",
    lessonCount: 42,
    tags: ["Reading", "Vocabulary", "Speaking"],
  },
  {
    id: "letters-lab",
    name: "Letters Lab",
    emoji: "🔤",
    shortDescription: "Build fluency with sounds, letters, and blends.",
    description:
      "Practice letters and sounds with interactive mini-games designed for daily repetition.",
    subject: "Foundations",
    ageRange: "5-8",
    lessonCount: 36,
    tags: ["Phonics", "Pronunciation"],
  },
  {
    id: "story-castle",
    name: "Story Castle",
    emoji: "🏰",
    shortDescription: "Read, act, and retell short Hebrew stories.",
    description:
      "Explore story paths, answer comprehension prompts, and grow confidence through retelling.",
    subject: "Comprehension",
    ageRange: "7-12",
    lessonCount: 28,
    tags: ["Stories", "Comprehension"],
  },
  {
    id: "math-market",
    name: "Math Market",
    emoji: "🧮",
    shortDescription: "Math challenges in a playful market world.",
    description:
      "Solve quick math tasks while shopping, budgeting, and unlocking themed challenge lanes.",
    subject: "Math",
    ageRange: "7-12",
    lessonCount: 31,
    tags: ["Arithmetic", "Problem Solving"],
  },
];

export const APP_BY_ID = new Map(APP_CATALOG.map(app => [app.id, app]));
