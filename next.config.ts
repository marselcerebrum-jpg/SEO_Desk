import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Build mandiri untuk dijalankan di VPS (node .next/standalone/server.js).
  output: 'standalone',
  devIndicators: { position: 'bottom-right' },
};

export default nextConfig;
