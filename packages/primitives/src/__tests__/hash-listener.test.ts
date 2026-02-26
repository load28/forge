import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHashListener } from '../routing/hash-listener';

describe('HashListener', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('should return current hash path', () => {
    window.location.hash = '#/about';
    const listener = createHashListener();
    expect(listener.getPath()).toBe('/about');
    listener.destroy();
  });

  it('should default to / when no hash', () => {
    window.location.hash = '';
    const listener = createHashListener();
    expect(listener.getPath()).toBe('/');
    listener.destroy();
  });

  it('should notify on hash change', () => {
    window.location.hash = '#/';
    const listener = createHashListener();
    const fn = vi.fn();
    listener.onChange(fn);

    window.location.hash = '#/about';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(fn).toHaveBeenCalledWith('/about');
    listener.destroy();
  });

  it('should set hash via setPath', () => {
    const listener = createHashListener();
    listener.setPath('/contact');
    expect(window.location.hash).toBe('#/contact');
    listener.destroy();
  });
});
