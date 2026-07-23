/// <reference types="vite/client" />

import { afterEach, describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.{ts,js}");
const MEETINGS_PRODUCTION_REDIRECT =
  "https://meeting.zurot.org/api/auth/callback";
const MEETINGS_DEVELOPMENT_REDIRECT =
  "http://localhost:3000/api/auth/callback";
const TEST_CLIENT_REDIRECT = "http://localhost:3000/test";
const originalEnvironment = process.env.ZUROT_ENVIRONMENT;

afterEach(() => {
  if (originalEnvironment === undefined) {
    delete process.env.ZUROT_ENVIRONMENT;
  } else {
    process.env.ZUROT_ENVIRONMENT = originalEnvironment;
  }
});

describe("OAuth client validation", () => {
  it("registers Meetings as a confidential client without storing its raw secret", async () => {
    const t = convexTest(schema, modules);
    const secret = "test-only-meetings-secret";

    await t.mutation(api.oauth.registerClient, {
      clientId: "meetings",
      clientSecret: secret,
      tokenEndpointAuthMethod: "client_secret_post",
      redirectUris: [
        MEETINGS_PRODUCTION_REDIRECT,
        MEETINGS_DEVELOPMENT_REDIRECT,
      ],
    });

    const storedClient = await t.run(async ctx =>
      await ctx.db
        .query("oauthClients")
        .withIndex("by_client_id", q => q.eq("clientId", "meetings"))
        .first()
    );

    expect(storedClient).toMatchObject({
      clientId: "meetings",
      redirectUris: [
        MEETINGS_PRODUCTION_REDIRECT,
        MEETINGS_DEVELOPMENT_REDIRECT,
      ],
      tokenEndpointAuthMethod: "client_secret_post",
    });
    expect(storedClient?.clientSecret).toBeUndefined();
    expect(storedClient?.clientSecretHash).toBeTruthy();
    expect(storedClient?.clientSecretSalt).toBeTruthy();

    await expect(t.query(api.oauth.validateClientCredentials, {
      clientId: "meetings",
      clientSecret: secret,
      redirectUri: MEETINGS_PRODUCTION_REDIRECT,
    })).resolves.toMatchObject({
      valid: true,
      tokenEndpointAuthMethod: "client_secret_post",
    });

    await expect(t.query(api.oauth.validateClientCredentials, {
      clientId: "meetings",
      clientSecret: "wrong-secret",
      redirectUri: MEETINGS_PRODUCTION_REDIRECT,
    })).resolves.toMatchObject({
      valid: false,
      error: "Invalid client secret",
    });
  });

  it("rejects the test client unless the deployment environment is development", async () => {
    const t = convexTest(schema, modules);
    process.env.ZUROT_ENVIRONMENT = "production";

    await expect(t.query(api.oauth.validateClient, {
      clientId: "test-client",
      redirectUri: TEST_CLIENT_REDIRECT,
    })).resolves.toMatchObject({ valid: false, error: "Unknown client" });

    await expect(t.query(api.oauth.validateClientCredentials, {
      clientId: "test-client",
      redirectUri: TEST_CLIENT_REDIRECT,
    })).resolves.toMatchObject({ valid: false, error: "Unknown client" });
  });

  it("keeps the test client available in development", async () => {
    const t = convexTest(schema, modules);
    process.env.ZUROT_ENVIRONMENT = "development";

    await expect(t.query(api.oauth.validateClient, {
      clientId: "test-client",
      redirectUri: TEST_CLIENT_REDIRECT,
    })).resolves.toMatchObject({ valid: true, clientId: "test-client" });

    await expect(t.query(api.oauth.validateClientCredentials, {
      clientId: "test-client",
      redirectUri: TEST_CLIENT_REDIRECT,
    })).resolves.toMatchObject({ valid: true, clientId: "test-client" });
  });
});
