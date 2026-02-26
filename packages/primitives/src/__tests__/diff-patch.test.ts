import { describe, it, expect } from 'vitest';
import { h } from '../dom/vnode';
import { mount, patch } from '../dom/patch';

describe('mount', () => {
  it('should mount text', () => {
    const container = document.createElement('div');
    mount(h('p', null, 'hello'), container);
    expect(container.innerHTML).toBe('<p>hello</p>');
  });

  it('should mount nested elements', () => {
    const container = document.createElement('div');
    mount(h('div', { id: 'app' }, h('span', null, 'child')), container);
    expect(container.innerHTML).toBe('<div id="app"><span>child</span></div>');
  });

  it('should mount with event listeners', () => {
    const container = document.createElement('div');
    let clicked = false;
    mount(h('button', { onClick: () => { clicked = true; } }, 'click'), container);
    (container.firstChild as HTMLElement).click();
    expect(clicked).toBe(true);
  });
});

describe('patch', () => {
  it('should update text content', () => {
    const container = document.createElement('div');
    const oldVNode = h('p', null, 'old');
    mount(oldVNode, container);
    expect(container.innerHTML).toBe('<p>old</p>');

    const newVNode = h('p', null, 'new');
    patch(oldVNode, newVNode, container);
    expect(container.innerHTML).toBe('<p>new</p>');
  });

  it('should update props', () => {
    const container = document.createElement('div');
    const oldVNode = h('div', { id: 'a', class: 'old' });
    mount(oldVNode, container);

    const newVNode = h('div', { id: 'b' });
    patch(oldVNode, newVNode, container);
    const el = container.firstChild as HTMLElement;
    expect(el.id).toBe('b');
    expect(el.getAttribute('class')).toBeNull();
  });

  it('should replace element when tag changes', () => {
    const container = document.createElement('div');
    const oldVNode = h('div', null, 'hello');
    mount(oldVNode, container);

    const newVNode = h('span', null, 'hello');
    patch(oldVNode, newVNode, container);
    expect(container.innerHTML).toBe('<span>hello</span>');
  });

  it('should add and remove children', () => {
    const container = document.createElement('div');
    const old = h('ul', null, h('li', null, '1'));
    mount(old, container);
    expect(container.querySelectorAll('li')).toHaveLength(1);

    const next = h('ul', null, h('li', null, '1'), h('li', null, '2'));
    patch(old, next, container);
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });
});
