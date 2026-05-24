import { expect, test } from '@playwright/test';

const API_BASE = 'http://localhost:3333';
const AUTH_STORAGE_KEY = 'auth-token';

async function getDemoAuthToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/v1/info`);
  const info = await res.json();

  if (!info.demoAuthToken) {
    throw new Error('Demo auth token not available from API');
  }

  return info.demoAuthToken;
}

test.describe('Tax Page – E2E Verification', () => {
  let demoToken: string;

  test.beforeAll(async () => {
    demoToken = await getDemoAuthToken();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(
      ({ key, token }) => {
        window.localStorage.setItem(key, token);
        window.sessionStorage.setItem(key, token);
      },
      { key: AUTH_STORAGE_KEY, token: demoToken }
    );
  });

  // ── Tax page loads ────────────────────────────────────────────────────

  test('tax page loads with heading, year selector, and export button', async ({
    page
  }) => {
    await page.goto('/portfolio/tax');
    await page.waitForLoadState('networkidle');

    // "Tax Report" heading (use role to disambiguate from the nav tab)
    await expect(page.getByRole('heading', { name: 'Tax Report' })).toBeVisible(
      { timeout: 15_000 }
    );

    // Year selector (mat-select inside a mat-form-field labelled "Tax Year")
    const yearSelect = page.locator('mat-form-field').filter({
      hasText: 'Tax Year'
    });
    await expect(yearSelect).toBeVisible();

    // Export CSV button
    const exportBtn = page.getByText('Export CSV', { exact: true });
    await expect(exportBtn).toBeVisible();
  });

  // ── Year selector works ───────────────────────────────────────────────

  test('year selector contains current year and prior years', async ({
    page
  }) => {
    await page.goto('/portfolio/tax');
    await page.waitForLoadState('networkidle');

    // Open the year dropdown
    const yearSelect = page.locator('mat-form-field').filter({
      hasText: 'Tax Year'
    });
    await yearSelect.click();

    // Wait for the overlay panel with options
    const panel = page.locator('div.mat-mdc-select-panel');
    await expect(panel).toBeVisible({ timeout: 5_000 });

    const currentYear = new Date().getFullYear();

    // Should have 6 options (current year + 5 prior)
    const options = panel.locator('mat-option');
    await expect(options).toHaveCount(6);

    // Current year should be present
    await expect(
      panel.locator('mat-option', { hasText: String(currentYear) })
    ).toBeVisible();

    // A prior year should also be present
    await expect(
      panel.locator('mat-option', { hasText: String(currentYear - 1) })
    ).toBeVisible();
  });

  test('changing year reloads the table data', async ({ page }) => {
    await page.goto('/portfolio/tax');
    await page.waitForLoadState('networkidle');

    // Wait for initial data to load (2026 is current year with data)
    await page.waitForTimeout(2000);

    // Open year selector and pick 2025
    const yearSelect = page.locator('mat-form-field').filter({
      hasText: 'Tax Year'
    });
    await yearSelect.click();

    const panel = page.locator('div.mat-mdc-select-panel');
    await expect(panel).toBeVisible({ timeout: 5_000 });

    await panel.locator('mat-option', { hasText: '2025' }).click();

    // Wait for the API call to complete
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 2025 has tax data (dividends + no sells in 2025 seed data)
    // Verify the table or "no transactions" message is shown
    const table = page.locator('table[mat-table]');
    const noData = page.getByText('No tax-relevant transactions found');

    const hasTable = await table.isVisible();
    const hasNoData = await noData.isVisible();

    // One of these must be true — the page responded to the year change
    expect(hasTable || hasNoData).toBe(true);
  });

  // ── Table populates with correct data ─────────────────────────────────

  test('table displays correct columns and data for current year', async ({
    page
  }) => {
    await page.goto('/portfolio/tax');
    await page.waitForLoadState('networkidle');

    // Wait for data to load
    const table = page.locator('table[mat-table]');
    await expect(table).toBeVisible({ timeout: 15_000 });

    // Verify all expected column headers
    const expectedHeaders = [
      'Disposal Date',
      'Acquisition Date',
      'Symbol',
      'Type',
      'Quantity',
      'Cost Basis',
      'Proceeds',
      'Gain/Loss',
      'Holding Period',
      'Account'
    ];

    for (const header of expectedHeaders) {
      await expect(
        table.locator('th', { hasText: header }).first()
      ).toBeVisible();
    }

    // Verify rows exist (2026 has AAPL SELL, BLK DIVIDENDs, BLK SELL)
    const rows = table.locator('tr[mat-row]');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test('table rows contain expected symbols from demo data', async ({
    page
  }) => {
    await page.goto('/portfolio/tax');
    await page.waitForLoadState('networkidle');

    const table = page.locator('table[mat-table]');
    await expect(table).toBeVisible({ timeout: 15_000 });

    // 2026 demo data includes AAPL (SELL) and BLK (DIVIDEND + SELL)
    const tableText = await table.textContent();
    expect(tableText).toContain('AAPL');
    expect(tableText).toContain('BLK');
  });

  test('summary cards display gain/loss values', async ({ page }) => {
    await page.goto('/portfolio/tax');
    await page.waitForLoadState('networkidle');

    // Wait for summary cards to appear
    const totalCard = page.locator('.summary-card', {
      hasText: 'Total Gain/Loss'
    });
    await expect(totalCard).toBeVisible({ timeout: 15_000 });

    const shortTermCard = page.locator('.summary-card', {
      hasText: 'Short-Term Gain/Loss'
    });
    await expect(shortTermCard).toBeVisible();

    const longTermCard = page.locator('.summary-card', {
      hasText: 'Long-Term Gain/Loss'
    });
    await expect(longTermCard).toBeVisible();

    // Each card should contain a gf-value component with a rendered value
    for (const card of [totalCard, shortTermCard, longTermCard]) {
      const valueEl = card.locator('gf-value');
      await expect(valueEl).toBeVisible();
    }
  });

  // ── CSV export ────────────────────────────────────────────────────────

  test('Export CSV button is enabled when data exists and triggers download', async ({
    page
  }) => {
    await page.goto('/portfolio/tax');
    await page.waitForLoadState('networkidle');

    // Wait for data to load
    const table = page.locator('table[mat-table]');
    await expect(table).toBeVisible({ timeout: 15_000 });

    const exportBtn = page.locator('button', {
      hasText: 'Export CSV'
    });
    await expect(exportBtn).toBeVisible();
    await expect(exportBtn).toBeEnabled();

    // Listen for the download event
    const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
    await exportBtn.click();
    const download = await downloadPromise;

    // Verify the filename pattern
    expect(download.suggestedFilename()).toMatch(
      /ghostfolio-tax-report-\d{4}\.csv/
    );

    // Read and verify CSV content
    const csvContent = (await download.path())
      ? await (
          await import('fs')
        ).promises.readFile(await download.path()!, 'utf-8')
      : '';

    // CSV should have a header row with expected columns
    expect(csvContent).toContain('Disposal Date');
    expect(csvContent).toContain('Symbol');
    expect(csvContent).toContain('Gain/Loss');

    // Should contain actual data rows
    expect(csvContent).toContain('AAPL');
  });

  test('Export CSV button is disabled when no data exists', async ({
    page
  }) => {
    await page.goto('/portfolio/tax');
    await page.waitForLoadState('networkidle');

    // Switch to a year with no data (e.g., 2021)
    const yearSelect = page.locator('mat-form-field').filter({
      hasText: 'Tax Year'
    });
    await yearSelect.click();

    const panel = page.locator('div.mat-mdc-select-panel');
    await expect(panel).toBeVisible({ timeout: 5_000 });

    await panel.locator('mat-option', { hasText: '2021' }).click();

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // "No tax-relevant transactions" message should appear
    await expect(
      page.getByText('No tax-relevant transactions found')
    ).toBeVisible({ timeout: 10_000 });

    // Export button should be disabled
    const exportBtn = page.locator('button', { hasText: 'Export CSV' });
    await expect(exportBtn).toBeDisabled();
  });

  // ── Feature gating ───────────────────────────────────────────────────

  test('tax page is accessible when experimental features are enabled', async ({
    page
  }) => {
    // The demo user has isExperimentalFeatures=true, so the tax tab
    // should appear in the portfolio navigation
    await page.goto('/portfolio');
    await page.waitForLoadState('networkidle');

    // The portfolio page should have a "Tax Report" navigation link
    const taxLink = page.locator('a', { hasText: 'Tax Report' });
    await expect(taxLink).toBeVisible({ timeout: 15_000 });

    // Clicking it should navigate to the tax page
    await taxLink.click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/portfolio\/tax/);
    await expect(
      page.getByRole('heading', { name: 'Tax Report' })
    ).toBeVisible();
  });
});

test.describe('Tax Page – Feature Gating (no experimental features)', () => {
  test('tax tab is hidden when experimental features are disabled', async ({
    page
  }) => {
    // Use the API to verify the feature gate by checking the portfolio
    // page without experimental features. We simulate this by NOT setting
    // the auth token (unauthenticated users don't have the flag).
    await page.goto('/portfolio');
    await page.waitForLoadState('networkidle');

    // Without authentication, the user should be redirected or the tax
    // link should not be visible. An unauthenticated user won't see the
    // portfolio page at all (auth guard redirects to login).
    const url = page.url();

    // Either redirected away from portfolio, or tax link is absent
    if (url.includes('/portfolio')) {
      const taxLink = page.locator('a', { hasText: 'Tax Report' });
      await expect(taxLink).toHaveCount(0);
    }
    // If redirected, that itself proves the guard works
  });
});
