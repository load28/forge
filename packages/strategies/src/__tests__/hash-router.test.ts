import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hashRouter } from '../hash-router/index';

describe('hashRouter strategy', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('should implement Router protocol', () => {
    const router = hashRouter();
    expect(router.current).toBeTypeOf('function');
    expect(router.onChange).toBeTypeOf('function');
    expect(router.go).toBeTypeOf('function');
    expect(router.register).toBeTypeOf('function');
    router.destroy();
  });

  it('should register routes and match current', () => {
    window.location.hash = '#/about';
    const router = hashRouter();
    router.register({ path: '/about', name: 'about' });

    const match = router.current();
    expect(match.matched).toBe(true);
    expect(match.route?.name).toBe('about');
    router.destroy();
  });

  it('should navigate via go()', () => {
    const router = hashRouter();
    router.register({ path: '/contact', name: 'contact' });
    router.go('/contact');
    expect(window.location.hash).toBe('#/contact');
    router.destroy();
  });

  it('should extract params', () => {
    window.location.hash = '#/users/42';
    const router = hashRouter();
    router.register({ path: '/users/:id', name: 'user' });

    const match = router.current();
    expect(match.params).toEqual({ id: '42' });
    router.destroy();
  });

  it('should return unmatched for unknown routes', () => {
    window.location.hash = '#/unknown';
    const router = hashRouter();
    router.register({ path: '/home', name: 'home' });

    const match = router.current();
    expect(match.matched).toBe(false);
    router.destroy();
  });
});
