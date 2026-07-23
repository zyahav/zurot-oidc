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
  tvCompatible?: boolean;
  tvLaunchReady?: boolean;
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
    tvCompatible: true,
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
    tvCompatible: true,
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
    tvCompatible: true,
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
    tvCompatible: true,
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
    tvCompatible: true,
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
  {
    id: "meetings",
    name: "Meetings",
    emoji: "🎥",
    shortDescription: "Join live, recorded ZurOt classes.",
    description:
      "Create or join secure ZurOt video meetings with a host-managed waiting room and automatic recording.",
    launchUrl: "https://meeting.zurot.org",
    access: { parent: "included", teacher: "included", student: "included" },
    tags: ["Meetings", "Classes", "Video"],
  },
  {
    id: "meta-control-room",
    name: "Meta Control Room",
    emoji: "📊",
    shortDescription: "Operate ZurOt leads and Meta conversations.",
    description:
      "The private ZurOt workspace for lead operations, Meta lifecycle evidence, and team coordination.",
    launchUrl: "https://meta.zurot.org/auth/login",
    access: { parent: "included", teacher: "included", student: "hidden" },
    tags: ["Business", "Meta", "Operations"],
    tvCompatible: true,
    tvLaunchReady: true,
  },
];

export const APP_BY_ID = new Map(APP_CATALOG.map(app => [app.id, app]));

export function appLaunchHref(
  app: ZurotApp,
  activeProfileId?: string,
  options?: { tv?: boolean }
): string {
  const base = app.launchPath ?? app.launchUrl;
  if (app.id !== "meta-control-room" || !activeProfileId) return base;
  const url = new URL(app.launchUrl);
  url.searchParams.set("profile_hint", activeProfileId);
  if (options?.tv) url.searchParams.set("tv", "1");
  return url.toString();
}
