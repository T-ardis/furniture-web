import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ['gsap'],
  },
  async redirects() {
    const demoLive = Boolean(
      process.env.NEXT_PUBLIC_TARDIS_WIDGET_URL &&
      process.env.NEXT_PUBLIC_TARDIS_EDGE_URL &&
      process.env.NEXT_PUBLIC_TARDIS_COLLECTOR_URL &&
      process.env.NEXT_PUBLIC_TARDIS_KEY &&
      process.env.NEXT_PUBLIC_TARDIS_SAMPLE_PRODUCT
    );
    return demoLive ? [{ source: '/', destination: '/demo', permanent: false }] : [];
  },
};

export default nextConfig;
