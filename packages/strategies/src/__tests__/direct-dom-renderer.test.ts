import { describe, it, expect, vi } from 'vitest';
import { directDomRenderer } from '../direct-dom-renderer/index';
import { signalReactive } from '../signal-reactive/index';
import { h, Fragment } from '@forge/primitives';

function setup() {
  const reactive = signalReactive();
  const renderer = directDomRenderer(reactive);
  const container = document.createElement('div');
  return { reactive, renderer, container };
}

describe('directDomRenderer strategy', () => {
  // ---- Protocol Conformance ----

  it('should implement Renderer protocol', () => {
    const { renderer } = setup();
    expect(renderer.createView).toBeTypeOf('function');
    expect(renderer.createViewFromFn).toBeTypeOf('function');
    expect(renderer.mount).toBeTypeOf('function');
    expect(renderer.update).toBeTypeOf('function');
    expect(renderer.replace).toBeTypeOf('function');
    expect(renderer.unmount).toBeTypeOf('function');
  });

  it('h() should return real DOM nodes, not VNodes', () => {
    setup();
    const result = h('div', { id: 'app' });
    expect(result).toBeInstanceOf(HTMLElement);
    expect((result as HTMLElement).tagName).toBe('DIV');
    expect((result as HTMLElement).id).toBe('app');
  });

  // ---- Static DOM Creation ----

  it('should create an element with attributes', () => {
    const { renderer, container } = setup();
    const view = renderer.createViewFromFn(() => h('div', { id: 'test', class: 'box' }));
    renderer.mount(view, container);

    const el = container.querySelector('div')!;
    expect(el).toBeTruthy();
    expect(el.id).toBe('test');
    expect(el.className).toBe('box');
  });

  it('should create nested elements', () => {
    const { renderer, container } = setup();
    const view = renderer.createViewFromFn(() =>
      h('div', null, h('span', null, 'hello')),
    );
    renderer.mount(view, container);

    expect(container.innerHTML).toBe('<div><span>hello</span></div>');
  });

  it('should create text nodes for string children', () => {
    const { renderer, container } = setup();
    const view = renderer.createViewFromFn(() => h('p', null, 'text'));
    renderer.mount(view, container);
    expect(container.innerHTML).toBe('<p>text</p>');
  });

  it('should create text nodes for number children', () => {
    const { renderer, container } = setup();
    const view = renderer.createViewFromFn(() => h('p', null, 42));
    renderer.mount(view, container);
    expect(container.innerHTML).toBe('<p>42</p>');
  });

  it('should skip null, undefined, false, true children', () => {
    const { renderer, container } = setup();
    const view = renderer.createViewFromFn(() =>
      h('div', null, 'a', null, undefined, false, true, 'b'),
    );
    renderer.mount(view, container);
    expect(container.innerHTML).toBe('<div>ab</div>');
  });

  it('should flatten nested arrays of children', () => {
    const { renderer, container } = setup();
    const view = renderer.createViewFromFn(() =>
      h('ul', null, ...[h('li', null, '1'), h('li', null, '2')]),
    );
    renderer.mount(view, container);
    expect(container.innerHTML).toBe('<ul><li>1</li><li>2</li></ul>');
  });

  it('should handle Fragment', () => {
    const { renderer, container } = setup();
    const view = renderer.createViewFromFn(() =>
      h(Fragment, null, h('span', null, 'a'), h('span', null, 'b')),
    );
    renderer.mount(view, container);
    expect(container.innerHTML).toBe('<span>a</span><span>b</span>');
  });

  // ---- Event Handling ----

  it('should attach onClick as click event listener', () => {
    const { renderer, container } = setup();
    const clicked = vi.fn();
    const view = renderer.createViewFromFn(() =>
      h('button', { onClick: clicked }, 'click me'),
    );
    renderer.mount(view, container);

    const btn = container.querySelector('button')!;
    btn.click();
    expect(clicked).toHaveBeenCalledTimes(1);
  });

  it('should remove event listeners on unmount', () => {
    const { renderer, container } = setup();
    const clicked = vi.fn();
    const view = renderer.createViewFromFn(() =>
      h('button', { onClick: clicked }, 'click me'),
    );
    const handle = renderer.mount(view, container);

    const btn = container.querySelector('button')!;
    renderer.unmount(handle);

    // Button is removed from DOM, but we can still check that it was cleaned up
    btn.click();
    // After unmount, listener should be removed
    expect(clicked).toHaveBeenCalledTimes(0);
  });

  // ---- Fine-Grained Reactivity ----

  it('should update text when reactive function child changes', () => {
    const { reactive, renderer, container } = setup();
    const count = reactive.signal(0);

    const view = renderer.createViewFromFn(() =>
      h('p', null, () => 'Count: ' + count.get()),
    );
    renderer.mount(view, container);

    expect(container.textContent).toBe('Count: 0');

    count.set(5);
    expect(container.textContent).toBe('Count: 5');
  });

  it('should update attribute when reactive function prop changes', () => {
    const { reactive, renderer, container } = setup();
    const cls = reactive.signal('old');

    const view = renderer.createViewFromFn(() =>
      h('div', { class: () => cls.get() }),
    );
    renderer.mount(view, container);

    expect(container.querySelector('div')!.getAttribute('class')).toBe('old');

    cls.set('new');
    expect(container.querySelector('div')!.getAttribute('class')).toBe('new');
  });

  it('should only update the affected DOM node, not siblings', () => {
    const { reactive, renderer, container } = setup();
    const count = reactive.signal(0);

    const view = renderer.createViewFromFn(() =>
      h('div', null,
        h('span', { id: 'static' }, 'static'),
        h('span', { id: 'dynamic' }, () => String(count.get())),
      ),
    );
    renderer.mount(view, container);

    const staticSpan = container.querySelector('#static')!;
    const dynamicSpan = container.querySelector('#dynamic')!;

    expect(staticSpan.textContent).toBe('static');
    expect(dynamicSpan.textContent).toBe('0');

    count.set(42);
    // Static span should be the exact same DOM node
    expect(container.querySelector('#static')).toBe(staticSpan);
    expect(dynamicSpan.textContent).toBe('42');
  });

  it('should handle conditional rendering', () => {
    const { reactive, renderer, container } = setup();
    const show = reactive.signal(true);

    const view = renderer.createViewFromFn(() =>
      h('div', null,
        () => show.get() ? h('span', null, 'visible') : h('em', null, 'hidden'),
      ),
    );
    renderer.mount(view, container);

    expect(container.querySelector('span')!.textContent).toBe('visible');
    expect(container.querySelector('em')).toBeNull();

    show.set(false);
    expect(container.querySelector('span')).toBeNull();
    expect(container.querySelector('em')!.textContent).toBe('hidden');
  });

  it('should handle list rendering', () => {
    const { reactive, renderer, container } = setup();
    const items = reactive.signal(['a', 'b']);

    const view = renderer.createViewFromFn(() =>
      h('ul', null,
        () => items.get().map((item: string) => h('li', null, item)),
      ),
    );
    renderer.mount(view, container);

    expect(container.querySelectorAll('li').length).toBe(2);
    expect(container.querySelectorAll('li')[0].textContent).toBe('a');
    expect(container.querySelectorAll('li')[1].textContent).toBe('b');

    items.set(['x', 'y', 'z']);
    expect(container.querySelectorAll('li').length).toBe(3);
    expect(container.querySelectorAll('li')[2].textContent).toBe('z');
  });

  // ---- update() No-Op ----

  it('update() should be a no-op and not modify DOM', () => {
    const { renderer, container } = setup();
    const view = renderer.createViewFromFn(() => h('p', null, 'static'));
    const handle = renderer.mount(view, container);

    const htmlBefore = container.innerHTML;
    renderer.update(handle);
    expect(container.innerHTML).toBe(htmlBefore);
  });

  // ---- Cleanup ----

  it('unmount should dispose all reactive effects and remove DOM', () => {
    const { reactive, renderer, container } = setup();
    const count = reactive.signal(0);

    const view = renderer.createViewFromFn(() =>
      h('p', null, () => 'Count: ' + count.get()),
    );
    const handle = renderer.mount(view, container);

    expect(container.textContent).toBe('Count: 0');
    renderer.unmount(handle);
    expect(container.innerHTML).toBe('');

    // Signal change after unmount should have no effect (no errors, no DOM changes)
    count.set(99);
    expect(container.innerHTML).toBe('');
  });

  it('replace should dispose old effects and mount new view', () => {
    const { reactive, renderer, container } = setup();
    const count1 = reactive.signal(0);
    const count2 = reactive.signal(100);

    const view1 = renderer.createViewFromFn(() =>
      h('p', null, () => 'A: ' + count1.get()),
    );
    const handle = renderer.mount(view1, container);
    expect(container.textContent).toBe('A: 0');

    const view2 = renderer.createViewFromFn(() =>
      h('p', null, () => 'B: ' + count2.get()),
    );
    renderer.replace(handle, view2);
    expect(container.textContent).toBe('B: 100');

    // Old signal should have no effect
    count1.set(999);
    expect(container.textContent).toBe('B: 100');

    // New signal should update
    count2.set(200);
    expect(container.textContent).toBe('B: 200');
  });

  // ---- Integration with functionComponent ----

  it('should work with functionComponent pattern', () => {
    const { reactive, renderer, container } = setup();
    const count = reactive.signal(0);

    // Forge component pattern: outer fn is setup, returns lazy render fn
    function Counter() {
      return () => h('p', null, () => 'Count: ' + count.get());
    }

    const handle = { _brand: Symbol() as any, factory: Counter };
    const view = renderer.createView(handle, {});
    renderer.mount(view, container);

    expect(container.textContent).toBe('Count: 0');
    count.set(7);
    expect(container.textContent).toBe('Count: 7');
  });

  // ---- Security ----

  it('should throw on invalid tag names', () => {
    setup();
    expect(() => h('123invalid', null)).toThrow('invalid tag name');
  });

  it('should block script tags', () => {
    setup();
    expect(() => h('script', null)).toThrow('blocked for security');
  });

  it('should warn on javascript: URLs in href', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { renderer, container } = setup();

    const view = renderer.createViewFromFn(() =>
      h('a', { href: 'javascript:alert(1)' }, 'bad'),
    );
    renderer.mount(view, container);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('blocked dangerous URL'));
    expect(container.querySelector('a')!.getAttribute('href')).toBeNull();
    warnSpy.mockRestore();
  });

  it('should block __proto__ prop keys', () => {
    const { renderer, container } = setup();
    const view = renderer.createViewFromFn(() =>
      h('div', { __proto__: 'evil', id: 'safe' }),
    );
    renderer.mount(view, container);

    const el = container.querySelector('div')!;
    expect(el.id).toBe('safe');
    expect(el.getAttribute('__proto__')).toBeNull();
  });

  // ---- className → class mapping ----

  it('should map className to class attribute', () => {
    const { renderer, container } = setup();
    const view = renderer.createViewFromFn(() =>
      h('div', { className: 'foo bar' }),
    );
    renderer.mount(view, container);

    expect(container.querySelector('div')!.getAttribute('class')).toBe('foo bar');
  });

  // ---- Boolean attributes ----

  it('should handle boolean attributes', () => {
    const { renderer, container } = setup();
    const view = renderer.createViewFromFn(() =>
      h('input', { disabled: true, readonly: false }),
    );
    renderer.mount(view, container);

    const input = container.querySelector('input')!;
    expect(input.hasAttribute('disabled')).toBe(true);
    expect(input.hasAttribute('readonly')).toBe(false);
  });

  // ---- Reactive sub-effect cleanup ----

  it('should clean up sub-effects when reactive child re-evaluates', () => {
    const { reactive, renderer, container } = setup();
    const show = reactive.signal(true);
    const inner = reactive.signal('hello');

    const view = renderer.createViewFromFn(() =>
      h('div', null,
        () => show.get()
          ? h('span', null, () => inner.get())
          : h('em', null, 'off'),
      ),
    );
    renderer.mount(view, container);

    expect(container.querySelector('span')!.textContent).toBe('hello');

    // Switch to 'off' — old inner effect should be disposed
    show.set(false);
    expect(container.querySelector('em')!.textContent).toBe('off');

    // Changing inner should NOT update anything (effect was disposed)
    inner.set('world');
    expect(container.querySelector('em')!.textContent).toBe('off');
    expect(container.querySelector('span')).toBeNull();
  });

  // ---- Issue 5: normalizeToNodes consistency ----

  it('should render nothing for function component returning null', () => {
    const { renderer, container } = setup();
    function NullComp() { return null; }
    const view = renderer.createViewFromFn(() =>
      h('div', null, h(NullComp as any, null)),
    );
    renderer.mount(view, container);
    expect(container.innerHTML).toBe('<div></div>');
  });

  it('should render nothing for function component returning false', () => {
    const { renderer, container } = setup();
    function FalseComp() { return false; }
    const view = renderer.createViewFromFn(() =>
      h('div', null, h(FalseComp as any, null)),
    );
    renderer.mount(view, container);
    expect(container.innerHTML).toBe('<div></div>');
  });

  // ---- Issue 2: Reactive text fast path (.data reuse) ----

  it('should reuse Text node when reactive child returns consecutive primitives', () => {
    const { reactive, renderer, container } = setup();
    const text = reactive.signal('hello');

    const view = renderer.createViewFromFn(() =>
      h('p', null, () => text.get()),
    );
    renderer.mount(view, container);

    const p = container.querySelector('p')!;
    const originalTextNode = p.childNodes[0]; // Text node before the comment anchor
    expect(originalTextNode.textContent).toBe('hello');

    text.set('world');
    // Same Text node should be reused (not destroyed/recreated)
    expect(p.childNodes[0]).toBe(originalTextNode);
    expect(originalTextNode.textContent).toBe('world');
  });

  it('should fall back to slow path when reactive child transitions from text to element', () => {
    const { reactive, renderer, container } = setup();
    const useElement = reactive.signal(false);

    const view = renderer.createViewFromFn(() =>
      h('div', null,
        () => useElement.get() ? h('span', null, 'element') : 'text',
      ),
    );
    renderer.mount(view, container);
    expect(container.textContent).toBe('text');

    useElement.set(true);
    expect(container.querySelector('span')!.textContent).toBe('element');
  });

  it('should reuse Text node for number reactive children', () => {
    const { reactive, renderer, container } = setup();
    const num = reactive.signal(0);

    const view = renderer.createViewFromFn(() =>
      h('p', null, () => num.get()),
    );
    renderer.mount(view, container);

    const p = container.querySelector('p')!;
    const originalTextNode = p.childNodes[0];
    expect(originalTextNode.textContent).toBe('0');

    num.set(42);
    expect(p.childNodes[0]).toBe(originalTextNode);
    expect(originalTextNode.textContent).toBe('42');
  });

  // ---- Issue 6: style object prop support ----

  it('should handle static style object', () => {
    const { renderer, container } = setup();
    const view = renderer.createViewFromFn(() =>
      h('div', { style: { color: 'red', fontSize: '14px' } }),
    );
    renderer.mount(view, container);

    const el = container.querySelector('div') as HTMLElement;
    expect(el.style.color).toBe('red');
    expect(el.style.fontSize).toBe('14px');
  });

  it('should handle reactive style object', () => {
    const { reactive, renderer, container } = setup();
    const active = reactive.signal(true);

    const view = renderer.createViewFromFn(() =>
      h('div', { style: () => ({ color: active.get() ? 'red' : 'blue' }) }),
    );
    renderer.mount(view, container);

    const el = container.querySelector('div') as HTMLElement;
    expect(el.style.color).toBe('red');

    active.set(false);
    expect(el.style.color).toBe('blue');
  });

  it('should handle style string (backward compatible)', () => {
    const { renderer, container } = setup();
    const view = renderer.createViewFromFn(() =>
      h('div', { style: 'color: red' }),
    );
    renderer.mount(view, container);

    const el = container.querySelector('div')!;
    expect(el.getAttribute('style')).toBe('color: red');
  });

  it('should handle kebab-case style properties', () => {
    const { renderer, container } = setup();
    const view = renderer.createViewFromFn(() =>
      h('div', { style: { 'background-color': 'blue', 'font-size': '16px' } }),
    );
    renderer.mount(view, container);

    const el = container.querySelector('div') as HTMLElement;
    expect(el.style.backgroundColor).toBe('blue');
    expect(el.style.fontSize).toBe('16px');
  });

  it('should remove old style properties on reactive update', () => {
    const { reactive, renderer, container } = setup();
    const styles = reactive.signal<Record<string, string>>({ color: 'red', fontWeight: 'bold' });

    const view = renderer.createViewFromFn(() =>
      h('div', { style: () => styles.get() }),
    );
    renderer.mount(view, container);

    const el = container.querySelector('div') as HTMLElement;
    expect(el.style.color).toBe('red');
    expect(el.style.fontWeight).toBe('bold');

    styles.set({ color: 'blue' });
    expect(el.style.color).toBe('blue');
    expect(el.style.fontWeight).toBe('');
  });

  // ---- Issue 3: Inline function component disposable tracking ----

  it('should clean up event listeners from inline function components on unmount', () => {
    const { renderer, container } = setup();
    const clicked = vi.fn();

    function Button(props: Record<string, unknown>) {
      return h('button', { onClick: props.onClick }, 'click');
    }

    const view = renderer.createViewFromFn(() =>
      h('div', null, h(Button as any, { onClick: clicked })),
    );
    const handle = renderer.mount(view, container);

    const btn = container.querySelector('button')!;
    btn.click();
    expect(clicked).toHaveBeenCalledTimes(1);

    renderer.unmount(handle);
    btn.click();
    // After unmount, the event listener should be removed
    expect(clicked).toHaveBeenCalledTimes(1);
  });

  it('should track reactive effects inside inline function components', () => {
    const { reactive, renderer, container } = setup();
    const count = reactive.signal(0);

    function Counter() {
      return h('span', null, () => 'Count: ' + count.get());
    }

    const view = renderer.createViewFromFn(() =>
      h('div', null, h(Counter as any, null)),
    );
    const handle = renderer.mount(view, container);

    expect(container.textContent).toBe('Count: 0');
    count.set(5);
    expect(container.textContent).toBe('Count: 5');

    renderer.unmount(handle);
    count.set(99);
    // Effect should be disposed — no more updates
    expect(container.innerHTML).toBe('');
  });

  it('should handle inline function component with setup/render pattern', () => {
    const { reactive, renderer, container } = setup();
    const count = reactive.signal(0);

    function Counter() {
      // Setup/render pattern: outer function is setup, returns render function
      return () => h('span', null, () => 'x' + count.get());
    }

    const view = renderer.createViewFromFn(() =>
      h('div', null, h(Counter as any, null)),
    );
    renderer.mount(view, container);

    expect(container.textContent).toBe('x0');
    count.set(3);
    expect(container.textContent).toBe('x3');
  });
});
