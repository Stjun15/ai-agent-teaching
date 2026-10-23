/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "localhost:3000",
  ],
  serverExternalPackages: [
    "@earendil-works/pi-ai",
    "@earendil-works/pi-coding-agent",
    "@earendil-works/chord",
    "@earendil-works/pi-agent-core",
  ],
  experimental: {
    optimizePackageImports: ["lucide-react", "motion", "zustand"],
  },
};

export default nextConfig;