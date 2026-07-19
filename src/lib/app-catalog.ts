import type { ProfileRole as Role } from "./profile-ui";

export type AppAccessState = "included" | "requestable" | "hidden";

export type ZurotApp = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  launchUrl: string;
  access: Record<Role, AppAccessState>;
  shortDescription: string;
  subject?: string;
  ageRange?: string;
  lessonCount?: number;
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
    launchUrl: "/tzura/create",
    access: { parent: "included", teacher: "included", student: "included" },
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
    launchUrl: "/launch/mall-hebrew-adventures",
    access: { parent: "included", teacher: "included", student: "included" },
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
    launchUrl: "/launch/letters-lab",
    access: { parent: "included", teacher: "included", student: "included" },
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
    launchUrl: "/launch/story-castle",
    access: { parent: "included", teacher: "included", student: "included" },
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
    launchUrl: "/launch/math-market",
    access: { parent: "included", teacher: "included", student: "included" },
    subject: "Math",
    ageRange: "7-12",
    lessonCount: 31,
    tags: ["Arithmetic", "Problem Solving"],
  },
  {
    id: "devices",
    name: "Device Manager",
    emoji: "📱",
    shortDescription: "Manage family Android devices.",
    description:
      "Open the family device manager for paired Android phones and approved device commands.",
    launchUrl: "https://devices.zurot.org",
    access: { parent: "included", teacher: "included", student: "requestable" },
    tags: ["Devices", "Management"],
  },
];

export const APP_BY_ID = new Map(APP_CATALOG.map(app => [app.id, app]));
