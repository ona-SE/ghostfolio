import { expect, test } from '@playwright/test';

const API_BASE = 'http://localhost:3333';
const AUTH_STORAGE_KEY = 'auth-token';

/**
 * Fetches the demo JWT from the /api/v1/info endpoint.
 */
async function getDemoAuthToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/v1/info`);
  const info = await res.json();

  if (!info.demoAuthToken) {
    throw new Error('Demo auth token not available from API');
  }

  return info.demoAuthToken;
}

test.describe('Portfolio Performance Chart', () => {
  let demoToken: string;

  test.beforeAll(async () => {
    demoToken = await getDemoAuthToken();
  });

  test.beforeEach(async ({ page }) => {
    // Inject the demo token into both storage mechanisms before navigating
    await page.goto('/');
    await page.evaluate(
      ({ key, token }) => {
        window.localStorage.setItem(key, token);
        window.sessionStorage.setItem(key, token);
      },
      { key: AUTH_STORAGE_KEY, token: demoToken }
    );
  });

  test('renders the analysis page with performance and chart sections', async ({
    page
  }) => {
    await page.goto('/portfolio');

    // Wait for the analysis page to load
    await page.waitForLoadState('networkidle');

    // The page should contain the "Performance" heading inside the
    // benchmark-comparator component
    const performanceHeading = page.locator('gf-benchmark-comparator').first();
    await expect(performanceHeading).toBeVisible({ timeout: 15_000 });

    // The benchmark-comparator should contain a canvas element for the chart
    const performanceCanvas = performanceHeading.locator('canvas');
    await expect(performanceCanvas).toBeVisible({ timeout: 15_000 });
  });

  test('renders the Portfolio Evolution investment chart', async ({ page }) => {
    await page.goto('/portfolio');
    await page.waitForLoadState('networkidle');

    // The analysis page has multiple gf-investment-chart instances:
    // 1. Portfolio Evolution
    // 2. Investment Timeline
    // 3. Dividend Timeline
    const investmentCharts = page.locator('gf-investment-chart');
    await expect(investmentCharts.first()).toBeVisible({ timeout: 15_000 });

    // Each chart should have a canvas element
    const firstChartCanvas = investmentCharts.first().locator('canvas');
    await expect(firstChartCanvas).toBeVisible({ timeout: 15_000 });
  });

  test('displays performance metrics (net performance section)', async ({
    page
  }) => {
    await page.goto('/portfolio');
    await page.waitForLoadState('networkidle');

    // The analysis page shows performance breakdown cards with labels like
    // "Absolute Asset Performance", "Absolute Net Performance", etc.
    const performanceCard = page.locator('mat-card', {
      hasText: 'Absolute Net Performance'
    });
    await expect(performanceCard).toBeVisible({ timeout: 15_000 });

    // The card should contain gf-value components showing the values
    const valueComponents = performanceCard.locator('gf-value');
    await expect(valueComponents.first()).toBeVisible();
  });

  test('benchmark comparator has a "Compare with..." dropdown', async ({
    page
  }) => {
    await page.goto('/portfolio');
    await page.waitForLoadState('networkidle');

    const benchmarkComparator = page.locator('gf-benchmark-comparator');
    await expect(benchmarkComparator).toBeVisible({ timeout: 15_000 });

    // The comparator should have a mat-select with the "Compare with..." label
    const compareDropdown = benchmarkComparator.locator('mat-form-field');
    await expect(compareDropdown).toBeVisible();
  });

  test('renders all three chart sections on the analysis page', async ({
    page
  }) => {
    await page.goto('/portfolio');
    await page.waitForLoadState('networkidle');

    // Verify the chart section headings exist
    const benchmarkComparator = page.locator('gf-benchmark-comparator');
    await expect(benchmarkComparator).toBeVisible({ timeout: 15_000 });

    await expect(
      page.getByText('Portfolio Evolution', { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText('Investment Timeline', { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText('Dividend Timeline', { exact: true })
    ).toBeVisible();

    // All three gf-investment-chart instances should be present
    const charts = page.locator('gf-investment-chart');
    await expect(charts).toHaveCount(3, { timeout: 15_000 });
  });
});
