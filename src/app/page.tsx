"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  SignInButton,
  SignOutButton,
  useAuth,
  useUser,
} from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

type Profile = {
  _id: Id<"profiles">;
  handle: string;
  displayName: string;
  role: string;
  status: string;
};

type AppCard = {
  id: string;
  name: string;
  url: string;
  description: string;
};

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
  }, [isSignedIn, syncedUserId, upsertUser, user, userId]);

  return { syncError };
};

const ProfileAvatar = ({ name }: { name: string }) => {
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white">
      {initial}
    </div>
  );
};

function LoginState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-50 to-white px-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">ZurOt</h1>
        <p className="mt-3 text-sm text-zinc-600">Your access point to all your apps</p>
        <div className="mt-6">
          <SignInButton mode="modal">
            <button className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800">
              Sign in
            </button>
          </SignInButton>
        </div>
      </div>
    </div>
  );
}

function ProfilePickerState({
  profiles,
  onPick,
  pendingProfile,
}: {
  profiles: Profile[];
  onPick: (profileId: Id<"profiles">) => Promise<void>;
  pendingProfile: Id<"profiles"> | null;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white px-6 py-12">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex justify-end">
          {/* Logout must be available in every authenticated state, including State 2. */}
          <SignOutButton>
            <button className="text-sm font-medium text-zinc-700 underline">Sign out</button>
          </SignOutButton>
        </div>
        <h1 className="text-center text-3xl font-semibold text-zinc-900">Who&apos;s using ZurOt?</h1>

        {profiles.length === 0 ? (
          <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
            <p className="text-zinc-700">No profiles yet.</p>
            <Link href="/internal" className="mt-3 inline-block text-sm font-medium text-zinc-900 underline">
              Go to internal harness to create your first profile
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {profiles.map(profile => {
              const isPending = pendingProfile === profile._id;
              return (
                <button
                  key={profile._id}
                  onClick={() => void onPick(profile._id)}
                  disabled={isPending}
                  className="rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:border-zinc-300 disabled:opacity-70"
                >
                  <div className="flex items-center gap-3">
                    <ProfileAvatar name={profile.displayName} />
                    <div>
                      <div className="font-semibold text-zinc-900">{profile.displayName}</div>
                      <div className="text-sm text-zinc-600">@{profile.handle}</div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs uppercase tracking-wide text-zinc-500">{profile.role}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function AppLauncherState({
  activeProfile,
  apps,
  onSwitchProfile,
}: {
  activeProfile: Profile;
  apps: AppCard[];
  onSwitchProfile: () => Promise<void>;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white px-6 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold text-zinc-900">Welcome, {activeProfile.displayName}</h1>
          <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-sm">
            <ProfileAvatar name={activeProfile.displayName} />
            <div>
              <div className="text-sm font-medium text-zinc-900">@{activeProfile.handle}</div>
              <button
                onClick={() => void onSwitchProfile()}
                className="text-xs font-medium text-zinc-700 underline"
              >
                Switch profile
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-zinc-900">Your Apps</h2>
            <SignOutButton>
              <button className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700">
                Sign out
              </button>
            </SignOutButton>
          </div>

          {apps.length === 0 ? (
            <p className="text-sm text-zinc-600">No apps available for this profile yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {apps.map(app => (
                <a
                  key={app.id}
                  href={app.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-zinc-200 p-4 transition hover:border-zinc-300"
                >
                  <div className="font-semibold text-zinc-900">{app.name}</div>
                  <div className="mt-1 text-sm text-zinc-600">{app.description}</div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { isSignedIn } = useAuth();
  const { syncError } = useUserSync();
  const profiles = useQuery(api.profiles.listProfilesForUser, {});
  const activeProfile = useQuery(api.profiles.getActiveProfile, {});
  const appsForProfile = useQuery(api.profiles.getAppsForActiveProfile, {});
  const setActiveProfile = useMutation(api.profiles.setActiveProfile);
  const clearActiveProfile = useMutation(api.profiles.clearActiveProfile);

  const [pendingProfile, setPendingProfile] = useState<Id<"profiles"> | null>(null);
  const [dismissedSyncWarning, setDismissedSyncWarning] = useState(false);

  useEffect(() => {
    if (syncError) {
      setDismissedSyncWarning(false);
    }
  }, [syncError]);

  const profileList = useMemo(() => profiles ?? [], [profiles]);
  const appList = useMemo(() => appsForProfile ?? [], [appsForProfile]);

  const pickProfile = async (profileId: Id<"profiles">) => {
    setPendingProfile(profileId);
    try {
      await setActiveProfile({ profileId });
    } finally {
      setPendingProfile(null);
    }
  };

  const switchProfile = async () => {
    // Profile switch keeps Clerk auth alive and only clears active profile context.
    await clearActiveProfile({});
  };

  const syncWarning =
    syncError && !dismissedSyncWarning ? (
      <div className="fixed left-0 right-0 top-0 z-50 px-4 pt-3">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 shadow-sm">
          <span>{syncError}</span>
          <button
            className="ml-3 rounded px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
            onClick={() => setDismissedSyncWarning(true)}
          >
            Dismiss
          </button>
        </div>
      </div>
    ) : null;

  if (isSignedIn === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 text-sm text-zinc-600">
        Loading...
      </main>
    );
  }

  if (!isSignedIn) {
    return <LoginState />;
  }

  if (activeProfile === undefined || profiles === undefined || appsForProfile === undefined) {
    return (
      <>
        {syncWarning}
        <main className="flex min-h-screen items-center justify-center bg-zinc-50 text-sm text-zinc-600">
          Loading your workspace...
        </main>
      </>
    );
  }

  if (!activeProfile) {
    return (
      <>
        {syncWarning}
        <ProfilePickerState
          profiles={profileList}
          pendingProfile={pendingProfile}
          onPick={pickProfile}
        />
      </>
    );
  }

  return (
    <>
      {syncWarning}
      <AppLauncherState
        activeProfile={activeProfile as Profile}
        apps={appList}
        onSwitchProfile={switchProfile}
      />
    </>
  );
}
