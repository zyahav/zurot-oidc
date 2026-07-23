import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";

const apiBase = "https://video.bunnycdn.com";

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
};

export type BunnyVideo = {
  guid: string;
  title: string;
  status: number;
  encodeProgress: number;
  length: number;
  thumbnailFileName?: string | null;
  availableResolutions?: string | null;
};

export const createBunnyVideo = async (title: string): Promise<BunnyVideo> => {
  const libraryId = required("BUNNY_STREAM_LIBRARY_ID");
  const response = await fetch(`${apiBase}/library/${libraryId}/videos`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      AccessKey: required("BUNNY_STREAM_API_KEY"),
    },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) {
    throw new Error(`Bunny video creation failed (${response.status}).`);
  }
  return await response.json() as BunnyVideo;
};

export const getBunnyVideo = async (videoId: string): Promise<BunnyVideo> => {
  const libraryId = required("BUNNY_STREAM_LIBRARY_ID");
  const response = await fetch(
    `${apiBase}/library/${libraryId}/videos/${encodeURIComponent(videoId)}`,
    { headers: { AccessKey: required("BUNNY_STREAM_API_KEY") } }
  );
  if (!response.ok) {
    throw new Error(`Bunny video lookup failed (${response.status}).`);
  }
  return await response.json() as BunnyVideo;
};

export const createTusUploadAuthorization = (
  videoId: string,
  expiresAtSeconds: number
) => {
  const libraryId = required("BUNNY_STREAM_LIBRARY_ID");
  const apiKey = required("BUNNY_STREAM_API_KEY");
  const signature = createHash("sha256")
    .update(`${libraryId}${apiKey}${expiresAtSeconds}${videoId}`)
    .digest("hex");
  return {
    endpoint: `${apiBase}/tusupload`,
    libraryId,
    videoId,
    authorizationSignature: signature,
    authorizationExpire: expiresAtSeconds,
  };
};

export const verifyBunnyWebhook = (
  rawBody: string,
  signature: string | null,
  version: string | null,
  algorithm: string | null
) => {
  if (
    version !== "v1" ||
    algorithm !== "hmac-sha256" ||
    !signature ||
    !/^[0-9a-f]{64}$/.test(signature)
  ) {
    return false;
  }
  const expected = createHmac(
    "sha256",
    required("BUNNY_STREAM_READ_ONLY_API_KEY")
  ).update(rawBody, "utf8").digest("hex");
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
};

const base64Url = (value: Buffer) =>
  value.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");

export const createTvPlaybackUrl = (
  videoId: string,
  lifetimeSeconds = 10 * 60
) => {
  const hostname = required("BUNNY_STREAM_CDN_HOSTNAME");
  const tokenKey = process.env.BUNNY_STREAM_CDN_TOKEN_KEY?.trim();
  const videoPath = `/${videoId}/`;
  if (tokenKey) {
    const expires = Math.floor(Date.now() / 1000) + lifetimeSeconds;
    const token = `HS256-${base64Url(
      createHmac("sha256", tokenKey).update(`${videoPath}${expires}`).digest()
    )}`;
    const tokenPath = encodeURIComponent(videoPath);
    return {
      url: `https://${hostname}/bcdn_token=${token}&expires=${expires}&token_path=${tokenPath}${videoPath}playlist.m3u8`,
      expiresAt: expires * 1000,
    };
  }

  if (process.env.BUNNY_STREAM_ALLOW_DIRECT_PLAY === "true") {
    return {
      url: `https://${hostname}${videoPath}playlist.m3u8`,
      expiresAt: Date.now() + lifetimeSeconds * 1000,
    };
  }
  throw new Error("Secure Bunny TV playback is not configured.");
};

export const bunnyThumbnailUrl = (
  videoId: string,
  thumbnailFileName?: string | null
) => {
  if (!thumbnailFileName) return undefined;
  return `https://${required("BUNNY_STREAM_CDN_HOSTNAME")}/${videoId}/${thumbnailFileName}`;
};
