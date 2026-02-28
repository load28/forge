/**
 * VNode type branding symbol — prevents arbitrary objects from being treated as VNodes.
 * Similar to React's $$typeof (Symbol.for('react.element')) anti-XSS pattern.
 * See: https://overreacted.io/why-do-react-elements-have-typeof-property/
 */
export const VNODE_TYPE = Symbol.for('forge.vnode');

export type VNodeChild = VNode | string | number | boolean | null | undefined;

/**
 * Pure IR (Intermediate Representation) for virtual DOM nodes.
 * No DOM-specific fields — rendering strategies extend this as needed.
 */
export interface VNode {
  $$typeof: symbol;
  tag: string | Function | symbol;
  props: Record<string, unknown> | null;
  children: VNodeChild[];
  key?: string | number;
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

  return {
    $$typeof: VNODE_TYPE,
    tag,
    props: cleanProps,
    children: flatChildren,
    key,
  };
}
