import type { TvCredential } from "./tv-session";

const NATIVE_TV_SCHEME = "Bearer";
const ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;

export const serializeNativeTvCredential = (credential: TvCredential): string =>
  `${credential.id}.${credential.token}`;

export const parseNativeTvAuthorization = (request: Request): TvCredential | null => {
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;

  const separator = authorization.indexOf(" ");
  if (separator < 1 || authorization.slice(0, separator) !== NATIVE_TV_SCHEME) {
    return null;
  }
  const serialized = authorization.slice(separator + 1).trim();
  const credentialSeparator = serialized.indexOf(".");
  if (credentialSeparator < 1 || credentialSeparator === serialized.length - 1) {
    return null;
  }
  const id = serialized.slice(0, credentialSeparator);
  const token = serialized.slice(credentialSeparator + 1);
  if (!ID_PATTERN.test(id) || !TOKEN_PATTERN.test(token)) return null;
  return { id, token };
};

export const nativeTvJsonHeaders = {
  "cache-control": "no-store",
  "content-type": "application/json",
};
