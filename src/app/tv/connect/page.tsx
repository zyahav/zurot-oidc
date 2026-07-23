import { redirect } from "next/navigation";

export default function ConnectTvPage() {
  redirect("/devices?connect=tv#connect-tv");
}
