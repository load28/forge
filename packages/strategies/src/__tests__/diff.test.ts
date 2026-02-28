import { describe, it, expect } from 'vitest';
import { getSequence, diffKeys } from '../vdom-renderer/diff';

describe('diff module (AR-01)', () => {
  describe('getSequence (LIS)', () => {
    it('should return LIS for simple increasing array', () => {
      expect(getSequence([0, 1, 2, 3])).toEqual([0, 1, 2, 3]);
    });

    it('should find LIS in mixed array', () => {
      const result = getSequence([2, 0, 1, 3]);
      // LIS is [0, 1, 3] at indices [1, 2, 3]
      expect(result).toEqual([1, 2, 3]);
    });

    it('should skip negative values (new nodes)', () => {
      const result = getSequence([-1, 0, -1, 1, -1]);
      // getSequence initializes with [0], negatives are skipped.
      // result contains indices forming the LIS of positive values
      expect(result.length).toBeGreaterThanOrEqual(2);
      // The values at those indices should be increasing
      for (let i = 1; i < result.length; i++) {
        const prev = [-1, 0, -1, 1, -1][result[i - 1]];
        const curr = [-1, 0, -1, 1, -1][result[i]];
        expect(curr).toBeGreaterThan(prev);
      }
    });

    it('should handle single element', () => {
      expect(getSequence([0])).toEqual([0]);
    });

    it('should handle reversed array', () => {
      const result = getSequence([3, 2, 1, 0]);
      expect(result.length).toBe(1); // only 1 element in LIS
    });
  });

  describe('diffKeys', () => {
    it('should detect insertions', () => {
      const ops = diffKeys(['a', 'b'], ['a', 'b', 'c']);
      const inserts = ops.filter(o => o.type === 'insert');
      expect(inserts).toHaveLength(1);
      expect(inserts[0].key).toBe('c');
    });

    it('should detect removals', () => {
      const ops = diffKeys(['a', 'b', 'c'], ['a', 'c']);
      const removes = ops.filter(o => o.type === 'remove');
      expect(removes).toHaveLength(1);
      expect(removes[0].key).toBe('b');
    });

    it('should detect moves', () => {
      const ops = diffKeys(['a', 'b', 'c'], ['c', 'a', 'b']);
      const moves = ops.filter(o => o.type === 'move');
      expect(moves.length).toBeGreaterThan(0);
    });

    it('should handle identical lists', () => {
      const ops = diffKeys(['a', 'b', 'c'], ['a', 'b', 'c']);
      expect(ops).toHaveLength(0); // no ops needed
    });

    it('should handle complete replacement', () => {
      const ops = diffKeys(['a', 'b'], ['x', 'y']);
      const removes = ops.filter(o => o.type === 'remove');
      const inserts = ops.filter(o => o.type === 'insert');
      expect(removes).toHaveLength(2);
      expect(inserts).toHaveLength(2);
    });
  });
});
