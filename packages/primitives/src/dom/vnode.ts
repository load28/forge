/**
 * VNode type branding symbol — prevents arbitrary objects from being treated as VNodes.
 * Similar to React's $$typeof (Symbol.for('react.element')) anti-XSS pattern.
 * See: https://overreacted.io/why-do-react-elements-have-typeof-property/
 */
export const VNODE_TYPE = Symbol.for('forge.vnode');

/**
 * Fragment symbol — renders children without a wrapper element (TC-02).
 * Similar to React.Fragment: https://react.dev/reference/react/Fragment
 * Usage: h(Fragment, null, child1, child2)
 */
export const Fragment = Symbol.for('forge.fragment');

export type VNodeChild = VNode | string | number | boolean | null | undefined;

export interface VNode {
  $$typeof: symbol;
  tag: string | Function | symbol;
  props: Record<string, unknown> | null;
  children: VNodeChild[];
  key?: string | number;
  el?: Node;
  /** P5: Pre-computed flag — true if any child has a key, avoids O(n) .some() per patch */
  _childrenHaveKeys?: boolean;
  /** P1: Tracks the real parent element for Fragment VNodes (DocumentFragment empties on append) */
  _parentEl?: Element;
}

/** Flatten nested children arrays and filter falsy values in a single pass (P11 optimization) */
function flattenChildren(children: unknown[], result: VNodeChild[]): void {
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (Array.isArray(child)) {
      flattenChildren(child, result);
    } else if (child != null && child !== false && child !== true) {
      result.push(child as VNodeChild);
    }
  }
}

/**
 * SVG tags that require createElementNS for correct rendering.
 * Based on SVG 2 spec: https://www.w3.org/TR/SVG2/
 */
export const SVG_TAGS = new Set([
  'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse',
  'g', 'text', 'tspan', 'defs', 'use', 'symbol', 'clipPath', 'mask',
  'pattern', 'image', 'foreignObject', 'marker', 'linearGradient',
  'radialGradient', 'stop', 'filter', 'animate', 'animateTransform',
  'textPath', 'desc', 'title', 'metadata',
]);

export function createVNode(
  tag: string | Function | symbol,
  props: Record<string, unknown> | null,
  ...children: unknown[]
): VNode {
  const flatChildren: VNodeChild[] = [];
  flattenChildren(children, flatChildren);
  const key = props?.key as string | number | undefined;
  // TC-03: Strip key from props — it's a VNode concept, not a DOM attribute.
  // React does the same: key is consumed by the reconciler, not passed to the element.
  let cleanProps = props;
  if (props && 'key' in props) {
    const { key: _, ...rest } = props;
    cleanProps = Object.keys(rest).length > 0 ? rest : null;
  }
  // P5: Check for keyed children once during creation, not every patch
  let hasKeyedChild = false;
  for (let i = 0; i < flatChildren.length; i++) {
    const child = flatChildren[i];
    if (child != null && typeof child === 'object' && '$$typeof' in child && (child as VNode).key != null) {
      hasKeyedChild = true;
      break;
    }
  }

  return {
    $$typeof: VNODE_TYPE,
    tag,
    props: cleanProps,
    children: flatChildren,
    key,
    _childrenHaveKeys: hasKeyedChild,
  };
}
