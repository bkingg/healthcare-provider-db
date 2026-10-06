import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Server Actions accept 1 MB by default; the bulk imports (members,
      // medications) take spreadsheets up to 10 MB. Photos for medication
      // orders don't go through here — they upload separately, shrunk on the
      // phone (see /api/m/uploads).
      bodySizeLimit: "12mb",
    },
  },
};

export default withNextIntl(nextConfig);
