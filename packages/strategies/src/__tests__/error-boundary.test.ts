import { describe, it, expect } from 'vitest';
import { errorBoundary, tryCatchRender } from '../vdom-renderer/error-boundary';
import { createVNode as h } from '@forge/primitives';

describe('error-boundary (DX-XC-1)', () => {
  it('should create an error boundary vnode with handler', () => {
    const handler = (err: unknown) => h('div', null, `Error: ${err}`);
    const vnode = errorBoundary(handler, h('span', null, 'child'));
    expect(vnode._errorHandler).toBe(handler);
    expect(vnode.children).toHaveLength(1);
  });

  it('tryCatchRender should return normal result when no error', () => {
    const result = tryCatchRender(
      () => h('div', null, 'ok'),
      () => h('div', null, 'error'),
    );
    expect(result.tag).toBe('div');
    expect(result.children[0]).toBe('ok');
  });

  it('tryCatchRender should return fallback on error', () => {
    const result = tryCatchRender(
      () => { throw new Error('boom'); },
      (err) => h('div', { class: 'error' }, String(err)),
    );
    expect(result.tag).toBe('div');
    expect(result.props?.class).toBe('error');
  });

  it('tryCatchRender should return empty span when handler returns null', () => {
    const result = tryCatchRender(
      () => { throw new Error('boom'); },
      () => null,
    );
    expect(result.tag).toBe('span');
  });
});
