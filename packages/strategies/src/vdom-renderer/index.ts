import type { Renderer, MountHandle, ComponentHandle, Props } from '@forge/core';
import { h as createVNode, mount as mountVNode, patch as patchVNode, type VNode, type VNodeChild } from '@forge/primitives';

interface VDOMMountHandle extends MountHandle {
  currentVNode: VNode | null;
  renderFn: (() => VNode) | null;
}

export interface VDOMView {
  renderFn: () => VNode;
}

export interface VDOMRenderer extends Renderer<VDOMView> {
  h(tag: string | Function, props: Record<string, unknown> | null, ...children: VNodeChild[]): VNode;
  createViewFromFn(renderFn: () => VNode): VDOMView;
}

export function vdomRenderer(): VDOMRenderer {
  function h(tag: string | Function, props: Record<string, unknown> | null, ...children: VNodeChild[]): VNode {
    return createVNode(tag, props, ...children);
  }

  function createView(component: ComponentHandle, props: Props): VDOMView {
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

  function unmount(handle: MountHandle): void {
    const h = handle as VDOMMountHandle;
    if (h.currentVNode) {
      h.container.innerHTML = '';
      h.currentVNode = null;
    }
  }

  return { h, createView, createViewFromFn, mount, update, unmount };
}
