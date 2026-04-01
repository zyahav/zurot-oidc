"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SignInButton, useAuth, useClerk } from "@clerk/nextjs";
import { useConvex, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { AddProfileModal } from "@/components/zurot/add-profile-modal";
import { PinEntryModal } from "@/components/zurot/pin-entry-modal";
import { ProfileAvatar } from "@/components/zurot/profile-avatar";
import { SignOutConfirmModal } from "@/components/zurot/signout-confirm-modal";
import { ToastItem, ToastStack } from "@/components/zurot/toast-stack";
import { HubProfile } from "@/lib/profile-types";
import { getRoleLabel } from "@/lib/profile-ui";

export default function ProfilesPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const convex = useConvex();
  const profiles = useQuery(api.profiles.getProfiles, {});
  const setActiveProfile = useMutation(api.profiles.setActiveProfile);
  const createProfile = useMutation(api.profiles.createProfile);
  const [pendingId, setPendingId] = useState<Id<"profiles"> | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pinModalProfile, setPinModalProfile] = useState<HubProfile | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinVerifying, setPinVerifying] = useState(false);
  const [pinFailedAttempts, setPinFailedAttempts] = useState(0);
  const [pinCooldownSeconds, setPinCooldownSeconds] = useState(0);

  const profileList = useMemo(() => (profiles ?? []) as HubProfile[], [profiles]);
  const canAddProfile = profileList.length < 10;

  useEffect(() => {
    if (pinCooldownSeconds <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setPinCooldownSeconds(current => Math.max(0, current - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [pinCooldownSeconds]);

  const pushToast = (message: string) => {
    const toast = { id: crypto.randomUUID(), message };
    setToasts(current => [...current, toast]);
    setTimeout(() => {
      setToasts(current => current.filter(item => item.id !== toast.id));
    }, 2600);
  };

  const closePinModal = () => {
    setPinModalProfile(null);
    setPinInput("");
    setPinError(null);
    setPinVerifying(false);
    setPinFailedAttempts(0);
    setPinCooldownSeconds(0);
  };

  const handleSelectProfile = async (profileId: Id<"profiles">) => {
    const selectedProfile = profileList.find(profile => profile._id === profileId);
    if (!selectedProfile) {
      return;
    }

    if (selectedProfile.hasPin) {
      setPinModalProfile(selectedProfile);
      setPinInput("");
      setPinError(null);
      return;
    }

    setPendingId(profileId);
    try {
      await setActiveProfile({ profileId });
      window.location.assign("/portal");
    } finally {
      setPendingId(null);
    }
  };

  const verifyAndEnterProfile = async (pin: string) => {
    if (!pinModalProfile || pinVerifying || pinCooldownSeconds > 0) {
      return;
    }

    setPinVerifying(true);
    setPinError(null);
    try {
      const isValid = await convex.query(api.profiles.verifyProfilePin, {
        profileId: pinModalProfile._id,
        pin,
      });

      if (isValid) {
        await setActiveProfile({ profileId: pinModalProfile._id });
        closePinModal();
        window.location.assign("/portal");
        return;
      }

      const nextAttempt = pinFailedAttempts + 1;
      if (nextAttempt >= 5) {
        setPinCooldownSeconds(30);
        setPinFailedAttempts(0);
        setPinError("Too many failed attempts. Keypad disabled for 30 seconds.");
      } else {
        setPinFailedAttempts(nextAttempt);
        setPinError("Incorrect PIN. Try again.");
      }
      setPinInput("");
    } finally {
      setPinVerifying(false);
    }
  };

  const handlePinDigit = (digit: string) => {
    if (pinVerifying || pinCooldownSeconds > 0 || pinInput.length >= 4) {
      return;
    }

    const next = `${pinInput}${digit}`;
    setPinInput(next);
    setPinError(null);

    if (next.length === 4) {
      void verifyAndEnterProfile(next);
    }
  };

  const handleCreateProfile: Parameters<typeof AddProfileModal>[0]["onSubmit"] = async values => {
    if (!canAddProfile) {
      pushToast("Maximum of 10 profiles reached.");
      return;
    }

    setCreateBusy(true);
    try {
      const created = (await createProfile(values)) as HubProfile;
      setShowAddModal(false);
      pushToast("Profile created.");

      if (profileList.length === 0) {
        await setActiveProfile({ profileId: created._id });
        window.location.assign("/portal");
      }
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Failed to create profile.");
    } finally {
      setCreateBusy(false);
    }
  };

  const confirmSignOut = async () => {
    setSignOutBusy(true);
    try {
      await signOut({ redirectUrl: "/profiles" });
    } finally {
      setSignOutBusy(false);
    }
  };

  if (!isLoaded) {
    return <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-200">Loading...</main>;
  }

  if (!isSignedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6">
        <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-zinc-100">Profiles</h1>
          <p className="mt-2 text-sm text-zinc-400">Sign in to select a profile.</p>
          <div className="mt-6">
            <SignInButton mode="modal">
              <button className="w-full rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900">
                Sign in
              </button>
            </SignInButton>
          </div>
        </div>
      </main>
    );
  }

  if (profiles === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-200">
        Loading profiles...
      </main>
    );
  }

  return (
    <>
      <main className="relative min-h-screen bg-zinc-950 px-6 py-10">
        <div className="mx-auto w-full max-w-5xl">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Profiles</p>
          <h1 className="mt-2 text-center text-4xl font-semibold text-zinc-50">Who&apos;s Watching?</h1>
          <p className="mt-2 text-center text-sm uppercase tracking-[0.2em] text-zinc-500">Select a profile to enter</p>

          <div className="mt-8 flex items-center justify-end">
            {profileList.length > 0 ? (
              <Link href="/profiles/manage" className="text-sm font-medium text-zinc-300 underline">
                Manage Profiles
              </Link>
            ) : null}
          </div>

          <div
            className={`mt-8 grid gap-4 ${
              profileList.length === 0 ? "mx-auto max-w-[220px] grid-cols-1" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
            }`}
          >
            {profileList.map(profile => {
              const isPending = pendingId === profile._id;
              return (
                <button
                  key={profile._id}
                  onClick={() => void handleSelectProfile(profile._id)}
                  disabled={isPending}
                  className="group rounded-2xl border border-zinc-700 bg-zinc-900/90 p-4 text-left transition duration-150 hover:-translate-y-1 hover:border-zinc-300 disabled:opacity-60"
                >
                  <ProfileAvatar
                    emoji={profile.emoji}
                    color={profile.color}
                    size={90}
                    showLock={profile.hasPin}
                  />
                  <p className="mt-3 text-[13px] font-semibold text-zinc-100">{profile.name}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-zinc-400">{getRoleLabel(profile.role)}</p>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => (canAddProfile ? setShowAddModal(true) : pushToast("Maximum of 10 profiles reached."))}
              className="group rounded-2xl border border-dashed border-zinc-600 bg-zinc-900 p-4 text-left transition duration-150 hover:-translate-y-1 hover:border-zinc-300"
            >
              <div className="flex h-[90px] w-[90px] items-center justify-center rounded-2xl border border-dashed border-zinc-500 text-4xl text-zinc-300">
                +
              </div>
              <p className="mt-3 text-[13px] font-semibold text-zinc-100">Add Profile</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
                {canAddProfile ? "Create New" : "Limit Reached"}
              </p>
            </button>
          </div>

          <div className="mt-10 text-center">
            <button
              type="button"
              onClick={() => setShowSignOutModal(true)}
              className="text-sm text-zinc-400 underline hover:text-zinc-200"
            >
              Sign out of account
            </button>
          </div>
        </div>
      </main>

      {showAddModal ? (
        <AddProfileModal
          busy={createBusy}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleCreateProfile}
        />
      ) : null}

      <PinEntryModal
        open={pinModalProfile !== null}
        profileName={pinModalProfile?.name ?? ""}
        profileEmoji={pinModalProfile?.emoji ?? "🔒"}
        profileColor={pinModalProfile?.color ?? "#1f2937"}
        enteredPin={pinInput}
        verifying={pinVerifying}
        errorMessage={pinError}
        attemptsRemaining={Math.max(0, 5 - pinFailedAttempts)}
        cooldownSeconds={pinCooldownSeconds}
        onClose={closePinModal}
        onDigit={handlePinDigit}
        onBackspace={() => setPinInput(current => current.slice(0, -1))}
        onClear={() => setPinInput("")}
      />

      <SignOutConfirmModal
        open={showSignOutModal}
        busy={signOutBusy}
        onCancel={() => setShowSignOutModal(false)}
        onConfirm={() => void confirmSignOut()}
      />

      <ToastStack toasts={toasts} />
    </>
  );
}
