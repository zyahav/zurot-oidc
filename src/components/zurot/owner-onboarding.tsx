"use client";

import { FormEvent, useState } from "react";
import { AVATAR_PRESETS } from "@/lib/profile-ui";
import { ProfileAvatar } from "./profile-avatar";

export type OwnerOnboardingValues = {
  name: string;
  emoji: string;
  color: string;
  role: "parent" | "teacher";
  ownerPin: string;
};

export function OwnerOnboarding({
  busy,
  serverError,
  onSubmit,
  onSignOut,
}: {
  busy: boolean;
  serverError: string | null;
  onSubmit: (values: OwnerOnboardingValues) => Promise<void>;
  onSignOut: () => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<"parent" | "teacher">("parent");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [selectedPreset, setSelectedPreset] = useState(AVATAR_PRESETS[11]);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("Enter the account owner’s name.");
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setFormError("Choose a 4-digit owner PIN.");
      return;
    }
    if (pin !== confirmPin) {
      setFormError("The PIN confirmation does not match.");
      return;
    }

    setFormError(null);
    await onSubmit({
      name: trimmedName,
      emoji: selectedPreset.emoji,
      color: selectedPreset.color,
      role,
      ownerPin: pin,
    });
  };

  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-10 text-zinc-100">
      <div className="mx-auto w-full max-w-2xl rounded-3xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">First-time setup</p>
        <h1 className="mt-3 text-3xl font-semibold">Create the account owner</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-300">
          Start with the adult who manages profiles and devices. Your owner PIN protects family settings; it is not your sign-in password.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-emerald-500/50 bg-emerald-500/10 p-3">
            <p className="text-xs font-semibold text-emerald-300">1 · Account owner</p>
            <p className="mt-1 text-xs text-zinc-300">Create the first adult profile.</p>
          </div>
          <div className="rounded-xl border border-zinc-700 p-3">
            <p className="text-xs font-semibold text-zinc-300">2 · Owner PIN</p>
            <p className="mt-1 text-xs text-zinc-400">Protect management and TV approval.</p>
          </div>
          <div className="rounded-xl border border-zinc-700 p-3">
            <p className="text-xs font-semibold text-zinc-300">3 · Family profiles</p>
            <p className="mt-1 text-xs text-zinc-400">Add children after setup.</p>
          </div>
        </div>

        <form className="mt-8 space-y-6" onSubmit={submit}>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-200" htmlFor="owner-name">Owner name</label>
            <input
              id="owner-name"
              value={name}
              onChange={event => setName(event.target.value)}
              className="w-full rounded-xl border border-zinc-600 bg-zinc-950 px-4 py-3 text-zinc-100"
              placeholder="e.g. Alex"
              maxLength={64}
              autoComplete="name"
              required
            />
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-zinc-200">Owner role</legend>
            <div className="grid grid-cols-2 gap-3">
              {(["parent", "teacher"] as const).map(candidate => (
                <button
                  key={candidate}
                  type="button"
                  onClick={() => setRole(candidate)}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold capitalize ${
                    role === candidate
                      ? "border-zinc-100 bg-zinc-100 text-zinc-900"
                      : "border-zinc-600 bg-zinc-950 text-zinc-200"
                  }`}
                >
                  {candidate}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-200" htmlFor="owner-pin">4-digit owner PIN</label>
              <input
                id="owner-pin"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                value={pin}
                onChange={event => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
                className="w-full rounded-xl border border-zinc-600 bg-zinc-950 px-4 py-3 text-center text-xl tracking-[0.45em] text-zinc-100"
                placeholder="••••"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-200" htmlFor="owner-pin-confirm">Confirm owner PIN</label>
              <input
                id="owner-pin-confirm"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                value={confirmPin}
                onChange={event => setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
                className="w-full rounded-xl border border-zinc-600 bg-zinc-950 px-4 py-3 text-center text-xl tracking-[0.45em] text-zinc-100"
                placeholder="••••"
              />
            </div>
          </div>

          <fieldset>
            <legend className="mb-3 text-sm font-medium text-zinc-200">Owner avatar</legend>
            <div className="flex flex-wrap gap-2">
              {AVATAR_PRESETS.map(preset => {
                const selected = preset.emoji === selectedPreset.emoji && preset.color === selectedPreset.color;
                return (
                  <button
                    key={`${preset.emoji}-${preset.color}`}
                    type="button"
                    aria-label={`Choose ${preset.emoji} avatar`}
                    aria-pressed={selected}
                    onClick={() => setSelectedPreset(preset)}
                    className={`rounded-xl border p-1 ${selected ? "border-zinc-100" : "border-zinc-700"}`}
                  >
                    <ProfileAvatar emoji={preset.emoji} color={preset.color} size={52} />
                  </button>
                );
              })}
            </div>
          </fieldset>

          {formError || serverError ? (
            <p role="alert" className="rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              {formError ?? serverError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-emerald-400 px-5 py-3 font-semibold text-zinc-950 disabled:opacity-60"
          >
            {busy ? "Creating account owner…" : "Create owner and continue"}
          </button>
          <button type="button" onClick={onSignOut} className="w-full text-sm text-zinc-400 underline">
            Sign out of this account
          </button>
        </form>
      </div>
    </main>
  );
}
