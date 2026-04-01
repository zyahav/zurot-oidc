"use client";

import { FormEvent, useState } from "react";
import { AVATAR_PRESETS, ProfileRole, ROLE_LABEL } from "@/lib/profile-ui";
import { ProfileAvatar } from "./profile-avatar";

export type AddProfileFormValues = {
  name: string;
  emoji: string;
  color: string;
  role: ProfileRole;
};

export function AddProfileModal({
  busy,
  onClose,
  onSubmit,
}: {
  busy?: boolean;
  onClose: () => void;
  onSubmit: (values: AddProfileFormValues) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<ProfileRole>("student");
  const [selectedPreset, setSelectedPreset] = useState(AVATAR_PRESETS[0]);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required.");
      return;
    }

    setError(null);
    await onSubmit({
      name: trimmedName,
      emoji: selectedPreset.emoji,
      color: selectedPreset.color,
      role,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-xl rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        <h2 className="text-2xl font-semibold text-white">Add New Profile</h2>
        <p className="mt-2 text-sm text-zinc-300">Profile names can repeat. Emoji + color makes each profile unique.</p>

        <form className="mt-6 space-y-5" onSubmit={submit}>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-200">Name</label>
            <input
              value={name}
              onChange={event => setName(event.target.value)}
              className="w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              placeholder="e.g. Alex"
              maxLength={64}
              required
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-zinc-200">Role</p>
            <div className="flex flex-wrap gap-2">
              {(["student", "parent", "teacher"] as const).map(candidate => (
                <button
                  key={candidate}
                  type="button"
                  onClick={() => setRole(candidate)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    role === candidate
                      ? "border-zinc-100 bg-zinc-100 text-zinc-900"
                      : "border-zinc-600 bg-zinc-900 text-zinc-200"
                  }`}
                >
                  {ROLE_LABEL[candidate]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-zinc-200">Avatar</p>
            <div className="mb-3">
              <ProfileAvatar emoji={selectedPreset.emoji} color={selectedPreset.color} size={90} />
            </div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {AVATAR_PRESETS.map(preset => {
                const selected =
                  selectedPreset.emoji === preset.emoji && selectedPreset.color === preset.color;

                return (
                  <button
                    key={`${preset.emoji}-${preset.color}`}
                    type="button"
                    onClick={() => setSelectedPreset(preset)}
                    className={`rounded-lg border p-2 ${
                      selected ? "border-zinc-100" : "border-zinc-700"
                    }`}
                  >
                    <ProfileAvatar emoji={preset.emoji} color={preset.color} size={56} />
                  </button>
                );
              })}
            </div>
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-200"
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 disabled:opacity-60"
              disabled={busy}
            >
              {busy ? "Creating..." : "Create Profile"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
