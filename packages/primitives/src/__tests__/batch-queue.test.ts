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
});
