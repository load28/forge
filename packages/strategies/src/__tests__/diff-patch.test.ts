import { describe, it, expect, vi } from 'vitest';
import { createVNode as h, Fragment } from '@forge/primitives';
import { mount, patch, unmount } from '../vdom-renderer/patch';

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

  // New: Boolean attribute handling
  it('should handle boolean attributes', () => {
    const container = document.createElement('div');
    mount(h('input', { disabled: true, readonly: false }), container);
    const el = container.firstChild as HTMLElement;
    expect(el.hasAttribute('disabled')).toBe(true);
    expect(el.hasAttribute('readonly')).toBe(false);
  });

  it('should handle null/undefined attribute values', () => {
    const container = document.createElement('div');
    mount(h('div', { 'data-value': null as any, 'data-other': undefined as any }), container);
    const el = container.firstChild as HTMLElement;
    expect(el.hasAttribute('data-value')).toBe(false);
    expect(el.hasAttribute('data-other')).toBe(false);
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

  // New: Text node indexing stability
  it('should correctly patch multiple text children', () => {
    const container = document.createElement('div');
    const old = h('div', null, 'a', 'b', 'c');
    mount(old, container);
    expect(container.innerHTML).toBe('<div>abc</div>');

    const next = h('div', null, 'x', 'y', 'z');
    patch(old, next, container);
    expect(container.innerHTML).toBe('<div>xyz</div>');
  });

  it('should patch mixed vnode and text children', () => {
    const container = document.createElement('div');
    const old = h('div', null, 'text1', h('span', null, 'elem'), 'text2');
    mount(old, container);
    expect(container.innerHTML).toBe('<div>text1<span>elem</span>text2</div>');

    const next = h('div', null, 'changed1', h('span', null, 'changed'), 'changed2');
    patch(old, next, container);
    expect(container.innerHTML).toBe('<div>changed1<span>changed</span>changed2</div>');
  });

  // New: Boolean/null attribute patching
  it('should handle patching boolean attributes', () => {
    const container = document.createElement('div');
    const old = h('input', { disabled: true });
    mount(old, container);
    const el = container.firstChild as HTMLElement;
    expect(el.hasAttribute('disabled')).toBe(true);

    const next = h('input', { disabled: false });
    patch(old, next, container);
    expect(el.hasAttribute('disabled')).toBe(false);
  });

  // New: Event handler stability
  it('should update event handlers without adding duplicates', () => {
    const container = document.createElement('div');
    let count = 0;

    const old = h('button', { onClick: () => { count += 1; } }, 'click');
    mount(old, container);
    const btn = container.firstChild as HTMLElement;
    btn.click();
    expect(count).toBe(1);

    // Update handler
    const next = h('button', { onClick: () => { count += 10; } }, 'click');
    patch(old, next, container);
    btn.click();
    expect(count).toBe(11); // Should use new handler, not accumulate
  });

  // New: Key-based reconciliation
  it('should reorder keyed children', () => {
    const container = document.createElement('div');
    const old = h('ul', null,
      h('li', { key: 'a' }, 'A'),
      h('li', { key: 'b' }, 'B'),
      h('li', { key: 'c' }, 'C'),
    );
    mount(old, container);
    expect(container.innerHTML).toBe('<ul><li>A</li><li>B</li><li>C</li></ul>');

    // Reorder: C, A, B
    const next = h('ul', null,
      h('li', { key: 'c' }, 'C'),
      h('li', { key: 'a' }, 'A'),
      h('li', { key: 'b' }, 'B'),
    );
    patch(old, next, container);
    expect(container.innerHTML).toBe('<ul><li>C</li><li>A</li><li>B</li></ul>');
  });

  it('should add and remove keyed children', () => {
    const container = document.createElement('div');
    const old = h('ul', null,
      h('li', { key: 'a' }, 'A'),
      h('li', { key: 'b' }, 'B'),
    );
    mount(old, container);

    const next = h('ul', null,
      h('li', { key: 'b' }, 'B'),
      h('li', { key: 'c' }, 'C'),
    );
    patch(old, next, container);
    expect(container.innerHTML).toBe('<ul><li>B</li><li>C</li></ul>');
  });

  // TC-03: key should not appear as DOM attribute
  it('should not render key as DOM attribute', () => {
    const container = document.createElement('div');
    mount(h('div', { key: 'mykey', id: 'test' }), container);
    const el = container.firstChild as HTMLElement;
    expect(el.hasAttribute('key')).toBe(false);
    expect(el.id).toBe('test');
  });

  // TC-06: Reduced blocklist — style and template should work
  it('should allow style elements', () => {
    const container = document.createElement('div');
    expect(() => mount(h('style', null, '.foo { color: red }'), container)).not.toThrow();
  });

  it('should allow template elements', () => {
    const container = document.createElement('div');
    expect(() => mount(h('template', null), container)).not.toThrow();
  });

  // Security: dangerous tags still blocked
  it('should block script tags', () => {
    const container = document.createElement('div');
    expect(() => mount(h('script', null), container)).toThrow('blocked for security');
  });

  it('should block iframe tags', () => {
    const container = document.createElement('div');
    expect(() => mount(h('iframe', null), container)).toThrow('blocked for security');
  });

  // TC-02: Fragment support
  it('should render Fragment children without wrapper element', () => {
    const container = document.createElement('div');
    mount(h(Fragment, null, h('span', null, 'a'), h('span', null, 'b')), container);
    expect(container.innerHTML).toBe('<span>a</span><span>b</span>');
  });

  it('should render Fragment with text children', () => {
    const container = document.createElement('div');
    mount(h(Fragment, null, 'hello', ' ', 'world'), container);
    expect(container.textContent).toBe('hello world');
  });

  // P1: Fragment patch — children should update correctly after mount
  it('should patch Fragment children after mount', () => {
    const container = document.createElement('div');
    const old = h(Fragment, null, h('span', null, 'a'), h('span', null, 'b'));
    mount(old, container);
    expect(container.innerHTML).toBe('<span>a</span><span>b</span>');

    const next = h(Fragment, null, h('span', null, 'x'), h('span', null, 'y'));
    patch(old, next, container);
    expect(container.innerHTML).toBe('<span>x</span><span>y</span>');
  });

  it('should patch Fragment with added/removed children', () => {
    const container = document.createElement('div');
    const old = h(Fragment, null, h('p', null, '1'));
    mount(old, container);
    expect(container.innerHTML).toBe('<p>1</p>');

    const next = h(Fragment, null, h('p', null, '1'), h('p', null, '2'));
    patch(old, next, container);
    expect(container.innerHTML).toBe('<p>1</p><p>2</p>');
  });

  // P1: Fragment unmount should remove child nodes
  it('should unmount Fragment children', () => {
    const container = document.createElement('div');
    const vnode = h(Fragment, null, h('span', null, 'a'), h('span', null, 'b'));
    mount(vnode, container);
    expect(container.innerHTML).toBe('<span>a</span><span>b</span>');

    unmount(vnode);
    expect(container.innerHTML).toBe('');
  });

  // P1: Fragment → Element tag change
  it('should handle Fragment to element tag change', () => {
    const container = document.createElement('div');
    const old = h(Fragment, null, h('span', null, 'a'), h('span', null, 'b'));
    mount(old, container);
    expect(container.innerHTML).toBe('<span>a</span><span>b</span>');

    const next = h('div', null, 'replaced');
    patch(old, next, container);
    expect(container.innerHTML).toBe('<div>replaced</div>');
  });

  // P1: Element → Fragment tag change
  it('should handle element to Fragment tag change', () => {
    const container = document.createElement('div');
    const old = h('div', null, 'original');
    mount(old, container);
    expect(container.innerHTML).toBe('<div>original</div>');

    const next = h(Fragment, null, h('span', null, 'a'), h('span', null, 'b'));
    patch(old, next, container);
    expect(container.innerHTML).toBe('<span>a</span><span>b</span>');
  });

  // TC-04: ref callback
  it('should call ref callback with element on mount', () => {
    const container = document.createElement('div');
    let refEl: Element | null = null;
    mount(h('div', { ref: (el: Element | null) => { refEl = el; }, id: 'test' }), container);
    expect(refEl).not.toBeNull();
    expect((refEl as HTMLElement).id).toBe('test');
  });

  // TC-08: Event handler cleanup
  it('should remove event handler when on* becomes null', () => {
    const container = document.createElement('div');
    let count = 0;
    const old = h('button', { onClick: () => { count++; } }, 'btn');
    mount(old, container);
    const btn = container.firstChild as HTMLElement;
    btn.click();
    expect(count).toBe(1);

    // Patch to null handler — should remove event listener
    const next = h('button', { onClick: null as any }, 'btn');
    patch(old, next, container);
    btn.click();
    expect(count).toBe(1); // should not increment
  });
});
