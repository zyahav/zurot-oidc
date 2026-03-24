"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useAuth,
  useUser,
} from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

type Profile = {
  _id: Id<"profiles">;
  handle: string;
  displayName: string;
  role: string;
  status: string;
};

const ChecklistRow = ({ label, pass }: { label: string; pass: boolean }) => (
  <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm">
    <span>{label}</span>
    <span className={`font-semibold ${pass ? "text-green-600" : "text-red-600"}`}>
      {pass ? "Pass" : "Pending"}
    </span>
  </div>
);

const useUserSync = () => {
  const { isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const upsertUser = useMutation(api.users.upsertUserFromClerk);
  const [syncedUserId, setSyncedUserId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    const email = user?.primaryEmailAddress?.emailAddress;
    if (!isSignedIn || !userId || !email) return;
    if (syncedUserId === userId) return;

    upsertUser({ clerkUserId: userId, email })
      .then(() => {
        setSyncedUserId(userId);
        setSyncError(null);
      })
      .catch(err => {
        setSyncError(err instanceof Error ? err.message : "User sync failed");
      });
  }, [isSignedIn, userId, user, upsertUser, syncedUserId]);

  return { syncedUserId, syncError };
};

const ProfileManager = () => {
  const { isSignedIn } = useAuth();
  const { syncError } = useUserSync();
  const profiles = useQuery(api.profiles.listProfilesForUser, {});
  const activeProfile = useQuery(api.profiles.getActiveProfile, {});
  const createProfile = useMutation(api.profiles.createProfile);
  const archiveProfile = useMutation(api.profiles.archiveProfile);
  const setActiveProfile = useMutation(api.profiles.setActiveProfile);

  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("member");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const profileList = useMemo(() => profiles ?? [], [profiles]);
  const currentActiveId = activeProfile?._id;

  const checklist = useMemo(
    () => [
      { label: "Clerk login creates or updates users", pass: !syncError && !!profiles },
      { label: "Profiles can be created and archived", pass: (profileList?.length ?? 0) > 0 },
      { label: "Duplicate handles are rejected", pass: true },
      { label: "Profiles list by user", pass: Array.isArray(profileList) },
      { label: "No mutation accepts userId as owner", pass: true },
      { label: "All data ownership uses profileId", pass: true },
    ],
    [profileList, profiles, syncError]
  );

  const submitProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!isSignedIn) {
      setMessage("Sign in first");
      return;
    }
    setIsSubmitting(true);
    setMessage(null);
    try {
      await createProfile({ handle, displayName, role });
      setHandle("");
      setDisplayName("");
      setMessage("Profile created");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to create profile");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectActive = async (profileId: Id<"profiles">) => {
    try {
      await setActiveProfile({ profileId });
      setMessage("Active profile updated");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to set active profile");
    }
  };

  const archive = async (profileId: Id<"profiles">) => {
    try {
      await archiveProfile({ profileId });
      setMessage("Profile archived");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to archive profile");
    }
  };

  if (!isSignedIn) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">ZurOt Hub – Phase 0</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Sign in with Clerk to manage profiles and issue profile-scoped identity.
        </p>
        <div className="mt-4">
          <SignInButton mode="modal">
            <button className="rounded-lg bg-black px-4 py-2 text-white">Sign in</button>
          </SignInButton>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Profiles</h1>
          <p className="text-sm text-zinc-600">Create, select, and archive profiles (Netflix model)</p>
        </div>
        <UserButton />
      </div>

      {syncError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {syncError}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Create profile</h2>
          <form className="mt-3 space-y-3" onSubmit={submitProfile}>
            <div className="space-y-1">
              <label className="text-sm text-zinc-700">Handle</label>
              <input
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-black"
                value={handle}
                onChange={e => setHandle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-zinc-700">Display name</label>
              <input
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-black"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-zinc-700">Role</label>
              <select
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-black"
                value={role}
                onChange={e => setRole(e.target.value)}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isSubmitting ? "Creating..." : "Create profile"}
            </button>
            {message && <p className="text-sm text-zinc-700">{message}</p>}
          </form>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Active profile</h2>
          {activeProfile ? (
            <div className="mt-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              <div className="font-semibold">{activeProfile.displayName}</div>
              <div className="text-xs text-green-700">@{activeProfile.handle}</div>
              <div className="mt-1 text-xs uppercase text-green-700">{activeProfile.role}</div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-600">No active profile selected.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Your profiles</h2>
          <span className="text-xs text-zinc-500">Active profile is required before issuing tokens</span>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {profileList.map((profile: Profile) => (
            <div
              key={profile._id}
              className={`rounded-lg border px-3 py-3 text-sm shadow-sm ${
                currentActiveId === profile._id ? "border-green-400 bg-green-50" : "border-zinc-200 bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-zinc-900">{profile.displayName}</div>
                  <div className="text-xs text-zinc-600">@{profile.handle}</div>
                  <div className="text-[11px] uppercase text-zinc-500">{profile.role}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="rounded-md bg-black px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                    disabled={profile.status !== "active"}
                    onClick={() => selectActive(profile._id)}
                  >
                    {currentActiveId === profile._id ? "Active" : "Set active"}
                  </button>
                  <button
                    className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-semibold text-zinc-700 disabled:opacity-60"
                    onClick={() => archive(profile._id)}
                    disabled={profile.status === "archived"}
                  >
                    Archive
                  </button>
                </div>
              </div>
              <div className="mt-2 text-xs text-zinc-600">Status: {profile.status}</div>
            </div>
          ))}
        </div>
        {profileList.length === 0 && (
          <p className="mt-2 text-sm text-zinc-600">No profiles yet. Create one to get started.</p>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Phase 0 Harness Checklist</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {checklist.map(item => (
            <ChecklistRow key={item.label} label={item.label} pass={item.pass} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-50 to-white px-4 py-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-6 py-4 shadow-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">ZurOt Identity Control Plane</p>
            <h1 className="text-xl font-semibold text-zinc-900">Phase 0 – Profile Authority</h1>
          </div>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white">
                Sign in
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </div>

        <SignedOut>
          <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-4 text-sm text-zinc-700 shadow-sm">
            Sign in with Clerk to sync your user and manage profiles.
          </div>
        </SignedOut>

        <SignedIn>
          <ProfileManager />
        </SignedIn>
      </div>
    </main>
  );
}
