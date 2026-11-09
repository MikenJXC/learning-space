import { requireAccountUser } from "@/lib/auth";
import { EffortDashboard } from "./effort-dashboard";
export const dynamic = "force-dynamic";
export default async function EffortPage() {
  await requireAccountUser();
  return <EffortDashboard />;
}
