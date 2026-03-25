import test from "node:test";
import assert from "node:assert/strict";

async function loadEngine() {
  return import(new URL("./translation-engine.ts", import.meta.url).href);
}

test('translatePersonaToScopes("teacher", "game") returns game instructor/viewer scopes', async () => {
  const engine = await loadEngine();
  assert.deepEqual(engine.translatePersonaToScopes("teacher", "game"), [
    "game:instructor",
    "game:viewer",
  ]);
});

test('translatePersonaToScopes("student", "game") returns game player scope', async () => {
  const engine = await loadEngine();
  assert.deepEqual(engine.translatePersonaToScopes("student", "game"), ["game:player"]);
});

test('translatePersonaToScopes("parent", "game") returns game observer scope', async () => {
  const engine = await loadEngine();
  assert.deepEqual(engine.translatePersonaToScopes("parent", "game"), ["game:observer"]);
});

test('translatePersonaToScopes("guest", "game") returns empty scopes', async () => {
  const engine = await loadEngine();
  assert.deepEqual(engine.translatePersonaToScopes("guest", "game"), []);
});

test('resolveClientToProduct("mall-hebrew-adventures") resolves to "game"', async () => {
  const engine = await loadEngine();
  assert.equal(engine.resolveClientToProduct("mall-hebrew-adventures"), "game");
});

test("filterScopesToProduct isolates product scopes", async () => {
  const engine = await loadEngine();
  assert.deepEqual(
    engine.filterScopesToProduct(["game:instructor", "lms:grader", "hub:admin"], "game"),
    ["game:instructor"]
  );
});

test("teacher token scopes for mall-hebrew-adventures are exactly isolated game scopes", async () => {
  const engine = await loadEngine();
  const product = engine.resolveClientToProduct("mall-hebrew-adventures");
  const rawScopes = engine.translatePersonaToScopes("teacher", product);
  const scopes = engine.filterScopesToProduct(rawScopes, product);

  assert.deepEqual(scopes, ["game:instructor", "game:viewer"]);
  assert.equal(scopes.some((s: string) => s.startsWith("lms:")), false);
  assert.equal(scopes.some((s: string) => s.startsWith("hub:")), false);
});
