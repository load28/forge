/**
 * PERF-1: Fine-grained signal-to-DOM binding.
 *
 * Enables signals to bind directly to DOM text nodes and attributes,
 * bypassing the full VDOM diff when only a text value changes.
 *
 * Based on Preact Signals' approach where "if you pass a signal directly into JSX,
 * it will bind directly to the DOM Text node... and update that whenever the signal changes."
 * See: https://preactjs.com/blog/introducing-signals/
 * See: https://preactjs.com/guide/v10/signals/
 *
 * This module provides the building blocks for renderers to implement
 * fine-grained DOM updates. It works with any reactive signal interface
 * that provides get() and subscribe().
 */

/** Minimal signal interface for binding */
export interface ReadableSignal<T> {
  get(): T;
  subscribe(fn: (value: T) => void): () => void;
}

/** Cleanup function returned by bind operations */
export type BindingCleanup = () => void;

/**
 * Bind a signal directly to a DOM Text node's data property.
 * Updates bypass VDOM entirely — O(1) per signal change.
 *
 * @returns Cleanup function to remove the binding
 *
 * @example
 * ```ts
 * const name = signal('World');
 * const textNode = document.createTextNode('');
 * const cleanup = bindSignalToText(name, textNode);
 * // textNode.data is now 'World' and auto-updates
 * ```
 */
export function bindSignalToText<T>(
  signal: ReadableSignal<T>,
  textNode: Text,
): BindingCleanup {
  // Set initial value
  textNode.data = String(signal.get());

  // Subscribe to changes — direct DOM mutation, no VDOM diff
  return signal.subscribe((value) => {
    textNode.data = String(value);
  });
}

/**
 * Bind a signal to a specific DOM attribute.
 * Updates bypass VDOM entirely — O(1) per signal change.
 *
 * @returns Cleanup function to remove the binding
 */
export function bindSignalToAttribute(
  signal: ReadableSignal<unknown>,
  element: Element,
  attrName: string,
): BindingCleanup {
  function update(value: unknown) {
    if (value === false || value == null) {
      element.removeAttribute(attrName);
    } else if (value === true) {
      element.setAttribute(attrName, '');
    } else {
      element.setAttribute(attrName, String(value));
    }
  }

  // Set initial value
  update(signal.get());

  // Subscribe to changes
  return signal.subscribe(update);
}

/**
 * Bind a signal to a DOM element's style property.
 *
 * @returns Cleanup function to remove the binding
 */
export function bindSignalToStyle(
  signal: ReadableSignal<string>,
  element: HTMLElement,
  property: string,
): BindingCleanup {
  function update(value: string) {
    element.style.setProperty(property, value);
  }

  update(signal.get());
  return signal.subscribe(update);
}

/**
 * Bind a signal to a DOM element's className.
 *
 * @returns Cleanup function to remove the binding
 */
export function bindSignalToClass(
  signal: ReadableSignal<string>,
  element: Element,
): BindingCleanup {
  function update(value: string) {
    element.className = value;
  }

  update(signal.get());
  return signal.subscribe(update);
}
