import { Id } from "../../convex/_generated/dataModel";
import { ProfileRole } from "./profile-ui";

export type HubProfile = {
  _id: Id<"profiles">;
  id: Id<"profiles">;
  name: string;
  handle: string;
  emoji: string;
  color: string;
  role: ProfileRole;
  hasPin: boolean;
  since: string;
  createdAt: number;
};
