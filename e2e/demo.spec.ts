import { test, expect } from '@playwright/test';

test.describe('Forge Demo App', () => {
  test.beforeEach(async ({ page }) => {
    // Capture console errors for debugging
    page.on('pageerror', (error) => {
      console.error('Page error:', error.message);
    });
    await page.goto('http://localhost:5173');
    await page.waitForSelector('.app', { timeout: 15000 });
  });

  test('should render home page', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('Forge Demo');
    await expect(page.locator('a')).toHaveText('Go to Counter →');
    await page.screenshot({ path: 'e2e/screenshots/01-home.png', fullPage: true });
  });

  test('should navigate to counter page', async ({ page }) => {
    await page.click('a[href="#/counter"]');
    await expect(page.locator('h1')).toHaveText('Counter');
    await expect(page.locator('.count')).toHaveText('Count: 0');
    await page.screenshot({ path: 'e2e/screenshots/02-counter-initial.png', fullPage: true });
  });

  test('should increment and decrement counter', async ({ page }) => {
    await page.click('a[href="#/counter"]');
    await expect(page.locator('.count')).toHaveText('Count: 0');

    // Click +1 three times
    await page.click('button:has-text("+1")');
    await page.click('button:has-text("+1")');
    await page.click('button:has-text("+1")');
    await expect(page.locator('.count')).toHaveText('Count: 3');
    await page.screenshot({ path: 'e2e/screenshots/03-counter-incremented.png', fullPage: true });

    // Click -1 once
    await page.click('button:has-text("-1")');
    await expect(page.locator('.count')).toHaveText('Count: 2');

    // Click Reset
    await page.click('button:has-text("Reset")');
    await expect(page.locator('.count')).toHaveText('Count: 0');
    await page.screenshot({ path: 'e2e/screenshots/04-counter-reset.png', fullPage: true });
  });

  test('should navigate back to home', async ({ page }) => {
    await page.click('a[href="#/counter"]');
    await expect(page.locator('h1')).toHaveText('Counter');

    await page.click('a[href="#/"]');
    await expect(page.locator('h1')).toHaveText('Forge Demo');
    await page.screenshot({ path: 'e2e/screenshots/05-back-to-home.png', fullPage: true });
  });
});
