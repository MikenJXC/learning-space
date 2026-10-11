import type { LibraryAsset } from "@/lib/library-types";

export function downloadUrl(asset: Pick<LibraryAsset, "url">) {
  return `${asset.url}${asset.url.includes("?") ? "&" : "?"}download=1`;
}
