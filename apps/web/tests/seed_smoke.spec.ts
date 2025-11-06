/**
 * Seed Smoke Test
 * 
 * Playwright smoke test for seed validation.
 * Optional: Skip in CI if heavy.
 */

import { test, expect } from '@playwright/test';

test.describe('Seed Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'founder@puzzelcx.local');
    await page.fill('input[name="password"]', 'changeme');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard/okrs');
  });

  test('OKR list renders with counts > 0 for tenant scope', async ({ page }) => {
    await page.goto('/dashboard/okrs?scope=tenant');
    
    const okrList = page.locator('[data-testid="okr-list"]');
    await expect(okrList).toBeVisible();
    
    const okrCount = await page.locator('[data-testid="okr-item"]').count();
    expect(okrCount).toBeGreaterThan(0);
  });

  test('Cycle selector includes Q1 2026', async ({ page }) => {
    await page.goto('/dashboard/okrs');
    
    const cycleSelector = page.locator('[data-testid="cycle-selector"]');
    await cycleSelector.click();
    
    await expect(page.locator('text=Q1 2026')).toBeVisible();
    await expect(page.locator('text=Q4 2025')).toBeVisible();
    await expect(page.locator('text=Q2 2026')).toBeVisible();
    await expect(page.locator('text=Q3 2026')).toBeVisible();
  });

  test('SUPERUSER banner (read-only) visible', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'platform@puzzelcx.local');
    await page.fill('input[name="password"]', 'changeme');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard/okrs');
    
    const superuserBanner = page.locator('[data-testid="superuser-banner"]');
    await expect(superuserBanner).toBeVisible();
    await expect(superuserBanner).toContainText('read-only');
  });
});

