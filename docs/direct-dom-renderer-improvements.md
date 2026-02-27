# Direct DOM Renderer 개선사항 — 코드레벨 아키텍처 분석

## 대상 파일

| 파일 | 역할 |
|------|------|
| `packages/strategies/src/direct-dom-renderer/index.ts` | 핵심 구현 (4개 이슈 수정) |
| `packages/strategies/src/__tests__/direct-dom-renderer.test.ts` | 단위 테스트 (27 → 40개) |
| `packages/core/src/engine/create-framework.ts` | 주석 보강 (이슈 4) |

---

## 전체 아키텍처: 표현식 → 렌더러 데이터 흐름

```
┌─────────────────────────────────────────────────────────────────────────┐
│  JSX Source                                                             │
│  <p class="count">{() => 'Count: ' + count.get()}</p>                  │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │ TypeScript 컴파일 (jsx: "react-jsx")
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  jsx-runtime.ts / jsx-dev-runtime.ts                                    │
│  jsxDEV('p', { class: 'count', children: () => 'Count: '+count.get()}) │
│  → children 분리 → h('p', {class:'count'}, () => 'Count:'+count.get()) │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │ h() → _factory 호출
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  factory.ts  (모듈 레벨 싱글턴)                                         │
│  _factory = createDirectElement  ← directDomRenderer()가 등록           │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  createDirectElement(tag, props, ...children)                           │
│                                                                         │
│  tag 분기:                                                              │
│  ├─ Fragment (symbol)  → collectNodes()로 flat Node[] 반환              │
│  ├─ Function           → 함수 컴포넌트 처리 [이슈 3 수정 대상]          │
│  └─ string             → document.createElement() + applyProp/appendChild│
│                                                                         │
│  반환값: Node | Node[]  (실제 DOM 노드)                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 이슈 2: 리액티브 텍스트 노드 Fast Path

### 배경: Comment Anchor 패턴

`createReactiveChild`는 SolidJS/Lit/Vue 3이 사용하는 **comment anchor 패턴**으로 동적 컨텐츠의 위치를 추적한다.

```
mount 전:   <p></p>
mount 후:   <p> "Count: 0" <!---->  </p>
                  ↑ 동적 컨텐츠    ↑ anchor (위치 마커)
```

`anchor.parentNode.insertBefore(node, anchor)`로 항상 anchor 바로 앞에 컨텐츠를 삽입한다.

### 수정 전: Slow Path Only (L274-327)

```
signal 변경 시마다:
  1. subDisposables 정리
  2. 기존 Text 노드 DOM에서 제거 (removeChild)
  3. childFn() 평가 → resolveToNodes()로 새 Text 노드 생성
  4. 새 노드 DOM에 삽입 (insertBefore)
```

**문제**: `() => 'Count: ' + count.get()`처럼 단순 텍스트가 변경될 때도 매번 Text 노드를 파괴/생성한다. DOM 노드 생성은 `textNode.data` 변경 대비 비용이 높다.

### 수정 후: Fast Path 분기 (L281-318)

```typescript
const effect = reactive.autorun(() => {
  // 1. 이전 sub-effect 정리 (변경 없음)
  for (const d of subDisposables) d.dispose();
  subDisposables = [];

  // 2. childFn() 평가를 노드 제거 *전*으로 이동 (핵심 변경)
  const subCtx = pushRenderContext();
  let value: unknown;
  try {
    value = childFn();        // ← signal 의존성 추적은 여기서 발생
  } finally {
    popRenderContext();
  }
  subDisposables = subCtx.disposables;

  // 3. FAST PATH: primitive + 기존 Text 노드 → .data 직접 변경
  if (
    (typeof value === 'string' || typeof value === 'number') &&
    currentNodes.length === 1 &&
    currentNodes[0] instanceof Text
  ) {
    currentNodes[0].data = String(value);  // O(1) DOM 변경, 노드 생성 없음
    return;                                 // 여기서 종료
  }

  // 4. SLOW PATH: 기존 방식 (노드 교체)
  for (const node of currentNodes) {
    node.parentNode?.removeChild(node);
  }
  const newNodes = resolveToNodes(value);
  currentNodes = newNodes;
  for (const node of newNodes) {
    anchor.parentNode!.insertBefore(node, anchor);
  }
});
```

### 실행 흐름 상세

**첫 번째 실행 (mount)**:
```
currentNodes = []  →  length !== 1  →  SLOW PATH
→ resolveToNodes("Count: 0") → [Text("Count: 0")]
→ currentNodes = [Text("Count: 0")]
→ DOM: <p> Text("Count: 0") <!---> </p>
```

**두 번째 실행 (count가 0→3)**:
```
childFn() = "Count: 3"        → typeof === 'string' ✓
currentNodes.length === 1      ✓
currentNodes[0] instanceof Text ✓
→ FAST PATH: Text.data = "Count: 3"
→ DOM: <p> Text("Count: 3") <!---> </p>  (동일 노드, data만 변경)
```

**텍스트→엘리먼트 전환 시 (useElement가 false→true)**:
```
childFn() = <span>element</span>  → typeof === 'object' (Node)
→ FAST PATH 조건 불충족 → SLOW PATH
→ 기존 Text 노드 제거, span 노드 삽입
```

### Fast Path 진입 조건 3가지가 모두 필요한 이유

| 조건 | 없으면 발생하는 문제 |
|------|---------------------|
| `typeof value === 'string' \|\| 'number'` | Node/null/array 반환 시 `.data` 할당 불가 |
| `currentNodes.length === 1` | 첫 실행(length=0) 또는 리스트 렌더링(length>1) 시 잘못된 업데이트 |
| `instanceof Text` | 이전 값이 Element 노드였을 때 `.data` 프로퍼티 없음 |

### `childFn()` 평가 순서 변경의 의미

수정 전: `노드 제거 → 평가 → 노드 삽입`
수정 후: `평가 → (fast path이면 .data 변경) 또는 (slow path이면 제거→삽입)`

**이점**: 평가 시 예외 발생해도 기존 DOM이 그대로 유지된다.
**안전성**: `childFn()` 내부에서 signal을 읽으면 `reactive.autorun`이 의존성을 추적하므로, 평가 시점과 무관하게 추적은 동일하게 동작한다.

### signal 의존성 추적 메커니즘 (autorun 내부)

```
reactive.autorun(fn)
  → createEffect(fn, scheduleEffect)
    → effect.ts의 execute()
      → startTracking(node)          // currentConsumer = effectNode
      → fn()                          // childFn() 실행
        → count.get()                 // graphSignal.get()
          → reportRead(signalNode)    // effectNode.sources에 signalNode 추가
      → endTracking(node)            // currentConsumer 복원
      → snapshotSourceVersions()     // 현재 source version 기록

count.set(3)
  → propagateDirty(signalNode)       // 모든 observer를 DIRTY로 마킹
  → scheduleEffect(execute)          // BatchQueue에 flush 등록
  → flush → execute()                // effect 재실행 → fast path
```

---

## 이슈 3: 인라인 함수 컴포넌트 Disposable 추적

### 배경: Render Context Stack

Direct DOM 렌더러는 `RenderContext` 스택으로 disposable(이벤트 리스너, autorun effect 등)을 수집한다:

```typescript
interface RenderContext {
  disposables: Disposable[];
}

let renderContextStack: RenderContext[] = [];
let currentRenderCtx: RenderContext | null = null;
```

`trackDisposable(d)`는 `currentRenderCtx.disposables`에 push한다. mount 시 최상위 context가 생성되고, unmount 시 해당 context의 모든 disposable이 `dispose()`된다.

### 수정 전 (L97-108): context 미설정

```typescript
if (typeof tag === 'function') {
  const componentProps = props ? { ...props } : {};
  // ...children 처리
  const result = (tag as Function)(componentProps);
  if (typeof result === 'function') {
    return normalizeToNodes(result());  // ← 여기서 h() 호출 시 trackDisposable 호출됨
  }
  return normalizeToNodes(result);
}
```

**문제**: `h('button', { onClick: handler })`가 인라인 컴포넌트 내부에서 실행될 때, `applyProp`이 `addEventListener`를 등록하고 `trackDisposable`로 정리 함수를 등록한다. 그런데 이 disposable이 **부모 render context에 직접 추가**되므로 일반적으로는 동작하지만, 만약 인라인 컴포넌트가 중첩되면 어느 context에 속하는지 불명확해진다.

더 심각한 시나리오: 인라인 컴포넌트가 render context 외부(예: 이벤트 핸들러 내부)에서 호출되면 `currentRenderCtx`가 null이라 disposable이 아예 추적되지 않고 **메모리 누수**가 발생한다.

### 수정 후 (L97-120): 명시적 context 격리 + 전달

```typescript
if (typeof tag === 'function') {
  const componentProps: Record<string, unknown> = props ? { ...props } : {};
  if (children.length > 0) {
    componentProps.children = children.length === 1 ? children[0] : children;
  }
  const ctx = pushRenderContext();    // ← 새 context 생성, 스택에 push
  try {
    const result = (tag as Function)(componentProps);
    if (typeof result === 'function') {
      return normalizeToNodes(result());
    }
    return normalizeToNodes(result);
  } finally {
    popRenderContext();               // ← 부모 context 복원
    for (const d of ctx.disposables) {
      trackDisposable(d);            // ← 수집된 disposable을 부모로 전달
    }
  }
}
```

### 실행 흐름: `h('div', null, h(Button, { onClick: fn }))`

```
createDirectElement('div', null, h(Button, ...))
│
├─ h(Button, { onClick: fn }) 실행:
│   ├─ pushRenderContext()        →  ctx = { disposables: [] }
│   │                                currentRenderCtx = ctx
│   ├─ Button({ onClick: fn })
│   │   └─ return h('button', { onClick: fn }, 'click')
│   │       └─ createDirectElement('button', { onClick: fn }, 'click')
│   │           ├─ document.createElement('button')
│   │           ├─ applyProp(el, 'onClick', fn)
│   │           │   ├─ el.addEventListener('click', fn)
│   │           │   └─ trackDisposable({ dispose: removeEventListener })
│   │           │       └─ ctx.disposables.push(...)  ← ctx에 수집됨
│   │           └─ appendChild(el, 'click')
│   │               └─ el.appendChild(Text("click"))
│   │
│   ├─ popRenderContext()          →  currentRenderCtx = 부모ctx
│   └─ for (d of ctx.disposables)
│       └─ trackDisposable(d)      →  부모ctx.disposables.push(...)
│                                      ↑ 부모 unmount 시 정리 보장
│
├─ appendChild(div, <button>)
└─ return div
```

### 이 패턴과 mount()의 render context 비교

```
mount() 내부:
  pushRenderContext()     → mount-level ctx 생성
  untracked(() => renderFn())  → JSX 트리 전체 구축
    └─ createDirectElement 재귀 호출
       └─ 인라인 함수 컴포넌트:
          pushRenderContext()  → component-level ctx
          ... 실행 ...
          popRenderContext()
          → component-level disposable → mount-level ctx로 전달
  popRenderContext()

unmount() 내부:
  for (d of handle.disposables) d.dispose()  → mount-level ctx 일괄 정리
    → 인라인 컴포넌트의 이벤트 리스너/effect도 여기서 정리됨
```

### 한계: ComponentSystem 비통합

Renderer 프로토콜 시그니처가 `reactive: ReactiveSystem`만 받으므로 `ComponentSystem`에 접근 불가:

```typescript
export function directDomRenderer(reactive: ReactiveSystem): DirectDOMRenderer {
  // component 파라미터 없음 → define/instantiate/destroy 호출 불가
```

따라서 인라인 함수 컴포넌트에서는:
- `onAttach` / `onDetach` 라이프사이클 훅 **미동작**
- `provide` / `inject` 컨텍스트 **미동작**
- 전체 라이프사이클이 필요하면 `framework.createView()` 또는 `routerView` 플러그인을 통해 마운트해야 함

---

## 이슈 5: `normalizeToNodes` / `resolveToNodes` 일관성

### 두 함수의 역할 차이

```
resolveToNodes: mount()와 createReactiveChild()에서 사용
  → 렌더 함수 결과 또는 리액티브 표현식 결과를 DOM 노드로 변환

normalizeToNodes: createDirectElement의 함수 컴포넌트 분기에서 사용
  → 함수 컴포넌트의 반환값을 DOM 노드로 변환
```

### 수정 전: 비일관 동작

```typescript
// resolveToNodes
if (value == null || value === false || value === true) return [];

// normalizeToNodes
if (value == null || value === false || value === true) {
  return [document.createTextNode('')];  // ← 빈 텍스트 노드 생성
}
```

`<NullComponent />`가 `null`을 반환하면:
```
수정 전: <div>[empty Text]</div>   ← DOM에 phantom 노드 잔류
수정 후: <div></div>               ← 깨끗한 DOM
```

### 수정 후: 통일

```typescript
// normalizeToNodes (L354-355)
if (value == null || value === false || value === true) {
  return [];  // resolveToNodes와 동일
}
```

### 호출자 안전성 분석

`normalizeToNodes`의 반환값은 `createDirectElement`에서 직접 반환된다:

```typescript
// createDirectElement → 함수 컴포넌트 분기 (L108-112)
const result = (tag as Function)(componentProps);
if (typeof result === 'function') {
  return normalizeToNodes(result());  // Node[] 반환 (빈 배열 가능)
}
return normalizeToNodes(result);      // Node[] 반환 (빈 배열 가능)
```

이 반환값은 상위 `createDirectElement`에서 `appendChild`를 통해 처리된다:

```typescript
// appendChild (L254)
if (Array.isArray(child)) {
  for (const c of child) appendChild(parent, c);  // 빈 배열 → 0회 반복 → 안전
  return;
}
```

`mount`에서는 `resolveToNodes`를 통해 처리된다:

```typescript
// mount (L401-402)
const result = untracked(() => view.renderFn());
const nodes = resolveToNodes(result);  // 이미 빈 배열 반환 가능 → 안전
```

---

## 이슈 6: `style` 객체 Prop 지원

### 수정 전: 모든 값이 String(value)로 변환

```typescript
// setAttr (L240)
el.setAttribute(attrName, String(value));
// style={{ color: 'red' }} → el.setAttribute('style', '[object Object]')
```

### 수정 후: `applyProp`에 style 전용 분기 추가 (L172-187)

`applyProp`의 prop 처리 우선순위 체인:

```
1. key === 'key'        → 무시 (React 호환 key)
2. key === 'ref'        → ref callback 처리
3. key.startsWith('on') → 이벤트 리스너 등록
4. key === 'style'      → ★ 새로 추가된 분기
5. typeof value === 'function' → 리액티브 prop (autorun)
6. 기본                  → setAttr (문자열 속성)
```

### style 분기의 3가지 경로 (L172-187)

```typescript
if (key === 'style') {
  // 경로 A: 리액티브 style (함수)
  if (typeof value === 'function') {
    const effect = reactive.autorun(() => {
      const v = (value as () => unknown)();
      applyStyle(el as HTMLElement, v);
    });
    trackDisposable(effect);
    return;
  }
  // 경로 B: 정적 style 객체
  if (typeof value === 'object' && value !== null) {
    applyStyle(el as HTMLElement, value);
    return;
  }
  // 경로 C: style 문자열 → setAttr로 fall-through
  // style="color: red" → el.setAttribute('style', 'color: red')
}
```

### `applyStyle` 헬퍼 함수 (L203-224)

```typescript
function applyStyle(el: HTMLElement, value: unknown): void {
  // 문자열: 그대로 attribute 설정
  if (typeof value === 'string') {
    el.setAttribute('style', value);
    return;
  }

  // 객체: 속성별 개별 적용
  if (typeof value === 'object' && value !== null) {
    el.removeAttribute('style');    // ← 이전 속성 전부 제거 (리액티브 업데이트 시 중요)
    const styleObj = value as Record<string, string>;
    for (const prop in styleObj) {
      if (!Object.prototype.hasOwnProperty.call(styleObj, prop)) continue;
      if (prop.includes('-')) {
        // kebab-case: 'font-size' → setProperty('font-size', '16px')
        el.style.setProperty(prop, styleObj[prop]);
      } else {
        // camelCase: 'fontSize' → el.style.fontSize = '16px'
        (el.style as unknown as Record<string, string>)[prop] = styleObj[prop];
      }
    }
    return;
  }

  // null/false: style 제거
  if (value == null || value === false) {
    el.removeAttribute('style');
  }
}
```

### `removeAttribute('style')` 후 재적용 방식의 의미

리액티브 style에서 속성이 제거될 때를 처리하기 위함:

```typescript
// 첫 번째 평가: { color: 'red', fontWeight: 'bold' }
//  → el.style.color = 'red'
//  → el.style.fontWeight = 'bold'

// 두 번째 평가: { color: 'blue' }  (fontWeight 제거됨)
//  → el.removeAttribute('style')    ← fontWeight 등 모든 이전 속성 제거
//  → el.style.color = 'blue'        ← 새 속성만 적용
```

diff 방식(이전/현재 객체를 비교하여 제거된 키만 삭제)보다 단순하지만, 속성이 매우 많을 때 약간의 리페인트 비용이 있다. 현재 단계에서는 정확성과 단순성을 우선시한 설계이다.

### camelCase vs kebab-case 판별 로직

```typescript
if (prop.includes('-')) {
  el.style.setProperty(prop, styleObj[prop]);
} else {
  (el.style as unknown as Record<string, string>)[prop] = styleObj[prop];
}
```

- `includes('-')`는 **kebab-case를 양성 판별**한다.
- CSS 커스텀 프로퍼티(`--custom-color`)도 `-`를 포함하므로 `setProperty`로 처리된다.
- `fontSize` 같은 camelCase는 `-`가 없으므로 직접 할당. 브라우저가 자동으로 `font-size`로 변환한다.

---

## 이슈 4: `createFramework.createView()` autorun 문서화

### 렌더러별 autorun 동작 차이

```typescript
// create-framework.ts L103-114
currentDisposable = reactive.autorun(() => {
  if (!mountHandle) {
    mountHandle = renderer.mount(view, container);
  } else {
    renderer.update(mountHandle);
  }
});
```

**VDOM 렌더러**:
```
autorun 실행 → mount() → renderFn() 호출 → signal.get() → 의존성 추적
signal 변경 → autorun 재실행 → update() → renderFn() 재호출 → patch(oldVNode, newVNode)
```

**Direct DOM 렌더러**:
```
autorun 실행 → mount() 내부에서 untracked(() => renderFn()) 실행
  → untracked가 currentConsumer = null 설정
  → signal.get() 호출되어도 의존성 추적 안 됨
  → autorun은 의존성 0개 → 재실행 트리거 없음
  → update()는 no-op (fine-grained effect가 개별 DOM 업데이트 담당)
```

`untracked`의 구현 (reactive-node.ts L63-71):
```typescript
export function untracked<T>(fn: () => T): T {
  const prev = currentConsumer;
  currentConsumer = null;     // ← 추적 비활성화
  try {
    return fn();              // ← 이 안에서의 signal.get()은 추적되지 않음
  } finally {
    currentConsumer = prev;   // ← 복원
  }
}
```

**단, 내부에서 생성되는 새로운 autorun은 자체 tracking context를 생성하므로 영향받지 않는다:**
```
untracked(renderFn)
  └─ createDirectElement → appendChild → createReactiveChild
      └─ reactive.autorun(fn)       ← 새 effect 생성
         └─ createEffect(fn, scheduler)
            └─ execute()
               └─ startTracking(effectNode)  ← currentConsumer = effectNode (untracked 무관)
               └─ fn() → childFn() → count.get() → reportRead(signalNode)
               └─ endTracking(effectNode)
```

---

## 테스트 커버리지

### 추가된 13개 테스트

#### 이슈 5 (2개)

| 테스트 | 검증 내용 |
|--------|----------|
| `should render nothing for function component returning null` | `NullComp() → null` → `<div></div>` (빈 텍스트 노드 없음) |
| `should render nothing for function component returning false` | `FalseComp() → false` → `<div></div>` |

#### 이슈 2 (3개)

| 테스트 | 검증 내용 |
|--------|----------|
| `should reuse Text node when reactive child returns consecutive primitives` | `signal('hello') → signal('world')` 후 `childNodes[0]`가 **동일 인스턴스**(===)인지 확인 |
| `should fall back to slow path when reactive child transitions from text to element` | `'text' → <span>element</span>` 전환 시 span 정상 렌더링 |
| `should reuse Text node for number reactive children` | `signal(0) → signal(42)` 후 Text 노드 동일 인스턴스 확인 |

#### 이슈 6 (5개)

| 테스트 | 검증 내용 |
|--------|----------|
| `should handle static style object` | `{ color: 'red', fontSize: '14px' }` → `el.style.color === 'red'` |
| `should handle reactive style object` | `() => ({ color: active.get() ? 'red' : 'blue' })` → signal 변경 시 반영 |
| `should handle style string (backward compatible)` | `style: 'color: red'` → `getAttribute('style') === 'color: red'` |
| `should handle kebab-case style properties` | `{ 'background-color': 'blue' }` → `el.style.backgroundColor === 'blue'` |
| `should remove old style properties on reactive update` | `{color, fontWeight} → {color}` → `fontWeight === ''` |

#### 이슈 3 (3개)

| 테스트 | 검증 내용 |
|--------|----------|
| `should clean up event listeners from inline function components on unmount` | unmount 후 `btn.click()` → handler 호출 안 됨 |
| `should track reactive effects inside inline function components` | 인라인 Counter 내 `() => count.get()` 동작 + unmount 후 effect 정리 |
| `should handle inline function component with setup/render pattern` | `function Counter() { return () => h(...) }` 패턴 정상 동작 |

### 전체 테스트 결과

```
단위 테스트: 24 파일, 296개 전체 통과
E2E (demo-direct-dom): 3개 통과
E2E (demo 원본): 4개 통과
```
