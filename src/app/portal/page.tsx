"use client";

import Link from "next/link";
import { useState } from "react";
import { SignInButton } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useActiveProfileGuard } from "../_guards/use-active-profile-guard";
import { APP_CATALOG } from "@/lib/app-catalog";
import { api } from "../../../convex/_generated/api";

export default function PortalHomePage() {
  const router = useRouter();
  const { isLoaded, isSignedIn, activeProfile, shouldRedirectToProfiles } = useActiveProfileGuard();
  const clearActiveProfile = useMutation(api.profiles.clearActiveProfile);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const disabledApps = useQuery(
    api.profiles.getDisabledApps,
    activeProfile ? { profileId: activeProfile._id } : "skip"
  );
  const recentActivity = useQuery(
    api.activities.listRecentForProfile,
    activeProfile ? { profileId: activeProfile._id, limit: 4 } : "skip"
  );

  if (!isLoaded) {
    return <main className="flex min-h-screen items-center justify-center">Loading...</main>;
  }

  if (!isSignedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-zinc-900">Portal</h1>
          <p className="mt-2 text-sm text-zinc-600">Sign in to continue.</p>
          <div className="mt-6">
            <SignInButton mode="modal">
              <button className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white">
                Sign in
              </button>
            </SignInButton>
          </div>
        </div>
      </main>
    );
  }

  if (activeProfile === undefined) {
    return <main className="flex min-h-screen items-center justify-center">Loading active profile...</main>;
  }

  if (shouldRedirectToProfiles || activeProfile === null) {
    return <main className="flex min-h-screen items-center justify-center">Redirecting to /profiles...</main>;
  }

  const hidden = new Set(disabledApps ?? []);
  const visibleApps = APP_CATALOG.filter(app => !hidden.has(app.id));
  const recentIds = new Set((recentActivity ?? []).map(item => item.app));
  const continueLearning = visibleApps.filter(app => recentIds.has(app.id));
  const featured = visibleApps[0] ?? APP_CATALOG[0];

  const switchProfile = async () => {
    await clearActiveProfile({});
    router.push("/profiles");
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div className="text-lg font-semibold tracking-tight">ZurOt</div>
          <nav className="hidden items-center gap-6 text-sm text-zinc-300 md:flex">
            <Link href="/portal" className="hover:text-white">
              Home
            </Link>
            <span className="text-zinc-500">My Apps</span>
            <span className="text-zinc-500">Progress</span>
            <span className="text-zinc-500">Library</span>
          </nav>
          <div className="relative">
            <button
              type="button"
              onClick={() => setSwitcherOpen(open => !open)}
              className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full" style={{ background: activeProfile.color }}>
                {activeProfile.emoji}
              </span>
              <span>{activeProfile.name}</span>
              <span aria-hidden>▾</span>
            </button>

            {switcherOpen ? (
              <div className="absolute right-0 mt-2 w-44 rounded-xl border border-zinc-700 bg-zinc-900 p-1 shadow-xl">
                <button
                  type="button"
                  onClick={() => void switchProfile()}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-100 hover:bg-zinc-800"
                >
                  Switch profile
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <section className="relative overflow-hidden rounded-3xl border border-zinc-700 bg-zinc-900 p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Featured App</p>
          <div className="mt-3 max-w-2xl">
            <h1 className="text-4xl font-semibold text-zinc-50">{featured.name}</h1>
            <p className="mt-3 text-sm text-zinc-300">{featured.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {featured.tags.map(tag => (
                <span key={tag} className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-6">
              <Link
                href={`/portal/app/${featured.id}`}
                className="inline-flex rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900"
              >
                Launch App
              </Link>
            </div>
          </div>
          <span className="pointer-events-none absolute right-8 top-8 select-none text-[220px] opacity-10 blur-sm">
            {featured.emoji}
          </span>
        </section>

        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Continue Learning</h2>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Recent</p>
          </div>
          {continueLearning.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">
              No recent sessions yet for this profile.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {continueLearning.map(app => (
                <Link key={app.id} href={`/portal/app/${app.id}`} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-500">
                  <p className="text-3xl">{app.emoji}</p>
                  <p className="mt-2 font-semibold">{app.name}</p>
                  <p className="mt-1 text-sm text-zinc-400">{app.shortDescription}</p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-xl font-semibold">All Apps</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {visibleApps.map(app => (
              <Link key={app.id} href={`/portal/app/${app.id}`} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-500">
                <div className="flex items-center justify-between">
                  <p className="text-3xl">{app.emoji}</p>
                  {app.isNew ? <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-emerald-950">NEW</span> : null}
                </div>
                <p className="mt-2 font-semibold">{app.name}</p>
                <p className="mt-1 text-sm text-zinc-400">{app.shortDescription}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
