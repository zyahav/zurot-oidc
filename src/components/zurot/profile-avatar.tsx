import { CSSProperties } from "react";

export function ProfileAvatar({
  emoji,
  color,
  size = 90,
  showLock = false,
  showPencil = false,
}: {
  emoji: string;
  color: string;
  size?: number;
  showLock?: boolean;
  showPencil?: boolean;
}) {
  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: 16,
    background: color,
  };

  return (
    <div className="relative inline-flex items-center justify-center" style={style}>
      <span style={{ fontSize: Math.floor(size * 0.42), lineHeight: 1 }}>{emoji}</span>
      {showLock ? (
        <span className="absolute -bottom-1 -right-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-zinc-900 bg-zinc-950 text-xs">
          🔒
        </span>
      ) : null}
      {showPencil ? (
        <span className="absolute -bottom-1 -right-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-xs">
          ✎
        </span>
      ) : null}
    </div>
  );
}
