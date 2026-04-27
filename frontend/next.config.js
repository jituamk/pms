/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enables a self-contained server bundle in .next/standalone for Docker.
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Service-Worker-Allowed', value: '/' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
