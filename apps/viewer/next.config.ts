import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@openmatsuri/config",
    "@openmatsuri/map",
    "@openmatsuri/realtime",
    "@openmatsuri/ui",
  ],
};

export default nextConfig;
