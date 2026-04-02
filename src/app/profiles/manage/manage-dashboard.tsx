"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SignInButton, useAuth, useClerk } from "@clerk/nextjs";
import { useConvex, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../../../convex/_generated/api";
import { AddProfileModal } from "@/components/zurot/add-profile-modal";
import { ProfileAvatar } from "@/components/zurot/profile-avatar";
import { SignOutConfirmModal } from "@/components/zurot/signout-confirm-modal";
import { ToastItem, ToastStack } from "@/components/zurot/toast-stack";
import { APP_CATALOG } from "@/lib/app-catalog";
import { HubProfile } from "@/lib/profile-types";
import { AVATAR_PRESETS, ProfileRole, ROLE_BADGE_CLASSES, ROLE_LABEL, getRoleLabel } from "@/lib/profile-ui";

const OWNER_PIN_UNLOCK_MS = 30 * 60 * 1000;

type ActivityRecord = {
  _id: string;
  app: string;
  title: string;
  createdAt: number;
  type: string;
};

const formatDateTime = (timestamp: number) =>
  new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const getActivityDuration = (activity: ActivityRecord, index: number) => {
  const seed = activity._id
    .slice(0, 6)
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return 8 + ((seed + index * 11) % 34);
};

export function ManageDashboard({ initialProfileId }: { initialProfileId?: string }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const convex = useConvex();
  const router = useRouter();
  const profilesRaw = useQuery(api.profiles.getProfiles, {});
  const ownerPin = useQuery(api.profiles.getOwnerPin, {});

  const [unlockedUntil, setUnlockedUntil] = useState<number | null>(null);
  const [gatePinInput, setGatePinInput] = useState("");
  const [gateError, setGateError] = useState<string | null>(null);
  const [gateVerifying, setGateVerifying] = useState(false);
  const [gateFailedAttempts, setGateFailedAttempts] = useState(0);
  const [gateCooldownSeconds, setGateCooldownSeconds] = useState(0);
  const [setupPinInput, setSetupPinInput] = useState("");
  const [setupPinConfirm, setSetupPinConfirm] = useState("");
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [forgotMode, setForgotMode] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSentMessage, setOtpSentMessage] = useState<string | null>(null);
  const [recoveryVerified, setRecoveryVerified] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [sidebarMessage, setSidebarMessage] = useState<string | null>(null);

  const [editableName, setEditableName] = useState("");
  const [editableRole, setEditableRole] = useState<ProfileRole>("student");
  const [editableAvatar, setEditableAvatar] = useState(AVATAR_PRESETS[0]);
  const [identityBusy, setIdentityBusy] = useState(false);

  const [pinMode, setPinMode] = useState<"idle" | "set" | "change">("idle");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinBusy, setPinBusy] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const profiles = useMemo(() => (profilesRaw ?? []) as HubProfile[], [profilesRaw]);
  const canAddProfile = profiles.length < 10;

  const selectedProfile = useMemo(() => {
    if (profiles.length === 0) {
      return null;
    }
    if (initialProfileId) {
      return profiles.find(profile => profile._id === initialProfileId) ?? profiles[0];
    }
    return profiles[0];
  }, [initialProfileId, profiles]);

  const disabledApps = useQuery(
    api.profiles.getDisabledApps,
    selectedProfile ? { profileId: selectedProfile._id } : "skip"
  );
  const activityRaw = useQuery(
    api.activities.listRecentForProfile,
    selectedProfile ? { profileId: selectedProfile._id, limit: 10 } : "skip"
  );

  const activity = useMemo(() => {
    return ((activityRaw ?? []) as ActivityRecord[]).map((record, index) => ({
      ...record,
      durationMinutes: getActivityDuration(record, index),
    }));
  }, [activityRaw]);

  const isUnlocked = unlockedUntil !== null && Date.now() < unlockedUntil;
  const requiresSetup = ownerPin !== undefined && (!ownerPin.hasPin || recoveryVerified);

  const pushToast = (message: string) => {
    const toast = { id: crypto.randomUUID(), message };
    setToasts(current => [...current, toast]);
    setTimeout(() => {
      setToasts(current => current.filter(item => item.id !== toast.id));
    }, 2600);
  };

  useEffect(() => {
    if (unlockedUntil === null) {
      return;
    }

    const msRemaining = unlockedUntil - Date.now();
    if (msRemaining <= 0) {
      setUnlockedUntil(null);
      return;
    }

    const timeout = setTimeout(() => {
      setUnlockedUntil(null);
    }, msRemaining);

    return () => clearTimeout(timeout);
  }, [unlockedUntil]);

  useEffect(() => {
    if (gateCooldownSeconds <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setGateCooldownSeconds(current => Math.max(0, current - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [gateCooldownSeconds]);

  useEffect(() => {
    if (!selectedProfile) {
      return;
    }

    setEditableName(selectedProfile.name);
    setEditableRole(selectedProfile.role);
    setEditableAvatar({ emoji: selectedProfile.emoji, color: selectedProfile.color });
    setPinMode("idle");
    setPinInput("");
    setPinError(null);
    setShowDeleteConfirm(false);
  }, [selectedProfile]);

  const createProfile = useMutation(api.profiles.createProfile);
  const setOwnerPin = useMutation(api.profiles.setOwnerPin);
  const updateProfile = useMutation(api.profiles.updateProfile);
  const deleteProfile = useMutation(api.profiles.deleteProfile);
  const disableApp = useMutation(api.profiles.disableApp);
  const enableApp = useMutation(api.profiles.enableApp);

  const onCreateProfile: Parameters<typeof AddProfileModal>[0]["onSubmit"] = async values => {
    if (!canAddProfile) {
      setSidebarMessage("Maximum of 10 profiles reached.");
      return;
    }

    setCreateBusy(true);
    try {
      const created = (await createProfile(values)) as HubProfile;
      setShowAddModal(false);
      pushToast("Profile created!");
      router.push(`/profiles/manage/${created._id}`);
      setSidebarMessage(null);
    } catch (error) {
      setSidebarMessage(error instanceof Error ? error.message : "Failed to create profile.");
    } finally {
      setCreateBusy(false);
    }
  };

  const unlockManageGate = () => {
    setUnlockedUntil(Date.now() + OWNER_PIN_UNLOCK_MS);
    setGatePinInput("");
    setGateError(null);
    setGateFailedAttempts(0);
    setGateCooldownSeconds(0);
    setForgotMode(false);
    setOtpInput("");
    setOtpError(null);
    setOtpSentMessage(null);
  };

  const verifyOwnerPin = async (pin: string) => {
    if (gateVerifying || gateCooldownSeconds > 0) {
      return;
    }

    setGateVerifying(true);
    setGateError(null);
    try {
      const result = await convex.query(api.profiles.getOwnerPin, { pin });
      if (result.isValid) {
        unlockManageGate();
        return;
      }

      const nextAttempt = gateFailedAttempts + 1;
      if (nextAttempt >= 5) {
        setGateCooldownSeconds(30);
        setGateFailedAttempts(0);
        setGateError("Too many failed attempts. Keypad disabled for 30 seconds.");
      } else {
        setGateFailedAttempts(nextAttempt);
        setGateError("Incorrect PIN. Try again.");
      }
      setGatePinInput("");
    } finally {
      setGateVerifying(false);
    }
  };

  const handleGateDigit = (digit: string) => {
    if (gateVerifying || gateCooldownSeconds > 0 || gatePinInput.length >= 4) {
      return;
    }

    const next = `${gatePinInput}${digit}`;
    setGatePinInput(next);
    setGateError(null);

    if (next.length === 4) {
      void verifyOwnerPin(next);
    }
  };

  const saveOwnerPin = async () => {
    if (!/^\d{4}$/.test(setupPinInput) || !/^\d{4}$/.test(setupPinConfirm)) {
      setSetupError("PIN must be exactly 4 digits.");
      return;
    }

    if (setupPinInput !== setupPinConfirm) {
      setSetupError("PIN confirmation does not match.");
      return;
    }

    setSetupBusy(true);
    setSetupError(null);
    try {
      await setOwnerPin({ pin: setupPinInput });
      setSetupPinInput("");
      setSetupPinConfirm("");
      setRecoveryVerified(false);
      unlockManageGate();
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : "Failed to save owner PIN.");
    } finally {
      setSetupBusy(false);
    }
  };

  const sendRecoveryOtp = async () => {
    setOtpBusy(true);
    setOtpError(null);
    try {
      const response = await fetch("/api/manage/send-recovery-otp", { method: "POST" });
      const body = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Failed to send recovery code.");
      }
      setForgotMode(true);
      setOtpSentMessage(body.message ?? "Recovery code sent.");
    } catch (error) {
      setOtpError(error instanceof Error ? error.message : "Failed to send recovery code.");
    } finally {
      setOtpBusy(false);
    }
  };

  const confirmRecoveryOtp = async () => {
    if (!/^\d{6}$/.test(otpInput)) {
      setOtpError("Recovery code must be exactly 6 digits.");
      return;
    }

    setOtpBusy(true);
    setOtpError(null);
    try {
      const response = await fetch("/api/manage/verify-recovery-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: otpInput }),
      });
      const body = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Failed to verify recovery code.");
      }

      setRecoveryVerified(true);
      setForgotMode(false);
      setOtpInput("");
      setOtpError(null);
      setOtpSentMessage(null);
      setGatePinInput("");
      setGateError(null);
      setGateFailedAttempts(0);
      setGateCooldownSeconds(0);
      pushToast(body.message ?? "Recovery code verified.");
    } catch (error) {
      setOtpError(error instanceof Error ? error.message : "Failed to verify recovery code.");
    } finally {
      setOtpBusy(false);
    }
  };

  const saveIdentity = async () => {
    if (!selectedProfile) {
      return;
    }

    const trimmed = editableName.trim();
    if (!trimmed) {
      pushToast("Name is required.");
      return;
    }

    setIdentityBusy(true);
    try {
      await updateProfile({
        id: selectedProfile._id,
        name: trimmed,
        role: editableRole,
        emoji: editableAvatar.emoji,
        color: editableAvatar.color,
      });
      pushToast("Profile updated.");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Failed to update profile.");
    } finally {
      setIdentityBusy(false);
    }
  };

  const toggleAppAccess = async (appId: string, enabled: boolean) => {
    if (!selectedProfile) {
      return;
    }

    try {
      if (enabled) {
        await disableApp({ profileId: selectedProfile._id, appId });
        pushToast("App disabled for this profile.");
      } else {
        await enableApp({ profileId: selectedProfile._id, appId });
        pushToast("App enabled for this profile.");
      }
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Failed to update app access.");
    }
  };

  const savePin = async () => {
    if (!selectedProfile) {
      return;
    }
    if (!/^\d{4}$/.test(pinInput)) {
      setPinError("PIN must be exactly 4 digits.");
      return;
    }

    setPinBusy(true);
    setPinError(null);
    try {
      await updateProfile({
        id: selectedProfile._id,
        // Carry-forward: this arg name is pinHash, but backend expects RAW 4-digit PIN input.
        pinHash: pinInput,
      });
      pushToast(pinMode === "set" ? "PIN set." : "PIN changed.");
      setPinMode("idle");
      setPinInput("");
    } catch (error) {
      setPinError(error instanceof Error ? error.message : "Failed to save PIN.");
    } finally {
      setPinBusy(false);
    }
  };

  const removePin = async () => {
    if (!selectedProfile) {
      return;
    }
    setPinBusy(true);
    try {
      await updateProfile({ id: selectedProfile._id, pinHash: null });
      pushToast("PIN removed.");
      setPinMode("idle");
      setPinInput("");
      setPinError(null);
    } catch (error) {
      setPinError(error instanceof Error ? error.message : "Failed to remove PIN.");
    } finally {
      setPinBusy(false);
    }
  };

  const confirmDeleteProfile = async () => {
    if (!selectedProfile) {
      return;
    }
    setDeleteBusy(true);
    try {
      await deleteProfile({ id: selectedProfile._id });
      pushToast("Profile deleted.");
      setShowDeleteConfirm(false);

      const nextProfile = profiles.find(profile => profile._id !== selectedProfile._id);
      if (nextProfile) {
        router.push(`/profiles/manage/${nextProfile._id}`);
      } else {
        router.push("/profiles/manage");
      }
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Failed to delete profile.");
    } finally {
      setDeleteBusy(false);
    }
  };

  const confirmSignOut = async () => {
    setShowSignOutModal(false);
    setSignOutBusy(true);
    try {
      await signOut();
      window.location.href = "/profiles";
    } finally {
      setSignOutBusy(false);
    }
  };

  const enabledAppsCount = useMemo(() => {
    if (!disabledApps) {
      return APP_CATALOG.length;
    }
    return APP_CATALOG.length - disabledApps.length;
  }, [disabledApps]);

  const totalMinutes = activity.reduce((sum, item) => sum + item.durationMinutes, 0);
  const sessionsCount = activity.length;
  const lastSeen = activity[0]?.createdAt ?? null;
  const maxDuration = Math.max(...activity.map(item => item.durationMinutes), 1);

  if (!isLoaded) {
    return <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-200">Loading...</main>;
  }

  if (!isSignedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6">
        <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-zinc-100">Manage Profiles</h1>
          <p className="mt-2 text-sm text-zinc-400">Sign in to continue.</p>
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

  if (!isUnlocked) {
    if (ownerPin === undefined) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-200">
          Loading security gate...
        </main>
      );
    }

    if (requiresSetup) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
            <div className="mb-4 text-3xl">🛡️</div>
            <h1 className="text-2xl font-semibold text-zinc-100">Set up your owner PIN</h1>
            <p className="mt-2 text-sm text-zinc-300">
              Set up a PIN to protect this area.
              {recoveryVerified ? " Recovery verified. Choose a new 4-digit PIN." : ""}
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-2 block text-sm text-zinc-300">4-digit PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={setupPinInput}
                  onChange={event => setSetupPinInput(event.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  placeholder="0000"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-zinc-300">Confirm PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={setupPinConfirm}
                  onChange={event => setSetupPinConfirm(event.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  placeholder="0000"
                />
              </div>
            </div>

            {setupError ? <p className="mt-3 text-sm text-red-400">{setupError}</p> : null}

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => router.push("/profiles")}
                className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveOwnerPin()}
                disabled={setupBusy}
                className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 disabled:opacity-60"
              >
                {setupBusy ? "Saving..." : "Save PIN"}
              </button>
            </div>
          </div>
        </main>
      );
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
        <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
          <div className="mb-4 text-3xl">🛡️</div>
          <h1 className="text-2xl font-semibold text-zinc-100">Manage Profiles</h1>
          <p className="mt-2 text-sm text-zinc-300">
            Enter your 4-digit owner PIN to continue.
          </p>

          {!forgotMode ? (
            <>
              <div className="mt-4">
                <ManagePinKeypad
                  enteredPin={gatePinInput}
                  verifying={gateVerifying}
                  attemptsRemaining={Math.max(0, 5 - gateFailedAttempts)}
                  cooldownSeconds={gateCooldownSeconds}
                  errorMessage={gateError}
                  onDigit={handleGateDigit}
                  onBackspace={() => setGatePinInput(current => current.slice(0, -1))}
                  onClear={() => {
                    setGatePinInput("");
                    setGateError(null);
                  }}
                />
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/profiles")}
                  className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void sendRecoveryOtp()}
                  disabled={otpBusy}
                  className="text-sm text-zinc-300 underline disabled:opacity-60"
                >
                  Forgot PIN?
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mt-4 rounded-xl border border-zinc-700 bg-zinc-950 p-4">
                <p className="text-sm text-zinc-300">Enter the 6-digit recovery code sent to your email.</p>
                {otpSentMessage ? <p className="mt-2 text-xs text-zinc-400">{otpSentMessage}</p> : null}
                <input
                  type="text"
                  inputMode="numeric"
                  value={otpInput}
                  onChange={event => setOtpInput(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                  placeholder="123456"
                />
                {otpError ? <p className="mt-2 text-sm text-red-400">{otpError}</p> : null}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotMode(false);
                      setOtpInput("");
                      setOtpError(null);
                    }}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200"
                  >
                    Back
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void sendRecoveryOtp()}
                      disabled={otpBusy}
                      className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 disabled:opacity-60"
                    >
                      Resend
                    </button>
                    <button
                      type="button"
                      onClick={() => void confirmRecoveryOtp()}
                      disabled={otpBusy}
                      className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-900 disabled:opacity-60"
                    >
                      {otpBusy ? "Verifying..." : "Verify"}
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-start">
                <button
                  type="button"
                  onClick={() => router.push("/profiles")}
                  className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-100 md:px-6">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 md:grid-cols-[300px_1fr]">
          <aside className="sticky top-4 h-fit rounded-2xl border border-zinc-700 bg-zinc-900 p-4 shadow-xl">
            <Link href="/profiles" className="text-sm text-zinc-300 underline">
              ← Back to profiles
            </Link>
            <div className="mt-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">ZurOt</p>
              <h2 className="mt-1 text-lg font-semibold">Manage Profiles</h2>
            </div>

            <div className="mt-5 space-y-2">
              {profiles.map(profile => {
                const selected = selectedProfile?._id === profile._id;
                return (
                  <Link
                    key={profile._id}
                    href={`/profiles/manage/${profile._id}`}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
                      selected ? "border-zinc-100 bg-zinc-100 text-zinc-900" : "border-zinc-700 bg-zinc-950 text-zinc-100"
                    }`}
                  >
                    <ProfileAvatar
                      emoji={profile.emoji}
                      color={profile.color}
                      size={54}
                      showLock={profile.hasPin}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{profile.name}</p>
                      <p className={`text-xs ${selected ? "text-zinc-700" : "text-zinc-400"}`}>
                        {getRoleLabel(profile.role)}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="mt-4 rounded-xl border border-dashed border-zinc-600 bg-zinc-950 p-3">
              <button
                type="button"
                onClick={() => (canAddProfile ? setShowAddModal(true) : setSidebarMessage("Maximum of 10 profiles reached."))}
                className="w-full text-left text-sm font-medium text-zinc-200"
              >
                + Add new profile
              </button>
              {sidebarMessage ? <p className="mt-2 text-xs text-amber-300">{sidebarMessage}</p> : null}
            </div>

            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={() => setShowSignOutModal(true)}
                className="text-xs text-zinc-400 underline hover:text-zinc-200"
              >
                Sign out of account
              </button>
            </div>
          </aside>

          <section className="space-y-4">
            {!selectedProfile ? (
              <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
                No profile selected.
              </div>
            ) : (
              <>
                <section className="rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
                  <div className="flex flex-wrap items-center gap-4">
                    <ProfileAvatar
                      emoji={selectedProfile.emoji}
                      color={selectedProfile.color}
                      size={80}
                      showLock={selectedProfile.hasPin}
                    />
                    <div>
                      <h1 className="text-3xl font-semibold">{selectedProfile.name}</h1>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            ROLE_BADGE_CLASSES[selectedProfile.role]
                          }`}
                        >
                          {ROLE_LABEL[selectedProfile.role]}
                        </span>
                        <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">
                          Member since {selectedProfile.since}
                        </span>
                        {selectedProfile.hasPin ? (
                          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-900">
                            🔒 PIN Active
                          </span>
                        ) : (
                          <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">
                            🔓 No PIN
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="Total time" value={`${totalMinutes} min`} />
                  <MetricCard label="Sessions" value={`${sessionsCount}`} />
                  <MetricCard label="Last seen" value={lastSeen ? formatDateTime(lastSeen) : "No activity"} />
                  <MetricCard label="Apps enabled" value={`${enabledAppsCount} / ${APP_CATALOG.length}`} />
                </section>

                <section className="rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
                  <h2 className="text-lg font-semibold">Recent Activity</h2>
                  {activity.length === 0 ? (
                    <p className="mt-3 text-sm text-zinc-400">No activity yet for this profile.</p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {activity.map(item => {
                        const app = APP_CATALOG.find(candidate => candidate.id === item.app);
                        const width = Math.max(8, Math.round((item.durationMinutes / maxDuration) * 100));
                        return (
                          <div key={item._id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <span className="text-xl">{app?.emoji ?? "📘"}</span>
                                <div>
                                  <p className="text-sm font-semibold text-zinc-100">{app?.name ?? item.app}</p>
                                  <p className="text-xs text-zinc-400">{formatDateTime(item.createdAt)}</p>
                                </div>
                              </div>
                              <p className="text-xs text-zinc-300">{item.durationMinutes} min</p>
                            </div>
                            <p className="mt-2 text-sm text-zinc-300">{item.title}</p>
                            <div className="mt-2 h-2 rounded bg-zinc-800">
                              <div className="h-2 rounded bg-zinc-300" style={{ width: `${width}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
                  <h2 className="text-lg font-semibold">App Access</h2>
                  <p className="mt-1 text-sm text-zinc-400">Toggle apps on/off for this profile. Changes apply immediately.</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {APP_CATALOG.map(app => {
                      const isDisabled = (disabledApps ?? []).includes(app.id);
                      return (
                        <div key={app.id} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-zinc-100">
                              {app.emoji} {app.name}
                            </p>
                            <p className="truncate text-xs text-zinc-400">{app.shortDescription}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void toggleAppAccess(app.id, !isDisabled)}
                            className={`ml-3 rounded-full px-3 py-1 text-xs font-semibold ${
                              isDisabled ? "bg-zinc-700 text-zinc-100" : "bg-zinc-100 text-zinc-900"
                            }`}
                          >
                            {isDisabled ? "OFF" : "ON"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
                  <h2 className="text-lg font-semibold">Identity</h2>
                  <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto]">
                    <div className="space-y-4">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-zinc-200">Name</label>
                        <input
                          value={editableName}
                          onChange={event => setEditableName(event.target.value)}
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                        />
                      </div>

                      <div>
                        <p className="mb-2 text-sm font-medium text-zinc-200">Role</p>
                        <div className="flex flex-wrap gap-2">
                          {(["student", "parent", "teacher"] as const).map(candidate => (
                            <button
                              key={candidate}
                              type="button"
                              onClick={() => setEditableRole(candidate)}
                              className={`rounded-full border px-3 py-1.5 text-sm ${
                                editableRole === candidate
                                  ? "border-zinc-100 bg-zinc-100 text-zinc-900"
                                  : "border-zinc-700 bg-zinc-950 text-zinc-200"
                              }`}
                            >
                              {ROLE_LABEL[candidate]}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="mb-2 text-sm font-medium text-zinc-200">Avatar</p>
                        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                          {AVATAR_PRESETS.map(preset => {
                            const selected =
                              editableAvatar.emoji === preset.emoji && editableAvatar.color === preset.color;
                            return (
                              <button
                                key={`${preset.emoji}-${preset.color}`}
                                type="button"
                                onClick={() => setEditableAvatar(preset)}
                                className={`rounded-lg border p-2 ${
                                  selected ? "border-zinc-100" : "border-zinc-700"
                                }`}
                              >
                                <ProfileAvatar emoji={preset.emoji} color={preset.color} size={54} />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="self-start rounded-xl border border-zinc-700 bg-zinc-950 p-3">
                      <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Preview</p>
                      <ProfileAvatar emoji={editableAvatar.emoji} color={editableAvatar.color} size={90} />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void saveIdentity()}
                    disabled={identityBusy}
                    className="mt-5 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 disabled:opacity-60"
                  >
                    {identityBusy ? "Saving..." : "Save Changes"}
                  </button>
                </section>

                <section className="rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
                  <h2 className="text-lg font-semibold">PIN Lock</h2>

                  {selectedProfile.hasPin ? (
                    <p className="mt-2 text-sm text-zinc-300">🔒 PIN is set for this profile.</p>
                  ) : (
                    <p className="mt-2 text-sm text-zinc-300">🔓 No PIN — anyone can enter this profile.</p>
                  )}

                  {pinMode !== "idle" ? (
                    <div className="mt-4 rounded-xl border border-zinc-700 bg-zinc-950 p-3">
                      <label className="mb-2 block text-sm font-medium text-zinc-200">
                        {pinMode === "set" ? "Set 4-digit PIN" : "Change 4-digit PIN"}
                      </label>
                      <input
                        type="password"
                        inputMode="numeric"
                        value={pinInput}
                        onChange={event => setPinInput(event.target.value.replace(/\D/g, "").slice(0, 4))}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                        placeholder="0000"
                      />
                      {pinError ? <p className="mt-2 text-sm text-red-400">{pinError}</p> : null}
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void savePin()}
                          disabled={pinBusy}
                          className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-900 disabled:opacity-60"
                        >
                          {pinBusy ? "Saving..." : "Save PIN"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPinMode("idle");
                            setPinInput("");
                            setPinError(null);
                          }}
                          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {!selectedProfile.hasPin ? (
                      <button
                        type="button"
                        onClick={() => setPinMode("set")}
                        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-100"
                      >
                        Set PIN
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setPinMode("change")}
                          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-100"
                        >
                          Change PIN
                        </button>
                        <button
                          type="button"
                          onClick={() => void removePin()}
                          className="rounded-lg border border-red-500/60 px-3 py-1.5 text-sm text-red-300"
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border border-red-700/70 bg-red-950/35 p-6">
                  <h2 className="text-lg font-semibold text-red-200">Danger Zone</h2>
                  <p className="mt-2 text-sm text-red-100/90">
                    Permanently delete {selectedProfile.name}. All activity and settings will be lost.
                  </p>

                  {profiles.length <= 1 ? (
                    <p className="mt-3 text-sm text-amber-200">
                      Delete disabled: you cannot delete the only remaining profile.
                    </p>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={profiles.length <= 1}
                    className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Delete Profile
                  </button>

                  {showDeleteConfirm ? (
                    <div className="mt-4 rounded-xl border border-red-600/60 bg-red-950/60 p-4">
                      <p className="text-sm text-red-100">Are you sure? This cannot be undone.</p>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void confirmDeleteProfile()}
                          disabled={deleteBusy}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {deleteBusy ? "Deleting..." : "Yes, delete"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(false)}
                          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </section>
              </>
            )}
          </section>
        </div>
      </main>

      {showAddModal ? (
        <AddProfileModal
          busy={createBusy}
          onClose={() => setShowAddModal(false)}
          onSubmit={onCreateProfile}
        />
      ) : null}
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

function ManagePinKeypad({
  enteredPin,
  verifying,
  attemptsRemaining,
  cooldownSeconds,
  errorMessage,
  onDigit,
  onBackspace,
  onClear,
}: {
  enteredPin: string;
  verifying: boolean;
  attemptsRemaining: number;
  cooldownSeconds: number;
  errorMessage: string | null;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onClear: () => void;
}) {
  const keypadDisabled = verifying || cooldownSeconds > 0;

  return (
    <>
      <div className="mb-4 flex items-center justify-center gap-2">
        {[0, 1, 2, 3].map(index => (
          <span
            key={index}
            className={`inline-flex h-3.5 w-3.5 rounded-full ${
              index < enteredPin.length ? "bg-zinc-100" : "bg-zinc-700"
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
    </>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-zinc-100">{value}</p>
    </div>
  );
}
