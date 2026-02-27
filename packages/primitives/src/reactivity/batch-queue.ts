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
        let firstError: unknown;
        for (const f of fns) {
          try { f(); } catch (e) {
            if (firstError === undefined) {
              firstError = e;
            } else {
              // P4: Log subsequent errors so they aren't silently lost
              console.error('Forge: additional error during batch flush:', e);
            }
          }
        }
        // P4: Re-throw the first error after all callbacks run
        if (firstError !== undefined) throw firstError;
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
