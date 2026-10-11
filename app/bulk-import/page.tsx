import { requireAccountUser } from "@/lib/auth";
import { BulkImporter } from "./bulk-importer";

export const dynamic = "force-dynamic";

export default async function BulkImportPage() {
  await requireAccountUser();
  return <BulkImporter />;
}
