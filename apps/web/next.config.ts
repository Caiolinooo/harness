import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@harness/contracts",
    "@harness/core",
    "@harness/memory",
    "@harness/providers",
    "@harness/pipeline-product-develop",
  ],
};

export default nextConfig;
