import { test, expect } from '@playwright/test';

test.describe('Forge Direct DOM Demo (SolidJS-style)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (error) => {
      console.error('Page error:', error.message);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error('Console error:', msg.text());
      }
    });
    await page.goto('http://localhost:5174');
    await page.waitForSelector('.app', { timeout: 15000 });
  });

  test('should render home page with No VDOM badge', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Forge Direct DOM Demo');
    await expect(page.locator('.badge')).toHaveText('No VDOM');
    await expect(page.locator('a[href="#/counter"]')).toHaveText('Go to Counter →');
    await page.screenshot({ path: 'e2e/screenshots/direct-dom-01-home.png', fullPage: true });
  });

  test('should navigate to counter and interact', async ({ page }) => {
    await page.click('a[href="#/counter"]');
    await expect(page.locator('h1')).toHaveText('Counter');
    await expect(page.locator('.count')).toHaveText('Count: 0');
    await page.screenshot({ path: 'e2e/screenshots/direct-dom-02-counter-initial.png', fullPage: true });

    // Increment 3 times
    await page.click('button:has-text("+1")');
    await page.click('button:has-text("+1")');
    await page.click('button:has-text("+1")');
    await expect(page.locator('.count')).toHaveText('Count: 3');
    await page.screenshot({ path: 'e2e/screenshots/direct-dom-03-counter-incremented.png', fullPage: true });

    // Decrement once
    await page.click('button:has-text("-1")');
    await expect(page.locator('.count')).toHaveText('Count: 2');
    await page.screenshot({ path: 'e2e/screenshots/direct-dom-04-counter-decremented.png', fullPage: true });

    // Reset
    await page.click('button:has-text("Reset")');
    await expect(page.locator('.count')).toHaveText('Count: 0');
    await page.screenshot({ path: 'e2e/screenshots/direct-dom-05-counter-reset.png', fullPage: true });
  });

  test('should navigate back to home', async ({ page }) => {
    await page.click('a[href="#/counter"]');
    await expect(page.locator('h1')).toHaveText('Counter');

    await page.click('a[href="#/"]');
    await expect(page.locator('h1')).toContainText('Forge Direct DOM Demo');
    await page.screenshot({ path: 'e2e/screenshots/direct-dom-06-back-to-home.png', fullPage: true });
  });
});
