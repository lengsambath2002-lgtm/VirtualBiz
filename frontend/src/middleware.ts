import createMiddleware from 'next-intl/middleware';

import { routing } from '@/lib/i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Node.js, not the Edge runtime (deprecated on Vercel; stable for middleware since Next 15.5).
  runtime: 'nodejs',
  // Everything except API routes, Next internals and files with an extension.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
