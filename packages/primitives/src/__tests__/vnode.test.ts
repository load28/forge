import { describe, it, expect } from 'vitest';
import { h, type VNode } from '../dom/vnode';

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
});
