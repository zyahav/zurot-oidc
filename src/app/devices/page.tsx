"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { useConvex, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

function normalizeTvCode(value: string): string {
  const raw = value
    .toUpperCase()
    .replace(/[^A-HJ-NP-Z2-9]/g, "")
    .slice(0, 8);
  return raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
}

export default function DevicesPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const convex = useConvex();
  const revokeDevice = useMutation(api.tv.revokeDevice);
  const resolvePairing = useMutation(api.tv.resolveManualPairing);
  const approvePairing = useMutation(api.tv.approvePairing);
  const [pinInput, setPinInput] = useState("");
  const [ownerPin, setOwnerPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [userCode, setUserCode] = useState("");
  const [deviceName, setDeviceName] = useState("Living room TV");
  const [connectBusy, setConnectBusy] = useState(false);
  const [connectMessage, setConnectMessage] = useState<string | null>(null);
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

  const connectTv = async (event: FormEvent) => {
    event.preventDefault();
    if (!ownerPin || userCode.length !== 9 || connectBusy) return;
    setConnectBusy(true);
    setConnectMessage(null);
    setError(null);
    try {
      const pairing = await resolvePairing({ userCode });
      if (!pairing.found) {
        setError("That TV code is invalid or expired. Check the television for a new code.");
        return;
      }
      const approval = await approvePairing({
        pairingId: pairing.pairingId,
        userCode: pairing.userCode,
        deviceName,
        ownerPin,
      });
      if (!approval.connected) {
        setError(
          approval.error === "pin_locked"
            ? "Too many owner PIN attempts. Please wait 30 seconds."
            : "The owner PIN is no longer valid. Unlock Manage Devices again."
        );
        return;
      }
      setUserCode("");
      setConnectMessage("TV approved. It will continue automatically.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to connect this TV.");
    } finally {
      setConnectBusy(false);
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
        <section id="connect-tv" className="mt-10 rounded-3xl border border-violet-700/60 bg-gradient-to-br from-violet-950 to-zinc-900 p-6 sm:p-8">
          <div className="max-w-2xl">
            <p className="text-sm font-bold tracking-[0.2em] text-violet-300">CONNECT A DEVICE</p>
            <h2 className="mt-3 text-2xl font-bold">Connect a TV</h2>
            <p className="mt-2 text-zinc-300">Enter the eight-character code shown below the QR code on your television.</p>
          </div>
          <form onSubmit={connectTv} className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div>
              <label className="mb-2 block text-sm text-zinc-300" htmlFor="tv-code">TV code</label>
              <input
                id="tv-code"
                autoCapitalize="characters"
                autoComplete="one-time-code"
                inputMode="text"
                maxLength={9}
                value={userCode}
                onChange={event => setUserCode(normalizeTvCode(event.target.value))}
                placeholder="ABCD-2345"
                className="w-full rounded-xl border border-zinc-600 bg-black px-4 py-4 text-center font-mono text-2xl font-bold tracking-[0.16em] outline-none focus:border-white"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-zinc-300" htmlFor="tv-name">Device name</label>
              <input
                id="tv-name"
                maxLength={40}
                value={deviceName}
                onChange={event => setDeviceName(event.target.value)}
                className="w-full rounded-xl border border-zinc-600 bg-black px-4 py-4 text-base outline-none focus:border-white"
              />
            </div>
            <button
              type="submit"
              disabled={connectBusy || userCode.length !== 9 || deviceName.trim().length === 0}
              className="self-end rounded-xl bg-white px-7 py-4 font-semibold text-black disabled:opacity-50"
            >
              {connectBusy ? "Connecting…" : "Connect TV"}
            </button>
          </form>
          {connectMessage ? <p className="mt-4 text-sm font-medium text-emerald-300" role="status">{connectMessage}</p> : null}
        </section>
        <section className="mt-10 space-y-4">
          <div>
            <p className="text-sm font-bold tracking-[0.2em] text-zinc-500">CONNECTED DEVICES</p>
            <h2 className="mt-2 text-2xl font-bold">Your televisions</h2>
          </div>
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
