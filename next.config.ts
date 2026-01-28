import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/inbox",
        destination: "/library",
        permanent: true,
      },
      {
        source: "/my-posts",
        destination: "/library?filter=my_posts",
        permanent: true,
      },
      {
        source: "/inspiration",
        destination: "/library?filter=inspiration",
        permanent: true,
      },
      {
        source: "/sources",
        destination: "/create",
        permanent: true,
      },
      {
        source: "/drafts",
        destination: "/create?tab=drafts",
        permanent: true,
      },
      {
        source: "/drafts/generate",
        destination: "/create",
        permanent: true,
      },
      {
        source: "/collections",
        destination: "/library",
        permanent: true,
      },
      {
        source: "/collections/:id",
        destination: "/library",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
