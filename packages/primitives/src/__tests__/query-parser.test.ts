import { describe, it, expect } from 'vitest';
import { parseQuery, parseQueryMulti } from '../routing/query-parser';

describe('parseQuery (DX-1)', () => {
  it('should parse simple query string', () => {
    expect(parseQuery('/page?a=1&b=2')).toEqual({ a: '1', b: '2' });
  });

  it('should return empty object for no query', () => {
    expect(parseQuery('/page')).toEqual({});
  });

  it('should handle empty query string', () => {
    expect(parseQuery('/page?')).toEqual({});
  });

  it('should decode URL-encoded values', () => {
    expect(parseQuery('/search?q=hello%20world')).toEqual({ q: 'hello world' });
  });

  it('should handle + as space', () => {
    expect(parseQuery('/search?q=hello+world')).toEqual({ q: 'hello world' });
  });

  it('should handle keys without values', () => {
    expect(parseQuery('/page?flag')).toEqual({ flag: '' });
  });

  it('should strip hash fragment from query', () => {
    expect(parseQuery('/page?a=1#section')).toEqual({ a: '1' });
  });

  it('should handle malformed encoding gracefully', () => {
    expect(parseQuery('/page?a=%ZZ')).toEqual({ a: '%ZZ' });
  });

  it('should handle multiple identical keys (last wins)', () => {
    expect(parseQuery('/page?a=1&a=2')).toEqual({ a: '2' });
  });
});

// P5: parseQueryMulti — WHATWG URLSearchParams multi-value support
describe('parseQueryMulti (P5)', () => {
  it('should return arrays for all values', () => {
    expect(parseQueryMulti('/page?a=1&b=2')).toEqual({ a: ['1'], b: ['2'] });
  });

  it('should collect multiple values for same key', () => {
    expect(parseQueryMulti('/page?tag=a&tag=b')).toEqual({ tag: ['a', 'b'] });
  });

  it('should return empty object for no query', () => {
    expect(parseQueryMulti('/page')).toEqual({});
  });

  it('should handle keys without values', () => {
    expect(parseQueryMulti('/page?flag')).toEqual({ flag: [''] });
  });

  it('should handle mixed single and multi values', () => {
    expect(parseQueryMulti('/page?a=1&b=2&a=3')).toEqual({ a: ['1', '3'], b: ['2'] });
  });

  it('should strip hash fragment', () => {
    expect(parseQueryMulti('/page?a=1#section')).toEqual({ a: ['1'] });
  });

  it('should return empty object for empty query string', () => {
    expect(parseQueryMulti('/page?')).toEqual({});
  });

  it('should handle malformed encoding gracefully', () => {
    expect(parseQueryMulti('/page?a=%ZZ')).toEqual({ a: ['%ZZ'] });
  });
});
