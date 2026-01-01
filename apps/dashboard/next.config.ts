import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@complii/sdk'],
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;



