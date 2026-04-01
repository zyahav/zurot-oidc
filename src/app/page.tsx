"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function RootPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const activeProfile = useQuery(api.profiles.getActiveProfile, {});

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      window.location.replace("/profiles");
      return;
    }
    if (activeProfile === undefined) return;
    if (activeProfile === null) {
      window.location.replace("/profiles");
    } else {
      window.location.replace("/portal");
    }
  }, [isLoaded, isSignedIn, activeProfile]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-sm text-zinc-400">
      Loading...
    </main>
  );
}
