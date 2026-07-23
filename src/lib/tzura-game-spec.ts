export type TzuraGameSpec = {
  schemaVersion: 1;
  title: string;
  theme: "space" | "ocean" | "forest" | "city" | "candy";
  player: {
    label: string;
    color: string;
  };
  goal: {
    label: string;
    target: number;
  };
  hazards: string[];
  collectibles: string[];
  rules: {
    speed: "calm" | "bouncy" | "zoomy";
    gravity: "floaty" | "normal" | "heavy";
    winMessage: string;
  };
  updatedAt: string;
};

export type TzuraCommandResult = {
  spec: TzuraGameSpec;
  transcript: string;
};

export type PublishedTzura = {
  artifactVersion: 1;
  id: string;
  sourceDraftId: string;
  title: string;
  publishedAt: string;
  frozenSpec: TzuraGameSpec;
};

const themeColors: Record<TzuraGameSpec["theme"], string> = {
  space: "#7067ff",
  ocean: "#0891b2",
  forest: "#16a34a",
  city: "#f97316",
  candy: "#e11d48",
};

export const defaultGameSpec: TzuraGameSpec = {
  schemaVersion: 1,
  title: "Star Hopper",
  theme: "space",
  player: {
    label: "rocket",
    color: themeColors.space,
  },
  goal: {
    label: "stars",
    target: 5,
  },
  hazards: ["moon rocks"],
  collectibles: ["stars"],
  rules: {
    speed: "bouncy",
    gravity: "floaty",
    winMessage: "You filled the sky!",
  },
  updatedAt: "draft",
};

export function interpretTzuraCommand(current: TzuraGameSpec, rawInstruction: string): TzuraCommandResult {
  const instruction = rawInstruction.trim();
  const text = instruction.toLowerCase();
  const next: TzuraGameSpec = structuredClone(current);
  const changes: string[] = [];

  const theme = matchTheme(text);
  if (theme) {
    next.theme = theme;
    next.player.color = themeColors[theme];
    changes.push(`theme set to ${theme}`);
  }

  const speed = matchSpeed(text);
  if (speed) {
    next.rules.speed = speed;
    changes.push(`speed set to ${speed}`);
  }

  const gravity = matchGravity(text);
  if (gravity) {
    next.rules.gravity = gravity;
    changes.push(`gravity set to ${gravity}`);
  }

  const player = matchAfter(text, ["player is ", "make me a ", "i am a ", "character is "]);
  if (player) {
    next.player.label = cleanLabel(player);
    changes.push(`player changed to ${next.player.label}`);
  }

  const collectable = matchAfter(text, ["collect ", "collects ", "grab ", "get "]);
  if (collectable) {
    const label = cleanLabel(collectable);
    next.goal.label = label;
    next.collectibles = [label];
    changes.push(`goal changed to collecting ${label}`);
  }

  const hazard = matchAfter(text, ["avoid ", "dodge ", "watch out for "]);
  if (hazard) {
    const label = cleanLabel(hazard);
    next.hazards = [label];
    changes.push(`hazard changed to ${label}`);
  }

  const target = text.match(/\b(\d{1,2})\b/);
  if (target) {
    const parsed = Math.max(1, Math.min(20, Number(target[1])));
    next.goal.target = parsed;
    changes.push(`target set to ${parsed}`);
  }

  if (text.includes("easy") || text.includes("little kid")) {
    next.goal.target = Math.min(next.goal.target, 3);
    next.rules.speed = "calm";
    changes.push("easy mode applied");
  }

  if (text.includes("hard") || text.includes("challenge")) {
    next.goal.target = Math.max(next.goal.target, 8);
    next.rules.speed = "zoomy";
    changes.push("challenge mode applied");
  }

  if (instruction.length > 0 && changes.length === 0) {
    next.title = toTitle(instruction).slice(0, 44);
    changes.push("title updated");
  }

  next.updatedAt = new Date().toISOString();

  return {
    spec: next,
    transcript: changes.length > 0 ? changes.join(", ") : "waiting for an instruction",
  };
}

export function publishTzura(draftId: string, spec: TzuraGameSpec): PublishedTzura {
  const publishedAt = new Date().toISOString();
  return {
    artifactVersion: 1,
    id: `tzura_${publishedAt.replace(/[-:.TZ]/g, "").slice(0, 14)}_${Math.random().toString(36).slice(2, 8)}`,
    sourceDraftId: draftId,
    title: spec.title,
    publishedAt,
    frozenSpec: structuredClone({ ...spec, updatedAt: publishedAt }),
  };
}

export function remixPublishedTzura(tzura: PublishedTzura): TzuraGameSpec {
  return {
    ...structuredClone(tzura.frozenSpec),
    title: `${tzura.frozenSpec.title} Remix`,
    updatedAt: new Date().toISOString(),
  };
}

function matchTheme(text: string): TzuraGameSpec["theme"] | null {
  if (text.includes("space") || text.includes("star") || text.includes("rocket")) return "space";
  if (text.includes("ocean") || text.includes("sea") || text.includes("fish")) return "ocean";
  if (text.includes("forest") || text.includes("tree") || text.includes("jungle")) return "forest";
  if (text.includes("city") || text.includes("street") || text.includes("car")) return "city";
  if (text.includes("candy") || text.includes("sweet") || text.includes("cake")) return "candy";
  return null;
}

function matchSpeed(text: string): TzuraGameSpec["rules"]["speed"] | null {
  if (text.includes("slow") || text.includes("calm")) return "calm";
  if (text.includes("fast") || text.includes("zoom")) return "zoomy";
  if (text.includes("bounce") || text.includes("jump")) return "bouncy";
  return null;
}

function matchGravity(text: string): TzuraGameSpec["rules"]["gravity"] | null {
  if (text.includes("float") || text.includes("fly")) return "floaty";
  if (text.includes("heavy")) return "heavy";
  if (text.includes("normal")) return "normal";
  return null;
}

function matchAfter(text: string, markers: string[]): string | null {
  for (const marker of markers) {
    const index = text.indexOf(marker);
    if (index >= 0) return text.slice(index + marker.length);
  }
  return null;
}

function cleanLabel(value: string): string {
  return value
    .replace(/\b(and|with|please|but|that|who|which|while|then|avoid|dodge|watch out for|to win|for points)\b.*$/i, "")
    .replace(/[^a-z0-9 ]/gi, "")
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(" ") || "stars";
}

function toTitle(value: string): string {
  return value
    .replace(/[^a-z0-9 ]/gi, " ")
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
