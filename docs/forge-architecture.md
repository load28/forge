# Forge 프레임워크 — 아키텍처 및 코드 레벨 레퍼런스

> 전략 패턴 기반 메타 프레임워크로, 리액티브 UI 애플리케이션을 구축한다.
> 플러그형 프로토콜을 통해 렌더링 전략, 리액티비티 시스템, 라우팅을 벤더 종속 없이 자유롭게 조합할 수 있다.

---

## 목차

1. [프로젝트 구조](#1-프로젝트-구조)
2. [아키텍처 개요](#2-아키텍처-개요)
3. [패키지: @forge/core](#3-패키지-forgecore)
   - 3.1 [타입 정의](#31-타입-정의)
   - 3.2 [프로토콜](#32-프로토콜)
   - 3.3 [엔진 — createFramework](#33-엔진--createframework)
4. [패키지: @forge/primitives](#4-패키지-forgeprimitives)
   - 4.1 [리액티비티 시스템](#41-리액티비티-시스템)
   - 4.2 [DOM 시스템](#42-dom-시스템)
   - 4.3 [라우팅 시스템](#43-라우팅-시스템)
5. [패키지: @forge/strategies](#5-패키지-forgestrategies)
   - 5.1 [표현식 레이어](#51-표현식-레이어)
   - 5.2 [Signal-Reactive 전략](#52-signal-reactive-전략)
   - 5.3 [VDOM 렌더러](#53-vdom-렌더러)
   - 5.4 [Direct DOM 렌더러](#54-direct-dom-렌더러)
   - 5.5 [함수 컴포넌트 시스템](#55-함수-컴포넌트-시스템)
   - 5.6 [해시 라우터](#56-해시-라우터)
   - 5.7 [Router-View 플러그인](#57-router-view-플러그인)
6. [횡단 관심사](#6-횡단-관심사)
7. [데이터 흐름 다이어그램](#7-데이터-흐름-다이어그램)

---

## 1. 프로젝트 구조

```
forge/
├── packages/
│   ├── core/                     # 프로토콜 인터페이스 및 프레임워크 엔진
│   │   └── src/
│   │       ├── types.ts          # 공유 타입 프리미티브
│   │       ├── protocols/        # 전략 인터페이스 (ReactiveSystem, Renderer, ...)
│   │       └── engine/           # createFramework() — DI 합성 루트
│   ├── primitives/               # 저수준 빌딩 블록 (프레임워크 의존성 없음)
│   │   └── src/
│   │       ├── reactivity/       # 푸시-풀 리액티브 그래프
│   │       ├── dom/              # VNode, diff, patch, signal-binding
│   │       └── routing/          # 경로 매칭, 해시 리스너, 쿼리 파서
│   ├── strategies/               # core 프로토콜의 플러그형 구현체들
│   │   └── src/
│   │       ├── expression/       # IR 비의존 JSX/h() 팩토리
│   │       ├── signal-reactive/  # 그래프 시그널 + BatchQueue 기반 ReactiveSystem
│   │       ├── vdom-renderer/    # VNode diff/patch 기반 Renderer
│   │       ├── direct-dom-renderer/ # 세밀한 DOM 조작 기반 Renderer (SolidJS 스타일)
│   │       ├── function-component/  # 훅 컨텍스트 및 DI를 갖춘 ComponentSystem
│   │       ├── hash-router/      # window.location.hash 기반 Router
│   │       └── router-view/      # Router + Renderer를 연결하는 FrameworkPlugin
│   ├── demo/                     # VDOM 렌더러 데모 앱
│   └── demo-direct-dom/          # Direct DOM 렌더러 데모 앱
├── e2e/                          # Playwright E2E 테스트
└── docs/                         # 이 문서
```

### 의존성 그래프

```
@forge/core          (의존성 없음)
    ↑
@forge/primitives    (독립적 — 아무것도 의존하지 않음)
    ↑
@forge/strategies    (@forge/core + @forge/primitives에 의존)
```

---

## 2. 아키텍처 개요

Forge는 모든 레이어에서 **전략 패턴(Strategy Pattern)**을 따른다. `@forge/core` 패키지가 프로토콜 인터페이스를 정의하고, `@forge/strategies`가 자유롭게 조합 가능한 구체적 구현체를 제공한다.

```
┌─────────────────────────────────────────────────────────────┐
│                    createFramework()                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │리액티브  │  │  렌더러  │  │컴포넌트  │  │   라우터   │  │
│  │  시스템   │  │          │  │  시스템  │  │ (선택사항) │  │
│  └─────┬─────┘  └─────┬────┘  └─────┬────┘  └──────┬─────┘  │
│        │              │              │              │         │
│  ┌─────┴─────┐  ┌─────┴────┐  ┌─────┴────┐  ┌─────┴─────┐  │
│  │  signal-  │  │  vdom-   │  │ function │  │   hash-   │  │
│  │ reactive  │  │ renderer │  │component │  │  router   │  │
│  └───────────┘  ├──────────┤  └──────────┘  └───────────┘  │
│                 │ direct-  │                                 │
│                 │   dom-   │    + 플러그인 (router-view, ...)│
│                 │ renderer │                                 │
│                 └──────────┘                                 │
└─────────────────────────────────────────────────────────────┘
```

**핵심 설계 결정:**

| 결정 | 근거 |
|------|------|
| core에 프로토콜 인터페이스 배치 | 전략들이 서로가 아닌 추상에 의존하도록 함 |
| primitives를 독립 라이브러리로 분리 | 프레임워크 없이도 사용 가능 (예: 어떤 앱에서든 시그널 사용) |
| 표현식 팩토리 싱글턴 | JSX 문법을 구체적 IR(VNode vs DOM Node)로부터 분리 |
| FrameworkPlugin을 통한 플러그인 시스템 | ProseMirror의 `view()` 라이프사이클 패턴에서 영감 |
| 마운트 메타데이터에 WeakMap 사용 | MountHandle에 내부 필드를 타입 캐스팅하여 붙이는 것을 회피 (P11) |

---

## 3. 패키지: @forge/core

**소스:** `packages/core/src/`

### 3.1 타입 정의

**파일:** `types.ts`

```typescript
// 정리 프리미티브
interface Disposable { dispose(): void; }
type Cleanup = () => void;

// 불투명 핸들 (고유 심볼로 브랜딩)
interface ComponentHandle { readonly _brand: unique symbol; }
interface MountHandle    { readonly container: Element; }
interface TaskHandle     { readonly _brand: unique symbol; }

// Props 가방
type Props = Record<string, unknown>;

// 뷰 라이프사이클 핸들 (framework.createView가 반환)
interface ViewHandle {
  replace(componentDef: unknown, props?: Props): void;
  destroy(): void;
}

// ProseMirror 스타일 플러그인 뷰 라이프사이클
interface PluginView { destroy?(): void; }

// 타입 안전 컨텍스트 키 (브랜딩 심볼 + 팬텀 타입)
interface ContextKey<T> {
  readonly _brand: unique symbol;
  readonly _type?: T;  // 팬텀 — 런타임에는 채워지지 않음
}

function createContextKey<T>(name: string): ContextKey<T>
  // { _brand: Symbol(name) }를 반환
```

### 3.2 프로토콜

다섯 개의 프로토콜 인터페이스가 전략 계약을 정의한다:

#### ReactiveSystem (`protocols/reactive.ts`)

```typescript
interface ReactiveSystem {
  autorun(fn: () => void | Cleanup): Disposable;
  batch(fn: () => void): void;
  computed?<T>(fn: () => T, options?: { equals?: (a: T, b: T) => boolean }): { get(): T; peek(): T };
}
```

- `autorun`: `fn` 내부의 리액티브 읽기를 추적하고, 의존성이 변경되면 재실행한다.
- `batch`: 배치 완료까지 하위 계산을 지연시킨다 (다이아몬드 글리치 방지).
- `computed`: 선택적 지연 메모이제이션 파생 값.

#### Renderer\<Representation\> (`protocols/renderer.ts`)

```typescript
interface Renderer<Representation = unknown> {
  createView(component: ComponentHandle, props: Props): Representation;
  mount(view: Representation, container: Element): MountHandle;
  update(handle: MountHandle): void;
  replace(handle: MountHandle, newView: Representation): MountHandle;
  unmount(handle: MountHandle): void;
}
```

제네릭 `Representation`이 서로 다른 IR 전략을 가능하게 한다:
- **VDOM**: `VDOMView` (`renderFn: () => VNode`을 보유)
- **Direct DOM**: `DirectDOMView` (`renderFn: () => unknown`을 보유)
- **향후**: Canvas 씬 그래프, 서버 문자열 버퍼 등

#### ComponentSystem\<Definition, Instance\> (`protocols/component.ts`)

```typescript
interface ComponentSystem<Definition = unknown, Instance = unknown> {
  define(definition: Definition): ComponentHandle;
  instantiate(handle: ComponentHandle, props: Props): Instance;
  destroy(instance: Instance): void;
  provide<T>(key: ContextKey<T>, value: T): void;
  inject<T>(key: ContextKey<T>, fallback?: T): T;
  onAttach(hook: Cleanup | (() => Cleanup)): void;
  onDetach(hook: () => void): void;
}
```

**라이프사이클:** `define → instantiate → attach → (재렌더링) → detach → destroy`

#### Router\<RouteMatch\> (`protocols/router.ts`)

```typescript
interface Router<RouteMatch = unknown> {
  current(): RouteMatch;
  onChange(callback: (match: RouteMatch) => void): Disposable;
  go(destination: unknown): void;
  register(definition: unknown): Disposable;
}
```

#### Scheduler (`protocols/scheduler.ts`)

```typescript
interface Scheduler {
  schedule(task: () => void, priority?: unknown): TaskHandle;
  cancel(handle: TaskHandle): void;
  flush(): void;
}
```

향후 사용을 위해 예약됨 (동시 렌더링, requestIdleCallback 등).

### 3.3 엔진 — createFramework

**파일:** `engine/create-framework.ts`

모든 프로토콜을 결합하는 합성 루트(composition root).

```typescript
interface FrameworkConfig {
  reactive: ReactiveSystem;
  renderer: Renderer;
  component: ComponentSystem;
  router?: Router;
  scheduler?: Scheduler;
  plugins?: FrameworkPlugin[];
}

interface Framework {
  reactive: ReactiveSystem;
  renderer: Renderer;
  component: ComponentSystem;
  router?: Router;
  scheduler?: Scheduler;
  mount(container: Element, componentDef?: unknown, props?: Record<string, unknown>): MountHandle;
  unmount(handle: MountHandle): void;
  use(plugin: FrameworkPlugin): Framework;
  createView(container: Element, componentDef: unknown, props?: Record<string, unknown>): ViewHandle;
}
```

**플러그인 인터페이스 (ProseMirror에서 영감):**

```typescript
interface FrameworkPlugin {
  name: string;
  install?(framework: Framework): void;
  view?(framework: Framework, container: Element): PluginView;
  beforeMount?(container: Element, componentDef: unknown, props: Record<string, unknown>): void;
  afterMount?(handle: MountHandle): void;
  beforeUnmount?(handle: MountHandle): void;
}
```

**내부 아키텍처:**

| 하위 함수 | 책임 |
|---|---|
| `createView()` | 컴포넌트 렌더링 API — `component.define` + `component.instantiate` + `renderer.createView` + `reactive.autorun`을 `replace()`/`destroy()`를 가진 `ViewHandle`로 래핑 |
| `createComponentInstance()` | `component.define()` → `component.instantiate()` 호출 |
| `mountWithReactiveTracking()` | `reactive.autorun()` 내부에서 초기 마운트 — VDOM은 시그널 변경 시 재트리거; Direct DOM은 한 번만 실행 (update가 no-op) |
| `attachLifecycle()` | `instance.attach()`가 존재하면 호출 |
| `bindRouter()` | `router.onChange()` 구독 → autorun 재추적 |
| `runPluginViews()` | 마운트 중 각 플러그인의 `view()` 훅 호출 |
| `mount()` | 전체 마운트 흐름: `beforeMount` → 인스턴스 생성 → 리액티브 추적과 함께 마운트 → 라이프사이클 → 플러그인 뷰 → `afterMount` |
| `unmount()` | `beforeUnmount` → 플러그인 뷰 파괴 → 구독 해제 → `component.destroy()` → `renderer.unmount()` |
| `use()` | 플러그인 등록 (P7: 이름으로 중복 방지) → `install()` 호출 |

**WeakMap 패턴 (P11):** 마운트 메타데이터(`disposables`, `pluginViews`, `instance`)를 MountHandle 객체에 내부 필드로 붙이는 대신 `WeakMap<MountHandle, MountMetadata>`에 저장한다.

**autorun 동작 참고:** VDOM 렌더러의 경우, `createView()`/`mountWithReactiveTracking()`의 autorun이 시그널 변경 시 재트리거되어 `renderer.update()`를 호출하여 재렌더링 및 diff를 수행한다. Direct DOM 렌더러의 경우, `mount()`가 내부적으로 `untracked()`를 사용하고 `update()`가 no-op이므로, autorun은 초기 마운트 시 한 번만 실행된다. Direct DOM 렌더 중 생성된 세밀한 이펙트들이 자체적으로 독립 추적을 처리한다.

---

## 4. 패키지: @forge/primitives

**소스:** `packages/primitives/src/`

프레임워크 의존성 없음. 세 개의 하위 시스템: 리액티비티, DOM, 라우팅.

### 4.1 리액티비티 시스템

#### 4.1.1 ReactiveNode (`reactivity/reactive-node.ts`)

푸시-풀 리액티브 그래프의 기반. Preact Signals, SolidJS, TC39 Signal 제안에 기반.

```typescript
enum ReactiveState {
  CLEAN = 0,   // 값이 최신 상태
  CHECK = 1,   // 간접 의존성이 변경되었을 수 있음 — 신뢰 전 검증 필요
  DIRTY = 2,   // 직접 의존성이 변경됨 — 반드시 재계산
}

enum NodeKind {
  SOURCE = 0,     // 시그널 소스 노드
  COMPUTED = 1,   // 계산된 파생 값
  EFFECT = 2,     // 사이드 이펙트 (리프 노드)
}

interface ReactiveNode {
  kind: NodeKind;
  state: ReactiveState;
  version: number;                   // 변경 감지 카운터
  sources: ReactiveNode[];           // 의존성 (이 노드에 데이터를 공급하는 노드들)
  sourcesVersions: number[];         // 마지막 업데이트 시 소스 버전 스냅샷
  observers: ReactiveNode[];         // 의존자 (이 노드에 의존하는 노드들)
  _sourcesSet?: Set<ReactiveNode>;   // O(1) 존재 확인 (보조)
  _observersSet?: Set<ReactiveNode>; // O(1) 존재 확인 (보조)
  _computing?: boolean;              // 재진입 방지 가드
  compute?: () => void;              // COMPUTED 재계산 함수
  notify?: () => void;               // EFFECT 스케줄링 콜백
}
```

**의존성 추적 컨텍스트:**

```
currentConsumer: ReactiveNode | null    // 현재 추적 중인 활성 노드
trackingStack: (ReactiveNode | null)[]  // 중첩 추적을 위한 스택
```

- `startTracking(consumer)` → `currentConsumer`를 스택에 푸시, `currentConsumer = consumer`로 설정
- `endTracking(consumer)` → 스택에서 팝, 이전 consumer 복원
- `reportRead(source)` → `currentConsumer`가 존재하면 양방향 링크 등록 (source ↔ observer)
- `untracked(fn)` → `currentConsumer = null`로 설정, fn 실행, 복원

**푸시 단계 — `propagateDirty(source)`:**

반복적 BFS (재귀가 아님, V8의 ~10,400 프레임 스택 제한을 피하기 위해 — S5):
1. 직접 observer를 `DIRTY`로 표시, EFFECT 노드에 `notify()` 호출
2. BFS: 모든 하위 observer를 `CHECK`로 표시, EFFECT에 `notify()` 호출

```
SOURCE 쓰기 → propagateDirty → [DIRTY] 직접 observer
                                  ↓ BFS
                                 [CHECK] 간접 observer
```

**풀 단계 — `updateIfNecessary(node)`:**

명시적 스택을 사용한 반복 처리 (재귀가 아님 — TC-2):
- `CLEAN` → 아무것도 안 함
- `CHECK` → 각 소스 검증: 소스 버전이 변경되었으면 → `DIRTY`로 승격; 아니면 → `CLEAN`
- `DIRTY` → 재계산 (COMPUTED 노드: `node.compute()` 호출)

**정리 — `cleanupSources(node)`:**

모든 소스의 observer 목록에서 해당 노드를 제거. O(1) 배열 제거를 위해 swap-and-pop 사용.

**버전 관리:**

- `snapshotSourceVersions(node)` → 소스 버전 배열 사전 할당 (P3 최적화)
- `incrementVersion(node)` → `(node.version + 1) | 0` (오버플로우 보호)

#### 4.1.2 Signal (`reactivity/signal.ts`)

저수준 관찰 가능한 값. 그래프 와이어링 없음 — 통합을 위한 훅 콜백.

```typescript
interface Signal<T> {
  get(): T;              // 읽기 (onRead 훅 트리거)
  set(next: T | ((prev: T) => T)): void;  // 쓰기 (onWrite 훅 트리거)
  subscribe(fn: (value: T) => void): () => void;  // 직접 구독자
  peek(): T;             // onRead 트리거 없이 읽기
}

interface ReadonlySignal<T> {
  get(): T;
  subscribe(fn: (value: T) => void): () => void;
  peek(): T;
}

interface SignalOptions<T> {
  onRead?: (signal: Signal<T>) => void;    // 그래프 reportRead용 훅
  onWrite?: (signal: Signal<T>) => void;   // 그래프 propagateDirty용 훅
  equals?: (a: T, b: T) => boolean;        // 커스텀 동등성 비교 (기본값: Object.is)
}
```

**핵심 구현 세부사항:**

- **재진입 알림 가드:** `notifying` 플래그 + `dirty` 플래그 → 알림 중 내부 set이 재반복을 유발 (최대 100회 반복)
- **구독자 활성 확인 (TC-3):** 알림 사이클 중 제거된 구독자는 건너뜀
- **BUG-13 규약:** `T`가 함수 타입일 때, `set(fn)`은 모호함 — 업데이터 `(prev) => next`로 처리됨. 호출자는 `set(() => myFunction)` 형태를 사용해야 함.
- **알림 순서:** `onWrite`가 먼저 실행 (그래프 전파), 그다음 `subscribe` 콜백

#### 4.1.3 GraphSignal (`reactivity/graph-signal.ts`)

ReactiveNode에 사전 연결된 Signal을 생성하는 편의 래퍼로, 푸시-풀 그래프에서 자동 의존성 추적을 수행한다.

```typescript
interface GraphSignal<T> extends Signal<T> {
  readonly node: ReactiveNode;
}

function createGraphSignal<T>(initial: T, options?): GraphSignal<T>
  // SOURCE 노드 생성
  // 연결: onRead → reportRead(node), onWrite → incrementVersion(node) + propagateDirty(node)
```

#### 4.1.4 Computed (`reactivity/computed.ts`)

지연 메모이제이션 파생 값. 접근 시에만, 소스가 변경된 경우에만 재계산한다.

```typescript
interface Computed<T> {
  get(): T;   // reportRead + updateIfNecessary + 캐시된 값 반환
  peek(): T;  // updateIfNecessary + 캐시된 값 반환 (추적 없음)
}
```

**구현:**
- COMPUTED ReactiveNode 생성 (초기 상태 DIRTY)
- `recompute()`: 소스 정리 → 추적 → fn 실행 → 값 변경 시: incrementVersion → 버전 스냅샷 → CLEAN
- 순환 의존성 가드: `_computing` 플래그 → Error throw
- `options.equals`를 통한 커스텀 동등성 비교 (기본값: `Object.is`)

#### 4.1.5 Effect (`reactivity/effect.ts`)

추적된 의존성이 변경되면 재실행되는 사이드 이펙트.

```typescript
type EffectScheduler = (run: () => void) => void;
interface EffectHandle { dispose(): void; }

function createEffect(fn: () => void | (() => void), scheduler?: EffectScheduler): EffectHandle
```

**구현:**
- EFFECT ReactiveNode 생성 (초기 상태 DIRTY)
- `execute()`: 재진입 가드 (`_computing`) → `updateIfNecessary` → DIRTY이면: 이전 결과 정리 → 소스 정리 → 추적 → fn 실행 → 버전 스냅샷 → CLEAN
- 첫 실행은 동기적 (즉시)
- 정리 함수: `fn`이 함수를 반환하면, 다음 실행 전과 dispose 시 호출됨
- `notify()` 콜백: `scheduler`에 위임 (기본값: 동기)
- `dispose()`: `disposed` 플래그 설정, 정리 실행, 그래프에서 제거

#### 4.1.6 BatchQueue (`reactivity/batch-queue.ts`)

깊이 기반 배칭 메커니즘으로, 모든 시그널 쓰기가 완료될 때까지 사이드 이펙트를 지연시킨다.

```typescript
class BatchQueue {
  batch(fn: () => void): void;     // 깊이 증가, fn 실행, 깊이 감소, 깊이 0에서 플러시
  enqueue(fn: () => void): void;   // 대기 세트에 추가 (깊이 > 0) 또는 즉시 실행
}
```

**오류 처리 (P4):** 하나가 throw해도 모든 대기 콜백이 실행됨. 첫 번째 오류는 모든 콜백 완료 후 다시 throw됨. 후속 오류는 `console.error`로 로깅.

### 4.2 DOM 시스템

#### 4.2.1 VNode (`dom/vnode.ts`)

XSS 방지 브랜딩이 적용된 가상 DOM 노드.

```typescript
const VNODE_TYPE = Symbol.for('forge.vnode');  // XSS 방지 브랜드 (React의 $$typeof와 유사)
const Fragment = Symbol.for('forge.fragment');

interface VNode {
  $$typeof: symbol;                    // 반드시 VNODE_TYPE이어야 함
  tag: string | Function | symbol;     // 엘리먼트 태그, 컴포넌트, 또는 Fragment
  props: Record<string, unknown> | null;
  children: VNodeChild[];
  key?: string | number;               // 재조정 키
  el?: Node;                           // 지원 DOM 노드 (mount/patch 시 설정)
  _childrenHaveKeys?: boolean;         // P5: 사전 계산 플래그로 O(n) 검사 생략
  _parentEl?: Element;                 // P1: Fragment 노드의 실제 부모
}
```

**`createVNode(tag, props, ...children)`:**
1. `flattenChildren` — 재귀, 단일 패스 평탄화 + falsy 필터링 (P11 최적화)
2. props에서 `key` 제거 (TC-03, React와 동일)
3. `_childrenHaveKeys` 플래그 사전 계산 (P5 — 패치마다 O(n) `.some()` 회피)

**SVG_TAGS Set:** `createElementNS`가 필요한 30개 SVG 엘리먼트 이름

#### 4.2.2 Diff 알고리즘 (`dom/diff.ts`)

**LIS — 최장 증가 부분 수열 (`getSequence`):**

O(n log n) 알고리즘으로, Vue 3의 `getSequence()`에 기반. 키 기반 재조정 시 DOM 이동을 최소화하는 데 사용된다. LIS에 속한 엘리먼트들은 이미 올바른 상대 순서에 있어 DOM 이동이 필요 없다.

```typescript
function getSequence(arr: number[]): number[]
  // 이진 탐색 + 역추적으로 최적 부분 수열 찾기
  // 값이 < 0인 항목은 건너뜀 (새 노드)
```

**`diffKeys(oldKeys, newKeys): DiffOp[]`:**

최소한의 `insert`, `move`, `remove` 연산을 생성:
1. `oldKey → index` 맵 구축
2. LIS 계산을 위해 재사용된 old 인덱스 추적
3. 미사용 old 키 제거
4. LIS로 안정 노드 식별
5. LIS에 없는 재사용 노드 → `move`, 이전에 없던 키 → `insert`

#### 4.2.3 Patch (`dom/patch.ts`)

완전한 VDOM 재조정 엔진.

**보안 (OWASP 기반):**

| 방어 | 구현 |
|------|------|
| 위험 태그 차단 (S2) | `DANGEROUS_TAGS` Set: `script, iframe, object, embed, base` |
| 태그 이름 검증 | `VALID_TAG_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/` |
| URL 프로토콜 차단 (S3b) | `DANGEROUS_URL_RE`로 `javascript:`, `vbscript:` 차단; DATA_URL은 image/video/audio만 허용 |
| 문자열 이벤트 핸들러 차단 (S3a) | `on*` props는 반드시 함수여야 함 (`onclick="..."` XSS 차단) |
| 프로토타입 오염 차단 (S4) | `BLOCKED_PROP_KEYS`: `__proto__`, `constructor`, `prototype` |
| VNode 브랜딩 | `$$typeof === VNODE_TYPE` 검사 (React의 `$$typeof`와 유사) |

**이벤트 핸들러 시스템:**

```typescript
const eventHandlers = new WeakMap<HTMLElement, Map<string, { current: EventListener; wrapper: EventListener }>>();
```

안정 래퍼 패턴: `setEventHandler`가 `entry.current`에 위임하는 단일 래퍼를 생성하여, `removeEventListener`/`addEventListener` 반복 없이 핸들러 업데이트가 가능하다.

**`createEl(vnode, isSvg)`:** VNode 트리에서 실제 DOM 생성
- Fragment → DocumentFragment, `childNodesMap: WeakMap<VNode, Node[]>`로 자식 추적
- SVG 컨텍스트 전파: `svg` 태그가 SVG 네임스페이스에 진입, 자식이 상속
- `setProp()`을 통해 모든 보안 검사와 함께 props 적용

**`patch(oldVNode, newVNode, container)`:**
1. 태그 불일치 → 전체 교체 (Fragment ↔ Element 전환 포함 — P1)
2. 같은 태그 → props 패치 (할당을 피하기 위해 for..in 사용 — PF-04), children 패치
3. Children 분기: 이전 또는 새 자식 중 키가 있으면 → `patchKeyedChildren`, 아니면 → `patchNonKeyedChildren`

**`patchKeyedChildren`:**
1. 이전 자식의 `oldKey → index` 맵 구축
2. 새 키를 이전에 대해 매칭, 매칭된 쌍 패치
3. 매칭되지 않은 이전 자식 제거
4. old 인덱스에 대해 LIS 계산 → 안정 세트
5. 역방향 반복: 새 노드 삽입, 안정하지 않은 재사용 노드 이동

**`patchNonKeyedChildren`:**
- 공통 접두사: 제자리 패치 (VNode → VNode) 또는 교체 (텍스트 ↔ 엘리먼트)
- 초과 새 자식 → 추가
- 초과 이전 자식 → 제거 (안정적 인덱스를 위해 역방향 반복)

**Fragment 처리 (P1):**
- `DocumentFragment`는 `appendChild` 후 비워짐 → `vnode._parentEl`로 실제 부모 추적
- 자식 DOM 노드를 `childNodesMap: WeakMap<VNode, Node[]>`로 추적

**SSR 호환성 (P6):** `createDomPatcher(doc: DocumentLike)` — 가상 document 주입을 위한 팩토리 (스텁, 아직 기능하지 않음).

#### 4.2.4 Signal 바인딩 (`dom/signal-binding.ts`)

VDOM diff를 완전히 우회하는 O(1) 세밀한 DOM 업데이트.

```typescript
function bindSignalToText<T>(signal: ReadableSignal<T>, textNode: Text): BindingCleanup
  // textNode.data = String(signal.get()), 업데이트 구독

function bindSignalToAttribute(signal: ReadableSignal<unknown>, element: Element, attrName: string): BindingCleanup
  // 값 타입에 따라 setAttribute/removeAttribute

function bindSignalToStyle(signal: ReadableSignal<string>, element: HTMLElement, property: string): BindingCleanup
  // element.style.setProperty(property, value)

function bindSignalToClass(signal: ReadableSignal<string>, element: Element): BindingCleanup
  // element.className = value
```

`signal.subscribe()`를 직접 사용 (그래프가 아님 — 독립적 알림 경로). primitives로 제공되지만 현재 Direct DOM 렌더러는 사용하지 않음 (일관성을 위해 `reactive.autorun` 사용).

#### 4.2.5 에러 바운더리 (`dom/error-boundary.ts`)

```typescript
function errorBoundary(fallback: ErrorHandler, ...children: VNodeChild[]): VNode
  // 'forge-error-boundary' 태그와 _errorHandler 속성을 가진 VNode 생성

function tryCatchRender(renderFn: () => VNode, onError: ErrorHandler): VNode
  // try/catch 래퍼 — 오류 시 fallback VNode 반환
```

동기적 렌더 오류만 캐치한다 (React의 Error Boundary 동작과 동일).

### 4.3 라우팅 시스템

#### 4.3.1 경로 매처 (`routing/path-matcher.ts`)

해석적(비컴파일) 패턴 매칭.

```typescript
function matchPath(pattern: string, path: string): PathMatch
  // { matched: boolean, params: Record<string, string> }를 반환
```

**패턴 문법:**
- 정적: `/users/list`
- 이름 있는 파라미터: `/users/:id`
- 선택적 파라미터: `/users/:id?` (TC-1)
- 와일드카드: `/files/*` (나머지 경로 캡처)

**보안:**
- params 객체에 `Object.create(null)` 사용 (S7 — 프로토타입 오염 방지)
- `safeDecode()`가 `decodeURIComponent`를 래핑 (잘못된 UTF-8 처리)
- 후행 슬래시 정규화
- 매칭 전 쿼리 문자열 제거 (TC-2)

#### 4.3.2 컴파일된 매처 (`routing/compiled-matcher.ts`)

O(1) 매칭을 위한 사전 컴파일 패턴 매처 (세그먼트별 해석 비교 대비).

```typescript
interface CompiledRoute {
  pattern: string;
  regex: RegExp;           // 패턴에서 컴파일
  paramNames: string[];    // 추출된 파라미터 이름, 순서대로
  hasWildcard: boolean;
}

function compilePath(pattern: string): CompiledRoute
  // 패턴을 RegExp로 한 번 컴파일

function matchCompiled(route: CompiledRoute, path: string): CompiledMatch
  // route.regex.exec(path) → 인덱스로 파라미터 추출
```

Express/path-to-regexp의 컴파일 후 매칭 패턴에서 영감.

#### 4.3.3 해시 리스너 (`routing/hash-listener.ts`)

저수준 브라우저 해시 변경 리스너.

```typescript
interface HashListener {
  getPath(): string;
  setPath(path: string): void;
  onChange(callback: (path: string) => void): () => void;
  destroy(): void;
}

function createHashListener(win?: WindowLike): HashListener
```

**핵심 세부사항:**
- 테스트 가능성 및 SSR 호환성을 위한 `WindowLike` 인터페이스 (A-1)
- 경로 살균 (S6): 제어 문자 U+0000–U+001F, U+007F 제거
- 해시 내 해시 처리 (TC-3): `#/page#fragment` → 첫 부분만 사용
- 반복 전 콜백 스냅샷 (BUG-16 수정)

#### 4.3.4 쿼리 파서 (`routing/query-parser.ts`)

```typescript
function parseQuery(path: string): Record<string, string>
  // 키당 단일 값: "/page?a=1&b=2" → { a: "1", b: "2" }

function parseQueryMulti(path: string): Record<string, string[]>
  // 키당 다중 값 (WHATWG §5.1): "/page?tag=a&tag=b" → { tag: ['a', 'b'] }
```

둘 다 결과 객체에 `Object.create(null)` 사용하고, `safeDecodeComponent`가 폼 인코딩 스펙에 따라 `+` → 공백을 처리.

---

## 5. 패키지: @forge/strategies

**소스:** `packages/strategies/src/`

### 5.1 표현식 레이어

**파일:** `expression/factory.ts`, `expression/jsx-runtime.ts`, `expression/jsx-dev-runtime.ts`

JSX 문법을 구체적 렌더링 표현으로부터 분리하는 IR 비의존 표현식 팩토리.

```
JSX 소스 → tsc/esbuild → jsx() / jsxs() / jsxDEV()
                                      ↓
                                    h(tag, props, ...children)
                                      ↓
                                  _factory(tag, props, ...children)
                                      ↓
                    ┌─────────────────┴──────────────────┐
                    │ VDOM: createVNode(...)              │ Direct DOM: createDirectElement(...)
                    │ → VNode 반환                        │ → Node | Node[] 반환
                    └────────────────────────────────────┘
```

**factory.ts:**

```typescript
let _factory: ExpressionFactory | null = null;

const Fragment = Symbol.for('forge.fragment');

function registerFactory(factory: ExpressionFactory): void
  // 렌더러 초기화 시 호출

function h(tag, props, ...children): unknown
  // _factory에 위임; 미등록 시 throw
```

**jsx-runtime.ts / jsx-dev-runtime.ts:**

```typescript
function jsx(type, props, key?): unknown
  // props에서 children 추출 → h(type, restProps, ...children)에 위임
  // 단일 자식 빠른 경로: 필요할 때만 배열로 래핑

function jsxs(type, props, key?): unknown
  // jsx와 동일 (다중 자식)

function jsxDEV(type, props, key?): unknown
  // 개발 런타임 — 동일한 동작, 소스 맵용 별도 진입점
```

### 5.2 Signal-Reactive 전략

**파일:** `signal-reactive/index.ts`

그래프 시그널 + BatchQueue를 사용하여 `ReactiveSystem` 프로토콜을 구현.

```typescript
interface SignalReactiveSystem extends ReactiveSystem {
  signal<T>(initial: T): Signal<T>;
  computed<T>(fn: () => T, options?): Computed<T>;
}

function signalReactive(): SignalReactiveSystem
```

**내부 아키텍처:**

```
signal.set(value)
    ↓
batchQueue.batch(() => {
    graphSignal.set(value)          // → onWrite → incrementVersion + propagateDirty
})
    ↓
[배치 깊이가 0으로 감소]
    ↓
대기 이펙트 플러시              // pendingEffects Set
    ↓
effect.execute()                   // 풀 단계: updateIfNecessary → DIRTY이면 재계산
```

**핵심 메커니즘:**

1. **배치된 시그널 쓰기:** `signal.set()`이 내부 `graphSignal.set()`을 `batchQueue.batch()`로 래핑하여 이펙트 플러시 전에 모든 dirty 플래그가 전파되도록 보장 (다이아몬드 글리치 방지)

2. **이펙트 스케줄링:** `autorun(fn)` → `createEffect(fn, scheduleEffect)` 여기서 `scheduleEffect`는 `pendingEffects: Set`에 추가하고 `batchQueue.enqueue(flush)`를 호출

3. **플러시 루프 (글리치 방지):** `pendingEffects`가 빌 때까지 반복, `MAX_ITERATIONS = 100` 가드로 무한 루프 방지. 이펙트가 (시그널 쓰기를 통해) 새 이펙트를 트리거할 수 있으며, 이는 다음 반복에서 수집됨.

4. **Computed 패스스루:** `computed()` → `createComputed()` 직접 호출 (배치 래핑 불필요 — computed 노드는 풀 단계 재계산 중에만 자신의 버전을 업데이트)

### 5.3 VDOM 렌더러

**파일:** `vdom-renderer/index.ts`

VNode diff/patch를 사용하여 `Renderer<VDOMView>` 프로토콜을 구현.

```typescript
interface VDOMView { renderFn: () => VNode; }
interface VDOMMountHandle extends MountHandle {
  currentVNode: VNode | null;
  renderFn: (() => VNode) | null;
}
```

**프로토콜 구현:**

| 메서드 | 동작 |
|--------|------|
| 생성자 | `registerFactory(createVNode)` — JSX를 VNode 생성에 바인딩 |
| `createView(handle, props)` | `handle.factory(props)` 호출 → `renderFn` 획득 → `{ renderFn }`으로 래핑 |
| `mount(view, container)` | `view.renderFn()` → `mountVNode(vnode, container)` → `currentVNode`을 가진 핸들 반환 |
| `update(handle)` | `handle.renderFn()` → `patchVNode(old, new, container)` → `currentVNode` 업데이트 |
| `replace(handle, newView)` | `renderFn` 교체, 새 VNode 렌더, 이전에 대해 `patchVNode` |
| `unmount(handle)` | `unmountVNode(currentVNode)` (S1: innerHTML이 아닌 적절한 DOM 제거 사용) |

**컴포넌트 핸들 타입 가드:**

```typescript
function isFactoryHandle(handle): handle is { factory: (props) => () => VNode }
  // 덕 타이핑 검사: null이 아닌 객체이고 'factory' 함수를 가짐
```

### 5.4 Direct DOM 렌더러

**파일:** `direct-dom-renderer/index.ts`

VDOM 중간 레이어 없이 JSX에서 직접 실제 DOM 노드를 생성하는 SolidJS 스타일 렌더러.

```typescript
interface DirectDOMView { renderFn: () => unknown; }
interface DirectDOMMountHandle extends MountHandle {
  rootNodes: Node[];
  disposables: Disposable[];
  renderFn: (() => unknown) | null;
}
```

**생성자:** `registerFactory(createDirectElement)` — JSX를 직접 DOM 생성에 바인딩.

#### 렌더 컨텍스트 스택

DOM 트리 구축 중 disposable을 수집하기 위한 모듈 수준 스택:

```typescript
let renderContextStack: RenderContext[] = [];
let currentRenderCtx: RenderContext | null = null;

function pushRenderContext(): RenderContext    // 새 { disposables: [] } 푸시
function popRenderContext(): void              // 이전 복원
function trackDisposable(d: Disposable): void // 현재 컨텍스트에 추가
```

#### createDirectElement(tag, props, ...children)

세 가지 분기:

**1. Fragment (`tag === Fragment`):**
```
→ 자식 노드를 평탄한 Node[]로 수집
→ 배열 반환 (래퍼 엘리먼트 없음)
```

**2. 함수 컴포넌트 (`typeof tag === 'function'`):**
```
→ 렌더 컨텍스트 푸시 (하위 disposable 수집)
→ tag(props) 호출 → result
→ result가 함수이면 (setup/render 패턴): result() 호출
→ normalizeToNodes(result)
→ 렌더 컨텍스트 팝
→ 수집된 disposable을 부모 컨텍스트로 전달
```

**제한사항 (문서화됨):** JSX에서 직접 사용되는 인라인 함수 컴포넌트는 ComponentSystem을 거치지 않는다. onAttach/onDetach 라이프사이클, provide/inject 컨텍스트 미지원. 전체 라이프사이클이 필요하면 `framework.createView()` / routerView 사용.

**3. HTML/SVG 엘리먼트 (`typeof tag === 'string'`):**
```
→ validateTag(tag, isSvg) — 보안 검사
→ createElement / createElementNS
→ applyProp()으로 props 적용
→ appendChild()로 자식 추가
→ Element 반환
```

#### applyProp(el, key, value, isSvg)

처리 체인 (순서가 중요):

1. `key === 'key'` → 건너뜀
2. `key === 'ref'` → `value(el)` 호출, 정리를 위해 `value(null)` disposable 추적
3. `key.startsWith('on')` → `addEventListener(eventName, value)`, 제거 disposable 추적
4. `key === 'style'` →
   - 함수: `reactive.autorun(() => applyStyle(el, value()))` — 세밀한 리액티브
   - 객체: `applyStyle(el, value)` — 정적
   - 문자열: `setAttr`로 폴스루
5. `typeof value === 'function'` (리액티브 prop) → `reactive.autorun(() => setAttr(el, key, value()))` — 세밀한 리액티브
6. 정적 prop → `setAttr(el, key, value)`

**`applyStyle(el, value)`:**
- 문자열 → `el.setAttribute('style', value)`
- 객체 → `el.removeAttribute('style')` (초기화), 각 속성에 대해:
  - 케밥 케이스 (`font-size`) → `el.style.setProperty(prop, value)`
  - 카멜 케이스 (`fontSize`) → `el.style[prop] = value`
- null/false → `el.removeAttribute('style')`

**`setAttr(el, key, value)`:**
- URL 속성에 대한 URL 안전성 검사
- `false`/`null` → `removeAttribute`
- `true` → `setAttribute(name, '')`
- 그 외 → `setAttribute(name, String(value))`

#### appendChild(parent, child)

- `null`/`false`/`true` → 건너뜀
- `Node` → `parent.appendChild`
- `Array` → 재귀
- `Function` → `createReactiveChild(parent, child)` — 세밀한 리액티브
- 프리미티브 → `createTextNode(String(child))`

#### createReactiveChild — 주석 앵커 패턴

SolidJS, Lit, Vue 3과 동일한 기법. 주석 노드가 위치를 표시하고, 동적 콘텐츠가 그 앞에 삽입된다.

```typescript
function createReactiveChild(parent, childFn) {
  const anchor = document.createComment('');
  parent.appendChild(anchor);
  let currentNodes: Node[] = [];
  let subDisposables: Disposable[] = [];

  const effect = reactive.autorun(() => {
    // 이전 평가의 하위 이펙트 정리
    for (const d of subDisposables) d.dispose();
    subDisposables = [];

    // 하위 컨텍스트에서 평가하여 중첩 disposable 수집
    const subCtx = pushRenderContext();
    const value = childFn();
    popRenderContext();
    subDisposables = subCtx.disposables;

    // 빠른 경로: 프리미티브 + 기존 Text 노드 → .data 직접 변경
    if ((typeof value === 'string' || typeof value === 'number')
        && currentNodes.length === 1
        && currentNodes[0] instanceof Text) {
      currentNodes[0].data = String(value);
      return;
    }

    // 느린 경로: 이전 노드 제거, 새 노드 생성, 앵커 앞에 삽입
    for (const node of currentNodes) node.parentNode?.removeChild(node);
    const newNodes = resolveToNodes(value);
    currentNodes = newNodes;
    for (const node of newNodes) anchor.parentNode!.insertBefore(node, anchor);
  });
}
```

**빠른 경로 최적화:** 리액티브 함수가 프리미티브(string/number)를 반환하고 현재 DOM이 단일 Text 노드이면, Text 노드의 `.data` 속성을 직접 변경한다. 이로써 매 시그널 변경마다 DOM 노드 생성/파괴를 피한다.

#### Renderer 프로토콜

| 메서드 | 동작 |
|--------|------|
| `mount(view, container)` | `pushRenderContext` → `untracked(() => view.renderFn())` → 노드로 해석 → 컨테이너에 추가 → `rootNodes` + `disposables`를 가진 핸들 반환 |
| `update(_handle)` | **No-op.** 세밀한 리액티브 이펙트가 모든 DOM 업데이트를 직접 처리. |
| `replace(handle, newView)` | 이전 이펙트 해제 → 이전 노드 제거 → `mount(newView, container)` |
| `unmount(handle)` | 모든 리액티브 구독 해제 → 모든 DOM 노드 제거 |

**mount에서 `untracked()`:** 외부 추적 컨텍스트를 억제한다. 내부 `reactive.autorun()` 호출(리액티브 props/children이 생성)이 자체적으로 독립 추적을 수립한다. 이를 통해 프레임워크 수준의 autorun이 재트리거(전체 재렌더링 유발)되는 것을 방지한다.

#### 보안 (patch.ts와 동일한 패턴)

| 방어 | 패턴 |
|------|------|
| `DANGEROUS_TAGS` | `script, iframe, object, embed, base` |
| `VALID_TAG_RE` | `/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/` |
| `VALID_SVG_TAG_RE` | `/^[a-zA-Z][a-zA-Z0-9]*$/` |
| `DANGEROUS_URL_RE` | `javascript:`, `vbscript:` 차단 |
| `DATA_URL_RE` / `SAFE_DATA_RE` | image/video/audio 데이터 URI만 허용 |
| `BLOCKED_PROP_KEYS` | `__proto__, constructor, prototype` |

### 5.5 함수 컴포넌트 시스템

**파일:** `function-component/index.ts`

`ComponentSystem<RenderFn, FnComponentInstance>` 프로토콜을 구현.

```typescript
type RenderFn = (props: Props) => () => unknown;  // 팩토리가 렌더 함수를 반환

interface FnComponentInstance {
  render: () => unknown;   // 렌더 함수 (Renderer가 호출)
  attach(): void;          // onAttach 훅 실행
  detach(): void;          // 정리 + onDetach 훅 실행
}

interface FnComponentHandle extends ComponentHandle {
  factory: RenderFn;
}
```

#### 훅 컨텍스트 스택 (BUG-15 수정)

중첩된 컴포넌트 인스턴스화 시 오염을 방지:

```typescript
interface HookContext {
  attachHooks: { hook: Cleanup | (() => Cleanup) }[];
  detachHooks: (() => void)[];
  scope: ContextScope;
}

const hookContextStack: HookContext[] = [];
let currentHookContext: HookContext | null = null;
```

`pushHookContext()` / `popHookContext()` — 저장/복원 패턴 (React의 dispatcher와 유사).

#### 컨텍스트 스코프 체인 (A-FC-1)

프로토타입 체인과 유사한 스코프 중첩을 통한 트리 범위 의존성 주입:

```typescript
interface ContextScope {
  values: Map<symbol, unknown>;
  parent: ContextScope | null;
}
```

```
rootScope (최상위 컴포넌트 간 공유)
    ↑ parent
  childScope (컴포넌트 A)
    ↑ parent
  childScope (컴포넌트 B, A의 자식)
```

- `provide(key, value)` → `currentScope.values.set(key._brand, value)`
- `inject(key, fallback?)` → 키를 찾을 때까지 `scope.parent` 체인을 거슬러 올라감; fallback 없으면 throw

#### 프로토콜 구현

| 메서드 | 동작 |
|--------|------|
| `define(definition)` | `{ _brand: Symbol('component'), factory: definition }` 반환 |
| `instantiate(handle, props)` | 훅 컨텍스트 푸시 → `factory(props)` 호출 → 훅 캡처 → 팝 → `render`, `attach()`, `detach()`를 가진 인스턴스 반환 |
| `destroy(instance)` | `instance.detach()` 호출 |
| `provide(key, value)` | 현재 스코프에 설정 |
| `inject(key, fallback?)` | 스코프 체인 탐색 |
| `onAttach(hook)` | `currentHookContext.attachHooks`에 푸시 (인스턴스화 외부에서 호출 시 throw) |
| `onDetach(hook)` | `currentHookContext.detachHooks`에 푸시 (인스턴스화 외부에서 호출 시 throw) |

**라이프사이클 흐름:**

```
define(factory)
    ↓
instantiate(handle, props)
    ↓ pushHookContext
factory(props) → 렌더 함수
    ↓ (onAttach/onDetach 호출이 캡처됨)
    ↓ popHookContext
    ↓
attach()
    ↓ 각 attachHook 실행; 반환된 정리 함수 캡처
...
detach() / destroy()
    ↓ 캡처된 정리 함수 실행
    ↓ 각 detachHook 실행
```

### 5.6 해시 라우터

**파일:** `hash-router/index.ts`

`window.location.hash`를 사용하여 `Router<HashRouteMatch>` 프로토콜을 구현.

```typescript
interface HashRouteMatch {
  matched: boolean;
  route?: RouteDefinition;
  params: Record<string, string>;
  path: string;
}

type NavigationGuard = (to: HashRouteMatch, from: HashRouteMatch) => boolean | string | void;

interface HashRouter extends Router<HashRouteMatch> {
  destroy(): void;
  beforeEach(guard: NavigationGuard): Disposable;  // DX-2
}
```

**내부 아키텍처:**

```typescript
function hashRouter(): HashRouter {
  const listener = createHashListener();      // 저수준 해시 변경
  const routes: CompiledRouteEntry[] = [];    // 사전 컴파일된 패턴
  const callbacks = new Set<...>();            // onChange 구독자
  const guards: NavigationGuard[] = [];       // 내비게이션 가드
  let lastMatch: HashRouteMatch;              // 가드의 `from` 파라미터용 이전 매치
  ...
}
```

**경로 해석 (`resolve(path)`):**
- 등록된 경로를 순회하며 `matchCompiled(entry.compiled, path)` 호출
- 첫 번째 매치가 우선 (순서 의존)
- 매치 없음 → `{ matched: false, params: {}, path }`

**내비게이션 가드 시스템 (DX-2, Vue Router에서 영감):**

```
hashchange 이벤트
    ↓
resolve(path) → HashRouteMatch
    ↓
runGuards(to, from):
    각 guard에 대해:
        false 반환 → 취소 (URL을 lastMatch.path로 되돌림)
        문자열 반환 → 리다이렉트 (새 경로 해석, setPath)
        void 반환 → 계속
    ↓
리다이렉트 루프 가드: MAX_REDIRECTS = 10
    ↓
콜백 알림
```

**프로토콜 구현:**

| 메서드 | 동작 |
|--------|------|
| `current()` | `resolve(listener.getPath())` → `lastMatch` 업데이트 |
| `onChange(cb)` | callbacks Set에 추가, Disposable 반환 |
| `go(destination)` | `listener.setPath(destination)` |
| `register(definition)` | `compilePath(def.path)` → routes에 푸시 → Disposable 반환 (dispose 시 splice) |
| `destroy()` | `listener.destroy()` + 모든 상태 초기화 |
| `beforeEach(guard)` | guards 배열에 푸시, Disposable 반환 |

### 5.7 Router-View 플러그인

**파일:** `router-view/index.ts`

Router와 Renderer API를 연결하는 ProseMirror에서 영감을 받은 플러그인.

```typescript
interface RouteComponent {
  path: string;
  name?: string;
  component: unknown;
}

function routerView(routes: RouteComponent[]): FrameworkPlugin
```

**구현 (순수 합성 — 자체 렌더링 로직 없음):**

```typescript
{
  name: 'router-view',

  view(framework, container): PluginView {
    // 1. Router API를 통해 경로 등록
    for (const r of routes) {
      framework.router.register({ path: r.path, name: r.name });
    }

    // 2. Framework 렌더링 API를 통해 초기 경로의 컴포넌트 마운트
    const match = framework.router.current();
    const initial = routes.find(r => r.path === match.path) ?? routes[0];
    const viewHandle = framework.createView(container, initial.component);

    // 3. Router API + 렌더링 API 합성으로 내비게이션 시 교체
    framework.router.onChange((m) => {
      const route = routes.find(r => r.path === m.path);
      if (route) viewHandle.replace(route.component);
    });

    return {
      destroy() {
        viewHandle.destroy();
        // 경로 등록 및 라우터 구독 해제
      }
    };
  }
}
```

---

## 6. 횡단 관심사

### 6.1 보안 모델

| 레이어 | 위협 | 방어 |
|--------|------|------|
| VNode | 임의 객체 주입 | `$$typeof` 심볼 브랜드 (React와 유사) |
| 태그 이름 | script 태그를 통한 XSS | `DANGEROUS_TAGS` 차단 목록 + 정규식 검증 |
| URL props | `javascript:` 프로토콜 | `DANGEROUS_URL_RE` + data URI 화이트리스트 |
| 이벤트 핸들러 | 문자열 이벤트 핸들러 주입 | `on*` 값은 `function`만 허용 |
| Props | 프로토타입 오염 | `BLOCKED_PROP_KEYS` Set으로 `__proto__`, `constructor`, `prototype` 차단 |
| 라우트 파라미터 | 프로토타입 오염 | 모든 params 객체에 `Object.create(null)` |
| 해시 경로 | 제어 문자 주입 | 살균 정규식으로 U+0000–U+001F, U+007F 제거 |
| URL 디코딩 | 잘못된 UTF-8 | `safeDecode`가 `decodeURIComponent`를 try/catch로 래핑 |

### 6.2 성능 패턴

| 패턴 | ID | 위치 |
|------|----|------|
| 사전 계산된 키 자식 플래그 | P5 | `vnode.ts` — 패치마다 O(n) `.some()` 회피 |
| 사전 할당된 버전 배열 | P3 | `reactive-node.ts` — `snapshotSourceVersions` |
| 오버플로우 안전 버전 증가 | P3 | `(version + 1) \| 0` 비트 OR |
| 최소 DOM 이동을 위한 LIS | PF-01 | `diff.ts` / `patch.ts` — O(n log n) |
| Object.entries 대신 for..in | PF-04 | `patch.ts` — 중간 배열 할당 회피 |
| 단일 패스 평탄화 + 필터링 | P11 | `vnode.ts` — `flattenChildren` |
| O(1) source/observer Set 검사 | — | `reactive-node.ts` — 보조 `_sourcesSet`/`_observersSet` |
| Swap-and-pop 배열 제거 | — | `cleanupSources` — O(n) splice 대신 O(1) |
| Text 노드 `.data` 변경 | — | `direct-dom-renderer` — DOM 노드 생성/파괴 회피 빠른 경로 |
| 컴파일된 경로 패턴 | A-2 | `compiled-matcher.ts` — RegExp 한 번 컴파일, O(1) 매칭 |
| 반복적 그래프 순회 | S5, TC-2 | `reactive-node.ts` — 재귀 대신 BFS/스택 (스택 오버플로우 방지) |

### 6.3 에러 처리

| 시나리오 | 동작 |
|----------|------|
| 팩토리 미등록 | `h()`가 `"Forge: no expression factory registered"` throw |
| 유효하지 않은 태그 이름 | `validateTag`가 `"Forge: invalid tag name"` throw |
| 위험한 태그 | `validateTag`가 `"Forge: tag blocked for security"` throw |
| 위험한 URL | `console.warn` + 차단 (throw 아님) |
| 순환 computed | `_computing` 가드 → `"Circular dependency detected"` throw |
| 무한 이펙트 루프 | `MAX_ITERATIONS = 100` → 진단 메시지와 함께 throw |
| 무한 리다이렉트 루프 | `MAX_REDIRECTS = 10` → `console.error` + 중지 |
| BatchQueue 오류 | 모든 콜백 실행; 첫 번째 오류 재throw, 후속은 로깅 (P4) |
| 시그널 구독자 오류 | `console.error` + 계속 (알림 루프를 깨뜨리지 않음) |
| 재진입 시그널 알림 | `MAX_ITERATIONS = 100` → `console.error` + 중단 |
| 컨텍스트 미발견 | `inject()`가 provider 없고 fallback 없으면 throw |
| 인스턴스화 외부의 훅 | `onAttach`/`onDetach`가 현재 훅 컨텍스트 없으면 throw |

### 6.4 Disposable 패턴

모든 구독, 이펙트, 바인딩이 `dispose()`를 가진 `Disposable`을 반환:

```
Framework.mount() → MountHandle
    ├── reactive autorun → Disposable
    ├── router.onChange → Disposable
    └── plugin.view() → PluginView (destroy() 보유)

Framework.unmount(handle)
    ├── plugin.beforeUnmount 훅
    ├── plugin view destroy()
    ├── 모든 구독 해제
    ├── component.destroy() (detach 훅 실행)
    └── renderer.unmount()
```

---

## 7. 데이터 흐름 다이어그램

### 7.1 VDOM 렌더 사이클

```
Signal.set(value)
    ↓
batchQueue.batch(() => {
    graphSignal.onWrite → incrementVersion + propagateDirty
})
    ↓ 배치 깊이 → 0
flush()
    ↓
effect.execute() [createView/mountWithReactiveTracking의 autorun]
    ↓
renderer.update(mountHandle)
    ↓
VDOMRenderer.update:
    newVNode = renderFn()       // 컴포넌트 렌더 재호출
    patchVNode(old, new, el)    // Diff 및 재조정
    handle.currentVNode = new
```

### 7.2 Direct DOM 렌더 사이클

```
Signal.set(value)
    ↓
batchQueue.batch(() => {
    graphSignal.onWrite → incrementVersion + propagateDirty
})
    ↓ 배치 깊이 → 0
flush()
    ↓
effect.execute() [applyProp/createReactiveChild의 세밀한 autorun]
    ↓
직접 DOM 변경:
    ├── 리액티브 prop:   setAttr(el, key, value())
    ├── 리액티브 style:  applyStyle(el, value())
    └── 리액티브 child:  Text.data = String(value) [빠른 경로]
                      또는 replaceNodes(oldNodes, newNodes) [느린 경로]
```

### 7.3 컴포넌트 라이프사이클

```
framework.mount(container, MyComponent, props)
    ↓
plugin.beforeMount() 훅
    ↓
component.define(MyComponent)   → ComponentHandle { factory }
component.instantiate(handle, props)
    ↓ pushHookContext
    factory(props)   // 사용자 코드 실행, 훅 등록
        onAttach(() => { ... })
        onDetach(() => { ... })
        return () => JSX  // 렌더 함수
    ↓ popHookContext
    ↓
renderer.createView(handle, props) → View
    ↓
reactive.autorun(() => {
    renderer.mount(view, container)  // 또는 renderer.update(handle)
})
    ↓
instance.attach()   // onAttach 훅 실행
    ↓
plugin.view(framework, container) → PluginView[]
plugin.afterMount(mountHandle)
    ↓
--- 라이브 상태 ---
    ↓
framework.unmount(handle)
    ↓
plugin.beforeUnmount()
pluginView.destroy()
구독 해제
component.destroy(instance)
    ↓ instance.detach()  // 정리 함수 + onDetach 훅 실행
renderer.unmount(handle)
```

### 7.4 라우트 내비게이션

```
사용자가 <a href="#/users/42"> 클릭
    ↓
window hashchange 이벤트
    ↓
hashListener.handler()
    ↓
sanitizePath(hash)
    ↓
hashRouter 내부:
    resolve(path) → HashRouteMatch { matched, route, params, path }
    ↓
    runGuards(to, from)
        ↓ guard가 false 반환 → URL 되돌림, 중지
        ↓ guard가 문자열 반환 → 리다이렉트 (새 경로 해석, setPath)
        ↓ guard가 void 반환 → 계속
    ↓
    lastMatch = finalMatch
    모든 콜백 알림
    ↓
routerView 플러그인 콜백:
    route = routes.find(r => r.path === match.path)
    viewHandle.replace(route.component)
        ↓
        이전 컴포넌트: autorun 해제 + component.destroy
        새 컴포넌트: define + instantiate + createView + mount
```
