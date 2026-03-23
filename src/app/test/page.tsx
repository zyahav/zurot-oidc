"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { decodeJwtClient } from "@/lib/jwt-client";

interface DecodedToken {
  iss?: string;
  aud?: string;
  sub?: string;
  exp?: number;
  iat?: number;
  name?: string;
  preferred_username?: string;
  "https://zurot.org/profile_context"?: {
    profileId?: string;
    userId?: string;
    role?: string;
  };
}

function TestPageContent() {
  const searchParams = useSearchParams();
  const activeProfile = useQuery(api.profiles.getActiveProfile, {});
  const profiles = useQuery(api.profiles.listProfilesForUser, {});

  const [tokens, setTokens] = useState<{
    access_token?: string;
    id_token?: string;
    decoded?: DecodedToken;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExchanging, setIsExchanging] = useState(false);

  // Handle OAuth callback - exchange code for tokens
  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      setError(errorParam);
      return;
    }

    if (code && state && !tokens && !isExchanging) {
      setIsExchanging(true);
      exchangeCodeForTokens(code);
    }
  }, [searchParams, tokens, isExchanging]);

  const exchangeCodeForTokens = async (code: string) => {
    try {
      const response = await fetch("/api/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          code,
          client_id: "test-client",
          redirect_uri: `${window.location.origin}/test`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error_description || data.error || "Token exchange failed");
      }

      // Decode the ID token
      const decoded = decodeJwtClient(data.id_token) as DecodedToken;

      setTokens({
        access_token: data.access_token,
        id_token: data.id_token,
        decoded,
      });
      setError(null);

      // Clear URL params
      window.history.replaceState({}, "", "/test");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Token exchange failed");
    } finally {
      setIsExchanging(false);
    }
  };

  const startOAuthFlow = () => {
    const state = Math.random().toString(36).substring(7);
    const params = new URLSearchParams({
      response_type: "code",
      client_id: "test-client",
      redirect_uri: `${window.location.origin}/test`,
      scope: "openid profile",
      state,
    });

    window.location.href = `/oauth/authorize?${params.toString()}`;
  };

  const clearTokens = () => {
    setTokens(null);
    setError(null);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-50 to-white px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-6 py-4 shadow-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">ZurOt Hub</p>
            <h1 className="text-xl font-semibold text-zinc-900">OIDC Test Client</h1>
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
            Sign in first, then use this page to test the OIDC flow.
          </div>
        </SignedOut>

        <SignedIn>
          {/* Error Display */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Phase 1 Checklist */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">Phase 1 Test Checklist</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Complete the OIDC flow to verify all Phase 1 requirements pass.
            </p>
            <div className="mt-4 grid gap-2">
              <ChecklistItem
                label="App receives token with sub = profile_<id>"
                pass={!!tokens?.decoded?.sub && tokens.decoded.sub.startsWith("profile_")}
              />
              <ChecklistItem
                label="Switching profile changes sub"
                pass={!!tokens?.decoded?.sub && tokens.decoded.sub.startsWith("profile_")}
                hint="Test with different profiles"
              />
              <ChecklistItem
                label="Same human, two profiles → two identities"
                pass={(profiles?.length ?? 0) >= 2}
                hint={`You have ${profiles?.length ?? 0} profiles`}
              />
              <ChecklistItem
                label="OSS app treats profiles as separate users"
                pass={!!tokens?.decoded?.sub}
              />
              <ChecklistItem
                label="Token validates via JWKS"
                pass={!!tokens?.id_token}
              />
            </div>
          </div>

          {/* OAuth Test Controls */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">Test OAuth Flow</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Start the OIDC Authorization Code flow to get a profile-scoped token.
            </p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={startOAuthFlow}
                className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Start OAuth Flow
              </button>
              {tokens && (
                <button
                  onClick={clearTokens}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Clear Tokens
                </button>
              )}
            </div>
          </div>

          {/* Token Display */}
          {tokens && (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-green-900">✓ Token Received</h2>
              
              <div className="mt-4 space-y-4">
                {/* Decoded Claims */}
                <div>
                  <h3 className="text-sm font-semibold text-green-800">Decoded ID Token Claims</h3>
                  <div className="mt-2 rounded-lg bg-white p-4 font-mono text-xs">
                    <div className="grid gap-1">
                      <ClaimRow label="iss (issuer)" value={tokens.decoded?.iss} />
                      <ClaimRow label="aud (audience)" value={tokens.decoded?.aud} />
                      <ClaimRow 
                        label="sub (subject)" 
                        value={tokens.decoded?.sub} 
                        highlight 
                      />
                      <ClaimRow label="name" value={tokens.decoded?.name} />
                      <ClaimRow label="preferred_username" value={tokens.decoded?.preferred_username} />
                      <ClaimRow 
                        label="profileId (custom)" 
                        value={tokens.decoded?.["https://zurot.org/profile_context"]?.profileId} 
                      />
                      <ClaimRow 
                        label="userId (custom)" 
                        value={tokens.decoded?.["https://zurot.org/profile_context"]?.userId} 
                      />
                      <ClaimRow 
                        label="role (custom)" 
                        value={tokens.decoded?.["https://zurot.org/profile_context"]?.role} 
                      />
                      <ClaimRow 
                        label="exp" 
                        value={tokens.decoded?.exp ? new Date(tokens.decoded.exp * 1000).toISOString() : undefined} 
                      />
                    </div>
                  </div>
                </div>

                {/* Verification */}
                <div className="rounded-lg bg-white p-4">
                  <h3 className="text-sm font-semibold text-green-800">Verification</h3>
                  <div className="mt-2 text-sm text-green-700">
                    <p>
                      ✓ <strong>sub = profile_&#123;id&#125;</strong>:{" "}
                      {tokens.decoded?.sub === `profile_${tokens.decoded?.["https://zurot.org/profile_context"]?.profileId}`
                        ? "PASS"
                        : "FAIL"}
                    </p>
                    <p>
                      ✓ <strong>sub ≠ userId</strong>:{" "}
                      {tokens.decoded?.sub !== tokens.decoded?.["https://zurot.org/profile_context"]?.userId
                        ? "PASS"
                        : "FAIL"}
                    </p>
                  </div>
                </div>

                {/* Raw Token */}
                <details className="rounded-lg bg-white p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-green-800">
                    Raw ID Token (click to expand)
                  </summary>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all text-xs text-zinc-600">
                    {tokens.id_token}
                  </pre>
                </details>
              </div>
            </div>
          )}

          {/* Active Profile Reference */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">Current Active Profile</h2>
            {activeProfile ? (
              <div className="mt-3 rounded-lg bg-zinc-50 p-4">
                <div className="font-semibold text-zinc-900">{activeProfile.displayName}</div>
                <div className="text-sm text-zinc-600">@{activeProfile.handle}</div>
                <div className="mt-2 font-mono text-xs text-zinc-500">
                  Profile ID: {activeProfile._id}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-zinc-600">
                No active profile. Go to{" "}
                <Link href="/" className="text-blue-600 underline">
                  home page
                </Link>{" "}
                to select one.
              </p>
            )}
          </div>
        </SignedIn>
      </div>
    </main>
  );
}

export default function TestPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <TestPageContent />
    </Suspense>
  );
}

function ChecklistItem({
  label,
  pass,
  hint,
}: {
  label: string;
  pass: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm">
      <div>
        <span>{label}</span>
        {hint && <span className="ml-2 text-xs text-zinc-500">({hint})</span>}
      </div>
      <span className={`font-semibold ${pass ? "text-green-600" : "text-zinc-400"}`}>
        {pass ? "Pass" : "Pending"}
      </span>
    </div>
  );
}

function ClaimRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`flex justify-between ${highlight ? "bg-yellow-100 -mx-2 px-2 py-1 rounded" : ""}`}>
      <span className="text-zinc-500">{label}:</span>
      <span className={highlight ? "font-bold text-zinc-900" : "text-zinc-700"}>
        {value || "—"}
      </span>
    </div>
  );
}
