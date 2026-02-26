export { h, VNODE_TYPE, SVG_TAGS, Fragment, type VNode, type VNodeChild } from './vnode';
export { mount, patch, unmount, createDomPatcher, type DocumentLike } from './patch';
export { errorBoundary, tryCatchRender, type ErrorHandler } from './error-boundary';
// JSX types: import { ForgeJSX } from '@forge/primitives' for type-only usage
// Not re-exported here to avoid runtime namespace issues with esbuild/Vite.
// Users should import directly: import type { ForgeJSX } from '@forge/primitives/dom/jsx';
export {
  bindSignalToText, bindSignalToAttribute, bindSignalToStyle, bindSignalToClass,
  type ReadableSignal, type BindingCleanup,
} from './signal-binding';
export { getSequence, diffKeys, type DiffOp } from './diff';
