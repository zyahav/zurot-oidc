import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterEach, test } from "node:test";
import {
  createTusUploadAuthorization,
  createTvPlaybackUrl,
  verifyBunnyWebhook,
} from "./bunny-stream.ts";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

test("creates Bunny's presigned TUS upload headers without exposing the API key", () => {
  process.env.BUNNY_STREAM_LIBRARY_ID = "123";
  process.env.BUNNY_STREAM_API_KEY = "secret";
  const authorization = createTusUploadAuthorization("video-id", 1_900_000_000);
  assert.equal(authorization.libraryId, "123");
  assert.equal(authorization.videoId, "video-id");
  assert.match(authorization.authorizationSignature, /^[0-9a-f]{64}$/);
  assert.doesNotMatch(JSON.stringify(authorization), /secret/);
});

test("refuses direct TV playback unless explicitly enabled", () => {
  process.env.BUNNY_STREAM_CDN_HOSTNAME = "video.example.test";
  delete process.env.BUNNY_STREAM_CDN_TOKEN_KEY;
  delete process.env.BUNNY_STREAM_ALLOW_DIRECT_PLAY;
  assert.throws(() => createTvPlaybackUrl("video-id"), /not configured/);
});

test("creates a direct development HLS URL only behind the explicit flag", () => {
  process.env.BUNNY_STREAM_CDN_HOSTNAME = "video.example.test";
  process.env.BUNNY_STREAM_ALLOW_DIRECT_PLAY = "true";
  const playback = createTvPlaybackUrl("video-id");
  assert.equal(playback.url, "https://video.example.test/video-id/playlist.m3u8");
});

test("creates a directory-scoped Bunny token for HLS manifests and segments", () => {
  process.env.BUNNY_STREAM_CDN_HOSTNAME = "video.example.test";
  process.env.BUNNY_STREAM_CDN_TOKEN_KEY = "playback-secret";
  const playback = createTvPlaybackUrl("video-id", 600);
  const expires = Math.floor(playback.expiresAt / 1000);
  const digest = createHmac("sha256", "playback-secret")
    .update(`/video-id/${expires}`)
    .digest("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
  assert.equal(
    playback.url,
    `https://video.example.test/bcdn_token=HS256-${digest}&expires=${expires}` +
      "&token_path=%2Fvideo-id%2F/video-id/playlist.m3u8"
  );
});

test("verifies Bunny webhooks against the exact raw body", () => {
  process.env.BUNNY_STREAM_READ_ONLY_API_KEY = "webhook-secret";
  const body = '{"VideoGuid":"video-id","Status":3}';
  const signature = createHmac("sha256", "webhook-secret")
    .update(body)
    .digest("hex");
  assert.equal(verifyBunnyWebhook(body, signature, "v1", "hmac-sha256"), true);
  assert.equal(
    verifyBunnyWebhook(`${body}\n`, signature, "v1", "hmac-sha256"),
    false
  );
});
