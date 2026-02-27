import type { Renderer, MountHandle, ComponentHandle, Props, Disposable, ReactiveSystem } from '@forge/core';
import { registerFactory, Fragment } from '../expression/factory';
import { untracked, SVG_TAGS } from '@forge/primitives';

// ---- Types ----

interface DirectDOMMountHandle extends MountHandle {
  rootNodes: Node[];
  disposables: Disposable[];
  renderFn: (() => unknown) | null;
}

export interface DirectDOMView {
  renderFn: () => unknown;
}

export interface DirectDOMRenderer extends Renderer<DirectDOMView> {
  createViewFromFn(renderFn: () => unknown): DirectDOMView;
}

// ---- Security (same patterns as primitives/dom/patch.ts) ----

const DANGEROUS_TAGS = new Set(['script', 'iframe', 'object', 'embed', 'base']);
const VALID_TAG_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const VALID_SVG_TAG_RE = /^[a-zA-Z][a-zA-Z0-9]*$/;
const SVG_NS = 'http://www.w3.org/2000/svg';
const DANGEROUS_URL_RE = /^[\s\u0000-\u001f]*(?:javascript|vbscript):/i;
const DATA_URL_RE = /^[\s\u0000-\u001f]*data:/i;
const SAFE_DATA_RE = /^data:(?:image\/(?:png|gif|jpeg|webp|svg\+xml)|video\/|audio\/)/i;
const URL_PROPS = new Set([
  'href', 'src', 'action', 'formaction', 'poster', 'cite',
  'background', 'codebase', 'data', 'xlink:href',
]);
const BLOCKED_PROP_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function validateTag(tag: string, isSvg = false): void {
  const re = isSvg && SVG_TAGS.has(tag) ? VALID_SVG_TAG_RE : VALID_TAG_RE;
  if (!re.test(tag)) {
    throw new Error(`Forge: invalid tag name "${tag}"`);
  }
  if (DANGEROUS_TAGS.has(tag.toLowerCase())) {
    throw new Error(`Forge: "${tag}" tag is blocked for security`);
  }
}

function isSafeUrl(value: string): boolean {
  if (DANGEROUS_URL_RE.test(value)) return false;
  if (DATA_URL_RE.test(value) && !SAFE_DATA_RE.test(value)) return false;
  return true;
}

// ---- Render Context Stack ----

interface RenderContext {
  disposables: Disposable[];
}

let renderContextStack: RenderContext[] = [];
let currentRenderCtx: RenderContext | null = null;

function pushRenderContext(): RenderContext {
  const ctx: RenderContext = { disposables: [] };
  if (currentRenderCtx) renderContextStack.push(currentRenderCtx);
  currentRenderCtx = ctx;
  return ctx;
}

function popRenderContext(): void {
  currentRenderCtx = renderContextStack.pop() ?? null;
}

function trackDisposable(d: Disposable): void {
  currentRenderCtx?.disposables.push(d);
}

// ---- Main Export ----

export function directDomRenderer(reactive: ReactiveSystem): DirectDOMRenderer {
  registerFactory(createDirectElement);

  // ---- Element Creation Factory ----

  function createDirectElement(
    tag: string | Function | symbol,
    props: Record<string, unknown> | null,
    ...children: unknown[]
  ): Node | Node[] {
    // Fragment — return flat array of child nodes
    if (tag === Fragment) {
      const nodes: Node[] = [];
      for (const child of children) {
        collectNodes(nodes, child);
      }
      return nodes;
    }

    // Function component
    // NOTE: This inline path does not integrate with the ComponentSystem
    // (no onAttach/onDetach lifecycle, no provide/inject context).
    // For full lifecycle support, use framework.createView() / routerView plugin.
    if (typeof tag === 'function') {
      const componentProps: Record<string, unknown> = props ? { ...props } : {};
      if (children.length > 0) {
        componentProps.children = children.length === 1 ? children[0] : children;
      }
      const ctx = pushRenderContext();
      try {
        const result = (tag as Function)(componentProps);
        if (typeof result === 'function') {
          return normalizeToNodes(result());
        }
        return normalizeToNodes(result);
      } finally {
        popRenderContext();
        // Transfer sub-disposables to parent render context for proper cleanup
        for (const d of ctx.disposables) {
          trackDisposable(d);
        }
      }
    }

    // HTML/SVG element
    const tagStr = tag as string;
    const isSvg = SVG_TAGS.has(tagStr);
    validateTag(tagStr, isSvg);

    const el = isSvg
      ? document.createElementNS(SVG_NS, tagStr)
      : document.createElement(tagStr);

    if (props) {
      for (const key in props) {
        if (!Object.prototype.hasOwnProperty.call(props, key)) continue;
        if (BLOCKED_PROP_KEYS.has(key)) continue;
        applyProp(el, key, props[key], isSvg);
      }
    }

    for (const child of children) {
      appendChild(el, child);
    }

    return el;
  }

  // ---- Prop Application ----

  function applyProp(el: Element, key: string, value: unknown, _isSvg: boolean): void {
    if (key === 'key') return;

    // ref callback
    if (key === 'ref') {
      if (typeof value === 'function') {
        (value as (el: Element | null) => void)(el);
        trackDisposable({ dispose: () => (value as (el: Element | null) => void)(null) });
      }
      return;
    }

    // Event handlers (onClick → click)
    if (key.startsWith('on') && key.length > 2) {
      if (typeof value === 'function') {
        const eventName = key[2].toLowerCase() + key.slice(3);
        el.addEventListener(eventName, value as EventListener);
        trackDisposable({
          dispose: () => el.removeEventListener(eventName, value as EventListener),
        });
      }
      return;
    }

    // Style object handling
    if (key === 'style') {
      if (typeof value === 'function') {
        const effect = reactive.autorun(() => {
          const v = (value as () => unknown)();
          applyStyle(el as HTMLElement, v);
        });
        trackDisposable(effect);
        return;
      }
      if (typeof value === 'object' && value !== null) {
        applyStyle(el as HTMLElement, value);
        return;
      }
      // style string — fall through to setAttr
    }

    // Reactive prop (function that returns the value, not an event handler)
    if (typeof value === 'function') {
      const effect = reactive.autorun(() => {
        const v = (value as () => unknown)();
        setAttr(el, key, v);
      });
      trackDisposable(effect);
      return;
    }

    // Static prop
    setAttr(el, key, value);
  }

  function applyStyle(el: HTMLElement, value: unknown): void {
    if (typeof value === 'string') {
      el.setAttribute('style', value);
      return;
    }
    if (typeof value === 'object' && value !== null) {
      el.removeAttribute('style');
      const styleObj = value as Record<string, string>;
      for (const prop in styleObj) {
        if (!Object.prototype.hasOwnProperty.call(styleObj, prop)) continue;
        if (prop.includes('-')) {
          el.style.setProperty(prop, styleObj[prop]);
        } else {
          (el.style as unknown as Record<string, string>)[prop] = styleObj[prop];
        }
      }
      return;
    }
    if (value == null || value === false) {
      el.removeAttribute('style');
    }
  }

  function setAttr(el: Element, key: string, value: unknown): void {
    const attrName = key === 'className' ? 'class' : key;

    // URL safety check
    if (URL_PROPS.has(attrName) && typeof value === 'string' && !isSafeUrl(value)) {
      console.warn(`Forge: blocked dangerous URL in "${attrName}"`);
      return;
    }

    if (value === false || value == null) {
      el.removeAttribute(attrName);
    } else if (value === true) {
      el.setAttribute(attrName, '');
    } else {
      el.setAttribute(attrName, String(value));
    }
  }

  // ---- Child Appending ----

  function appendChild(parent: Element, child: unknown): void {
    if (child == null || child === false || child === true) return;

    if (child instanceof Node) {
      parent.appendChild(child);
      return;
    }

    if (Array.isArray(child)) {
      for (const c of child) appendChild(parent, c);
      return;
    }

    // Reactive child — function that returns dynamic content
    if (typeof child === 'function') {
      createReactiveChild(parent, child as () => unknown);
      return;
    }

    // Static text
    parent.appendChild(document.createTextNode(String(child)));
  }

  /**
   * Fine-grained reactive child using the comment anchor pattern.
   * Same technique used by SolidJS, Lit, and Vue 3.
   * A comment node marks the position; dynamic content is inserted before it.
   */
  function createReactiveChild(parent: Element, childFn: () => unknown): void {
    const anchor = document.createComment('');
    parent.appendChild(anchor);

    let currentNodes: Node[] = [];
    let subDisposables: Disposable[] = [];

    const effect = reactive.autorun(() => {
      // Clean up sub-effects from previous evaluation
      for (const d of subDisposables) d.dispose();
      subDisposables = [];

      // Evaluate in a sub-context to collect nested disposables
      const subCtx = pushRenderContext();
      let value: unknown;
      try {
        value = childFn();
      } finally {
        popRenderContext();
      }
      subDisposables = subCtx.disposables;

      // FAST PATH: primitive value + existing single Text node → mutate .data in-place
      if (
        (typeof value === 'string' || typeof value === 'number') &&
        currentNodes.length === 1 &&
        currentNodes[0] instanceof Text
      ) {
        currentNodes[0].data = String(value);
        return;
      }

      // SLOW PATH: Remove previous nodes and create new ones
      for (const node of currentNodes) {
        node.parentNode?.removeChild(node);
      }

      const newNodes = resolveToNodes(value);
      currentNodes = newNodes;

      // Insert before anchor
      for (const node of newNodes) {
        anchor.parentNode!.insertBefore(node, anchor);
      }
    });

    trackDisposable(effect);
    // Track sub-disposable cleanup for when the parent unmounts
    trackDisposable({
      dispose() {
        for (const d of subDisposables) d.dispose();
      },
    });
  }

  // ---- Node Resolution Helpers ----

  function resolveToNodes(value: unknown): Node[] {
    if (value == null || value === false || value === true) return [];
    if (value instanceof Node) return [value];
    if (Array.isArray(value)) {
      const result: Node[] = [];
      for (const item of value) {
        result.push(...resolveToNodes(item));
      }
      return result;
    }
    return [document.createTextNode(String(value))];
  }

  function normalizeToNodes(value: unknown): Node[] {
    if (value instanceof Node) return [value];
    if (Array.isArray(value)) {
      const result: Node[] = [];
      for (const item of value) {
        const resolved = normalizeToNodes(item);
        result.push(...resolved);
      }
      return result;
    }
    if (value == null || value === false || value === true) {
      return [];
    }
    return [document.createTextNode(String(value))];
  }

  function collectNodes(nodes: Node[], child: unknown): void {
    if (child == null || child === false || child === true) return;
    if (child instanceof Node) {
      nodes.push(child);
      return;
    }
    if (Array.isArray(child)) {
      for (const c of child) collectNodes(nodes, c);
      return;
    }
    nodes.push(document.createTextNode(String(child)));
  }

  // ---- Renderer Protocol ----

  function isFactoryHandle(handle: unknown): handle is { factory: (props: Props) => () => unknown } {
    return handle != null
      && typeof handle === 'object'
      && 'factory' in handle
      && typeof (handle as Record<string, unknown>).factory === 'function';
  }

  function createView(component: ComponentHandle, props: Props): DirectDOMView {
    if (isFactoryHandle(component)) {
      const renderFn = component.factory(props);
      if (typeof renderFn === 'function') {
        return { renderFn };
      }
    }
    return { renderFn: () => document.createTextNode('') };
  }

  function createViewFromFn(renderFn: () => unknown): DirectDOMView {
    return { renderFn };
  }

  function mount(view: DirectDOMView, container: Element): DirectDOMMountHandle {
    const ctx = pushRenderContext();
    try {
      // Execute render function outside any outer tracking context.
      // Fine-grained effects created during render handle their own tracking.
      const result = untracked(() => view.renderFn());
      const nodes = resolveToNodes(result);

      for (const node of nodes) {
        container.appendChild(node);
      }

      return {
        container,
        rootNodes: nodes,
        disposables: ctx.disposables,
        renderFn: view.renderFn,
      };
    } finally {
      popRenderContext();
    }
  }

  function update(_handle: MountHandle): void {
    // No-op. Fine-grained reactive effects handle all DOM updates directly.
  }

  function replace(handle: MountHandle, newView: DirectDOMView): DirectDOMMountHandle {
    const h = handle as DirectDOMMountHandle;

    // Dispose all fine-grained effects from old view
    for (const d of h.disposables) d.dispose();

    // Remove old DOM nodes
    for (const node of h.rootNodes) {
      node.parentNode?.removeChild(node);
    }

    // Mount new view into same container
    return mount(newView, h.container);
  }

  function unmount(handle: MountHandle): void {
    const h = handle as DirectDOMMountHandle;

    // Dispose all reactive subscriptions
    for (const d of h.disposables) d.dispose();

    // Remove all DOM nodes
    for (const node of h.rootNodes) {
      node.parentNode?.removeChild(node);
    }

    h.rootNodes = [];
    h.disposables = [];
    h.renderFn = null;
  }

  return { createView, createViewFromFn, mount, update, replace, unmount };
}
