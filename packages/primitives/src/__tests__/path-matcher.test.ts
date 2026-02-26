import { describe, it, expect } from 'vitest';
import { matchPath } from '../routing/path-matcher';

describe('matchPath', () => {
  it('should match exact path', () => {
    expect(matchPath('/about', '/about')).toEqual({ matched: true, params: {} });
  });

  it('should match path with params', () => {
    const result = matchPath('/users/:id', '/users/42');
    expect(result).toEqual({ matched: true, params: { id: '42' } });
  });

  it('should return non-match for different paths', () => {
    expect(matchPath('/about', '/home')).toEqual({ matched: false, params: {} });
  });

  it('should match wildcard', () => {
    const result = matchPath('/files/*', '/files/a/b/c');
    expect(result).toEqual({ matched: true, params: { '*': 'a/b/c' } });
  });

  it('should match root', () => {
    expect(matchPath('/', '/')).toEqual({ matched: true, params: {} });
  });

  it('should not match different length paths', () => {
    expect(matchPath('/a/b', '/a')).toEqual({ matched: false, params: {} });
  });

  it('should match multiple params', () => {
    const result = matchPath('/users/:userId/posts/:postId', '/users/1/posts/42');
    expect(result).toEqual({ matched: true, params: { userId: '1', postId: '42' } });
  });

  // New: URL decoding
  it('should decode URL-encoded path parameters', () => {
    const result = matchPath('/users/:name', '/users/hello%20world');
    expect(result).toEqual({ matched: true, params: { name: 'hello world' } });
  });

  it('should decode URL-encoded wildcard paths', () => {
    const result = matchPath('/files/*', '/files/path%2Fto%2Ffile');
    expect(result).toEqual({ matched: true, params: { '*': 'path/to/file' } });
  });

  // New: Trailing slash normalization
  it('should match paths with trailing slash', () => {
    expect(matchPath('/about', '/about/')).toEqual({ matched: true, params: {} });
  });

  it('should match when pattern has trailing slash', () => {
    expect(matchPath('/about/', '/about')).toEqual({ matched: true, params: {} });
  });

  // New: Consistent params return
  it('should always return params object even on non-match', () => {
    const result = matchPath('/about', '/home');
    expect(result.params).toEqual({});
  });

  // New: Malformed percent encoding should not throw
  it('should handle malformed percent encoding gracefully', () => {
    const result = matchPath('/users/:id', '/users/%ZZ');
    expect(result).toEqual({ matched: true, params: { id: '%ZZ' } });
  });

  // TC-1: Optional parameter support
  it('should match optional param when present', () => {
    const result = matchPath('/users/:id?', '/users/42');
    expect(result).toEqual({ matched: true, params: { id: '42' } });
  });

  it('should match optional param when absent', () => {
    const result = matchPath('/users/:id?', '/users');
    expect(result).toEqual({ matched: true, params: {} });
  });

  it('should match multiple trailing optional params', () => {
    const result = matchPath('/a/:b?/:c?', '/a');
    expect(result).toEqual({ matched: true, params: {} });
  });

  // TC-2: Query string stripping
  it('should strip query string before matching', () => {
    const result = matchPath('/users/:id', '/users/42?tab=profile&sort=name');
    expect(result).toEqual({ matched: true, params: { id: '42' } });
  });

  it('should match exact path with query string', () => {
    const result = matchPath('/about', '/about?ref=home');
    expect(result).toEqual({ matched: true, params: {} });
  });
});
