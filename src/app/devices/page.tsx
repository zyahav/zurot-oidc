"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { useConvex, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

export default function DevicesPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const convex = useConvex();
  const revokeDevice = useMutation(api.tv.revokeDevice);
  const [pinInput, setPinInput] = useState("");
  const [ownerPin, setOwnerPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const devices = useQuery(api.tv.listDevices, ownerPin ? { ownerPin } : "skip");

  const unlock = async (event: FormEvent) => {
    event.preventDefault();
    const result = await convex.query(api.profiles.getOwnerPin, { pin: pinInput });
    if (!result.hasPin) {
      setError("Set an owner PIN in Manage Profiles first.");
      return;
    }
    if (!result.isValid) {
      setError("Incorrect owner PIN.");
      setPinInput("");
      return;
    }
    setError(null);
    setOwnerPin(pinInput);
  };

  const revoke = async (deviceId: string) => {
    if (!ownerPin) return;
    setBusyId(deviceId);
    setError(null);
    try {
      await revokeDevice({ deviceId: deviceId as Id<"tvDevices">, ownerPin });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to remove this TV.");
    } finally {
      setBusyId(null);
    }
  };

  if (!isLoaded) return <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">Loading…</main>;
  if (!isSignedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
        <div className="w-full max-w-md rounded-3xl border border-zinc-700 bg-zinc-900 p-8 text-center">
          <h1 className="text-3xl font-bold">Manage Devices</h1>
          <p className="mt-3 text-zinc-400">Sign in as the account owner to continue.</p>
          <SignInButton mode="modal"><button className="mt-6 w-full rounded-xl bg-white px-5 py-3 font-semibold text-black">Sign in</button></SignInButton>
        </div>
      </main>
    );
  }
  if (!ownerPin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
        <form onSubmit={unlock} className="w-full max-w-md rounded-3xl border border-zinc-700 bg-zinc-900 p-8 text-center">
          <h1 className="text-3xl font-bold">Manage Devices</h1>
          <p className="mt-3 text-zinc-400">Enter the four-digit account owner PIN.</p>
          <input autoFocus type="password" inputMode="numeric" maxLength={4} value={pinInput} onChange={event => setPinInput(event.target.value.replace(/\D/g, "").slice(0, 4))} aria-label="Account owner PIN" className="mt-6 w-full rounded-xl border border-zinc-600 bg-black px-4 py-4 text-center text-3xl tracking-[0.5em]" />
          {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
          <button type="submit" disabled={pinInput.length !== 4} className="mt-6 w-full rounded-xl bg-white px-5 py-3 font-semibold text-black disabled:opacity-50">Continue</button>
          <Link href="/profiles" className="mt-5 block text-sm text-zinc-500 underline">Back to Profiles</Link>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-center justify-between">
          <div><p className="text-sm font-bold tracking-[0.2em] text-zinc-500">ZUROT</p><h1 className="mt-2 text-4xl font-bold">Manage Devices</h1></div>
          <Link href="/profiles" className="rounded-xl border border-zinc-700 px-4 py-2">Back to Profiles</Link>
        </header>
        {error ? <p className="mt-6 rounded-xl border border-red-800 bg-red-950 p-4 text-red-200">{error}</p> : null}
        <section className="mt-10 space-y-4">
          {devices === undefined ? <p className="text-zinc-400">Loading devices…</p> : null}
          {devices?.length === 0 ? <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-400">No connected televisions.</div> : null}
          {devices?.map(device => (
            <article key={device.id} className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <div><h2 className="text-xl font-semibold">📺 {device.name}</h2><p className="mt-1 text-sm text-zinc-500">Connected {new Date(device.createdAt).toLocaleDateString()}</p></div>
              <button onClick={() => void revoke(device.id)} disabled={busyId === device.id} className="rounded-xl border border-red-800 px-4 py-2 text-red-300 disabled:opacity-50">{busyId === device.id ? "Removing…" : "Sign out TV"}</button>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
