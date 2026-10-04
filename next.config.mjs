/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Prevents double-mount lifecycle issues with WebRTC
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
