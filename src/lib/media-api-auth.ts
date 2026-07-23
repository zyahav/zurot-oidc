import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { convexServer } from "@/lib/convex-server";
import { decodeToken, ISSUER, verifyToken } from "@/lib/jwt";

export type MediaActorArgs = {
  actorProfileId?: Id<"profiles">;
  forwardSecret?: string;
};

export type MediaApiContext = {
  actorArgs: MediaActorArgs;
  convex: ConvexHttpClient;
};

export const authenticateMediaApiRequest = async (
  request: Request
): Promise<MediaApiContext | null> => {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice(7).trim();
    const decoded = decodeToken(token);
    if (decoded?.iss === ISSUER && typeof decoded.aud === "string") {
      const audience = await convexServer.query(api.oauth.validateAudience, {
        clientId: decoded.aud,
      });
      const payload = audience.valid
        ? await verifyToken(token, decoded.aud)
        : null;
      const profileContext = payload?.["https://zurot.org/profile_context"] as
        | { profileId?: string }
        | undefined;
      const profileId = profileContext?.profileId;
      const forwardSecret = process.env.MEDIA_API_FORWARD_SECRET?.trim();
      if (profileId && forwardSecret) {
        return {
          convex: convexServer,
          actorArgs: {
            actorProfileId: profileId as Id<"profiles">,
            forwardSecret,
          },
        };
      }
      return null;
    }
  }

  const { userId, getToken } = await auth();
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!userId || !convexUrl) return null;
  const token = await getToken({ template: "convex" });
  if (!token) return null;
  const convex = new ConvexHttpClient(convexUrl);
  convex.setAuth(token);
  return { convex, actorArgs: {} };
};
