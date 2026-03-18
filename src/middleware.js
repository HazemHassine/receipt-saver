import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except for:
  // - API routes (/api/...)
  // - Next.js internals (_next/...) comment
  // - Static files (favicon, images, etc.)
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
