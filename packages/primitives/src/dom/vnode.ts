export type VNodeChild = VNode | string | number | boolean | null | undefined;

export interface VNode {
  tag: string | Function;
  props: Record<string, unknown> | null;
  children: VNodeChild[];
  key?: string | number;
  el?: Node;
}

export function h(
  tag: string | Function,
  props: Record<string, unknown> | null,
  ...children: VNodeChild[]
): VNode {
  return {
    tag,
    props,
    children: children.flat().filter(c => c != null && c !== false && c !== true),
    key: props?.key as string | number | undefined,
  };
}
