import { createFramework } from '@forge/core';
import { signalReactive, directDomRenderer, hashRouter, functionComponent, routerView } from '@forge/strategies';

// 1. Create strategy instances
const reactive = signalReactive();
const renderer = directDomRenderer(reactive);
const router = hashRouter();
const component = functionComponent();

// 2. Create reactive state
const count = reactive.signal(0);

// 3. Define route components
function Home() {
  return () => (
    <div class="app">
      <h1>Forge Direct DOM Demo <span class="badge">No VDOM</span></h1>
      <p>No virtual DOM. No diffing. Fine-grained reactive DOM updates.</p>
      <p>Strategies used:</p>
      <ul>
        <li>Reactive: Signal-based</li>
        <li>Renderer: Direct DOM (SolidJS-style)</li>
        <li>Router: Hash-based</li>
        <li>Component: Function</li>
      </ul>
      <a href="#/counter">Go to Counter →</a>
    </div>
  );
}

function Counter() {
  return () => (
    <div class="app">
      <h1>Counter</h1>
      <p class="count">{() => 'Count: ' + count.get()}</p>
      <div class="buttons">
        <button onClick={() => count.set((c: number) => c + 1)}>+1</button>
        <button onClick={() => count.set((c: number) => c - 1)}>-1</button>
        <button onClick={() => count.set(0)}>Reset</button>
      </div>
      <br />
      <a href="#/">← Home</a>
    </div>
  );
}

// 4. Compose framework
const app = createFramework({ reactive, renderer, component, router });

// 5. routerView plugin — declarative route-to-component mapping
app.use(routerView([
  { path: '/', component: Home },
  { path: '/counter', component: Counter },
]));

// 6. Mount
const container = document.getElementById('app')!;
app.mount(container);

console.log('Forge Direct DOM demo mounted!');
