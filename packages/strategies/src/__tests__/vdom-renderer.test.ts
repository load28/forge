import { describe, it, expect } from 'vitest';
import { vdomRenderer } from '../vdom-renderer/index';
import { h } from '@forge/primitives';

describe('vdomRenderer strategy', () => {
  it('should implement Renderer protocol', () => {
    const renderer = vdomRenderer();
    expect(renderer.createView).toBeTypeOf('function');
    expect(renderer.mount).toBeTypeOf('function');
    expect(renderer.update).toBeTypeOf('function');
    expect(renderer.replace).toBeTypeOf('function');
    expect(renderer.unmount).toBeTypeOf('function');
  });

  it('h() should create VNodes', () => {
    const vnode = h('div', { id: 'app' }, h('span', null, 'hi'));
    expect(vnode.tag).toBe('div');
    expect(vnode.props).toEqual({ id: 'app' });
  });

  it('should mount a render function', () => {
    const renderer = vdomRenderer();
    const container = document.createElement('div');

    const view = renderer.createViewFromFn(() => h('p', null, 'hello'));
    const handle = renderer.mount(view, container);

    expect(container.innerHTML).toBe('<p>hello</p>');
    expect(handle.container).toBe(container);
  });

  it('should update on re-render', () => {
    const renderer = vdomRenderer();
    const container = document.createElement('div');
    let text = 'old';

    const view = renderer.createViewFromFn(() => h('p', null, text));
    const handle = renderer.mount(view, container);
    expect(container.innerHTML).toBe('<p>old</p>');

    text = 'new';
    renderer.update(handle);
    expect(container.innerHTML).toBe('<p>new</p>');
  });

  it('should replace view with VDOM diff', () => {
    const renderer = vdomRenderer();
    const container = document.createElement('div');

    const view1 = renderer.createViewFromFn(() => h('p', null, 'old'));
    const handle = renderer.mount(view1, container);
    expect(container.innerHTML).toBe('<p>old</p>');

    const view2 = renderer.createViewFromFn(() => h('p', null, 'new'));
    renderer.replace(handle, view2);
    expect(container.innerHTML).toBe('<p>new</p>');
  });

  it('should use new renderFn after replace', () => {
    const renderer = vdomRenderer();
    const container = document.createElement('div');
    let text = 'first';

    const view1 = renderer.createViewFromFn(() => h('div', null, 'original'));
    const handle = renderer.mount(view1, container);
    expect(container.innerHTML).toBe('<div>original</div>');

    const view2 = renderer.createViewFromFn(() => h('div', null, text));
    renderer.replace(handle, view2);
    expect(container.innerHTML).toBe('<div>first</div>');

    text = 'updated';
    renderer.update(handle);
    expect(container.innerHTML).toBe('<div>updated</div>');
  });

  it('should unmount', () => {
    const renderer = vdomRenderer();
    const container = document.createElement('div');

    const view = renderer.createViewFromFn(() => h('div', null, 'bye'));
    const handle = renderer.mount(view, container);
    expect(container.innerHTML).toBe('<div>bye</div>');

    renderer.unmount(handle);
    expect(container.innerHTML).toBe('');
  });
});
