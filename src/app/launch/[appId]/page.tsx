"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useActiveProfileGuard } from "../../_guards/use-active-profile-guard";
import { APP_BY_ID } from "@/lib/app-catalog";

const STATUS_MESSAGES = [
  "Preparing your launch environment...",
  "Authorizing your profile silently... no second login needed",
  "Securing app context...",
];

export default function LaunchAppPage() {
  const { appId } = useParams<{ appId: string }>();
  const searchParams = useSearchParams();
  const app = APP_BY_ID.get(appId);
  const { isLoaded, isSignedIn, activeProfile, shouldRedirectToProfiles } = useActiveProfileGuard();
  const [progress, setProgress] = useState(4);
  const hasStartedRef = useRef(false);
  const hasRedirectedRef = useRef(false);

  const providedClientId = searchParams.get("client_id");
  const providedRedirectUri = searchParams.get("redirect_uri");

  const fallbackConfig = useMemo(() => {
    if (typeof window === "undefined") {
      return { clientId: "", redirectUri: "" };
    }
    return {
      clientId: "test-client",
      redirectUri: `${window.location.origin}/test`,
    };
  }, []);

  useEffect(() => {
    if (!app || !isLoaded || !isSignedIn || activeProfile === undefined || activeProfile === null) {
      return;
    }
    if (hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;

    const timer = setInterval(() => {
      setProgress(current => {
        const next = Math.min(100, current + (current < 70 ? 8 : 5));
        return next;
      });
    }, 280);

    return () => clearInterval(timer);
  }, [activeProfile, app, isLoaded, isSignedIn]);

  useEffect(() => {
    if (!app || !activeProfile || progress < 100 || hasRedirectedRef.current) {
      return;
    }

    const clientId = providedClientId ?? fallbackConfig.clientId;
    const redirectUri = providedRedirectUri ?? fallbackConfig.redirectUri;
    if (!clientId || !redirectUri) {
      return;
    }

    const url = new URL("/oauth/authorize", window.location.origin);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "openid profile");
    url.searchParams.set("state", crypto.randomUUID());
    url.searchParams.set("prompt", "none");
    url.searchParams.set("profile_hint", activeProfile._id);

    hasRedirectedRef.current = true;
    setTimeout(() => {
      window.location.assign(url.toString());
    }, 700);
  }, [activeProfile, app, fallbackConfig.clientId, fallbackConfig.redirectUri, progress, providedClientId, providedRedirectUri]);

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
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-100">
        <div className="w-full max-w-lg rounded-2xl border border-zinc-700 bg-zinc-900 p-6 text-center">
          <h1 className="text-2xl font-semibold">Unknown app</h1>
          <Link href="/portal" className="mt-4 inline-block text-sm underline">
            Back to Portal
          </Link>
        </div>
      </main>
    );
  }

  const statusMessage =
    progress >= 100
      ? "✓ Profile confirmed. Opening app..."
      : STATUS_MESSAGES[Math.min(STATUS_MESSAGES.length - 1, Math.floor(progress / 34))];

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-100">
      <div className="w-full max-w-xl rounded-3xl border border-zinc-700 bg-zinc-900 p-8 shadow-2xl">
        <div className="text-center">
          <div className="mx-auto inline-flex h-24 w-24 animate-pulse items-center justify-center rounded-2xl bg-zinc-800 text-5xl">
            {app.emoji}
          </div>
          <h1 className="mt-5 text-2xl font-semibold">{app.name}</h1>
          <p className="mt-2 text-sm text-zinc-300">
            Signed in as {activeProfile.name} · {activeProfile.role}
          </p>
        </div>

        <div className="mt-8">
          <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-800">
            <div className="h-3 rounded-full bg-zinc-100 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-3 text-center text-sm text-zinc-300">{statusMessage}</p>
        </div>

        <div className="mt-6 text-center">
          <Link href={`/portal/app/${app.id}`} className="text-xs text-zinc-400 underline">
            Back to app details
          </Link>
        </div>
      </div>
    </main>
  );
}
