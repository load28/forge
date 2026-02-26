import { describe, it, expect } from 'vitest';
import { compilePath, matchCompiled } from '../routing/compiled-matcher';

describe('compilePath + matchCompiled (A-2)', () => {
  it('should compile and match static paths', () => {
    const route = compilePath('/users/list');
    expect(matchCompiled(route, '/users/list')).toEqual({ matched: true, params: {} });
    expect(matchCompiled(route, '/users/other').matched).toBe(false);
  });

  it('should match named parameters', () => {
    const route = compilePath('/users/:id');
    const result = matchCompiled(route, '/users/42');
    expect(result.matched).toBe(true);
    expect(result.params.id).toBe('42');
  });

  it('should match multiple parameters', () => {
    const route = compilePath('/users/:userId/posts/:postId');
    const result = matchCompiled(route, '/users/1/posts/99');
    expect(result.matched).toBe(true);
    expect(result.params.userId).toBe('1');
    expect(result.params.postId).toBe('99');
  });

  it('should match optional parameters', () => {
    const route = compilePath('/users/:id?');
    expect(matchCompiled(route, '/users/42').matched).toBe(true);
    expect(matchCompiled(route, '/users').matched).toBe(true);
    expect(matchCompiled(route, '/users/').matched).toBe(true);
  });

  it('should match wildcard paths', () => {
    const route = compilePath('/files/*');
    const result = matchCompiled(route, '/files/a/b/c');
    expect(result.matched).toBe(true);
    expect(result.params['*']).toBe('a/b/c');
  });

  it('should strip query strings before matching', () => {
    const route = compilePath('/users/:id');
    const result = matchCompiled(route, '/users/42?tab=profile');
    expect(result.matched).toBe(true);
    expect(result.params.id).toBe('42');
  });

  it('should decode URL-encoded values', () => {
    const route = compilePath('/search/:query');
    const result = matchCompiled(route, '/search/hello%20world');
    expect(result.matched).toBe(true);
    expect(result.params.query).toBe('hello world');
  });

  it('should return false for non-matching paths', () => {
    const route = compilePath('/api/v1/users');
    expect(matchCompiled(route, '/api/v2/users').matched).toBe(false);
    expect(matchCompiled(route, '/api/v1').matched).toBe(false);
  });

  it('should compile once and match many times (performance)', () => {
    const route = compilePath('/users/:id/posts/:postId');
    // The regex is compiled once
    expect(route.regex).toBeInstanceOf(RegExp);
    expect(route.paramNames).toEqual(['id', 'postId']);

    // Match many different paths with same compiled route
    for (let i = 0; i < 100; i++) {
      const result = matchCompiled(route, `/users/${i}/posts/${i * 10}`);
      expect(result.matched).toBe(true);
      expect(result.params.id).toBe(String(i));
    }
  });
});
