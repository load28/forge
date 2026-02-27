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

  // DX-2: Navigation guard tests
  it('should support beforeEach navigation guard', () => {
    const router = hashRouter();
    expect(router.beforeEach).toBeTypeOf('function');
    router.destroy();
  });

  it('should allow disposing a navigation guard', () => {
    const router = hashRouter();
    const guard = vi.fn(() => true);
    const disposable = router.beforeEach(guard as any);
    expect(disposable.dispose).toBeTypeOf('function');
    disposable.dispose();
    router.destroy();
  });

  // P3: Guard redirect should sync URL
  it('should update hash when guard redirects', () => {
    const router = hashRouter();
    router.register({ path: '/admin', name: 'admin' });
    router.register({ path: '/login', name: 'login' });

    // Guard redirects /admin → /login
    router.beforeEach((to) => {
      if (to.path === '/admin') return '/login';
    });

    router.go('/admin');
    // Trigger hashchange manually — happy-dom doesn't fire it synchronously
    window.dispatchEvent(new Event('hashchange'));

    // After redirect, hash should be /login
    expect(window.location.hash).toBe('#/login');
    router.destroy();
  });

  // P3: Guard cancellation should revert URL
  it('should revert hash when guard cancels navigation', () => {
    const router = hashRouter();
    router.register({ path: '/home', name: 'home' });
    router.register({ path: '/admin', name: 'admin' });

    // Set initial route
    router.go('/home');
    window.dispatchEvent(new Event('hashchange'));

    // Guard cancels navigation to /admin
    router.beforeEach((to) => {
      if (to.path === '/admin') return false;
    });

    router.go('/admin');
    window.dispatchEvent(new Event('hashchange'));

    // URL should revert to previous path
    expect(window.location.hash).toBe('#/home');
    router.destroy();
  });
});
