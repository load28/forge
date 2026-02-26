export interface PathMatch {
  matched: boolean;
  params?: Record<string, string>;
}

export function matchPath(pattern: string, path: string): PathMatch {
  if (pattern === path) return { matched: true, params: {} };

  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);
  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const pat = patternParts[i];

    if (pat === '*') {
      params['*'] = pathParts.slice(i).join('/');
      return { matched: true, params };
    }

    if (pat.startsWith(':')) {
      if (i >= pathParts.length) return { matched: false };
      params[pat.slice(1)] = pathParts[i];
      continue;
    }

    if (pat !== pathParts[i]) return { matched: false };
  }

  if (patternParts.length !== pathParts.length) return { matched: false };

  return { matched: true, params };
}
