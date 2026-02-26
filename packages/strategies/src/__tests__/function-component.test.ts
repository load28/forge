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
});
