import { describe, it, expect } from 'vitest';
import { signalReactive } from '@forge/strategies';
import { vdomRenderer } from '@forge/strategies';
import { functionComponent } from '@forge/strategies';

describe('Forge integration', () => {
  it('should render a component via composed strategies', () => {
    const reactive = signalReactive();
    const renderer = vdomRenderer();
    const component = functionComponent();

    const handle = component.define((props: any) => {
      return () => renderer.h('div', null, 'Hello ' + props.name);
    });

    const instance = component.instantiate(handle, { name: 'Forge' });
    const container = document.createElement('div');

    const view = renderer.createViewFromFn(instance.render as () => any);
    const mountHandle = renderer.mount(view, container);

    expect(container.innerHTML).toBe('<div>Hello Forge</div>');
  });

  it('should re-render when reactive state changes', () => {
    const reactive = signalReactive();
    const renderer = vdomRenderer();

    const count = reactive.signal(0);
    const container = document.createElement('div');

    const view = renderer.createViewFromFn(() =>
      renderer.h('span', null, 'count: ' + count.get())
    );
    const handle = renderer.mount(view, container);

    expect(container.innerHTML).toBe('<span>count: 0</span>');

    reactive.autorun(() => {
      count.get();
      renderer.update(handle);
    });

    count.set(5);
    expect(container.innerHTML).toBe('<span>count: 5</span>');

    count.set(10);
    expect(container.innerHTML).toBe('<span>count: 10</span>');
  });

  it('should support component lifecycle hooks', () => {
    const component = functionComponent();
    const renderer = vdomRenderer();
    const logs: string[] = [];

    const handle = component.define((props: any) => {
      component.onAttach(() => {
        logs.push('attached');
        return () => logs.push('cleanup');
      });
      component.onDetach(() => logs.push('detached'));
      return () => renderer.h('p', null, 'lifecycle');
    });

    const instance = component.instantiate(handle, {});
    instance.attach();
    expect(logs).toEqual(['attached']);

    instance.detach();
    expect(logs).toEqual(['attached', 'cleanup', 'detached']);
  });

  it('should compose reactive + renderer + component together', () => {
    const reactive = signalReactive();
    const renderer = vdomRenderer();
    const component = functionComponent();

    const name = reactive.signal('World');

    const handle = component.define((props: any) => {
      return () => renderer.h('h1', null, 'Hello ' + name.get());
    });

    const instance = component.instantiate(handle, {});
    const container = document.createElement('div');

    const view = renderer.createViewFromFn(instance.render as () => any);
    const mountHandle = renderer.mount(view, container);

    expect(container.innerHTML).toBe('<h1>Hello World</h1>');

    reactive.autorun(() => {
      name.get();
      renderer.update(mountHandle);
    });

    name.set('Forge');
    expect(container.innerHTML).toBe('<h1>Hello Forge</h1>');
  });
});
