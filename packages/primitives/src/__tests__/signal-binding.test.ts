import { describe, it, expect, vi } from 'vitest';
import {
  bindSignalToText,
  bindSignalToAttribute,
  bindSignalToStyle,
  bindSignalToClass,
} from '../dom/signal-binding';

/** Simple mock signal for testing */
function mockSignal<T>(initial: T) {
  let value = initial;
  const subscribers = new Set<(v: T) => void>();

  return {
    get: () => value,
    set(next: T) {
      value = next;
      for (const fn of subscribers) fn(value);
    },
    subscribe(fn: (v: T) => void) {
      subscribers.add(fn);
      return () => { subscribers.delete(fn); };
    },
  };
}

describe('signal-binding (PERF-1)', () => {
  describe('bindSignalToText', () => {
    it('should set initial text content', () => {
      const sig = mockSignal('hello');
      const textNode = document.createTextNode('');
      bindSignalToText(sig, textNode);
      expect(textNode.data).toBe('hello');
    });

    it('should update text node when signal changes', () => {
      const sig = mockSignal('hello');
      const textNode = document.createTextNode('');
      bindSignalToText(sig, textNode);
      sig.set('world');
      expect(textNode.data).toBe('world');
    });

    it('should cleanup subscription on dispose', () => {
      const sig = mockSignal('hello');
      const textNode = document.createTextNode('');
      const cleanup = bindSignalToText(sig, textNode);
      cleanup();
      sig.set('world');
      expect(textNode.data).toBe('hello'); // not updated
    });

    it('should convert non-string values to string', () => {
      const sig = mockSignal(42 as unknown);
      const textNode = document.createTextNode('');
      bindSignalToText(sig, textNode);
      expect(textNode.data).toBe('42');
    });
  });

  describe('bindSignalToAttribute', () => {
    it('should set initial attribute', () => {
      const sig = mockSignal('test-value');
      const el = document.createElement('div');
      bindSignalToAttribute(sig, el, 'data-test');
      expect(el.getAttribute('data-test')).toBe('test-value');
    });

    it('should remove attribute on false/null', () => {
      const sig = mockSignal<unknown>('initial');
      const el = document.createElement('div');
      bindSignalToAttribute(sig, el, 'data-test');
      sig.set(null);
      expect(el.hasAttribute('data-test')).toBe(false);
    });

    it('should set empty attribute for boolean true', () => {
      const sig = mockSignal<unknown>(true);
      const el = document.createElement('input');
      bindSignalToAttribute(sig, el, 'disabled');
      expect(el.getAttribute('disabled')).toBe('');
    });
  });

  describe('bindSignalToStyle', () => {
    it('should set initial style', () => {
      const sig = mockSignal('red');
      const el = document.createElement('div');
      bindSignalToStyle(sig, el, 'color');
      expect(el.style.color).toBe('red');
    });

    it('should update style when signal changes', () => {
      const sig = mockSignal('red');
      const el = document.createElement('div');
      bindSignalToStyle(sig, el, 'color');
      sig.set('blue');
      expect(el.style.color).toBe('blue');
    });
  });

  describe('bindSignalToClass', () => {
    it('should set initial className', () => {
      const sig = mockSignal('btn primary');
      const el = document.createElement('div');
      bindSignalToClass(sig, el);
      expect(el.className).toBe('btn primary');
    });

    it('should update className when signal changes', () => {
      const sig = mockSignal('btn');
      const el = document.createElement('div');
      bindSignalToClass(sig, el);
      sig.set('btn active');
      expect(el.className).toBe('btn active');
    });
  });
});
