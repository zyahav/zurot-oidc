"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

export function useActiveProfileGuard() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const activeProfile = useQuery(api.profiles.getActiveProfile, {});

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    if (activeProfile === null) {
      router.replace("/profiles");
    }
  }, [activeProfile, isLoaded, isSignedIn, router]);

  return {
    isLoaded,
    isSignedIn,
    activeProfile,
    shouldRedirectToProfiles: isLoaded && isSignedIn && activeProfile === null,
  };
}
