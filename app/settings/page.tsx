import { requireAccountUser } from "@/lib/auth";
import { SettingsCenter } from "./settings-center";
export const dynamic = "force-dynamic";
export default async function SettingsPage() {
  const user = await requireAccountUser();
  return <SettingsCenter username={user.username} role={user.role} />;
}
