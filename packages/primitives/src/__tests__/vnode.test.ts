import { describe, it, expect } from 'vitest';
import { createVNode as h, VNODE_TYPE, type VNode } from '../ir/vnode';

describe('VNode', () => {
  it('should create element vnode', () => {
    const node = h('div', { id: 'app' }, 'hello');
    expect(node.tag).toBe('div');
    expect(node.props).toEqual({ id: 'app' });
    expect(node.children).toEqual(['hello']);
  });

  it('should create nested vnodes', () => {
    const node = h('div', null, h('span', null, 'child'));
    expect(node.children).toHaveLength(1);
    expect((node.children[0] as VNode).tag).toBe('span');
  });

  it('should flatten arrays in children', () => {
    const items = [h('li', null, '1'), h('li', null, '2')];
    const node = h('ul', null, ...items);
    expect(node.children).toHaveLength(2);
  });

  it('should filter out null, undefined, and boolean children', () => {
    const node = h('div', null, 'text', null, undefined, false, true, 0);
    expect(node.children).toEqual(['text', 0]);
  });

  // TC-03: key should be on VNode but stripped from props
  it('should strip key from props', () => {
    const node = h('div', { key: 'mykey', id: 'app' });
    expect(node.key).toBe('mykey');
    expect(node.props).toEqual({ id: 'app' });
    expect(node.props && 'key' in node.props).toBe(false);
  });

  it('should set props to null when key is only prop', () => {
    const node = h('div', { key: 'mykey' });
    expect(node.key).toBe('mykey');
    expect(node.props).toBeNull();
  });

  it('should have $$typeof brand symbol', () => {
    const node = h('div', null);
    expect(node.$$typeof).toBe(VNODE_TYPE);
  });
});
