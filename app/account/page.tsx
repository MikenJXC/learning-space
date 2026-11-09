import { requireAccountUser } from "@/lib/auth";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function AccountPage() {
  await requireAccountUser();
  redirect("/settings#account");
}
