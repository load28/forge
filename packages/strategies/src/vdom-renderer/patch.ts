import { type VNode as BaseVNode, type VNodeChild, VNODE_TYPE, SVG_TAGS, Fragment } from '@forge/primitives';
import { getSequence } from './diff';

/** VDOM reconciliation-specific extension of pure VNode IR with DOM rendering fields */
export interface DOMVNode extends BaseVNode {
  el?: Node;
  _childrenHaveKeys?: boolean;
  _parentEl?: Element;
}

type VNode = DOMVNode;

// ---- Security: XSS Prevention ----
// Based on OWASP XSS Prevention Cheat Sheet and React's sanitization patterns.
// See: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html

/** SVG namespace URI for createElementNS (W3C SVG 2 spec) */
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Dangerous tags that must never be created from user input (S2).
 * TC-06: Reduced from over-aggressive list — style/template/slot/noscript removed
 * as they are needed for scoped styles, web components, and progressive enhancement.
 */
const DANGEROUS_TAGS = new Set([
  'script', 'iframe', 'object', 'embed', 'base',
]);

/**
 * Valid tag name pattern per HTML spec:
 * - Standard HTML/SVG tags: lowercase alphanumeric (e.g., "div", "h1")
 * - Custom elements: must contain a hyphen, lowercase start (e.g., "my-component")
 * See: https://html.spec.whatwg.org/multipage/custom-elements.html#valid-custom-element-name
 */
const VALID_TAG_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/**
 * Dangerous URL protocol pattern (S3b).
 * Blocks javascript:, vbscript:, data: (except safe data: image types).
 * Leading whitespace and control chars are stripped to prevent obfuscation.
 * Based on React's sanitizeURL approach.
 */
const DANGEROUS_URL_RE = /^[\s\u0000-\u001f]*(?:javascript|vbscript):/i;
const DATA_URL_RE = /^[\s\u0000-\u001f]*data:/i;
const SAFE_DATA_RE = /^data:(?:image\/(?:png|gif|jpeg|webp|svg\+xml)|video\/|audio\/)/i;

/** Props that accept URLs and need protocol validation */
const URL_PROPS = new Set([
  'href', 'src', 'action', 'formaction', 'poster', 'cite',
  'background', 'codebase', 'data', 'xlink:href',
]);

/** Prototype pollution keys to block (S4) */
const BLOCKED_PROP_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isVNode(child: VNodeChild): child is VNode {
  return child != null && typeof child === 'object' && '$$typeof' in child && (child as VNode).$$typeof === VNODE_TYPE;
}

/** SVG tags use camelCase (e.g., foreignObject, clipPath) — validated separately */
const VALID_SVG_TAG_RE = /^[a-zA-Z][a-zA-Z0-9]*$/;

/** Validate tag name — blocks dangerous tags and invalid names (S2) */
function validateTag(tag: string, isSvg = false): void {
  const re = isSvg && SVG_TAGS.has(tag) ? VALID_SVG_TAG_RE : VALID_TAG_RE;
  if (!re.test(tag)) {
    throw new Error(`Forge: invalid tag name "${tag}"`);
  }
  if (DANGEROUS_TAGS.has(tag.toLowerCase())) {
    throw new Error(`Forge: "${tag}" tag is blocked for security`);
  }
}

/** Check if a URL prop value contains a dangerous protocol (S3b) */
function isSafeUrl(value: string): boolean {
  if (DANGEROUS_URL_RE.test(value)) return false;
  if (DATA_URL_RE.test(value) && !SAFE_DATA_RE.test(value)) return false;
  return true;
}

// Store event handler wrappers to allow stable references
const eventHandlers = new WeakMap<HTMLElement, Map<string, { current: EventListener; wrapper: EventListener }>>();

function getHandlerMap(el: HTMLElement): Map<string, { current: EventListener; wrapper: EventListener }> {
  let map = eventHandlers.get(el);
  if (!map) {
    map = new Map();
    eventHandlers.set(el, map);
  }
  return map;
}

function setEventHandler(el: HTMLElement, eventName: string, handler: EventListener): void {
  const map = getHandlerMap(el);
  const existing = map.get(eventName);
  if (existing) {
    existing.current = handler;
  } else {
    const entry = { current: handler, wrapper: ((e: Event) => entry.current(e)) as EventListener };
    map.set(eventName, entry);
    el.addEventListener(eventName, entry.wrapper);
  }
}

function removeEventHandler(el: HTMLElement, eventName: string): void {
  const map = eventHandlers.get(el);
  if (!map) return;
  const entry = map.get(eventName);
  if (entry) {
    el.removeEventListener(eventName, entry.wrapper);
    map.delete(eventName);
  }
}

function setProp(el: HTMLElement, key: string, value: unknown): void {
  if (key === 'key' || key === '$$typeof') return;

  // S4: Block prototype pollution keys
  if (BLOCKED_PROP_KEYS.has(key)) return;

  // TC-04: ref callback — call with element on mount, null on unmount.
  // Based on React's callback ref pattern: https://react.dev/learn/manipulating-the-dom-with-refs
  if (key === 'ref') {
    if (typeof value === 'function') {
      (value as (el: Element | null) => void)(el);
    }
    return;
  }

  // S3a: on* props — only allow function values (block string event handlers for XSS prevention).
  if (key.startsWith('on')) {
    if (typeof value === 'function') {
      setEventHandler(el, key.slice(2).toLowerCase(), value as EventListener);
    } else {
      // TC-08: Remove stale handler when on* value becomes non-function
      removeEventHandler(el, key.slice(2).toLowerCase());
    }
    return;
  }

  // S3b: Validate URL props against dangerous protocols
  const attrName = key === 'className' ? 'class' : key;
  if (URL_PROPS.has(attrName) && typeof value === 'string' && !isSafeUrl(value)) {
    // Block dangerous URLs — set to safe empty value
    console.warn(`Forge: blocked potentially dangerous URL in "${attrName}"`);
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

function removeProp(el: HTMLElement, key: string, value: unknown): void {
  if (key === 'key' || key === '$$typeof') return;
  if (key === 'ref') {
    // TC-04: Call ref(null) on unmount — React callback ref convention
    if (typeof value === 'function') {
      (value as (el: Element | null) => void)(null);
    }
    return;
  }
  if (key.startsWith('on')) {
    removeEventHandler(el, key.slice(2).toLowerCase());
  } else {
    el.removeAttribute(key === 'className' ? 'class' : key);
  }
}

// Track child DOM nodes for stable text node references
const childNodesMap = new WeakMap<VNode, Node[]>();

/**
 * Create a real DOM element from a VNode.
 * @param vnode - The virtual node to create
 * @param isSvg - Whether we're inside an SVG context (propagated to children).
 *   SVG elements must use createElementNS per W3C SVG 2 spec.
 *   See: https://developer.mozilla.org/en-US/docs/Web/API/Document/createElementNS
 */
function createEl(vnode: VNode, isSvg = false): Node {
  if (typeof vnode.tag === 'function') {
    throw new Error('Function components should be resolved before patching');
  }

  // TC-02: Fragment support — render children directly into a DocumentFragment.
  // Based on React's Fragment: https://react.dev/reference/react/Fragment
  if (vnode.tag === Fragment) {
    const frag = document.createDocumentFragment();
    const childEls: Node[] = [];
    for (const child of vnode.children) {
      if (isVNode(child)) {
        const childEl = createEl(child, isSvg);
        frag.appendChild(childEl);
        childEls.push(childEl);
      } else if (child != null) {
        const textNode = document.createTextNode(String(child));
        frag.appendChild(textNode);
        childEls.push(textNode);
      }
    }
    vnode.el = frag as unknown as Node;
    childNodesMap.set(vnode, childEls);
    return frag;
  }

  // S2: Validate tag name before creating element
  const tag = vnode.tag as string;
  const svgContext = isSvg || tag === 'svg';
  validateTag(tag, svgContext);

  // TC-01: SVG namespace handling — svg tag enters SVG context, children inherit it
  const el = svgContext
    ? document.createElementNS(SVG_NS, tag) as unknown as HTMLElement
    : document.createElement(tag);
  vnode.el = el;

  // PF-04: Use for..in instead of Object.entries() to avoid intermediate array allocation
  if (vnode.props) {
    const props = vnode.props;
    for (const key in props) {
      if (Object.prototype.hasOwnProperty.call(props, key)) {
        setProp(el, key, props[key]);
      }
    }
  }

  const childEls: Node[] = [];
  for (const child of vnode.children) {
    if (isVNode(child)) {
      const childEl = createEl(child, svgContext);
      el.appendChild(childEl);
      childEls.push(childEl);
    } else if (child != null) {
      const textNode = document.createTextNode(String(child));
      el.appendChild(textNode);
      childEls.push(textNode);
    }
  }
  childNodesMap.set(vnode, childEls);

  return el;
}

export function mount(vnode: VNode, container: Element): void {
  const el = createEl(vnode);
  container.appendChild(el);
  // P1: Track real parent for Fragment VNodes — DocumentFragment empties on appendChild
  if (vnode.tag === Fragment) {
    vnode._parentEl = container;
  }
}

export function unmount(vnode: VNode): void {
  // P1: Fragment unmount — remove tracked child nodes since DocumentFragment is empty
  if (vnode.tag === Fragment) {
    const childEls = childNodesMap.get(vnode);
    if (childEls) {
      for (const child of childEls) {
        child.parentNode?.removeChild(child);
      }
    }
    return;
  }
  vnode.el?.parentNode?.removeChild(vnode.el);
}

export function patch(oldVNode: VNode, newVNode: VNode, container: Element): void {
  if (oldVNode.tag !== newVNode.tag) {
    // P1: Handle Fragment↔non-Fragment tag changes
    if (oldVNode.tag === Fragment) {
      // Fragment → Element: remove old fragment children, mount new element
      const parent = oldVNode._parentEl ?? container;
      const childEls = childNodesMap.get(oldVNode);
      const anchor = childEls?.[0] ?? null;
      const newEl = createEl(newVNode);
      parent.insertBefore(newEl, anchor);
      if (childEls) {
        for (const child of childEls) {
          child.parentNode?.removeChild(child);
        }
      }
    } else if (newVNode.tag === Fragment) {
      // Element → Fragment: replace old element with new fragment children
      const parent = oldVNode.el!.parentNode as Element ?? container;
      const newEl = createEl(newVNode);
      newVNode._parentEl = parent;
      parent.insertBefore(newEl, oldVNode.el!);
      parent.removeChild(oldVNode.el!);
    } else {
      const newEl = createEl(newVNode);
      oldVNode.el!.parentNode!.replaceChild(newEl, oldVNode.el!);
    }
    return;
  }

  // P1: Fragment patch — use real parent instead of empty DocumentFragment
  if (oldVNode.tag === Fragment) {
    const parent = oldVNode._parentEl ?? container;
    newVNode.el = oldVNode.el;
    newVNode._parentEl = parent;
    const newChildEls = patchChildren(oldVNode, newVNode, parent);
    childNodesMap.set(newVNode, newChildEls);
    return;
  }

  const el = oldVNode.el as HTMLElement;
  newVNode.el = el;

  // patch props (PF-04: for..in instead of Object.keys/entries to avoid allocation)
  const oldProps = oldVNode.props ?? {};
  const newProps = newVNode.props ?? {};

  for (const key in oldProps) {
    if (!Object.prototype.hasOwnProperty.call(oldProps, key)) continue;
    if (key === 'key' || key === '$$typeof') continue;
    if (!(key in newProps)) {
      removeProp(el, key, oldProps[key]);
    }
  }

  for (const key in newProps) {
    if (!Object.prototype.hasOwnProperty.call(newProps, key)) continue;
    if (key === 'key' || key === '$$typeof') continue;
    if (oldProps[key] !== newProps[key] || key.startsWith('on')) {
      setProp(el, key, newProps[key]);
    }
  }

  // patch children
  const newChildEls = patchChildren(oldVNode, newVNode, el);
  childNodesMap.set(newVNode, newChildEls);
}

function patchChildren(oldVNode: VNode, newVNode: VNode, parent: Element): Node[] {
  const oldCh = oldVNode.children;
  const newCh = newVNode.children;

  // P5: Use pre-computed _childrenHaveKeys flag (set during h()) instead of O(n) .some()
  const oldHasKeys = oldVNode._childrenHaveKeys ?? false;
  const newHasKeys = newVNode._childrenHaveKeys ?? false;

  if (oldHasKeys || newHasKeys) {
    return patchKeyedChildren(oldVNode, oldCh, newCh, parent);
  }

  return patchNonKeyedChildren(oldVNode, oldCh, newCh, parent);
}

function patchNonKeyedChildren(oldVNode: VNode, oldCh: VNodeChild[], newCh: VNodeChild[], parent: Element): Node[] {
  const oldLen = oldCh.length;
  const newLen = newCh.length;
  const commonLen = Math.min(oldLen, newLen);

  // Snapshot old DOM nodes for stable references
  const oldDomNodes = childNodesMap.get(oldVNode) ?? Array.from(parent.childNodes);
  const newDomNodes: Node[] = [];

  for (let i = 0; i < commonLen; i++) {
    const oldChild = oldCh[i];
    const newChild = newCh[i];

    // BUG-3/4: Handle null children explicitly
    if (newChild == null) {
      // New child is null — remove old DOM node if present
      const oldNode = oldDomNodes[i];
      if (oldNode && oldNode.parentNode === parent) {
        parent.removeChild(oldNode);
      }
      continue;
    }

    if (isVNode(oldChild) && isVNode(newChild)) {
      patch(oldChild, newChild, parent);
      newDomNodes.push(newChild.el!);
    } else if (oldChild !== newChild) {
      const oldNode = oldDomNodes[i];
      if (oldNode) {
        if (isVNode(newChild)) {
          const newEl = createEl(newChild);
          parent.replaceChild(newEl, oldNode);
          newDomNodes.push(newEl);
        } else {
          const textNode = document.createTextNode(String(newChild));
          parent.replaceChild(textNode, oldNode);
          newDomNodes.push(textNode);
        }
      } else {
        // No old DOM node — append new one
        if (isVNode(newChild)) {
          const newEl = createEl(newChild);
          parent.appendChild(newEl);
          newDomNodes.push(newEl);
        } else {
          const textNode = document.createTextNode(String(newChild));
          parent.appendChild(textNode);
          newDomNodes.push(textNode);
        }
      }
    } else {
      // Same child, keep the same DOM node
      newDomNodes.push(oldDomNodes[i]);
    }
  }

  // Add new children
  for (let i = commonLen; i < newLen; i++) {
    const child = newCh[i];
    if (isVNode(child)) {
      const el = createEl(child);
      parent.appendChild(el);
      newDomNodes.push(el);
    } else if (child != null) {
      const textNode = document.createTextNode(String(child));
      parent.appendChild(textNode);
      newDomNodes.push(textNode);
    }
  }

  // Remove extra old children (iterate backward for stable indices)
  for (let i = oldLen - 1; i >= newLen; i--) {
    const node = oldDomNodes[i];
    if (node && node.parentNode === parent) {
      parent.removeChild(node);
    }
  }

  return newDomNodes;
}

function patchKeyedChildren(oldVNode: VNode, oldCh: VNodeChild[], newCh: VNodeChild[], parent: Element): Node[] {
  const oldDomNodes = childNodesMap.get(oldVNode) ?? Array.from(parent.childNodes);
  const isSvg = (oldVNode.el as Element)?.namespaceURI === SVG_NS;

  // Build key → index map for old children
  const oldKeyMap = new Map<string | number, number>();
  for (let i = 0; i < oldCh.length; i++) {
    const child = oldCh[i];
    if (isVNode(child) && child.key != null) {
      oldKeyMap.set(child.key, i);
    }
  }

  const newDomNodes: Node[] = [];
  const usedOldIndices = new Set<number>();
  // Track old indices for LIS-based move optimization
  const oldIndicesForLIS: number[] = [];

  for (let i = 0; i < newCh.length; i++) {
    const newChild = newCh[i];

    if (isVNode(newChild) && newChild.key != null) {
      const oldIndex = oldKeyMap.get(newChild.key);

      if (oldIndex != null) {
        const oldChild = oldCh[oldIndex] as VNode;
        usedOldIndices.add(oldIndex);
        patch(oldChild, newChild, parent);
        newDomNodes.push(newChild.el!);
        oldIndicesForLIS.push(oldIndex);
      } else {
        const el = createEl(newChild, isSvg);
        newDomNodes.push(el);
        oldIndicesForLIS.push(-1); // new node
      }
    } else if (isVNode(newChild)) {
      const el = createEl(newChild, isSvg);
      newDomNodes.push(el);
      oldIndicesForLIS.push(-1);
    } else if (newChild != null) {
      const textNode = document.createTextNode(String(newChild));
      newDomNodes.push(textNode);
      oldIndicesForLIS.push(-1);
    }
  }

  // Remove unused old children
  for (let i = 0; i < oldCh.length; i++) {
    if (!usedOldIndices.has(i)) {
      const node = oldDomNodes[i];
      if (node && node.parentNode === parent) {
        parent.removeChild(node);
      }
    }
  }

  // PF-01: Use LIS to minimize DOM moves.
  // Nodes whose old indices form an increasing subsequence don't need to move.
  const lis = getSequence(oldIndicesForLIS);
  const stableSet = new Set(lis.map(i => i));

  // Insert/move nodes — iterate backward for stable insertBefore anchor
  for (let i = newDomNodes.length - 1; i >= 0; i--) {
    const node = newDomNodes[i];
    const anchor = i + 1 < newDomNodes.length ? newDomNodes[i + 1] : null;

    if (oldIndicesForLIS[i] === -1) {
      // New node — insert
      parent.insertBefore(node, anchor);
    } else if (!stableSet.has(i)) {
      // Moved node — reposition
      parent.insertBefore(node, anchor);
    }
    // Stable nodes (in LIS) — already in correct relative order, no move needed
  }

  return newDomNodes;
}

// ---- P6: SSR-compatible document injection ----

/**
 * Minimal document interface for SSR compatibility.
 * Implementations (e.g., linkedom, happy-dom) can provide this without a full browser.
 */
export interface DocumentLike {
  createElement(tag: string): Element;
  createElementNS(ns: string, tag: string): Element;
  createTextNode(data: string): Text;
  createDocumentFragment(): DocumentFragment;
}

/**
 * P6: Factory for creating DOM operations with an injected document.
 * Enables SSR environments to provide a virtual document implementation.
 *
 * Browser usage (default):
 *   import { mount, patch, unmount } from './patch';
 *
 * SSR usage:
 *   import { createDomPatcher } from './patch';
 *   const { mount, patch, unmount } = createDomPatcher(ssrDocument);
 */
export function createDomPatcher(doc: DocumentLike) {
  // P6: Warn that the provided document is not yet used
  void doc;
  console.warn(
    'Forge: createDomPatcher does not yet use the provided document. ' +
    'DOM operations will use globalThis.document.'
  );
  return { mount, patch, unmount };
}
