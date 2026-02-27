# JSX Support + h() Decoupling Design

## Problem

1. `h()`가 `@forge/primitives`에 있지만, h()는 VNode IR을 생성하는 vdom 전략의 일부
2. `vdom-renderer` 인터페이스에 `h()`가 노출되어 렌더러와 View Expression이 결합됨
3. 데모 코드가 `renderer.h('div', ...)` 형태로 가독성이 떨어짐

## Architecture Principle

```
View Expression (h, JSX)  →  IR (VNode)  →  Renderer (mount/patch/unmount)
        ↑ 분리된 관심사                          ↑ 분리된 관심사
```

- h(), VNode, vdom-renderer는 하나의 "vdom 전략 묶음"
- h()는 사용자용 공개 API → vdom-renderer에서 export
- primitives의 createVNode()은 내부 저수준 팩토리 (외부 미노출)
- JSX-runtime은 vdom 전략의 서브모듈

## Changes

### 1. primitives: h()를 외부 API에서 제거

- `vnode.ts`의 `h()` 함수명을 `createVNode()`으로 변경 (내부용)
- `dom/index.ts`에서 `h` export 제거, `createVNode` 내부 export만 유지
- `error-boundary.ts` 등 primitives 내부에서는 `createVNode` 사용

### 2. strategies/vdom-renderer: h() 공개 API 제공

- `h()` 함수를 vdom-renderer 모듈에서 독립 export
- `VDOMRenderer` 인터페이스에서 `h` 제거
- `jsx-runtime.ts` 추가 — h()를 호출하는 JSX 자동 변환 어댑터
- `jsx-dev-runtime.ts` 추가

### 3. strategies/package.json: exports 추가

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./jsx-runtime": "./src/vdom-renderer/jsx-runtime.ts",
    "./jsx-dev-runtime": "./src/vdom-renderer/jsx-dev-runtime.ts"
  }
}
```

### 4. demo: JSX로 전환

- `tsconfig.json`에 `jsx: "react-jsx"`, `jsxImportSource: "@forge/strategies"`
- `index.ts` → `index.tsx` 변환
- `renderer.h(...)` → JSX 문법

## File Changes

| File | Change |
|------|--------|
| `primitives/src/dom/vnode.ts` | `h()` → `createVNode()` 이름 변경 |
| `primitives/src/dom/index.ts` | `h` export 제거, `createVNode` 유지 |
| `primitives/src/dom/error-boundary.ts` | `h` → `createVNode` |
| `primitives/src/__tests__/*.test.ts` | `h` → strategies에서 import |
| `strategies/src/vdom-renderer/index.ts` | 인터페이스에서 `h` 제거, `h` 독립 export |
| `strategies/src/vdom-renderer/jsx-runtime.ts` | NEW |
| `strategies/src/vdom-renderer/jsx-dev-runtime.ts` | NEW |
| `strategies/src/index.ts` | `h` export 추가 |
| `strategies/package.json` | exports 서브패스 추가 |
| `demo/tsconfig.json` | JSX 설정 추가 |
| `demo/src/index.ts` → `index.tsx` | JSX 문법 전환 |
