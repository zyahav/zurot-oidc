"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { SignInButton } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import {
  defaultGameSpec,
  interpretTzuraCommand,
  publishTzura,
  remixPublishedTzura,
  type PublishedTzura,
  type TzuraGameSpec,
} from "@/lib/tzura-game-spec";
import { TzuraRuntime } from "@/components/tzura/tzura-runtime";
import { useActiveProfileGuard } from "@/app/_guards/use-active-profile-guard";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

const DRAFT_ID = "local-draft-child-profile-demo";
const STORAGE_KEY = "zurot.tzura.production-slice.v1";

type StoredState = {
  draft: TzuraGameSpec;
  published: PublishedTzura[];
};

export default function TzuraCreatePage() {
  const [qaProfileEnabled, setQaProfileEnabled] = useState<boolean | null>(null);
  const { isLoaded, isSignedIn, activeProfile, shouldRedirectToProfiles } = useActiveProfileGuard();
  const profileId = activeProfile?.id as Id<"profiles"> | undefined;
  const latestDraft = useQuery(
    api.tzuras.getLatestDraft,
    profileId && !qaProfileEnabled ? { ownerProfileId: profileId } : "skip"
  );
  const saveConvexDraft = useMutation(api.tzuras.saveDraft);
  const publishConvexDraft = useMutation(api.tzuras.publishDraft);
  const remixConvexArtifact = useMutation(api.tzuras.remixArtifact);
  const [draft, setDraft] = useState<TzuraGameSpec>(defaultGameSpec);
  const [convexDraftId, setConvexDraftId] = useState<Id<"tzuraDrafts"> | null>(null);
  const [convexArtifactId, setConvexArtifactId] = useState<Id<"tzuraArtifacts"> | null>(null);
  const [published, setPublished] = useState<PublishedTzura[]>([]);
  const [instruction, setInstruction] = useState("");
  const [status, setStatus] = useState("Say what to change. Typed text simulates the realtime voice agent.");
  const [selectedPublishedId, setSelectedPublishedId] = useState<string | null>(null);

  useEffect(() => {
    window.setTimeout(() => {
      setQaProfileEnabled(new URLSearchParams(window.location.search).get("qaProfile") === "playwright");
    }, 0);
  }, []);

  useEffect(() => {
    if (qaProfileEnabled === null || (!qaProfileEnabled && profileId)) {
      return;
    }

    const restoreStoredState = () => {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      try {
        const parsed = JSON.parse(stored) as StoredState;
        setDraft(parsed.draft);
        setPublished(parsed.published);
        setSelectedPublishedId(parsed.published[0]?.id ?? null);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    };

    window.setTimeout(restoreStoredState, 0);
  }, [profileId, qaProfileEnabled]);

  useEffect(() => {
    if (!latestDraft) {
      return;
    }

    window.setTimeout(() => {
      setDraft(latestDraft.gameSpec as TzuraGameSpec);
      setConvexDraftId(latestDraft._id);
      setStatus("Loaded the latest saved Tzura draft for this active profile.");
    }, 0);
  }, [latestDraft]);

  useEffect(() => {
    if (qaProfileEnabled === true || !profileId) {
      const state: StoredState = { draft, published };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [draft, profileId, published, qaProfileEnabled]);

  const selectedPublished = useMemo(
    () => published.find(item => item.id === selectedPublishedId) ?? published[0] ?? null,
    [published, selectedPublishedId]
  );

  if (qaProfileEnabled === null || (!qaProfileEnabled && !isLoaded)) {
    return <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">Loading...</main>;
  }

  if (!qaProfileEnabled && !isSignedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-100">
        <div className="w-full max-w-md rounded-lg border border-white/10 bg-zinc-900 p-6 text-center">
          <h1 className="text-2xl font-black">Tzura Creator</h1>
          <p className="mt-2 text-sm text-zinc-400">Sign in and choose a child profile to create a Tzura.</p>
          <SignInButton mode="modal">
            <button className="mt-5 rounded-md bg-zinc-100 px-4 py-2 text-sm font-black text-zinc-950">
              Sign in
            </button>
          </SignInButton>
        </div>
      </main>
    );
  }

  if (!qaProfileEnabled && activeProfile === undefined) {
    return <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">Loading active profile...</main>;
  }

  if (!qaProfileEnabled && (shouldRedirectToProfiles || activeProfile === null)) {
    return <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">Redirecting to /profiles...</main>;
  }

  const submitInstruction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = interpretTzuraCommand(draft, instruction);
    setDraft(result.spec);
    setInstruction("");
    setStatus(`Agent simulation: ${result.transcript}.`);
    if (profileId && !qaProfileEnabled) {
      const savedDraftId = await saveConvexDraft({
        draftId: convexDraftId ?? undefined,
        ownerProfileId: profileId,
        title: result.spec.title,
        gameSpec: result.spec,
      });
      setConvexDraftId(savedDraftId);
      setStatus(`Agent simulation: ${result.transcript}. Draft saved to this child profile.`);
    }
  };

  const publishDraft = async () => {
    let sourceDraftId = convexDraftId;
    if (profileId && !qaProfileEnabled && !sourceDraftId) {
      sourceDraftId = await saveConvexDraft({
        ownerProfileId: profileId,
        title: draft.title,
        gameSpec: draft,
      });
      setConvexDraftId(sourceDraftId);
    }

    const artifact = publishTzura(DRAFT_ID, draft);
    setPublished(items => [artifact, ...items]);
    setSelectedPublishedId(artifact.id);
    setStatus("Published a frozen Tzura artifact. The feed player now reads the snapshot, not the draft.");
    if (profileId && !qaProfileEnabled && sourceDraftId) {
      const result = await publishConvexDraft({
        draftId: sourceDraftId,
        ownerProfileId: profileId,
        visibility: "public",
      });
      setConvexArtifactId(result.artifactId);
      setStatus("Published a frozen Tzura artifact and created a profile-owned feed item.");
    }
  };

  const remix = async () => {
    if (!selectedPublished) return;
    const remixedSpec = remixPublishedTzura(selectedPublished);
    setDraft(remixedSpec);
    setStatus("Remix created a new editable draft copy. The published artifact stayed unchanged.");
    if (profileId && !qaProfileEnabled && convexArtifactId) {
      const newDraftId = await remixConvexArtifact({
        artifactId: convexArtifactId,
        ownerProfileId: profileId,
        title: remixedSpec.title,
        gameSpec: remixedSpec,
      });
      setConvexDraftId(newDraftId);
      setStatus("Remix created a new profile-owned draft copy. The published artifact stayed unchanged.");
    }
  };

  return (
    <main className="min-h-screen bg-[#101010] text-zinc-50">
      <style>{`
        @keyframes tzura-bob {
          0%, 100% { transform: translateY(0) rotate(-3deg); }
          50% { transform: translateY(-18px) rotate(3deg); }
        }
      `}</style>

      <header className="border-b border-white/10 bg-black/35">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">ZurOt</p>
            <h1 className="text-xl font-black">Voice-to-Tzura Creator</h1>
            <p className="mt-1 text-xs text-zinc-500">
              {qaProfileEnabled ? "QA profile" : activeProfile ? `${activeProfile.name}'s profile` : "Profile required"}
            </p>
          </div>
          <a className="rounded-md border border-white/15 px-3 py-2 text-sm font-semibold text-zinc-200 hover:bg-white/10" href="/portal">
            Portal
          </a>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[420px_1fr_420px]">
        <section className="rounded-lg border border-white/10 bg-zinc-950 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Child instruction</p>
          <form className="mt-4" onSubmit={submitInstruction}>
            <label className="sr-only" htmlFor="tzura-instruction">
              Typed voice instruction
            </label>
            <textarea
              id="tzura-instruction"
              value={instruction}
              onChange={event => setInstruction(event.target.value)}
              className="h-32 w-full resize-none rounded-md border border-zinc-700 bg-zinc-900 p-3 text-base text-zinc-50 outline-none focus:border-red-500"
              placeholder="Make it an ocean game where I am a fish and collect 7 pearls, but avoid sharks."
            />
            <button
              type="submit"
              className="mt-3 w-full rounded-md bg-[#e50914] px-4 py-3 text-sm font-black text-white hover:bg-[#f6121d]"
            >
              Update Live Game
            </button>
          </form>

          <div className="mt-4 rounded-md bg-zinc-900 p-3 text-sm text-zinc-300" role="status">
            {status}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={publishDraft}
              className="rounded-md bg-zinc-100 px-3 py-3 text-sm font-black text-zinc-950 hover:bg-white"
            >
              Publish
            </button>
            <button
              type="button"
              onClick={remix}
              disabled={!selectedPublished}
              className="rounded-md border border-white/15 px-3 py-3 text-sm font-black text-zinc-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Remix Frozen
            </button>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md bg-zinc-900 p-3">
              <dt className="text-zinc-500">Fast loop</dt>
              <dd className="mt-1 font-semibold text-zinc-100">Typed command to GameSpec</dd>
            </div>
            <div className="rounded-md bg-zinc-900 p-3">
              <dt className="text-zinc-500">Codex role</dt>
              <dd className="mt-1 font-semibold text-zinc-100">Outside realtime loop</dd>
            </div>
          </dl>
        </section>

        <section>
          <TzuraRuntime spec={draft} mode="draft" />
        </section>

        <section className="rounded-lg border border-white/10 bg-zinc-950 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Feed preview</p>
              <h2 className="mt-1 text-lg font-black">Published Tzura</h2>
            </div>
            <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-bold text-zinc-400">{published.length} saved</span>
          </div>

          {selectedPublished ? (
            <>
              <div className="mt-4">
                <TzuraRuntime spec={selectedPublished.frozenSpec} mode="published" published={selectedPublished} />
              </div>
              <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500" htmlFor="published-tzura">
                Frozen artifacts
              </label>
              <select
                id="published-tzura"
                value={selectedPublished.id}
                onChange={event => setSelectedPublishedId(event.target.value)}
                className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-900 p-3 text-sm text-zinc-100"
              >
                {published.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.title} - {new Date(item.publishedAt).toLocaleTimeString()}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <div className="mt-4 grid aspect-[9/16] min-h-[560px] place-items-center rounded-[28px] border border-dashed border-white/15 bg-zinc-900 p-6 text-center text-sm text-zinc-400">
              Publish the draft to create the first frozen feed artifact.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
