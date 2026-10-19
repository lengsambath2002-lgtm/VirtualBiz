import { fileURLToPath } from 'node:url';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root to frontend/ so a lockfile elsewhere in the monorepo
  // (backend/, mobile/) never changes where Next looks for files.
  outputFileTracingRoot: fileURLToPath(new URL('.', import.meta.url)),
  // The Docker image runs Next's standalone server (NEXT_OUTPUT=standalone, see Dockerfile).
  ...(process.env.NEXT_OUTPUT === 'standalone' ? { output: 'standalone' } : {}),
  reactStrictMode: true,
  poweredByHeader: false,
  // The dev "N" badge sits bottom-left, on top of the seller/provider rail's Log out button.
  devIndicators: false,
  async rewrites() {
    // Same-origin proxy: the browser calls /api/* on this origin and Next forwards it to the
    // Spring Boot API, so the httpOnly refresh cookie works with no CORS.
    // `||` (not `??`) so an empty value falls back too.
    const backendBase =
      process.env.API_URL ||
      process.env.API_PROXY_TARGET ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      'http://localhost:8180';
    return [{ source: '/api/:path*', destination: `${backendBase}/api/:path*` }];
  },
};

export default withNextIntl(nextConfig);
