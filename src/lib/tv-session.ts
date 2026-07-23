export const TV_PAIRING_COOKIE = "zurot_tv_pairing";
export const TV_SESSION_COOKIE = "zurot_tv_session";

export type TvCredential = {
  id: string;
  token: string;
};

export const serializeTvCredential = ({ id, token }: TvCredential): string =>
  `${id}.${token}`;

export const parseTvCredential = (value: string | undefined): TvCredential | null => {
  if (!value) return null;
  const separator = value.indexOf(".");
  if (separator < 1 || separator === value.length - 1) return null;
  const id = value.slice(0, separator);
  const token = value.slice(separator + 1);
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(id) || !/^[A-Za-z0-9_-]{32,256}$/.test(token)) {
    return null;
  }
  return { id, token };
};

export const tvCookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

export const isSameOriginRequest = (request: Request): boolean => {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return origin === new URL(request.url).origin;
};
