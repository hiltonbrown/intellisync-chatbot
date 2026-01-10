import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        hostname: "avatar.vercel.sh",
      },
      {
        protocol: "https",
        //https://nextjs.org/docs/messages/next-image-unconfigured-host
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Ignore pdf.worker.mjs in server builds since it's not needed
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
      };

      // Mark pdfjs-dist as external to prevent bundling issues
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push({
          'pdfjs-dist': 'commonjs pdfjs-dist',
        });
      }
    }
    return config;
  },
};

export default nextConfig;
