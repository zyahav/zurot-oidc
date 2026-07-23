import test from "node:test";
import assert from "node:assert/strict";

async function loadTvSession() {
  return import(new URL("./tv-session.ts", import.meta.url).href);
}

test("TV credentials round-trip without exposing separate cookie fields", async () => {
  const { parseTvCredential, serializeTvCredential } = await loadTvSession();
  const credential = {
    id: "pairing_Abc12345",
    token: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  };

  assert.deepEqual(parseTvCredential(serializeTvCredential(credential)), credential);
});

test("malformed TV credentials fail closed", async () => {
  const { parseTvCredential } = await loadTvSession();

  assert.equal(parseTvCredential(undefined), null);
  assert.equal(parseTvCredential("missing-separator"), null);
  assert.equal(parseTvCredential("short.token"), null);
  assert.equal(parseTvCredential("pairing_Abc12345.token with spaces that is long enough"), null);
});

test("TV cookies are HttpOnly, SameSite Lax, and scoped to the site", async () => {
  const { tvCookieOptions } = await loadTvSession();
  const options = tvCookieOptions(600);

  assert.equal(options.httpOnly, true);
  assert.equal(options.sameSite, "lax");
  assert.equal(options.path, "/");
  assert.equal(options.maxAge, 600);
});

test("state-changing TV requests require the exact same Origin", async () => {
  const { isSameOriginRequest } = await loadTvSession();

  assert.equal(
    isSameOriginRequest(new Request("https://app.zurot.org/api/tv/start", {
      method: "POST",
      headers: { origin: "https://app.zurot.org" },
    })),
    true
  );
  assert.equal(
    isSameOriginRequest(new Request("https://app.zurot.org/api/tv/start", {
      method: "POST",
      headers: { origin: "https://example.test" },
    })),
    false
  );
  assert.equal(
    isSameOriginRequest(new Request("https://app.zurot.org/api/tv/start", { method: "POST" })),
    false
  );
});
