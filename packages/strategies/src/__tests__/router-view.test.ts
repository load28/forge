import { describe, it, expect, vi } from 'vitest';
import { createFramework } from '@forge/core';
import { signalReactive, vdomRenderer, hashRouter, functionComponent, routerView } from '../index';

describe('routerView plugin', () => {
  function setup() {
    const reactive = signalReactive();
    const renderer = vdomRenderer();
    const router = hashRouter();
    const component = functionComponent();
    return { reactive, renderer, router, component };
  }

  it('should register routes on mount', () => {
    const { reactive, renderer, router, component } = setup();
    const registerSpy = vi.spyOn(router, 'register');

    const app = createFramework({ reactive, renderer, component, router });
    app.use(routerView([
      { path: '/', component: () => () => renderer.h('div', null, 'home') },
      { path: '/about', component: () => () => renderer.h('div', null, 'about') },
    ]));

    const container = document.createElement('div');
    app.mount(container);

    expect(registerSpy).toHaveBeenCalledTimes(2);
  });

  it('should render initial route component', () => {
    const { reactive, renderer, router, component } = setup();

    // Set hash to root before mounting
    window.location.hash = '#/';

    const app = createFramework({ reactive, renderer, component, router });
    app.use(routerView([
      { path: '/', component: () => () => renderer.h('div', null, 'Home Page') },
      { path: '/counter', component: () => () => renderer.h('div', null, 'Counter') },
    ]));

    const container = document.createElement('div');
    app.mount(container);

    expect(container.innerHTML).toBe('<div>Home Page</div>');
  });

  it('should swap component on route change', async () => {
    const { reactive, renderer, router, component } = setup();

    window.location.hash = '#/';

    const app = createFramework({ reactive, renderer, component, router });
    app.use(routerView([
      { path: '/', component: () => () => renderer.h('div', null, 'Home') },
      { path: '/other', component: () => () => renderer.h('div', null, 'Other') },
    ]));

    const container = document.createElement('div');
    app.mount(container);
    expect(container.innerHTML).toBe('<div>Home</div>');

    // Navigate
    window.location.hash = '#/other';
    // hashchange is async — wait for it
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(container.innerHTML).toBe('<div>Other</div>');
  });

  it('should cleanup on unmount', () => {
    const { reactive, renderer, router, component } = setup();

    window.location.hash = '#/';

    const app = createFramework({ reactive, renderer, component, router });
    app.use(routerView([
      { path: '/', component: () => () => renderer.h('div', null, 'Home') },
    ]));

    const container = document.createElement('div');
    const handle = app.mount(container);
    expect(container.innerHTML).toBe('<div>Home</div>');

    app.unmount(handle);
    expect(container.innerHTML).toBe('');
  });
});
