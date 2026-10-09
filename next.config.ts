import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/organizer/events/*/certificate/preview": ["./assets/fonts/**/*"],
    "/sign/*/preview": ["./assets/fonts/**/*"],
    "/me/certificates/*/pdf": ["./assets/fonts/**/*"],
  },
  async redirects() {
    return [{ source: "/organizer/join", destination: "/organizer/register", permanent: true }];
  },
  async headers() {
    return [
      {
        source: "/sign/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
