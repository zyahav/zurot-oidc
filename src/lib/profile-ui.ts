export type ProfileRole = "student" | "parent" | "teacher";

export type AvatarPreset = {
  emoji: string;
  color: string;
};

export const ROLE_LABEL: Record<ProfileRole, string> = {
  student: "Student",
  parent: "Parent",
  teacher: "Teacher",
};

export const ROLE_BADGE_CLASSES: Record<ProfileRole, string> = {
  student: "bg-violet-200 text-violet-900",
  parent: "bg-amber-200 text-amber-900",
  teacher: "bg-teal-200 text-teal-900",
};

export const AVATAR_PRESETS: AvatarPreset[] = [
  { emoji: "🦁", color: "#2d1a5c" },
  { emoji: "🦊", color: "#7a2f0f" },
  { emoji: "🐬", color: "#044e74" },
  { emoji: "🐼", color: "#1f2937" },
  { emoji: "🦄", color: "#6b21a8" },
  { emoji: "🐸", color: "#14532d" },
  { emoji: "🚀", color: "#1e3a8a" },
  { emoji: "🎨", color: "#7c2d12" },
  { emoji: "⚽", color: "#1d4ed8" },
  { emoji: "📚", color: "#78350f" },
  { emoji: "🎯", color: "#831843" },
  { emoji: "🌈", color: "#334155" },
];

export const getRoleLabel = (role: string) => {
  if (role === "student" || role === "parent" || role === "teacher") {
    return ROLE_LABEL[role];
  }
  return role;
};

export const isProfileRole = (value: string): value is ProfileRole => {
  return value === "student" || value === "parent" || value === "teacher";
};
