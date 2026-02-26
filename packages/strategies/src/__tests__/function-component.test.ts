import { describe, it, expect, vi } from 'vitest';
import { functionComponent } from '../function-component/index';

describe('functionComponent strategy', () => {
  it('should implement ComponentSystem protocol', () => {
    const cs = functionComponent();
    expect(cs.define).toBeTypeOf('function');
    expect(cs.instantiate).toBeTypeOf('function');
    expect(cs.destroy).toBeTypeOf('function');
    expect(cs.provide).toBeTypeOf('function');
    expect(cs.inject).toBeTypeOf('function');
    expect(cs.onAttach).toBeTypeOf('function');
    expect(cs.onDetach).toBeTypeOf('function');
  });

  it('should define and instantiate a function component', () => {
    const cs = functionComponent();
    const renderFn = vi.fn((props: any) => () => 'Hello ' + props.name);
    const handle = cs.define(renderFn);
    const instance = cs.instantiate(handle, { name: 'World' });
    expect(renderFn).toHaveBeenCalledWith({ name: 'World' });
    expect(instance.render()).toBe('Hello World');
  });

  it('should run onAttach hooks and return cleanup', () => {
    const cs = functionComponent();
    const cleanup = vi.fn();
    const attach = vi.fn(() => cleanup);

    const handle = cs.define((props: any) => {
      cs.onAttach(attach);
      return () => 'test';
    });

    const instance = cs.instantiate(handle, {});
    instance.attach();
    expect(attach).toHaveBeenCalledTimes(1);

    instance.detach();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('should run onDetach hooks', () => {
    const cs = functionComponent();
    const detachHook = vi.fn();

    const handle = cs.define((props: any) => {
      cs.onDetach(detachHook);
      return () => 'test';
    });

    const instance = cs.instantiate(handle, {});
    instance.detach();
    expect(detachHook).toHaveBeenCalledTimes(1);
  });

  it('should support provide/inject context', () => {
    const cs = functionComponent();
    const key = { _brand: Symbol('theme') } as any;

    cs.provide(key, 'dark');
    expect(cs.inject(key)).toBe('dark');
  });

  it('should return fallback when context not found', () => {
    const cs = functionComponent();
    const key = { _brand: Symbol('missing') } as any;
    expect(cs.inject(key, 'fallback')).toBe('fallback');
  });

  it('should throw when context not found and no fallback', () => {
    const cs = functionComponent();
    const key = { _brand: Symbol('missing') } as any;
    expect(() => cs.inject(key)).toThrow('Context not found');
  });

  // A-FC-1: Tree-scoped context tests
  it('should scope context to component tree (child sees parent context)', () => {
    const cs = functionComponent();
    const themeKey = { _brand: Symbol('theme') } as any;

    // Parent provides 'dark'
    const parentHandle = cs.define(() => {
      cs.provide(themeKey, 'dark');

      // Child instantiated during parent factory should see parent's context
      const childHandle = cs.define(() => {
        const theme = cs.inject(themeKey);
        return () => theme;
      });
      const child = cs.instantiate(childHandle, {});
      expect(child.render()).toBe('dark');

      return () => 'parent';
    });

    cs.instantiate(parentHandle, {});
  });

  it('should allow child to override parent context', () => {
    const cs = functionComponent();
    const themeKey = { _brand: Symbol('theme') } as any;

    const parentHandle = cs.define(() => {
      cs.provide(themeKey, 'dark');

      // Child overrides with 'light'
      const childHandle = cs.define(() => {
        cs.provide(themeKey, 'light');
        const theme = cs.inject(themeKey);
        return () => theme;
      });
      const child = cs.instantiate(childHandle, {});
      expect(child.render()).toBe('light');

      // Parent still sees 'dark'
      expect(cs.inject(themeKey)).toBe('dark');

      return () => 'parent';
    });

    cs.instantiate(parentHandle, {});
  });

  it('should isolate sibling component contexts', () => {
    const cs = functionComponent();
    const key = { _brand: Symbol('data') } as any;

    // Sibling A provides 'A' and captures the value during instantiation
    let sibAValue: string | undefined;
    const sibAHandle = cs.define(() => {
      cs.provide(key, 'A');
      sibAValue = cs.inject(key);
      return () => sibAValue;
    });

    // Sibling B should not see A's value — captures fallback during instantiation
    let sibBValue: string | undefined;
    const sibBHandle = cs.define(() => {
      sibBValue = cs.inject(key, 'fallback');
      return () => sibBValue;
    });

    cs.instantiate(sibAHandle, {});
    expect(sibAValue).toBe('A');

    cs.instantiate(sibBHandle, {});
    expect(sibBValue).toBe('fallback');
  });

  // BUG-15: Nested instantiation hook context
  it('should not corrupt hooks in nested component instantiation', () => {
    const cs = functionComponent();
    const outerDetach = vi.fn();
    const innerDetach = vi.fn();

    const innerHandle = cs.define(() => {
      cs.onDetach(innerDetach);
      return () => 'inner';
    });

    const outerHandle = cs.define(() => {
      cs.onDetach(outerDetach);
      // Nested instantiation
      const inner = cs.instantiate(innerHandle, {});
      return () => 'outer';
    });

    const outer = cs.instantiate(outerHandle, {});

    // Only outer's detach should run
    outer.detach();
    expect(outerDetach).toHaveBeenCalledTimes(1);
    expect(innerDetach).not.toHaveBeenCalled();
  });
});
