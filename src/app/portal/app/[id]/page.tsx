"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useActiveProfileGuard } from "../../../_guards/use-active-profile-guard";
import { APP_BY_ID, appLaunchHref } from "@/lib/app-catalog";
import { api } from "../../../../../convex/_generated/api";

type AccessRequest = {
  productKey: string;
  status: "pending" | "approved" | "declined";
  requestedAt: number;
};

export default function PortalAppDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isLoaded, isSignedIn, activeProfile, shouldRedirectToProfiles } = useActiveProfileGuard();
  const app = APP_BY_ID.get(id);
  const launchHref = app ? appLaunchHref(app, activeProfile?._id) : `/launch/${id}`;
  const requestAccess = useMutation(api.profiles.requestAccess);
  const disabledApps = useQuery(
    api.profiles.getDisabledApps,
    activeProfile ? { profileId: activeProfile._id } : "skip"
  );
  const accessRequests = useQuery(
    api.profiles.listAccessRequestsForProfile,
    activeProfile ? { profileId: activeProfile._id } : "skip"
  ) as AccessRequest[] | undefined;
  const [message, setMessage] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

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

  const disabled = app ? (disabledApps ?? []).includes(app.id) : false;
  const policy = app && activeProfile ? app.access[activeProfile.role] : "hidden";
  const latestRequest = (accessRequests ?? [])
    .filter(request => request.productKey === id)
    .sort((a, b) => b.requestedAt - a.requestedAt)[0];
  const cardState =
    policy === "included" || (policy === "requestable" && latestRequest?.status === "approved")
      ? "open"
      : policy === "requestable" && latestRequest?.status === "pending"
        ? "pending"
        : policy === "requestable" && latestRequest?.status === "declined"
          ? "declined"
          : policy === "requestable"
            ? "request"
            : "hidden";

  if (!app || disabled || cardState === "hidden") {
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

  const submitRequest = async () => {
    setRequesting(true);
    setMessage(null);
    try {
      await requestAccess({ profileId: activeProfile._id, productKey: app.id });
      setMessage("Request received — we'll update you when it has been reviewed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to request access.");
    } finally {
      setRequesting(false);
    }
  };

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

        {app.subject || app.ageRange || app.lessonCount !== undefined ? (
          <div className="mt-5 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 sm:grid-cols-3">
            {app.subject ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">Subject</p>
                <p className="mt-1 text-sm text-zinc-100">{app.subject}</p>
              </div>
            ) : null}
            {app.ageRange ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">Age Range</p>
                <p className="mt-1 text-sm text-zinc-100">{app.ageRange}</p>
              </div>
            ) : null}
            {app.lessonCount !== undefined ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">Lessons</p>
                <p className="mt-1 text-sm text-zinc-100">{app.lessonCount}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {message ? (
          <p className="mt-5 rounded-lg border border-emerald-700 bg-emerald-950 px-3 py-2 text-sm text-emerald-100">
            {message}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          {cardState === "open" ? (
            app.launchUrl.startsWith("https://") ? (
              <a href={launchHref} target="_blank" rel="noreferrer" className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900">
                Open app
              </a>
            ) : (
              <Link href={launchHref} className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900">
                Open app
              </Link>
            )
          ) : null}
          {cardState === "request" ? (
            <button
              type="button"
              onClick={() => void submitRequest()}
              disabled={requesting}
              className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 disabled:opacity-60"
            >
              {requesting ? "Requesting..." : "Request access"}
            </button>
          ) : null}
          {cardState === "pending" ? (
            <button type="button" disabled className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-400">
              Pending approval
            </button>
          ) : null}
          {cardState === "declined" ? (
            <span className="rounded-lg border border-red-700 px-4 py-2 text-sm font-semibold text-red-300">
              Request declined
            </span>
          ) : null}
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
