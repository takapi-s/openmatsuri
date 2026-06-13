import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@openmatsuri/config",
    "@openmatsuri/tracker-ingest",
    "@openmatsuri/ui",
  ],
};

export default nextConfig;
