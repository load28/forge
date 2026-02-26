import type { VNode, VNodeChild } from './vnode';

function isVNode(child: VNodeChild): child is VNode {
  return child != null && typeof child === 'object' && 'tag' in child;
}

function createEl(vnode: VNode): Node {
  if (typeof vnode.tag === 'function') {
    throw new Error('Function components should be resolved before patching');
  }

  const el = document.createElement(vnode.tag);
  vnode.el = el;

  if (vnode.props) {
    for (const [key, value] of Object.entries(vnode.props)) {
      if (key === 'key') continue;
      if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
      } else {
        el.setAttribute(key === 'className' ? 'class' : key, String(value));
      }
    }
  }

  for (const child of vnode.children) {
    if (isVNode(child)) {
      el.appendChild(createEl(child));
    } else if (child != null) {
      el.appendChild(document.createTextNode(String(child)));
    }
  }

  return el;
}

export function mount(vnode: VNode, container: Element): void {
  const el = createEl(vnode);
  container.appendChild(el);
}

export function unmount(vnode: VNode): void {
  vnode.el?.parentNode?.removeChild(vnode.el);
}

export function patch(oldVNode: VNode, newVNode: VNode, container: Element): void {
  if (oldVNode.tag !== newVNode.tag) {
    const newEl = createEl(newVNode);
    oldVNode.el!.parentNode!.replaceChild(newEl, oldVNode.el!);
    return;
  }

  const el = oldVNode.el as HTMLElement;
  newVNode.el = el;

  // patch props
  const oldProps = oldVNode.props ?? {};
  const newProps = newVNode.props ?? {};

  for (const key of Object.keys(oldProps)) {
    if (key === 'key') continue;
    if (!(key in newProps)) {
      if (key.startsWith('on')) {
        el.removeEventListener(key.slice(2).toLowerCase(), oldProps[key] as EventListener);
      } else {
        el.removeAttribute(key === 'className' ? 'class' : key);
      }
    }
  }

  for (const [key, value] of Object.entries(newProps)) {
    if (key === 'key') continue;
    if (key.startsWith('on') && typeof value === 'function') {
      if (oldProps[key] !== value) {
        if (oldProps[key]) {
          el.removeEventListener(key.slice(2).toLowerCase(), oldProps[key] as EventListener);
        }
        el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
      }
    } else {
      el.setAttribute(key === 'className' ? 'class' : key, String(value));
    }
  }

  // patch children
  patchChildren(oldVNode.children, newVNode.children, el);
}

function patchChildren(oldCh: VNodeChild[], newCh: VNodeChild[], parent: Element): void {
  const oldLen = oldCh.length;
  const newLen = newCh.length;
  const commonLen = Math.min(oldLen, newLen);

  for (let i = 0; i < commonLen; i++) {
    const oldChild = oldCh[i];
    const newChild = newCh[i];

    if (isVNode(oldChild) && isVNode(newChild)) {
      patch(oldChild, newChild, parent);
    } else if (oldChild !== newChild) {
      const oldNode = isVNode(oldChild) ? oldChild.el! : parent.childNodes[i];
      if (oldNode) {
        if (isVNode(newChild)) {
          parent.replaceChild(createEl(newChild), oldNode);
        } else if (newChild != null) {
          parent.replaceChild(document.createTextNode(String(newChild)), oldNode);
        }
      }
    }
  }

  for (let i = commonLen; i < newLen; i++) {
    const child = newCh[i];
    if (isVNode(child)) {
      parent.appendChild(createEl(child));
    } else if (child != null) {
      parent.appendChild(document.createTextNode(String(child)));
    }
  }

  for (let i = oldLen - 1; i >= newLen; i--) {
    const child = oldCh[i];
    if (isVNode(child) && child.el) {
      parent.removeChild(child.el);
    } else if (parent.childNodes[i]) {
      parent.removeChild(parent.childNodes[i]);
    }
  }
}
