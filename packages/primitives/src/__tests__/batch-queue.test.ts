import { describe, it, expect, vi } from 'vitest';
import { BatchQueue } from '../reactivity/batch-queue';

describe('BatchQueue', () => {
  it('should defer notifications during batch', () => {
    const queue = new BatchQueue();
    const fn = vi.fn();

    queue.batch(() => {
      queue.enqueue(fn);
      queue.enqueue(fn);
      expect(fn).not.toHaveBeenCalled();
    });

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should execute immediately when not batching', () => {
    const queue = new BatchQueue();
    const fn = vi.fn();
    queue.enqueue(fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  // New: Nested batch support
  it('should support nested batches - only flush at outermost', () => {
    const queue = new BatchQueue();
    const fn = vi.fn();

    queue.batch(() => {
      queue.enqueue(fn);

      queue.batch(() => {
        queue.enqueue(fn);
        expect(fn).not.toHaveBeenCalled();
      });

      // Inner batch ended but outer still active — should NOT have flushed
      expect(fn).not.toHaveBeenCalled();
    });

    // Outer batch ends — now flush
    expect(fn).toHaveBeenCalledTimes(1); // Set deduplicates
  });

  it('should flush after deeply nested batches', () => {
    const queue = new BatchQueue();
    const calls: number[] = [];

    queue.batch(() => {
      queue.batch(() => {
        queue.batch(() => {
          queue.enqueue(() => calls.push(1));
        });
        expect(calls).toEqual([]);
        queue.enqueue(() => calls.push(2));
      });
      expect(calls).toEqual([]);
      queue.enqueue(() => calls.push(3));
    });

    expect(calls).toEqual([1, 2, 3]);
  });
});
