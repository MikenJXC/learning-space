import { requireAccountUser } from "@/lib/auth";
import { AccountCenter } from "./account-center";
export const dynamic = "force-dynamic";
export default async function AccountPage() {
  const user = await requireAccountUser();
  return <AccountCenter username={user.username} role={user.role} />;
}
