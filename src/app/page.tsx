"use client";

import { FormEvent, useState } from "react";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.trim();

function buildProfilesUrl(email: string): string {
  const fallbackOrigin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const base = APP_URL && APP_URL.length > 0 ? APP_URL : fallbackOrigin;
  const url = new URL("/profiles", base);
  if (email.trim().length > 0) {
    url.searchParams.set("email", email);
  }
  return url.toString();
}

export default function RootPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextEmail = email.trim().toLowerCase();
    if (!nextEmail || !nextEmail.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    window.location.assign(buildProfilesUrl(nextEmail));
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#090909] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(200,35,35,0.38)_0%,_rgba(9,9,9,0.92)_48%,_rgba(9,9,9,1)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,_rgba(8,102,255,0.2)_0%,_rgba(9,9,9,0)_40%)]" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-16 sm:px-10">
        <div className="mb-10 flex items-center justify-between">
          <p className="text-xl font-bold tracking-[0.26em] text-zinc-50">ZUROT</p>
          <a
            href={buildProfilesUrl("")}
            className="rounded-md border border-zinc-400/60 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:border-zinc-100 hover:bg-zinc-100 hover:text-zinc-900"
          >
            Sign in
          </a>
        </div>

        <div className="max-w-3xl">
          <h1 className="text-4xl font-extrabold leading-tight sm:text-6xl">
            Safe profiles and app access for every child in your home.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-zinc-200 sm:text-xl">
            Set up your account once, create protected profiles, and launch learning apps with the right permissions.
          </p>

          <form onSubmit={onSubmit} className="mt-8 w-full max-w-2xl">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email address"
                className="h-14 w-full rounded-md border border-zinc-500 bg-black/60 px-4 text-base text-zinc-100 placeholder:text-zinc-400 focus:border-red-500 focus:outline-none"
                aria-label="Email address"
              />
              <button
                type="submit"
                className="h-14 rounded-md bg-[#e50914] px-8 text-base font-bold text-white transition hover:bg-[#f6121d]"
              >
                Get Started
              </button>
            </div>
            {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
            <p className="mt-4 text-sm text-zinc-300">
              Already have an account?{" "}
              <a href={buildProfilesUrl(email.trim())} className="font-semibold text-zinc-100 underline">
                Go to profiles
              </a>
            </p>
          </form>
        </div>

        <div className="mt-16 grid gap-4 text-sm text-zinc-200 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-700/80 bg-zinc-900/60 p-4">
            <p className="font-semibold text-zinc-50">Create family profiles</p>
            <p className="mt-2">Set names, avatars, and roles so each child gets their own space.</p>
          </div>
          <div className="rounded-xl border border-zinc-700/80 bg-zinc-900/60 p-4">
            <p className="font-semibold text-zinc-50">Protect changes with PIN</p>
            <p className="mt-2">Manage dashboard access stays protected with owner PIN security.</p>
          </div>
          <div className="rounded-xl border border-zinc-700/80 bg-zinc-900/60 p-4">
            <p className="font-semibold text-zinc-50">Launch approved apps</p>
            <p className="mt-2">Profiles enter a curated portal experience with controlled app access.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
