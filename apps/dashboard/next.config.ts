import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  distDir: '/dist/apps/dashboard',
  transpilePackages: ['@complii/sdk'],
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
