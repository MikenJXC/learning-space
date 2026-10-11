import { redirect } from "next/navigation";
import { getAccountUser } from "@/lib/auth";
import { AuthScreen } from "./auth-screen";
export const dynamic = "force-dynamic";
export default async function LoginPage() {
  if (await getAccountUser()) redirect("/");
  return <AuthScreen />;
}
