"use client";

import { ProfileAvatar } from "./profile-avatar";

export function PinEntryModal({
  open,
  profileName,
  profileEmoji,
  profileColor,
  enteredPin,
  verifying,
  errorMessage,
  attemptsRemaining,
  cooldownSeconds,
  onClose,
  onDigit,
  onBackspace,
  onClear,
}: {
  open: boolean;
  profileName: string;
  profileEmoji: string;
  profileColor: string;
  enteredPin: string;
  verifying?: boolean;
  errorMessage?: string | null;
  attemptsRemaining: number;
  cooldownSeconds: number;
  onClose: () => void;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onClear: () => void;
}) {
  if (!open) {
    return null;
  }

  const keypadDisabled = verifying || cooldownSeconds > 0;
  const filledDots = enteredPin.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Enter PIN</h2>
          <button
            type="button"
            className="text-sm text-zinc-300 underline"
            onClick={onClose}
            disabled={verifying}
          >
            Cancel
          </button>
        </div>

        <div className="mb-4 flex items-center gap-3 rounded-xl bg-zinc-950 p-3">
          <ProfileAvatar emoji={profileEmoji} color={profileColor} size={58} />
          <div>
            <p className="text-sm text-zinc-400">Profile</p>
            <p className="text-base font-semibold text-zinc-100">{profileName}</p>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-center gap-2">
          {[0, 1, 2, 3].map(index => (
            <span
              key={index}
              className={`inline-flex h-3.5 w-3.5 rounded-full ${
                index < filledDots ? "bg-zinc-100" : "bg-zinc-700"
              }`}
            />
          ))}
        </div>

        {cooldownSeconds > 0 ? (
          <p className="mb-3 text-center text-sm text-amber-300">
            Try again in {cooldownSeconds} seconds.
          </p>
        ) : (
          <p className="mb-3 text-center text-xs text-zinc-400">
            Attempts remaining: {attemptsRemaining}
          </p>
        )}

        {errorMessage ? <p className="mb-3 text-center text-sm text-red-400">{errorMessage}</p> : null}

        <div className="grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"].map(key => {
            if (key === "clear") {
              return (
                <button
                  key={key}
                  type="button"
                  onClick={onClear}
                  disabled={keypadDisabled}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 py-3 text-sm font-medium text-zinc-200 disabled:opacity-50"
                >
                  Clear
                </button>
              );
            }

            if (key === "back") {
              return (
                <button
                  key={key}
                  type="button"
                  onClick={onBackspace}
                  disabled={keypadDisabled}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 py-3 text-sm font-medium text-zinc-200 disabled:opacity-50"
                >
                  ⌫
                </button>
              );
            }

            return (
              <button
                key={key}
                type="button"
                onClick={() => onDigit(key)}
                disabled={keypadDisabled}
                className="rounded-lg border border-zinc-700 bg-zinc-950 py-3 text-lg font-semibold text-zinc-100 disabled:opacity-50"
              >
                {key}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
