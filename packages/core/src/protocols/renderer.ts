import type { ComponentHandle, Props, MountHandle } from '../types';

export interface Renderer<Representation = unknown> {
  createView(component: ComponentHandle, props: Props): Representation;
  mount(view: Representation, container: Element): MountHandle;
  update(handle: MountHandle): void;
  unmount(handle: MountHandle): void;
}
