import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vinext also applies this transport limit to multipart route requests.
  // Its 1 MB default otherwise rejects ordinary PPT uploads before our handler runs.
  experimental: { serverActions: { bodySizeLimit: "64mb" } },
};

export default nextConfig;
