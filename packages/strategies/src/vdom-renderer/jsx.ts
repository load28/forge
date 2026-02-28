/**
 * DX-01: JSX type declarations for Forge's VDOM rendering strategy.
 *
 * Provides TypeScript JSX support so `h()` calls type-check correctly.
 * Based on TypeScript's JSX handbook: https://www.typescriptlang.org/docs/handbook/jsx.html
 * And React's JSX.IntrinsicElements pattern: https://www.totaltypescript.com/what-is-jsx-intrinsicelements
 *
 * Usage in tsconfig.json:
 *   "jsx": "react",
 *   "jsxFactory": "h",
 *   "jsxFragmentFactory": "Fragment"
 */
import type { VNode, VNodeChild } from '@forge/primitives';

/** Event handler types for DOM elements */
type EventHandler<E extends Event = Event> = (event: E) => void;

/** Common HTML attributes shared across all elements */
interface HTMLAttributes {
  // Core
  id?: string;
  class?: string;
  className?: string;
  style?: string | Record<string, string | number>;
  key?: string | number;
  ref?: (el: Element | null) => void;

  // ARIA
  role?: string;
  tabIndex?: number;
  title?: string;
  lang?: string;
  dir?: string;

  // Data attributes
  [key: `data-${string}`]: unknown;

  // Boolean
  hidden?: boolean;
  draggable?: boolean;
  contentEditable?: boolean | 'true' | 'false' | 'inherit';
  spellCheck?: boolean;

  // Event handlers — Mouse
  onClick?: EventHandler<MouseEvent>;
  onDblClick?: EventHandler<MouseEvent>;
  onMouseDown?: EventHandler<MouseEvent>;
  onMouseUp?: EventHandler<MouseEvent>;
  onMouseMove?: EventHandler<MouseEvent>;
  onMouseEnter?: EventHandler<MouseEvent>;
  onMouseLeave?: EventHandler<MouseEvent>;
  onContextMenu?: EventHandler<MouseEvent>;

  // Event handlers — Keyboard
  onKeyDown?: EventHandler<KeyboardEvent>;
  onKeyUp?: EventHandler<KeyboardEvent>;
  onKeyPress?: EventHandler<KeyboardEvent>;

  // Event handlers — Focus
  onFocus?: EventHandler<FocusEvent>;
  onBlur?: EventHandler<FocusEvent>;

  // Event handlers — Form
  onChange?: EventHandler<Event>;
  onInput?: EventHandler<Event>;
  onSubmit?: EventHandler<Event>;
  onReset?: EventHandler<Event>;

  // Event handlers — Touch
  onTouchStart?: EventHandler<TouchEvent>;
  onTouchMove?: EventHandler<TouchEvent>;
  onTouchEnd?: EventHandler<TouchEvent>;

  // Event handlers — Other
  onScroll?: EventHandler<Event>;
  onWheel?: EventHandler<WheelEvent>;
  onLoad?: EventHandler<Event>;
  onError?: EventHandler<Event>;
}

/** Input-specific attributes */
interface InputHTMLAttributes extends HTMLAttributes {
  type?: string;
  value?: string | number;
  checked?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  placeholder?: string;
  name?: string;
  required?: boolean;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  pattern?: string;
  autocomplete?: string;
  autofocus?: boolean;
  multiple?: boolean;
  accept?: string;
}

/** Anchor-specific attributes */
interface AnchorHTMLAttributes extends HTMLAttributes {
  href?: string;
  target?: string;
  rel?: string;
  download?: string | boolean;
  type?: string;
}

/** Image-specific attributes */
interface ImgHTMLAttributes extends HTMLAttributes {
  src?: string;
  alt?: string;
  width?: string | number;
  height?: string | number;
  loading?: 'lazy' | 'eager';
  decoding?: 'sync' | 'async' | 'auto';
  crossOrigin?: string;
}

/** Form-specific attributes */
interface FormHTMLAttributes extends HTMLAttributes {
  action?: string;
  method?: string;
  encType?: string;
  target?: string;
  noValidate?: boolean;
}

/** Button-specific attributes */
interface ButtonHTMLAttributes extends HTMLAttributes {
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  name?: string;
  value?: string;
  form?: string;
}

/** Select-specific attributes */
interface SelectHTMLAttributes extends HTMLAttributes {
  value?: string | string[];
  disabled?: boolean;
  multiple?: boolean;
  name?: string;
  required?: boolean;
  size?: number;
}

/** Textarea-specific attributes */
interface TextareaHTMLAttributes extends HTMLAttributes {
  value?: string;
  disabled?: boolean;
  placeholder?: string;
  name?: string;
  required?: boolean;
  rows?: number;
  cols?: number;
  readonly?: boolean;
  maxLength?: number;
  minLength?: number;
}

/** Label-specific attributes */
interface LabelHTMLAttributes extends HTMLAttributes {
  htmlFor?: string;
  form?: string;
}

/** Table cell attributes */
interface TdHTMLAttributes extends HTMLAttributes {
  colSpan?: number;
  rowSpan?: number;
  headers?: string;
}

/** SVG-specific attributes */
interface SVGAttributes extends HTMLAttributes {
  viewBox?: string;
  xmlns?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: string | number;
  d?: string;
  cx?: string | number;
  cy?: string | number;
  r?: string | number;
  x?: string | number;
  y?: string | number;
  width?: string | number;
  height?: string | number;
  transform?: string;
  opacity?: string | number;
  clipPath?: string;
  mask?: string;
  filter?: string;
}

/**
 * JSX type definitions for Forge's h() function.
 * Maps HTML tag names to their attribute types.
 *
 * To enable JSX support, add to a global.d.ts file:
 * ```ts
 * import type { ForgeIntrinsicElements } from '@forge/strategies/vdom-renderer/jsx';
 * declare namespace JSX {
 *   interface IntrinsicElements extends ForgeIntrinsicElements {}
 *   type Element = import('@forge/primitives').VNode;
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace ForgeJSX {
  export interface IntrinsicElements {
    // Structural
    div: HTMLAttributes;
    span: HTMLAttributes;
    p: HTMLAttributes;
    main: HTMLAttributes;
    section: HTMLAttributes;
    article: HTMLAttributes;
    aside: HTMLAttributes;
    header: HTMLAttributes;
    footer: HTMLAttributes;
    nav: HTMLAttributes;

    // Headings
    h1: HTMLAttributes;
    h2: HTMLAttributes;
    h3: HTMLAttributes;
    h4: HTMLAttributes;
    h5: HTMLAttributes;
    h6: HTMLAttributes;

    // Text
    strong: HTMLAttributes;
    em: HTMLAttributes;
    b: HTMLAttributes;
    i: HTMLAttributes;
    u: HTMLAttributes;
    s: HTMLAttributes;
    small: HTMLAttributes;
    sub: HTMLAttributes;
    sup: HTMLAttributes;
    code: HTMLAttributes;
    pre: HTMLAttributes;
    blockquote: HTMLAttributes;
    cite: HTMLAttributes;
    abbr: HTMLAttributes;
    mark: HTMLAttributes;
    time: HTMLAttributes;

    // Lists
    ul: HTMLAttributes;
    ol: HTMLAttributes;
    li: HTMLAttributes;
    dl: HTMLAttributes;
    dt: HTMLAttributes;
    dd: HTMLAttributes;

    // Forms
    form: FormHTMLAttributes;
    input: InputHTMLAttributes;
    textarea: TextareaHTMLAttributes;
    select: SelectHTMLAttributes;
    option: HTMLAttributes & { value?: string; selected?: boolean; disabled?: boolean };
    optgroup: HTMLAttributes & { label?: string; disabled?: boolean };
    button: ButtonHTMLAttributes;
    label: LabelHTMLAttributes;
    fieldset: HTMLAttributes & { disabled?: boolean };
    legend: HTMLAttributes;
    output: HTMLAttributes;
    progress: HTMLAttributes & { value?: number; max?: number };
    meter: HTMLAttributes & { value?: number; min?: number; max?: number; low?: number; high?: number; optimum?: number };

    // Links & Media
    a: AnchorHTMLAttributes;
    img: ImgHTMLAttributes;
    video: HTMLAttributes & { src?: string; controls?: boolean; autoplay?: boolean; loop?: boolean; muted?: boolean; poster?: string; width?: number | string; height?: number | string };
    audio: HTMLAttributes & { src?: string; controls?: boolean; autoplay?: boolean; loop?: boolean; muted?: boolean };
    source: HTMLAttributes & { src?: string; type?: string; media?: string };
    picture: HTMLAttributes;
    canvas: HTMLAttributes & { width?: number | string; height?: number | string };

    // Table
    table: HTMLAttributes;
    thead: HTMLAttributes;
    tbody: HTMLAttributes;
    tfoot: HTMLAttributes;
    tr: HTMLAttributes;
    th: TdHTMLAttributes & { scope?: string };
    td: TdHTMLAttributes;
    caption: HTMLAttributes;
    colgroup: HTMLAttributes & { span?: number };
    col: HTMLAttributes & { span?: number };

    // Other
    br: HTMLAttributes;
    hr: HTMLAttributes;
    details: HTMLAttributes & { open?: boolean };
    summary: HTMLAttributes;
    dialog: HTMLAttributes & { open?: boolean };
    slot: HTMLAttributes & { name?: string };
    template: HTMLAttributes;
    style: HTMLAttributes;
    noscript: HTMLAttributes;

    // SVG
    svg: SVGAttributes;
    path: SVGAttributes;
    circle: SVGAttributes;
    rect: SVGAttributes & { rx?: string | number; ry?: string | number };
    line: SVGAttributes & { x1?: string | number; y1?: string | number; x2?: string | number; y2?: string | number };
    polyline: SVGAttributes & { points?: string };
    polygon: SVGAttributes & { points?: string };
    ellipse: SVGAttributes & { rx?: string | number; ry?: string | number };
    g: SVGAttributes;
    text: SVGAttributes;
    tspan: SVGAttributes;
    defs: SVGAttributes;
    use: SVGAttributes & { href?: string };
    clipPath: SVGAttributes;
    mask: SVGAttributes;
    pattern: SVGAttributes;
    linearGradient: SVGAttributes;
    radialGradient: SVGAttributes;
    stop: SVGAttributes & { offset?: string | number; stopColor?: string; stopOpacity?: string | number };
    image: SVGAttributes;
    foreignObject: SVGAttributes;
    marker: SVGAttributes;
    animate: SVGAttributes;
    animateTransform: SVGAttributes;

    // Allow custom elements
    [tag: string]: Record<string, unknown>;
  }

  export type Element = VNode;
  export type ElementChildrenAttribute = { children: {} };
}
