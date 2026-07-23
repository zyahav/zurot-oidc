"use client";

import { FormEvent, useState } from "react";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../../../convex/_generated/api";

function normalizeTvCode(value: string): string {
  const raw = value
    .toUpperCase()
    .replace(/[^A-HJ-NP-Z2-9]/g, "")
    .slice(0, 8);
  return raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
}

export default function ConnectTvPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const resolvePairing = useMutation(api.tv.resolveManualPairing);
  const [userCode, setUserCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || userCode.length !== 9) return;
    setBusy(true);
    setError(null);
    try {
      const result = await resolvePairing({ userCode });
      if (!result.found) {
        setError("That TV code is invalid or expired. Check the television for a new code.");
        return;
      }
      const params = new URLSearchParams({
        pairing: result.pairingId,
        code: result.userCode,
      });
      router.push(`/tv/activate?${params.toString()}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to check this TV code.");
    } finally {
      setBusy(false);
    }
  };

  if (!isLoaded) {
    return <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">Loading…</main>;
  }

  if (!isSignedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
        <div className="w-full max-w-md rounded-3xl border border-zinc-700 bg-zinc-900 p-8 text-center">
          <p className="text-sm font-bold tracking-[0.2em]">ZUROT TV</p>
          <h1 className="mt-5 text-3xl font-bold">Connect with a TV code</h1>
          <p className="mt-3 text-zinc-400">Sign in as the account owner, then enter the code shown on the television.</p>
          <SignInButton mode="modal">
            <button className="mt-7 w-full rounded-xl bg-white px-5 py-3 font-semibold text-black">Sign in</button>
          </SignInButton>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-10 text-white">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-zinc-700 bg-zinc-900 p-8">
        <p className="text-sm font-bold tracking-[0.2em]">ZUROT TV</p>
        <h1 className="mt-5 text-3xl font-bold">Enter the TV code</h1>
        <p className="mt-3 text-zinc-400">Type the eight-character code shown below the QR code on your television.</p>
        <label className="mt-7 block text-sm text-zinc-300" htmlFor="tv-code">TV code</label>
        <input
          id="tv-code"
          autoFocus
          autoCapitalize="characters"
          autoComplete="one-time-code"
          inputMode="text"
          maxLength={9}
          value={userCode}
          onChange={event => setUserCode(normalizeTvCode(event.target.value))}
          placeholder="ABCD-2345"
          className="mt-2 w-full rounded-xl border border-zinc-600 bg-black px-4 py-4 text-center font-mono text-3xl font-bold tracking-[0.16em]"
        />
        {error ? <p className="mt-4 text-sm text-red-300" role="alert">{error}</p> : null}
        <button
          type="submit"
          disabled={busy || userCode.length !== 9}
          className="mt-7 w-full rounded-xl bg-white px-5 py-3 font-semibold text-black disabled:opacity-50"
        >
          {busy ? "Checking…" : "Continue"}
        </button>
      </form>
    </main>
  );
}
