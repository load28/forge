import { createFramework } from '@forge/core';
import { signalReactive, vdomRenderer, hashRouter, functionComponent, routerView } from '@forge/strategies';

// 1. Create strategy instances
const reactive = signalReactive();
const renderer = vdomRenderer();
const router = hashRouter();
const component = functionComponent();

// 2. Create reactive state
const count = reactive.signal(0);

// 3. Define route components — each route is an independent component
function Home() {
  return () => renderer.h('div', { class: 'app' },
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

function Counter() {
  return () => renderer.h('div', { class: 'app' },
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

// 4. Compose framework
const app = createFramework({ reactive, renderer, component, router });

// 5. routerView plugin — declarative route-to-component mapping
app.use(routerView([
  { path: '/', component: Home },
  { path: '/counter', component: Counter },
]));

// 6. Mount — plugin handles rendering via framework.createView()
const container = document.getElementById('app')!;
app.mount(container);

console.log('Forge demo app mounted!');
