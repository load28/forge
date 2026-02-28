import type { Renderer, MountHandle, ComponentHandle, Props } from '@forge/core';
import { createVNode, registerFactory, type VNode, type VNodeChild } from '@forge/primitives';
import { mount as mountVNode, patch as patchVNode, unmount as unmountVNode } from './patch';

interface VDOMMountHandle extends MountHandle {
  currentVNode: VNode | null;
  renderFn: (() => VNode) | null;
}

export interface VDOMView {
  renderFn: () => VNode;
}

export interface VDOMRenderer extends Renderer<VDOMView> {
  createViewFromFn(renderFn: () => VNode): VDOMView;
}

export function vdomRenderer(): VDOMRenderer {
  // Register VNode factory so h()/JSX produce VNodes
  registerFactory(createVNode);
  /**
   * A-VR-1: Typed component handle resolution.
   * The ComponentHandle from function-component strategy has a `factory` property.
   * This uses a type guard instead of duck-typing with `as any`.
   */
  function isFactoryHandle(handle: unknown): handle is { factory: (props: Props) => () => VNode } {
    return handle != null
      && typeof handle === 'object'
      && 'factory' in handle
      && typeof (handle as Record<string, unknown>).factory === 'function';
  }

  function createView(component: ComponentHandle, props: Props): VDOMView {
    if (isFactoryHandle(component)) {
      const renderFn = component.factory(props);
      if (typeof renderFn === 'function') {
        return { renderFn };
      }
    }
    // Fallback: return an empty view
    return { renderFn: () => createVNode('div', null) };
  }

  function createViewFromFn(renderFn: () => VNode): VDOMView {
    return { renderFn };
  }

  function mount(view: VDOMView, container: Element): VDOMMountHandle {
    const vnode = view.renderFn();
    mountVNode(vnode, container);
    return {
      container,
      currentVNode: vnode,
      renderFn: view.renderFn,
    };
  }

  function update(handle: MountHandle): void {
    const h = handle as VDOMMountHandle;
    if (!h.renderFn || !h.currentVNode) return;
    const newVNode = h.renderFn();
    patchVNode(h.currentVNode, newVNode, h.container);
    h.currentVNode = newVNode;
  }

  function replace(handle: MountHandle, newView: VDOMView): VDOMMountHandle {
    const h = handle as VDOMMountHandle;
    h.renderFn = newView.renderFn;
    const newVNode = newView.renderFn();
    if (h.currentVNode) {
      patchVNode(h.currentVNode, newVNode, h.container);
    }
    h.currentVNode = newVNode;
    return h;
  }

  function unmount(handle: MountHandle): void {
    const h = handle as VDOMMountHandle;
    if (h.currentVNode) {
      // S1 fix: Use proper DOM removal instead of innerHTML = '' to prevent XSS.
      // Based on OWASP DOM-based XSS Prevention Cheat Sheet recommendation:
      // "Use the right output method (sink)" — removeChild is safer than innerHTML.
      // See: https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html
      unmountVNode(h.currentVNode);
      h.currentVNode = null;
      h.renderFn = null;
    }
  }

  return { createView, createViewFromFn, mount, update, replace, unmount };
}
