/**
 * Query string parsing utility (DX-1).
 * Extracts query parameters from a URL path string.
 * Based on URLSearchParams Web API spec: https://url.spec.whatwg.org/#urlsearchparams
 */

/** Parse query string from a path (e.g., "/page?a=1&b=2" → { a: "1", b: "2" }) */
export function parseQuery(path: string): Record<string, string> {
  const params: Record<string, string> = Object.create(null);
  const queryIdx = path.indexOf('?');
  if (queryIdx < 0) return params;

  const queryString = path.slice(queryIdx + 1);
  // Strip hash fragment if present
  const hashIdx = queryString.indexOf('#');
  const cleanQuery = hashIdx >= 0 ? queryString.slice(0, hashIdx) : queryString;

  if (!cleanQuery) return params;

  const pairs = cleanQuery.split('&');
  for (const pair of pairs) {
    if (!pair) continue;
    const eqIdx = pair.indexOf('=');
    if (eqIdx < 0) {
      params[safeDecodeComponent(pair)] = '';
    } else {
      const key = safeDecodeComponent(pair.slice(0, eqIdx));
      const value = safeDecodeComponent(pair.slice(eqIdx + 1));
      params[key] = value;
    }
  }

  return params;
}

function safeDecodeComponent(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s;
  }
}
