"use client";

import type { PublishedTzura, TzuraGameSpec } from "@/lib/tzura-game-spec";

type RuntimeProps = {
  spec: TzuraGameSpec;
  mode: "draft" | "published";
  published?: PublishedTzura | null;
};

const themeBackgrounds: Record<TzuraGameSpec["theme"], string> = {
  space: "from-[#17113f] via-[#1e1b4b] to-[#020617]",
  ocean: "from-[#063344] via-[#075985] to-[#082f49]",
  forest: "from-[#052e16] via-[#166534] to-[#1a2e05]",
  city: "from-[#431407] via-[#7c2d12] to-[#111827]",
  candy: "from-[#831843] via-[#be185d] to-[#4c0519]",
};

const speedDurations: Record<TzuraGameSpec["rules"]["speed"], string> = {
  calm: "8s",
  bouncy: "5s",
  zoomy: "2.8s",
};

export function TzuraRuntime({ spec, mode, published }: RuntimeProps) {
  const duration = speedDurations[spec.rules.speed];
  const gravityClass = spec.rules.gravity === "heavy" ? "translate-y-10" : spec.rules.gravity === "floaty" ? "-translate-y-6" : "";

  return (
    <section
      aria-label={mode === "published" ? "Published Tzura player" : "Live Tzura draft preview"}
      className={`relative mx-auto aspect-[9/16] min-h-[560px] w-full max-w-[390px] overflow-hidden rounded-[28px] border border-white/15 bg-gradient-to-b ${themeBackgrounds[spec.theme]} shadow-2xl`}
    >
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4 text-white">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">
            {mode === "published" ? "Frozen Tzura" : "Live Draft"}
          </p>
          <h2 className="mt-1 text-xl font-black leading-tight">{spec.title}</h2>
        </div>
        <div className="rounded-full bg-black/30 px-3 py-1 text-xs font-bold backdrop-blur">
          {spec.goal.target} {spec.goal.label}
        </div>
      </div>

      <div className="absolute inset-0 opacity-30">
        {Array.from({ length: 14 }).map((_, index) => (
          <span
            key={index}
            className="absolute h-2 w-2 rounded-full bg-white"
            style={{
              left: `${8 + ((index * 17) % 84)}%`,
              top: `${14 + ((index * 23) % 70)}%`,
              opacity: 0.35 + (index % 4) * 0.12,
            }}
          />
        ))}
      </div>

      <div className="absolute inset-x-6 top-28 grid grid-cols-3 gap-3">
        {Array.from({ length: Math.min(spec.goal.target, 9) }).map((_, index) => (
          <div key={index} className="rounded-full bg-white/20 px-2 py-2 text-center text-xs font-bold text-white backdrop-blur">
            {spec.collectibles[0]}
          </div>
        ))}
      </div>

      <div className={`absolute left-1/2 top-[48%] h-28 w-28 -translate-x-1/2 ${gravityClass}`}>
        <div
          className="grid h-full w-full place-items-center rounded-[32px] border-4 border-white/80 text-center text-sm font-black uppercase text-white shadow-xl"
          style={{
            backgroundColor: spec.player.color,
            animation: `tzura-bob ${duration} ease-in-out infinite`,
          }}
        >
          {spec.player.label}
        </div>
      </div>

      <div className="absolute inset-x-5 bottom-24 rounded-xl border border-white/15 bg-black/30 p-3 text-white backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">Avoid</p>
        <p className="mt-1 text-lg font-black">{spec.hazards.join(", ")}</p>
      </div>

      <div className="absolute inset-x-0 bottom-0 border-t border-white/15 bg-black/35 p-4 text-white backdrop-blur">
        <p className="text-sm font-semibold">{spec.rules.winMessage}</p>
        {published ? (
          <p className="mt-1 truncate text-xs text-white/55">Artifact {published.id}</p>
        ) : (
          <p className="mt-1 text-xs text-white/55">Ready for realtime voice agent commands</p>
        )}
      </div>
    </section>
  );
}
