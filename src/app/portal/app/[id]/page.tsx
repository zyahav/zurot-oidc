"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useActiveProfileGuard } from "../../../_guards/use-active-profile-guard";
import { APP_BY_ID } from "@/lib/app-catalog";

export default function PortalAppDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isLoaded, isSignedIn, activeProfile, shouldRedirectToProfiles } = useActiveProfileGuard();
  const app = APP_BY_ID.get(id);

  if (!isLoaded) {
    return <main className="flex min-h-screen items-center justify-center">Loading...</main>;
  }

  if (!isSignedIn) {
    return <main className="flex min-h-screen items-center justify-center">Sign in required.</main>;
  }

  if (activeProfile === undefined) {
    return <main className="flex min-h-screen items-center justify-center">Loading active profile...</main>;
  }

  if (shouldRedirectToProfiles || activeProfile === null) {
    return <main className="flex min-h-screen items-center justify-center">Redirecting to /profiles...</main>;
  }

  if (!app) {
    return (
      <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
          <h1 className="text-2xl font-semibold">App not found</h1>
          <Link href="/portal" className="mt-4 inline-block text-sm underline">
            Back to Portal
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto w-full max-w-4xl rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        <Link href="/portal" className="text-sm text-zinc-400 underline">
          ← Back
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <span className="text-6xl">{app.emoji}</span>
          <div>
            <h1 className="text-3xl font-semibold text-zinc-50">{app.name}</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Signed in as {activeProfile.name} · {activeProfile.role}
            </p>
          </div>
        </div>

        <p className="mt-5 text-zinc-300">{app.description}</p>

        <div className="mt-5 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Subject</p>
            <p className="mt-1 text-sm text-zinc-100">{app.subject}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Age Range</p>
            <p className="mt-1 text-sm text-zinc-100">{app.ageRange}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Lessons</p>
            <p className="mt-1 text-sm text-zinc-100">{app.lessonCount}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/launch/${app.id}`}
            className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900"
          >
            Launch App
          </Link>
          <Link
            href="/portal"
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-100"
          >
            Back to Hub
          </Link>
        </div>
        <p className="mt-4 text-xs text-zinc-500">
          App ID: {id}
        </p>
      </div>
    </main>
  );
}
