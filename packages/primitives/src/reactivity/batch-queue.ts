export class BatchQueue {
  private depth = 0;
  private pending = new Set<() => void>();

  batch(fn: () => void): void {
    this.depth++;
    try {
      fn();
    } finally {
      this.depth--;
      if (this.depth === 0) {
        const fns = [...this.pending];
        this.pending.clear();
        for (const f of fns) {
          try { f(); } catch (e) { console.error('Error in batched callback:', e); }
        }
      }
    }
  }

  enqueue(fn: () => void): void {
    if (this.depth > 0) {
      this.pending.add(fn);
    } else {
      fn();
    }
  }
}
