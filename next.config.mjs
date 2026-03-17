/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Cloud Run deployment
  output: "standalone",

  // Allow external image domains (signed URLs from GCS)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
    ],
  },

  // Empty turbopack config to allow Turbopack (Next.js 16 default)
  turbopack: {},
};

export default nextConfig;
