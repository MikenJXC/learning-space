import { requireAccountUser } from "@/lib/auth";
import { LibraryApp } from "./library-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireAccountUser();
  return (
    <LibraryApp
      displayName={user.displayName}
    />
  );
}
