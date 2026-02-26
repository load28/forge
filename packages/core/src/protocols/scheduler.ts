import type { TaskHandle } from '../types';

/**
 * Scheduler protocol — prioritized task execution.
 *
 * Reserved for future use by the framework engine. Potential use cases:
 * - React-like concurrent rendering with priority lanes
 * - requestIdleCallback-based deferred work
 * - Animation frame scheduling
 *
 * Currently optional in FrameworkConfig. Strategies may implement this
 * for custom scheduling behavior (ARCH-2 documented).
 *
 * See: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback
 */
export interface Scheduler {
  /** Schedule a task with optional priority. Returns a handle for cancellation. */
  schedule(task: () => void, priority?: unknown): TaskHandle;

  /** Cancel a previously scheduled task. */
  cancel(handle: TaskHandle): void;

  /** Synchronously execute all pending tasks. */
  flush(): void;
}
