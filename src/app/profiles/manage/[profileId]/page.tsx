"use client";

import { useParams } from "next/navigation";
import { ManageDashboard } from "../manage-dashboard";

export default function ManageProfileByIdPage() {
  const params = useParams<{ profileId: string }>();
  return <ManageDashboard initialProfileId={params.profileId} />;
}
