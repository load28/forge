import { describe, it, expect, vi } from 'vitest';
import { createFramework } from '../engine/create-framework';
import type { ReactiveSystem, Renderer, Router, ComponentSystem } from '../protocols/index';

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
});
