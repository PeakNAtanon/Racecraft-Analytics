import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typedRoutes: false,
  agentRules: false,
  poweredByHeader: false,
};

export default nextConfig;
