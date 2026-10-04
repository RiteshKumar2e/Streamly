/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Prevents double-mount lifecycle issues with WebRTC
  swcMinify: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
