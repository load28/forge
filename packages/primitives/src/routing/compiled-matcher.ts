/**
 * A-2: Pre-compiled route pattern matcher.
 * Compiles a route pattern into a RegExp once, then matches against it O(1).
 *
 * Inspired by Express/path-to-regexp's compile-then-match pattern:
 * See: https://github.com/pillarjs/path-to-regexp
 *
 * This avoids re-parsing the pattern string on every navigation event.
 */

export interface CompiledRoute {
  /** Original pattern string */
  pattern: string;
  /** Compiled RegExp for matching */
  regex: RegExp;
  /** Parameter names extracted from pattern, in order */
  paramNames: string[];
  /** Whether the pattern ends with a wildcard */
  hasWildcard: boolean;
}

export interface CompiledMatch {
  matched: boolean;
  params: Record<string, string>;
}

function safeDecode(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}

function createParams(): Record<string, string> {
  return Object.create(null) as Record<string, string>;
}

/**
 * Compile a route pattern into a reusable CompiledRoute.
 * Patterns support:
 * - Static segments: `/users/list`
 * - Named params: `/users/:id`
 * - Optional params: `/users/:id?`
 * - Wildcard: `/files/*`
 *
 * @example
 * const route = compilePath('/users/:id');
 * matchCompiled(route, '/users/42'); // { matched: true, params: { id: '42' } }
 */
export function compilePath(pattern: string): CompiledRoute {
  // Normalize: remove trailing slash except root
  const normalized = pattern.length > 1 && pattern.endsWith('/')
    ? pattern.slice(0, -1)
    : pattern;

  const parts = normalized.split('/').filter(Boolean);
  const paramNames: string[] = [];
  let hasWildcard = false;
  let regexStr = '^';

  for (const part of parts) {
    if (part === '*') {
      hasWildcard = true;
      paramNames.push('*');
      regexStr += '\\/(.+)';
      break; // Wildcard consumes rest
    }

    if (part.startsWith(':')) {
      const isOptional = part.endsWith('?');
      const name = isOptional ? part.slice(1, -1) : part.slice(1);
      paramNames.push(name);
      regexStr += isOptional ? '(?:\\/([^/]+))?' : '\\/([^/]+)';
    } else {
      // Escape regex special chars in static segments
      regexStr += '\\/' + part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }

  if (!hasWildcard) {
    regexStr += '\\/?$';
  }

  return {
    pattern,
    regex: new RegExp(regexStr),
    paramNames,
    hasWildcard,
  };
}

/**
 * Match a path against a pre-compiled route pattern.
 * Query strings are automatically stripped before matching.
 */
export function matchCompiled(route: CompiledRoute, path: string): CompiledMatch {
  // Strip query string
  const queryIdx = path.indexOf('?');
  const cleanPath = queryIdx >= 0 ? path.slice(0, queryIdx) : path;

  const match = route.regex.exec(cleanPath);
  if (!match) return { matched: false, params: createParams() };

  const params = createParams();
  for (let i = 0; i < route.paramNames.length; i++) {
    const value = match[i + 1];
    if (value !== undefined) {
      params[route.paramNames[i]] = safeDecode(value);
    }
  }

  return { matched: true, params };
}
