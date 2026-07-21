"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  useAuth,
} from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

type Profile = {
  _id: string;
  handle: string;
  name: string;
  emoji: string;
  color: string;
  hasPin: boolean;
  role: string;
};

const PKCE_STORAGE_PREFIX = "zurot_pkce_";

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function createPkcePair(): Promise<{
  verifier: string;
  challenge: string;
}> {
  const verifier = generateCodeVerifier();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  );
  return {
    verifier,
    challenge: base64UrlEncode(new Uint8Array(digest)),
  };
}

function AuthorizePageContent() {
  const searchParams = useSearchParams();
  const { isSignedIn, isLoaded } = useAuth();
  const profiles = useQuery(api.profiles.listProfilesForUser, {});
  
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const silentRefreshAttempted = useRef(false);
  const navigationTimeout = useRef<number | null>(null);

  useEffect(() => {
    const restoreInteractiveState = () => {
      if (navigationTimeout.current !== null) window.clearTimeout(navigationTimeout.current);
      navigationTimeout.current = null;
      setIsSubmitting(false);
    };
    window.addEventListener("pageshow", restoreInteractiveState);
    return () => {
      window.removeEventListener("pageshow", restoreInteractiveState);
      if (navigationTimeout.current !== null) window.clearTimeout(navigationTimeout.current);
    };
  }, []);

  // OAuth parameters
  const clientId = searchParams.get("client_id");
  const redirectUri = searchParams.get("redirect_uri");
  const responseType = searchParams.get("response_type");
  const state = searchParams.get("state");
  const nonce = searchParams.get("nonce");
  const codeChallenge = searchParams.get("code_challenge");
  const codeChallengeMethod = searchParams.get("code_challenge_method");
  const profileHint = searchParams.get("profile_hint");
  const prompt = searchParams.get("prompt");
  const clientValidation = useQuery(
    api.oauth.validateClient,
    clientId && redirectUri ? { clientId, redirectUri } : "skip"
  );

  // Check if this is a silent refresh request
  const isSilentRefresh = prompt === "none";

  // Helper to redirect with error (OIDC-compliant)
  const redirectWithError = useCallback((errorCode: string, errorDescription: string) => {
    if (!redirectUri || !state || clientValidation?.valid !== true) {
      setError(`${errorCode}: ${errorDescription}`);
      return;
    }
    const redirectUrl = new URL(redirectUri);
    redirectUrl.searchParams.set("error", errorCode);
    redirectUrl.searchParams.set("error_description", errorDescription);
    redirectUrl.searchParams.set("state", state);
    window.location.href = redirectUrl.toString();
  }, [clientValidation, redirectUri, state]);

  const selectProfile = useCallback(async (profileId: string) => {
    if (
      !clientId ||
      !redirectUri ||
      !state ||
      (codeChallenge !== null && codeChallengeMethod !== "S256")
    ) {
      if (isSilentRefresh) {
        redirectWithError("invalid_request", "Missing OAuth parameters");
      } else {
        setError("Missing OAuth parameters");
      }
      return;
    }

    if (clientValidation?.valid !== true) {
      setError(clientValidation?.error || "Invalid OAuth client or redirect URI");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let challenge = codeChallenge;
      if (!challenge) {
        const pair = await createPkcePair();
        sessionStorage.setItem(`${PKCE_STORAGE_PREFIX}${state}`, pair.verifier);
        challenge = pair.challenge;
      }
      const response = await fetch("/api/oauth/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          clientId,
          redirectUri,
          state,
          nonce: nonce || undefined,
          code_challenge: challenge,
          code_challenge_method: "S256",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate authorization code");
      }

      const redirectUrl = new URL(redirectUri);
      redirectUrl.searchParams.set("code", data.code);
      redirectUrl.searchParams.set("state", state);
      navigationTimeout.current = window.setTimeout(() => {
        setError("Authorization navigation did not complete. Please select the profile again.");
        setIsSubmitting(false);
      }, 10_000);
      window.location.assign(redirectUrl.toString());
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Authorization failed";
      if (isSilentRefresh) {
        redirectWithError("server_error", errorMsg);
      } else {
        setError(errorMsg);
        setIsSubmitting(false);
      }
    }
  }, [clientId, clientValidation, codeChallenge, codeChallengeMethod, redirectUri, state, nonce, isSilentRefresh, redirectWithError]);

  // Validate OAuth parameters
  useEffect(() => {
    if (
      !clientId ||
      !redirectUri ||
      responseType !== "code" ||
      (codeChallenge !== null && codeChallengeMethod !== "S256")
    ) {
      if (isSilentRefresh && redirectUri && state) {
        redirectWithError("invalid_request", "Missing required parameters");
      } else {
        setError("Invalid OAuth request. Missing required parameters.");
      }
    }
  }, [clientId, redirectUri, responseType, nonce, codeChallenge, codeChallengeMethod, isSilentRefresh, redirectWithError, state]);

  useEffect(() => {
    if (!clientId || !redirectUri || clientValidation === undefined) return;
    if (!clientValidation.valid) {
      setError(clientValidation.error || "Invalid OAuth client or redirect URI");
    }
  }, [clientId, clientValidation, redirectUri]);

  // Handle silent refresh (prompt=none)
  useEffect(() => {
    if (!isSilentRefresh || !isLoaded || silentRefreshAttempted.current) return;
    if (clientId && redirectUri && clientValidation === undefined) return;
    if (clientId && redirectUri && clientValidation?.valid !== true) {
      setError(clientValidation?.error || "Invalid OAuth client or redirect URI");
      return;
    }

    // For silent refresh: if not signed in, return login_required error
    if (!isSignedIn) {
      redirectWithError("login_required", "User is not authenticated");
      return;
    }

    // Wait for profiles to load — must check BEFORE setting ref
    // so that when profiles arrive the effect can re-run and proceed
    if (profiles === undefined) return;

    // Set ref only after profiles confirmed loaded — prevents premature lock-out
    silentRefreshAttempted.current = true;

    // If no profiles, return interaction_required
    if (!profiles || profiles.length === 0) {
      redirectWithError("interaction_required", "No profiles available");
      return;
    }

    // If profile_hint is provided, try to use that profile
    if (profileHint) {
      const hintedProfile = profiles.find((p: Profile) => p._id === profileHint);
      if (hintedProfile) {
        selectProfile(hintedProfile._id);
        return;
      } else {
        // Profile hint invalid, return interaction_required
        redirectWithError("interaction_required", "Specified profile not available");
        return;
      }
    }

    // No profile_hint: if only one profile, auto-select it
    const activeProfiles = profiles;
    if (activeProfiles.length === 1) {
      selectProfile(activeProfiles[0]._id);
      return;
    }

    // Multiple profiles and no hint: user interaction required
    redirectWithError("interaction_required", "Multiple profiles available, user must select");
  }, [clientId, clientValidation, isSilentRefresh, isLoaded, isSignedIn, profiles, profileHint, redirectUri, selectProfile, redirectWithError]);

  // Auto-select profile if profile_hint is valid (non-silent mode)
  useEffect(() => {
    if (isSilentRefresh) return; // Handled above
    if (clientId && redirectUri && clientValidation?.valid !== true) return;
    if (profileHint && profiles && isSignedIn) {
      const hintedProfile = profiles.find((p: Profile) => p._id === profileHint);
      if (hintedProfile) {
        selectProfile(hintedProfile._id);
      }
    }
  }, [clientId, clientValidation, redirectUri, profileHint, profiles, isSignedIn, isSilentRefresh, selectProfile]);

  if (!isLoaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-900">
        <div className="text-white">Loading...</div>
      </main>
    );
  }

  // For silent refresh, show minimal loading UI while processing
  if (isSilentRefresh && !error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-900">
        <div className="text-white text-sm">Processing...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-900 px-4">
        <div className="max-w-md rounded-xl bg-red-900/50 px-6 py-5 text-center">
          <h1 className="text-xl font-semibold text-white">Authorization Error</h1>
          <p className="mt-2 text-sm text-red-200">{error}</p>
          <button
            onClick={() => window.history.back()}
            className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-900"
          >
            Go back
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-900 px-4 py-10">
      <SignedOut>
        <div className="max-w-md rounded-xl bg-zinc-800 px-6 py-8 text-center">
          <h1 className="text-2xl font-bold text-white">Sign in to ZurOt</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Sign in to select a profile and authorize this application.
          </p>
          <div className="mt-6">
            <SignInButton mode="modal">
              <button className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100">
                Sign in with Clerk
              </button>
            </SignInButton>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="w-full max-w-2xl">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white">Who&apos;s using ZurOt?</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Select a profile to continue to <span className="font-mono text-zinc-300">{clientId}</span>
            </p>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
            {profiles?.map((profile: Profile) => (
              <button
                key={profile._id}
                onClick={() => selectProfile(profile._id)}
                disabled={isSubmitting}
                className="group flex flex-col items-center rounded-lg p-4 transition hover:bg-zinc-800 disabled:opacity-50"
              >
                <div
                  className="relative flex h-24 w-24 items-center justify-center rounded-2xl text-4xl shadow-lg transition group-hover:scale-105"
                  style={{ background: profile.color }}
                >
                  {profile.emoji}
                  {profile.hasPin ? (
                    <span className="absolute -bottom-1 -right-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-zinc-900 bg-zinc-950 text-xs">
                      🔒
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 text-center">
                  <div className="font-semibold text-white">{profile.name}</div>
                  {!profile.handle.startsWith("profile_") ? <div className="text-xs text-zinc-500">@{profile.handle}</div> : null}
                  <div className="mt-1 text-[10px] uppercase text-zinc-600">{profile.role}</div>
                </div>
              </button>
            ))}
          </div>

          {(!profiles || profiles.length === 0) && (
            <div className="mt-10 text-center">
              <p className="text-zinc-400">No profiles found.</p>
              <p className="mt-2 text-sm text-zinc-500">
                Create a profile first at{" "}
                <Link href="/profiles" className="text-blue-400 underline">/profiles</Link>
              </p>
            </div>
          )}

          {isSubmitting && (
            <div className="mt-8 text-center text-sm text-zinc-400">Authorizing...</div>
          )}
        </div>
      </SignedIn>
    </main>
  );
}

export default function AuthorizePage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center bg-zinc-900">
        <div className="text-white">Loading...</div>
      </main>
    }>
      <AuthorizePageContent />
    </Suspense>
  );
}
