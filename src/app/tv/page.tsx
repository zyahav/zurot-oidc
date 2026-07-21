"use client";

import QRCode from "qrcode";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

type TvProfile = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  role: "student" | "parent" | "teacher";
  hasPin: boolean;
};

type TvApp = {
  id: string;
  name: string;
  emoji: string;
  shortDescription: string;
  launchUrl: string;
  launchReady: boolean;
};

type TvHome = {
  device: { id: string; name: string };
  profiles: TvProfile[];
  activeProfile: Omit<TvProfile, "hasPin"> | null;
  apps: TvApp[];
};

type Pairing = {
  userCode: string;
  expiresAt: number;
  activationUrl: string;
};

export default function TvPage() {
  const [home, setHome] = useState<TvHome | null>(null);
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pinProfile, setPinProfile] = useState<TvProfile | null>(null);
  const [pin, setPin] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const loadHome = useCallback(async (): Promise<boolean> => {
    const response = await fetch("/api/tv/home", { cache: "no-store" });
    if (!response.ok) return false;
    setHome((await response.json()) as TvHome);
    setPairing(null);
    setError(null);
    setLoading(false);
    return true;
  }, []);

  const startPairing = useCallback(async () => {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/tv/start", { method: "POST" });
    if (!response.ok) {
      setError("Unable to create a TV connection code.");
      setLoading(false);
      return;
    }
    const next = (await response.json()) as Pairing;
    setPairing(next);
    setHome(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      const active = await loadHome();
      if (!active) await startPairing();
    })();
  }, [loadHome, startPairing]);

  useEffect(() => {
    if (!pairing) return;
    let cancelled = false;
    void QRCode.toDataURL(pairing.activationUrl, {
      width: 360,
      margin: 2,
      color: { dark: "#050505", light: "#ffffff" },
      errorCorrectionLevel: "M",
    }).then(value => {
      if (!cancelled) setQrDataUrl(value);
    });
    return () => {
      cancelled = true;
    };
  }, [pairing]);

  useEffect(() => {
    if (!pairing) return;
    const updateCountdown = () => {
      setSecondsLeft(Math.max(0, Math.ceil((pairing.expiresAt - Date.now()) / 1000)));
    };
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [pairing]);

  useEffect(() => {
    if (!pairing) return;
    const poll = window.setInterval(() => {
      void (async () => {
        const response = await fetch("/api/tv/status", { method: "POST", cache: "no-store" });
        if (!response.ok) return;
        const status = (await response.json()) as { status: string };
        if (status.status === "approved") {
          await loadHome();
        } else if (status.status === "expired") {
          await startPairing();
        }
      })();
    }, 2500);
    return () => window.clearInterval(poll);
  }, [loadHome, pairing, startPairing]);

  const selectProfile = async (profile: TvProfile, profilePin?: string) => {
    if (profile.hasPin && profilePin === undefined) {
      setPinProfile(profile);
      setPin("");
      setError(null);
      return;
    }
    setPinBusy(true);
    setError(null);
    const response = await fetch("/api/tv/select-profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profileId: profile.id, pin: profilePin }),
    });
    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      setError(
        result.error === "pin_locked"
          ? "Too many attempts. Wait 30 seconds and try again."
          : result.error === "incorrect_pin"
            ? "Incorrect profile PIN."
            : "Profile is unavailable."
      );
      setPinBusy(false);
      return;
    }
    setPinProfile(null);
    setPin("");
    await loadHome();
    setPinBusy(false);
  };

  const switchProfile = async () => {
    await fetch("/api/tv/switch-profile", { method: "POST" });
    await loadHome();
  };

  const signOutTv = async () => {
    await fetch("/api/tv/logout", { method: "POST" });
    await startPairing();
  };

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-black text-2xl text-white">Loading ZurOt TV…</main>;
  }

  if (pairing) {
    return (
      <main className="min-h-screen bg-black px-10 py-10 text-white">
        <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-12 lg:grid-cols-[1fr_420px]">
          <section>
            <p className="text-xl font-bold tracking-[0.28em]">ZUROT TV</p>
            <h1 className="mt-8 text-5xl font-bold leading-tight">Connect with your phone</h1>
            <ol className="mt-8 space-y-4 text-2xl text-zinc-300">
              <li>1. Open the camera on the account owner’s phone.</li>
              <li>2. Scan the QR code.</li>
              <li>3. Sign in and enter the owner PIN.</li>
            </ol>
            <p className="mt-10 text-lg text-zinc-500">The TV will continue automatically after approval.</p>
          </section>
          <section className="rounded-3xl bg-white p-7 text-center text-black">
            {qrDataUrl ? <Image unoptimized src={qrDataUrl} width={360} height={360} alt="ZurOt TV connection QR code" className="mx-auto h-[360px] w-[360px]" /> : null}
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">TV code</p>
            <p className="mt-2 font-mono text-4xl font-bold tracking-[0.16em]">{pairing.userCode}</p>
            <p className="mt-3 text-sm text-zinc-500">Expires in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}</p>
          </section>
        </div>
      </main>
    );
  }

  if (!home) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
        <p className="text-xl">{error ?? "TV connection unavailable."}</p>
        <button onClick={() => void startPairing()} className="mt-6 rounded-xl bg-white px-6 py-3 font-semibold text-black">Try again</button>
      </main>
    );
  }

  if (!home.activeProfile) {
    return (
      <main className="min-h-screen bg-[#090909] px-12 py-10 text-white">
        <header className="flex items-center justify-between">
          <p className="text-xl font-bold tracking-[0.28em]">ZUROT TV</p>
          <p className="text-zinc-500">{home.device.name}</p>
        </header>
        <section className="mx-auto mt-20 max-w-6xl text-center">
          <h1 className="text-5xl font-bold">Who’s Watching?</h1>
          <div className="mt-14 grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-5">
            {home.profiles.map(profile => (
              <button key={profile.id} onClick={() => void selectProfile(profile)} className="group rounded-3xl p-4 focus:outline-none focus:ring-4 focus:ring-white">
                <span className="mx-auto flex aspect-square w-full items-center justify-center rounded-3xl text-7xl transition group-hover:scale-105" style={{ background: profile.color }}>
                  {profile.emoji}
                </span>
                <span className="mt-4 block text-2xl font-semibold">{profile.name}</span>
                <span className="mt-1 block text-sm uppercase tracking-wider text-zinc-500">{profile.role}{profile.hasPin ? " · PIN" : ""}</span>
              </button>
            ))}
          </div>
          <button onClick={() => void signOutTv()} className="mt-16 text-lg text-zinc-500 underline">Sign out this TV</button>
        </section>
        {pinProfile ? (
          <div className="fixed inset-0 flex items-center justify-center bg-black/85 p-6">
            <form onSubmit={event => { event.preventDefault(); void selectProfile(pinProfile, pin); }} className="w-full max-w-md rounded-3xl border border-zinc-700 bg-zinc-900 p-8 text-left">
              <h2 className="text-3xl font-bold">Enter PIN for {pinProfile.name}</h2>
              <input autoFocus type="password" inputMode="numeric" maxLength={4} value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} className="mt-6 w-full rounded-xl border border-zinc-600 bg-black px-5 py-4 text-center text-4xl tracking-[0.5em]" aria-label="Profile PIN" />
              {error ? <p className="mt-3 text-red-300">{error}</p> : null}
              <div className="mt-6 flex gap-3">
                <button type="button" onClick={() => { setPinProfile(null); setError(null); }} className="flex-1 rounded-xl border border-zinc-600 px-4 py-3">Cancel</button>
                <button type="submit" disabled={pin.length !== 4 || pinBusy} className="flex-1 rounded-xl bg-white px-4 py-3 font-semibold text-black disabled:opacity-50">Continue</button>
              </div>
            </form>
          </div>
        ) : null}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#090909] px-12 py-10 text-white">
      <header className="flex items-center justify-between">
        <p className="text-xl font-bold tracking-[0.28em]">ZUROT TV</p>
        <div className="flex items-center gap-5">
          <span className="text-xl">{home.activeProfile.emoji} {home.activeProfile.name}</span>
          <button onClick={() => void switchProfile()} className="rounded-xl border border-zinc-600 px-5 py-2 focus:ring-4 focus:ring-white">Switch profile</button>
          <button onClick={() => void signOutTv()} className="rounded-xl border border-zinc-700 px-5 py-2 text-zinc-400 focus:ring-4 focus:ring-white">Sign out TV</button>
        </div>
      </header>
      <section className="mx-auto mt-16 max-w-7xl">
        <h1 className="text-5xl font-bold">Your Apps</h1>
        <div className="mt-10 grid grid-cols-2 gap-6 lg:grid-cols-3">
          {home.apps.map(app => app.launchReady ? (
            <a key={app.id} href={app.launchUrl} className="rounded-3xl border border-zinc-700 bg-zinc-900 p-8 transition hover:scale-[1.02] hover:border-white focus:outline-none focus:ring-4 focus:ring-white">
              <span className="text-6xl">{app.emoji}</span>
              <h2 className="mt-6 text-3xl font-bold">{app.name}</h2>
              <p className="mt-3 text-xl text-zinc-400">{app.shortDescription}</p>
              <p className="mt-6 text-sm font-semibold uppercase tracking-[0.16em] text-emerald-300">Open on TV</p>
            </a>
          ) : (
            <article key={app.id} aria-disabled="true" className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 text-zinc-500">
              <span className="text-6xl grayscale">{app.emoji}</span>
              <h2 className="mt-6 text-3xl font-bold text-zinc-300">{app.name}</h2>
              <p className="mt-3 text-xl">{app.shortDescription}</p>
              <p className="mt-6 text-sm font-semibold uppercase tracking-[0.16em]">TV version coming soon</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
