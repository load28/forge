export class BatchQueue {
  private batching = false;
  private pending = new Set<() => void>();

  batch(fn: () => void): void {
    this.batching = true;
    try {
      fn();
    } finally {
      this.batching = false;
      const fns = [...this.pending];
      this.pending.clear();
      for (const f of fns) f();
    }
  }

  enqueue(fn: () => void): void {
    if (this.batching) {
      this.pending.add(fn);
    } else {
      fn();
    }
  }
}
