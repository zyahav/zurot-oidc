"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

function ActivateTvContent() {
  const params = useSearchParams();
  const pairingId = params.get("pairing") ?? "";
  const userCode = params.get("code") ?? "";
  const validRequest = /^[a-z0-9]{20,64}$/i.test(pairingId)
    && /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(userCode);
  const { isLoaded, isSignedIn } = useAuth();
  const details = useQuery(
    api.tv.getActivationDetails,
    validRequest ? { pairingId: pairingId as Id<"tvPairings">, userCode } : "skip"
  );
  const approvePairing = useMutation(api.tv.approvePairing);
  const [deviceName, setDeviceName] = useState("Living Room TV");
  const [ownerPin, setOwnerPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!details) return;
    setBusy(true);
    setError(null);
    try {
      const result = await approvePairing({
        pairingId: pairingId as Id<"tvPairings">,
        userCode,
        deviceName,
        ownerPin,
      });
      if (!result.connected) {
        setOwnerPin("");
        setError(
          result.error === "pin_locked"
            ? "Too many attempts. Wait 30 seconds and try again."
            : "Incorrect owner PIN."
        );
        return;
      }
      setConnected(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to connect this TV.");
    } finally {
      setBusy(false);
    }
  };

  if (!isLoaded) {
    return <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">Checking TV code…</main>;
  }

  // Convex updates the pairing from pending to approved before the mutation
  // response reaches this client. That makes getActivationDetails return null
  // while the TV is successfully claiming its credential. Keep the in-flight
  // and completed states ahead of the expired-code branch so a successful
  // connection cannot be misreported as expired.
  if (connected) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
        <div className="w-full max-w-md rounded-3xl border border-emerald-700 bg-emerald-950 p-8 text-center">
          <p className="text-5xl">✓</p>
          <h1 className="mt-4 text-3xl font-bold">TV connected</h1>
          <p className="mt-3 text-emerald-100">You can return to the television and choose a profile.</p>
          <Link href="/devices" className="mt-7 inline-block text-sm underline">Manage Devices</Link>
        </div>
      </main>
    );
  }

  if (busy && validRequest && details === null) {
    return <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">Finishing TV connection…</main>;
  }

  if (!validRequest || details === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
        <div className="w-full max-w-md rounded-3xl border border-zinc-700 bg-zinc-900 p-8 text-center">
          <h1 className="text-3xl font-bold">TV code expired</h1>
          <p className="mt-3 text-zinc-400">Return to the TV for a new code, then scan the QR or enter the code manually.</p>
          <Link href="/tv/connect" className="mt-7 inline-block rounded-xl bg-white px-5 py-3 font-semibold text-black">
            Enter TV code
          </Link>
        </div>
      </main>
    );
  }

  if (details === undefined) {
    return <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">Checking TV code…</main>;
  }

  if (!isSignedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
        <div className="w-full max-w-md rounded-3xl border border-zinc-700 bg-zinc-900 p-8 text-center">
          <p className="text-sm font-bold tracking-[0.2em]">ZUROT TV</p>
          <h1 className="mt-5 text-3xl font-bold">Sign in as the account owner</h1>
          <p className="mt-3 text-zinc-400">After signing in, you’ll confirm this TV with the owner PIN.</p>
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
        <h1 className="mt-5 text-3xl font-bold">Connect this TV?</h1>
        <p className="mt-3 text-zinc-400">Only continue if this code matches the television.</p>
        <p className="mt-5 rounded-xl bg-black px-4 py-4 text-center font-mono text-3xl font-bold tracking-[0.16em]">{details.userCode}</p>
        <label className="mt-6 block text-sm text-zinc-300">TV name</label>
        <input value={deviceName} onChange={event => setDeviceName(event.target.value)} maxLength={40} className="mt-2 w-full rounded-xl border border-zinc-600 bg-black px-4 py-3" />
        <label className="mt-5 block text-sm text-zinc-300">Account owner PIN</label>
        <input type="password" inputMode="numeric" maxLength={4} value={ownerPin} onChange={event => setOwnerPin(event.target.value.replace(/\D/g, "").slice(0, 4))} className="mt-2 w-full rounded-xl border border-zinc-600 bg-black px-4 py-3 text-center text-2xl tracking-[0.5em]" aria-label="Account owner PIN" />
        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
        <button type="submit" disabled={busy || ownerPin.length !== 4 || deviceName.trim().length === 0} className="mt-7 w-full rounded-xl bg-white px-5 py-3 font-semibold text-black disabled:opacity-50">{busy ? "Connecting…" : "Connect this TV"}</button>
      </form>
    </main>
  );
}

export default function ActivateTvPage() {
  return <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">Loading…</main>}><ActivateTvContent /></Suspense>;
}
