import type { TaskHandle } from '../types';

export interface Scheduler {
  schedule(task: () => void, priority?: unknown): TaskHandle;
  cancel(handle: TaskHandle): void;
  flush(): void;
}
