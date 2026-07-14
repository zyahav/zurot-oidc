"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

const ACTIVE_PROFILE_REDIRECT_GRACE_MS = 1800;

export function useActiveProfileGuard() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const activeProfile = useQuery(api.profiles.getActiveProfile, {});

  useEffect(() => {
    if (!isLoaded || !isSignedIn || activeProfile !== null) {
      return;
    }

    const redirectTimer = window.setTimeout(() => {
      router.replace("/profiles");
    }, ACTIVE_PROFILE_REDIRECT_GRACE_MS);

    return () => window.clearTimeout(redirectTimer);
  }, [activeProfile, isLoaded, isSignedIn, router]);

  return {
    isLoaded,
    isSignedIn,
    activeProfile,
    shouldRedirectToProfiles: isLoaded && isSignedIn && activeProfile === null,
  };
}
