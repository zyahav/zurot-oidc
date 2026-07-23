import test from "node:test";
import assert from "node:assert/strict";
const credential = {
  id: "device_Abc12345",
  token: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
};

async function loadNativeTvSession() {
  return import(new URL("./tv-native-session.ts", import.meta.url).href);
}

test("native TV credentials use an explicit Bearer authorization header", async () => {
  const { parseNativeTvAuthorization, serializeNativeTvCredential } =
    await loadNativeTvSession();
  const request = new Request("https://app.zurot.org/api/tv/v1/home", {
    headers: {
      authorization: `Bearer ${serializeNativeTvCredential(credential)}`,
    },
  });
  assert.deepEqual(parseNativeTvAuthorization(request), credential);
});

test("native TV authorization rejects missing, malformed, and alternate schemes", async () => {
  const { parseNativeTvAuthorization, serializeNativeTvCredential } =
    await loadNativeTvSession();
  assert.equal(
    parseNativeTvAuthorization(new Request("https://app.zurot.org/api/tv/v1/home")),
    null
  );
  assert.equal(
    parseNativeTvAuthorization(new Request("https://app.zurot.org/api/tv/v1/home", {
      headers: { authorization: `Basic ${serializeNativeTvCredential(credential)}` },
    })),
    null
  );
  assert.equal(
    parseNativeTvAuthorization(new Request("https://app.zurot.org/api/tv/v1/home", {
      headers: { authorization: "Bearer malformed" },
    })),
    null
  );
});
