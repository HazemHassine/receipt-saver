import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ['en', 'de', 'fr', 'ar'],

  // Used when no locale matches
  defaultLocale: 'en',

  // Use path prefix for all locales
  localePrefix: 'always',
});
