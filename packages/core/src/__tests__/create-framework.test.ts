import { describe, it, expect, vi } from 'vitest';
import { createFramework } from '../engine/create-framework';
import type { ReactiveSystem, Renderer, Router, ComponentSystem } from '../protocols/index';
import type { Disposable } from '../types';

function mockReactive(): ReactiveSystem {
  return {
    autorun(fn) {
      fn();
      return { dispose: () => {} };
    },
    batch(fn) { fn(); },
  };
}

function mockRenderer(): Renderer {
  return {
    createView: vi.fn(() => ({})),
    mount: vi.fn((view, container) => ({ container })),
    update: vi.fn(),
    replace: vi.fn((handle, _newView) => handle),
    unmount: vi.fn(),
  };
}

function mockComponent(): ComponentSystem {
  return {
    define: vi.fn((def) => ({ _brand: Symbol() as any })),
    instantiate: vi.fn((handle, props) => ({})),
    destroy: vi.fn(),
    provide: vi.fn(),
    inject: vi.fn(),
    onAttach: vi.fn(),
    onDetach: vi.fn(),
  };
}

describe('createFramework', () => {
  it('should create a framework from config', () => {
    const fw = createFramework({
      reactive: mockReactive(),
      renderer: mockRenderer(),
      component: mockComponent(),
    });

    expect(fw).toBeDefined();
    expect(fw.reactive).toBeDefined();
    expect(fw.renderer).toBeDefined();
    expect(fw.component).toBeDefined();
    expect(fw.mount).toBeTypeOf('function');
    expect(fw.unmount).toBeTypeOf('function');
    expect(fw.createView).toBeTypeOf('function');
  });

  it('should throw if reactive is missing', () => {
    expect(() => createFramework({
      reactive: undefined as any,
      renderer: mockRenderer(),
      component: mockComponent(),
    })).toThrow('reactive');
  });

  it('should throw if renderer is missing', () => {
    expect(() => createFramework({
      reactive: mockReactive(),
      renderer: undefined as any,
      component: mockComponent(),
    })).toThrow('renderer');
  });

  it('should throw if component is missing', () => {
    expect(() => createFramework({
      reactive: mockReactive(),
      renderer: mockRenderer(),
      component: undefined as any,
    })).toThrow('component');
  });

  it('should accept optional router', () => {
    const router: Router = {
      current: () => ({}),
      onChange: () => ({ dispose: () => {} }),
      go: () => {},
      register: () => ({ dispose: () => {} }),
    };

    const fw = createFramework({
      reactive: mockReactive(),
      renderer: mockRenderer(),
      component: mockComponent(),
      router,
    });

    expect(fw.router).toBe(router);
  });

  it('mount should call component.define, renderer.createView, renderer.mount', () => {
    const renderer = mockRenderer();
    const component = mockComponent();

    const fw = createFramework({
      reactive: mockReactive(),
      renderer,
      component,
    });

    const container = document.createElement('div');
    fw.mount(container, () => 'test', { name: 'test' });

    expect(component.define).toHaveBeenCalled();
    expect(renderer.createView).toHaveBeenCalled();
    expect(renderer.mount).toHaveBeenCalled();
  });

  // ARCH-1: Plugin system tests
  it('should support plugins via config', () => {
    const installFn = vi.fn();
    const plugin = { name: 'test-plugin', install: installFn };

    const fw = createFramework({
      reactive: mockReactive(),
      renderer: mockRenderer(),
      component: mockComponent(),
      plugins: [plugin],
    });

    expect(installFn).toHaveBeenCalledWith(fw);
  });

  it('should support runtime plugin registration via use()', () => {
    const fw = createFramework({
      reactive: mockReactive(),
      renderer: mockRenderer(),
      component: mockComponent(),
    });

    const installFn = vi.fn();
    const result = fw.use({ name: 'runtime-plugin', install: installFn });
    expect(installFn).toHaveBeenCalledWith(fw);
    expect(result).toBe(fw); // chainable
  });

  it('should call plugin beforeMount/afterMount hooks', () => {
    const beforeMount = vi.fn();
    const afterMount = vi.fn();
    const plugin = { name: 'lifecycle-plugin', beforeMount, afterMount };

    const fw = createFramework({
      reactive: mockReactive(),
      renderer: mockRenderer(),
      component: mockComponent(),
      plugins: [plugin],
    });

    const container = document.createElement('div');
    fw.mount(container, () => 'test');

    expect(beforeMount).toHaveBeenCalledTimes(1);
    expect(afterMount).toHaveBeenCalledTimes(1);
  });

  it('should call plugin beforeUnmount hook', () => {
    const beforeUnmount = vi.fn();
    const plugin = { name: 'unmount-plugin', beforeUnmount };

    const fw = createFramework({
      reactive: mockReactive(),
      renderer: mockRenderer(),
      component: mockComponent(),
      plugins: [plugin],
    });

    const container = document.createElement('div');
    const handle = fw.mount(container, () => 'test');
    fw.unmount(handle);

    expect(beforeUnmount).toHaveBeenCalledTimes(1);
  });

  // --- createView API tests ---

  it('createView should return a ViewHandle with replace and destroy', () => {
    const fw = createFramework({
      reactive: mockReactive(),
      renderer: mockRenderer(),
      component: mockComponent(),
    });

    const container = document.createElement('div');
    const viewHandle = fw.createView(container, () => 'test');

    expect(viewHandle.replace).toBeTypeOf('function');
    expect(viewHandle.destroy).toBeTypeOf('function');
  });

  it('createView should delegate to renderer.mount', () => {
    const renderer = mockRenderer();
    const fw = createFramework({
      reactive: mockReactive(),
      renderer,
      component: mockComponent(),
    });

    const container = document.createElement('div');
    fw.createView(container, () => 'test');

    expect(renderer.createView).toHaveBeenCalled();
    expect(renderer.mount).toHaveBeenCalled();
  });

  it('viewHandle.replace should delegate to renderer.replace', () => {
    const renderer = mockRenderer();
    const fw = createFramework({
      reactive: mockReactive(),
      renderer,
      component: mockComponent(),
    });

    const container = document.createElement('div');
    const viewHandle = fw.createView(container, () => 'old');
    viewHandle.replace(() => 'new');

    expect(renderer.replace).toHaveBeenCalled();
  });

  it('viewHandle.destroy should delegate to renderer.unmount', () => {
    const renderer = mockRenderer();
    const fw = createFramework({
      reactive: mockReactive(),
      renderer,
      component: mockComponent(),
    });

    const container = document.createElement('div');
    const viewHandle = fw.createView(container, () => 'test');
    viewHandle.destroy();

    expect(renderer.unmount).toHaveBeenCalled();
  });

  // --- Plugin view() lifecycle tests ---

  it('should call plugin view() during mount', () => {
    const viewFn = vi.fn(() => ({ destroy: vi.fn() }));
    const plugin = { name: 'view-plugin', view: viewFn };

    const fw = createFramework({
      reactive: mockReactive(),
      renderer: mockRenderer(),
      component: mockComponent(),
      plugins: [plugin],
    });

    const container = document.createElement('div');
    fw.mount(container, () => 'test');

    expect(viewFn).toHaveBeenCalledWith(fw, container);
  });

  it('should call plugin view destroy on unmount', () => {
    const destroyFn = vi.fn();
    const plugin = { name: 'view-plugin', view: () => ({ destroy: destroyFn }) };

    const fw = createFramework({
      reactive: mockReactive(),
      renderer: mockRenderer(),
      component: mockComponent(),
      plugins: [plugin],
    });

    const container = document.createElement('div');
    const handle = fw.mount(container, () => 'test');
    fw.unmount(handle);

    expect(destroyFn).toHaveBeenCalledTimes(1);
  });

  it('mount without componentDef should work for plugin-driven rendering', () => {
    const viewFn = vi.fn(() => ({ destroy: vi.fn() }));
    const plugin = { name: 'view-plugin', view: viewFn };

    const fw = createFramework({
      reactive: mockReactive(),
      renderer: mockRenderer(),
      component: mockComponent(),
      plugins: [plugin],
    });

    const container = document.createElement('div');
    const handle = fw.mount(container);

    expect(handle).toBeDefined();
    expect(handle.container).toBe(container);
    expect(viewFn).toHaveBeenCalledWith(fw, container);
  });
});
