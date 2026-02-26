import type { ComponentHandle, Props, MountHandle } from '../types';

/**
 * Renderer protocol — transforms component trees into platform-specific output.
 *
 * The generic `Representation` parameter allows different rendering strategies:
 * - VDOM: VDOMView (holds a render function returning VNodes)
 * - Canvas/WebGL: SceneGraph
 * - Server: StringBuffer
 *
 * See: https://developer.mozilla.org/en-US/docs/Web/API/Document/createElement
 */
export interface Renderer<Representation = unknown> {
  /** Create a renderable view from a component handle and its props. */
  createView(component: ComponentHandle, props: Props): Representation;

  /** Mount the view into a DOM container, returning a handle for updates/unmount. */
  mount(view: Representation, container: Element): MountHandle;

  /** Re-render the mounted view (called by reactive autorun on dependency change). */
  update(handle: MountHandle): void;

  /**
   * Replace the currently mounted view with a new one.
   * Each rendering strategy implements this optimally:
   * - VDOM: swap renderFn + patch(oldVNode, newVNode)
   * - Compiler: dispose old fragment, insert new compiled fragment
   * - Canvas: replace scene graph
   */
  replace(handle: MountHandle, newView: Representation): MountHandle;

  /** Remove the view from the DOM and clean up resources. */
  unmount(handle: MountHandle): void;
}
