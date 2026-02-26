import { createFramework } from '@forge/core';
import { signalReactive, vdomRenderer, hashRouter, functionComponent } from '@forge/strategies';

// 1. Compose framework from strategies
const reactive = signalReactive();
const renderer = vdomRenderer();
const router = hashRouter();
const component = functionComponent();

// Register routes
router.register({ path: '/', name: 'home' });
router.register({ path: '/counter', name: 'counter' });

// 2. Create reactive state
const count = reactive.signal(0);

// 3. Define the app render function
function App() {
  const route = router.current();

  if (route.matched && route.route?.name === 'counter') {
    return renderer.h('div', { class: 'app' },
      renderer.h('h1', null, 'Counter'),
      renderer.h('p', { class: 'count' }, 'Count: ' + count.get()),
      renderer.h('div', { class: 'buttons' },
        renderer.h('button', { onClick: () => count.set((c: number) => c + 1) }, '+1'),
        renderer.h('button', { onClick: () => count.set((c: number) => c - 1) }, '-1'),
        renderer.h('button', { onClick: () => count.set(0) }, 'Reset'),
      ),
      renderer.h('br', null),
      renderer.h('a', { href: '#/' }, '\u2190 Home'),
    );
  }

  return renderer.h('div', { class: 'app' },
    renderer.h('h1', null, 'Forge Demo'),
    renderer.h('p', null, 'A framework built with the Forge meta-framework.'),
    renderer.h('p', null, 'Strategies used:'),
    renderer.h('ul', null,
      renderer.h('li', null, 'Reactive: Signal-based'),
      renderer.h('li', null, 'Renderer: Virtual DOM'),
      renderer.h('li', null, 'Router: Hash-based'),
      renderer.h('li', null, 'Component: Function'),
    ),
    renderer.h('a', { href: '#/counter' }, 'Go to Counter \u2192'),
  );
}

// 4. Mount the app
const container = document.getElementById('app')!;
const view = renderer.createViewFromFn(App);
const handle = renderer.mount(view, container);

// 5. Wire reactivity -> re-render
reactive.autorun(() => {
  count.get(); // track dependency
  renderer.update(handle);
});

// 6. Wire router -> re-render
router.onChange(() => {
  renderer.update(handle);
});

console.log('Forge demo app mounted!');
