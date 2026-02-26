/**
 * AR-01: Separated diff algorithm module.
 *
 * Contains the core diffing algorithms used by patch.ts, extracted for
 * testability and reusability. The LIS (Longest Increasing Subsequence)
 * algorithm is based on Vue 3's getSequence().
 *
 * See: https://github.com/vuejs/core/blob/main/packages/runtime-core/src/renderer.ts
 */

/**
 * Longest Increasing Subsequence — O(n log n).
 * Used to minimize DOM moves during keyed reconciliation.
 *
 * Given an array of old indices, returns the indices of the array elements
 * that form the longest increasing subsequence. These elements are already
 * in the correct relative order and don't need to be moved.
 *
 * @param arr - Array of old indices (-1 means new node, skip)
 * @returns Array of indices into `arr` forming the LIS
 */
export function getSequence(arr: number[]): number[] {
  const len = arr.length;
  const result = [0];
  const p = new Array(len);

  for (let i = 0; i < len; i++) {
    const val = arr[i];
    if (val < 0) continue; // skip new nodes (no old index)

    const j = result[result.length - 1];
    if (arr[j] < val) {
      p[i] = j;
      result.push(i);
      continue;
    }

    // Binary search for the insertion point
    let lo = 0;
    let hi = result.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[result[mid]] < val) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }

    if (val < arr[result[lo]]) {
      if (lo > 0) p[i] = result[lo - 1];
      result[lo] = i;
    }
  }

  // Backtrack to build the sequence
  let u = result.length;
  let v = result[u - 1];
  while (u-- > 0) {
    result[u] = v;
    v = p[v];
  }

  return result;
}

/**
 * Determine the minimum set of DOM operations (insert, move, remove)
 * needed to transform one list of keyed items into another.
 *
 * @param oldKeys - Array of keys in old order
 * @param newKeys - Array of keys in new order
 * @returns Object with arrays of operations to perform
 */
export interface DiffOp {
  type: 'insert' | 'move' | 'remove';
  key: string | number;
  /** For insert/move: target index in new array */
  newIndex?: number;
  /** For move/remove: source index in old array */
  oldIndex?: number;
}

export function diffKeys(
  oldKeys: (string | number)[],
  newKeys: (string | number)[],
): DiffOp[] {
  const ops: DiffOp[] = [];

  // Build old key → index map
  const oldKeyMap = new Map<string | number, number>();
  for (let i = 0; i < oldKeys.length; i++) {
    oldKeyMap.set(oldKeys[i], i);
  }

  // Track which old indices are reused
  const usedOldIndices = new Set<number>();
  const oldIndicesForLIS: number[] = [];

  for (let i = 0; i < newKeys.length; i++) {
    const oldIndex = oldKeyMap.get(newKeys[i]);
    if (oldIndex != null) {
      usedOldIndices.add(oldIndex);
      oldIndicesForLIS.push(oldIndex);
    } else {
      oldIndicesForLIS.push(-1);
    }
  }

  // Remove unused old keys
  for (let i = 0; i < oldKeys.length; i++) {
    if (!usedOldIndices.has(i)) {
      ops.push({ type: 'remove', key: oldKeys[i], oldIndex: i });
    }
  }

  // Use LIS to find stable nodes
  const lis = getSequence(oldIndicesForLIS);
  const stableSet = new Set(lis);

  for (let i = 0; i < newKeys.length; i++) {
    if (oldIndicesForLIS[i] === -1) {
      ops.push({ type: 'insert', key: newKeys[i], newIndex: i });
    } else if (!stableSet.has(i)) {
      ops.push({ type: 'move', key: newKeys[i], newIndex: i, oldIndex: oldIndicesForLIS[i] });
    }
  }

  return ops;
}
