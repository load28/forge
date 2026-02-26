import { describe, it, expectTypeOf } from 'vitest';
import type {
  ReactiveSystem,
  Renderer,
  Router,
  ComponentSystem,
  Scheduler,
  Disposable,
  MountHandle,
  ComponentHandle,
  ContextKey,
  Props,
  Cleanup,
} from '../index';

describe('Protocol types', () => {
  it('should define Disposable', () => {
    expectTypeOf<Disposable>().toHaveProperty('dispose');
  });

  it('should define ReactiveSystem with autorun and batch', () => {
    expectTypeOf<ReactiveSystem>().toHaveProperty('autorun');
    expectTypeOf<ReactiveSystem>().toHaveProperty('batch');
  });

  it('should define Renderer with generic Representation', () => {
    type VDOMRenderer = Renderer<{ tag: string }>;
    expectTypeOf<VDOMRenderer>().toHaveProperty('createView');
    expectTypeOf<VDOMRenderer>().toHaveProperty('mount');
    expectTypeOf<VDOMRenderer>().toHaveProperty('update');
    expectTypeOf<VDOMRenderer>().toHaveProperty('unmount');
  });

  it('should define Router with generic RouteMatch', () => {
    type URLRouter = Router<{ path: string; params: Record<string, string> }>;
    expectTypeOf<URLRouter>().toHaveProperty('current');
    expectTypeOf<URLRouter>().toHaveProperty('onChange');
    expectTypeOf<URLRouter>().toHaveProperty('go');
    expectTypeOf<URLRouter>().toHaveProperty('register');
  });

  it('should define ComponentSystem with generic Definition and Instance', () => {
    expectTypeOf<ComponentSystem>().toHaveProperty('define');
    expectTypeOf<ComponentSystem>().toHaveProperty('instantiate');
    expectTypeOf<ComponentSystem>().toHaveProperty('destroy');
    expectTypeOf<ComponentSystem>().toHaveProperty('provide');
    expectTypeOf<ComponentSystem>().toHaveProperty('inject');
    expectTypeOf<ComponentSystem>().toHaveProperty('onAttach');
    expectTypeOf<ComponentSystem>().toHaveProperty('onDetach');
  });

  it('should define Scheduler', () => {
    expectTypeOf<Scheduler>().toHaveProperty('schedule');
    expectTypeOf<Scheduler>().toHaveProperty('cancel');
    expectTypeOf<Scheduler>().toHaveProperty('flush');
  });
});
