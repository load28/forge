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
    expect(matchPath('/about', '/home')).toEqual({ matched: false });
  });

  it('should match wildcard', () => {
    const result = matchPath('/files/*', '/files/a/b/c');
    expect(result).toEqual({ matched: true, params: { '*': 'a/b/c' } });
  });

  it('should match root', () => {
    expect(matchPath('/', '/')).toEqual({ matched: true, params: {} });
  });

  it('should not match different length paths', () => {
    expect(matchPath('/a/b', '/a')).toEqual({ matched: false });
  });

  it('should match multiple params', () => {
    const result = matchPath('/users/:userId/posts/:postId', '/users/1/posts/42');
    expect(result).toEqual({ matched: true, params: { userId: '1', postId: '42' } });
  });
});
