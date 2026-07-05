/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    serverActions: { bodySizeLimit: '25mb' },
  },
  images: {
    domains: ['localhost'],
  },
};

export default nextConfig;
