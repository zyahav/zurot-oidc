/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.{ts,js}");

const bootstrapValues = {
  name: "Test Owner",
  emoji: "🌈",
  color: "#334155",
  ownerPin: "2468",
};

describe("first-account owner onboarding", () => {
  it("atomically creates the owner PIN and first adult profile", async () => {
    const t = convexTest(schema, modules);
    const account = t.withIdentity({
      subject: "clerk_new_account",
      email: "new-account@example.invalid",
    });

    const created = await account.mutation(api.profiles.bootstrapOwnerProfile, bootstrapValues);
    expect(created).toMatchObject({
      name: "Test Owner",
      role: "parent",
      emoji: "🌈",
      hasPin: false,
    });
    expect(await account.query(api.profiles.getOwnerPin, { pin: "2468" })).toEqual({
      hasPin: true,
      isValid: true,
    });
    expect(await account.query(api.profiles.getProfiles, {})).toHaveLength(1);
  });

  it("recovers a student-only account produced by the old onboarding flow", async () => {
    const subject = "clerk_student_only";
    const t = convexTest(schema, modules);
    await t.run(async ctx => {
      await ctx.db.insert("profiles", {
        userId: subject,
        name: "Existing Child",
        emoji: "🦁",
        color: "#312e81",
        role: "student",
        createdAt: Date.now(),
      });
    });
    const account = t.withIdentity({
      subject,
      email: "student-only@example.invalid",
    });

    expect(await account.query(api.profiles.listPendingRequests, {})).toEqual([]);
    await account.mutation(api.profiles.bootstrapOwnerProfile, {
      ...bootstrapValues,
      name: "Recovered Parent",
    });

    const profiles = await account.query(api.profiles.getProfiles, {});
    expect(profiles.map(profile => profile.role).sort()).toEqual(["parent", "student"]);
    expect(await account.query(api.profiles.getOwnerPin, { pin: "2468" })).toMatchObject({
      hasPin: true,
      isValid: true,
    });
  });

  it("rejects invalid or repeated bootstrap attempts without partial writes", async () => {
    const t = convexTest(schema, modules);
    const account = t.withIdentity({
      subject: "clerk_bootstrap_guard",
      email: "bootstrap-guard@example.invalid",
    });

    await expect(account.mutation(api.profiles.bootstrapOwnerProfile, {
      ...bootstrapValues,
      ownerPin: "12",
    })).rejects.toThrow("PIN must be exactly 4 digits");
    expect(await account.query(api.profiles.getProfiles, {})).toEqual([]);
    expect(await account.query(api.profiles.getOwnerPin, {})).toEqual({
      hasPin: false,
      isValid: false,
    });

    await account.mutation(api.profiles.bootstrapOwnerProfile, bootstrapValues);
    await expect(account.mutation(api.profiles.bootstrapOwnerProfile, {
      ...bootstrapValues,
      name: "Second Owner",
    })).rejects.toThrow("Account owner setup is already complete");
    expect(await account.query(api.profiles.getProfiles, {})).toHaveLength(1);
  });
});
