/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  experimental: {
    agentFeedback: true,
    serverActions: { bodySizeLimit: "6mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
