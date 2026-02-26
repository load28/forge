export interface PathMatch {
  matched: boolean;
  params: Record<string, string>;
}

function safeDecode(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}

function normalizePath(path: string): string {
  // Remove trailing slash (except for root)
  if (path.length > 1 && path.endsWith('/')) {
    return path.slice(0, -1);
  }
  return path;
}

/**
 * S7: Create null-prototype object for params to prevent prototype pollution.
 * Prevents keys like "constructor" or "__proto__" from resolving to
 * Object.prototype methods when accessed on the params object.
 */
function createParams(): Record<string, string> {
  return Object.create(null) as Record<string, string>;
}

export function matchPath(pattern: string, path: string): PathMatch {
  // TC-2: Strip query string before matching
  const queryIdx = path.indexOf('?');
  const cleanPath = queryIdx >= 0 ? path.slice(0, queryIdx) : path;

  const normalizedPattern = normalizePath(pattern);
  const normalizedPath = normalizePath(cleanPath);

  if (normalizedPattern === normalizedPath) return { matched: true, params: createParams() };

  const patternParts = normalizedPattern.split('/').filter(Boolean);
  const pathParts = normalizedPath.split('/').filter(Boolean);
  const params = createParams();

  for (let i = 0; i < patternParts.length; i++) {
    const pat = patternParts[i];

    if (pat === '*') {
      params['*'] = pathParts.slice(i).map(safeDecode).join('/');
      return { matched: true, params };
    }

    // TC-1: Optional parameter support — `:id?` matches even if path segment is absent.
    if (pat.startsWith(':')) {
      const isOptional = pat.endsWith('?');
      const paramName = isOptional ? pat.slice(1, -1) : pat.slice(1);

      if (i >= pathParts.length) {
        if (isOptional) {
          // Check remaining pattern parts are also optional or wildcards
          for (let j = i + 1; j < patternParts.length; j++) {
            const nextPat = patternParts[j];
            if (nextPat !== '*' && !(nextPat.startsWith(':') && nextPat.endsWith('?'))) {
              return { matched: false, params: createParams() };
            }
          }
          return { matched: true, params };
        }
        return { matched: false, params: createParams() };
      }
      params[paramName] = safeDecode(pathParts[i]);
      continue;
    }

    // BUG-12: Decode both pattern and path parts for comparison
    if (i >= pathParts.length) return { matched: false, params: createParams() };
    if (safeDecode(pat) !== safeDecode(pathParts[i])) return { matched: false, params: createParams() };
  }

  // Allow trailing optional params when pattern is longer than path
  if (patternParts.length > pathParts.length) {
    for (let i = pathParts.length; i < patternParts.length; i++) {
      const pat = patternParts[i];
      if (!(pat.startsWith(':') && pat.endsWith('?')) && pat !== '*') {
        return { matched: false, params: createParams() };
      }
    }
    return { matched: true, params };
  }

  if (patternParts.length !== pathParts.length) return { matched: false, params: createParams() };

  return { matched: true, params };
}
