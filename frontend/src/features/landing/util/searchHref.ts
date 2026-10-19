import type { SearchQuery } from '../types';

/** Locale-less `/search` href for the next-intl <Link> / router, dropping empty params. */
export function searchHref(query: SearchQuery = {}) {
  const params = Object.fromEntries(
    Object.entries(query).filter((entry): entry is [string, string] => !!entry[1]),
  );
  return { pathname: '/search', query: params };
}
