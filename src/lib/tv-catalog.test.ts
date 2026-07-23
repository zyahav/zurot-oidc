import test from "node:test";
import assert from "node:assert/strict";

async function loadCatalog() {
  return import(new URL("./app-catalog.ts", import.meta.url).href);
}

test("TV catalog contains the approved apps and excludes Device Manager", async () => {
  const { APP_CATALOG } = await loadCatalog();
  const tvIds = APP_CATALOG.filter(app => app.tvCompatible).map(app => app.id);

  assert.deepEqual(tvIds, [
    "tzura-creator",
    "mall-hebrew-adventures",
    "letters-lab",
    "story-castle",
    "math-market",
    "meta-control-room",
  ]);
  assert.equal(tvIds.includes("devices"), false);
  assert.deepEqual(
    APP_CATALOG.filter(app => app.tvLaunchReady).map(app => app.id),
    ["meta-control-room"]
  );
});

test("Meta Control Room remains hidden from student profiles", async () => {
  const { APP_BY_ID } = await loadCatalog();
  const meta = APP_BY_ID.get("meta-control-room");

  assert.ok(meta);
  assert.equal(meta.access.student, "hidden");
  assert.equal(meta.access.parent, "included");
  assert.equal(meta.access.teacher, "included");
});

test("Meetings is available to every profile role at its external launch URL", async () => {
  const { APP_BY_ID } = await loadCatalog();
  const meetings = APP_BY_ID.get("meetings");

  assert.ok(meetings);
  assert.equal(meetings.launchUrl, "https://meeting.zurot.org");
  assert.deepEqual(meetings.access, {
    parent: "included",
    teacher: "included",
    student: "included",
  });
});

test("Meta launch carries only the selected profile hint", async () => {
  const { APP_BY_ID, appLaunchHref } = await loadCatalog();
  const meta = APP_BY_ID.get("meta-control-room");
  assert.ok(meta);

  const launch = new URL(appLaunchHref(meta, "profile_test_123", { tv: true }));
  assert.equal(launch.origin, "https://meta.zurot.org");
  assert.equal(launch.pathname, "/auth/login");
  assert.equal(launch.searchParams.get("profile_hint"), "profile_test_123");
  assert.equal(launch.searchParams.get("tv"), "1");
});
