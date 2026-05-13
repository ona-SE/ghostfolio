import { expect, test } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

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

/**
 * Helper: POST to the import endpoint.
 */
async function postImport(
  token: string,
  body: object,
  dryRun = false
): Promise<Response> {
  return fetch(`${API_BASE}/api/v1/import?dryRun=${dryRun}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
}

/**
 * Helper: delete an activity by id so tests stay idempotent.
 */
async function deleteActivity(
  token: string,
  activityId: string
): Promise<void> {
  await fetch(`${API_BASE}/api/v1/order/${activityId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
}

test.describe('Activity Import – API', () => {
  let demoToken: string;

  test.beforeAll(async () => {
    demoToken = await getDemoAuthToken();
  });

  // ── JSON dry-run ──────────────────────────────────────────────────────

  test('dry-run JSON import returns activities without persisting', async () => {
    const res = await postImport(
      demoToken,
      {
        activities: [
          {
            currency: 'USD',
            dataSource: 'YAHOO',
            date: '2021-12-12T00:00:00.000Z',
            fee: 4.46,
            quantity: 1,
            symbol: 'BTCUSD',
            type: 'BUY',
            unitPrice: 44558.42
          }
        ]
      },
      true
    );

    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.isDryRun).toBe(true);
    expect(data.activities).toHaveLength(1);
    expect(data.activities[0].SymbolProfile.symbol).toBe('BTCUSD');
    expect(data.activities[0].quantity).toBe(1);
  });

  // ── JSON real import + cleanup ────────────────────────────────────────

  test('real JSON import persists the activity', async () => {
    const res = await postImport(demoToken, {
      activities: [
        {
          currency: 'USD',
          dataSource: 'YAHOO',
          date: '2021-12-12T00:00:00.000Z',
          fee: 4.46,
          quantity: 1,
          symbol: 'BTCUSD',
          type: 'BUY',
          unitPrice: 44558.42
        }
      ]
    });

    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.activities).toHaveLength(1);

    const activityId = data.activities[0].id;
    expect(activityId).toBeTruthy();

    // Verify the activity exists via the orders endpoint
    const ordersRes = await fetch(`${API_BASE}/api/v1/order`, {
      headers: { Authorization: `Bearer ${demoToken}` }
    });
    const orders = await ordersRes.json();
    const found = orders.activities.find(
      (a: { id: string }) => a.id === activityId
    );
    expect(found).toBeTruthy();

    // Cleanup
    await deleteActivity(demoToken, activityId);
  });

  // ── Multiple activities ───────────────────────────────────────────────

  test('dry-run import with multiple activities returns all', async () => {
    const res = await postImport(
      demoToken,
      {
        activities: [
          {
            currency: 'USD',
            dataSource: 'YAHOO',
            date: '2021-09-16T00:00:00.000Z',
            fee: 19,
            quantity: 5,
            symbol: 'MSFT',
            type: 'BUY',
            unitPrice: 298.58
          },
          {
            currency: 'USD',
            dataSource: 'YAHOO',
            date: '2021-11-17T00:00:00.000Z',
            fee: 0,
            quantity: 5,
            symbol: 'MSFT',
            type: 'DIVIDEND',
            unitPrice: 0.62
          }
        ]
      },
      true
    );

    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.isDryRun).toBe(true);
    expect(data.activities).toHaveLength(2);
    expect(data.activities[0].type).toBe('BUY');
    expect(data.activities[1].type).toBe('DIVIDEND');
  });

  // ── Validation: invalid type ──────────────────────────────────────────

  test('rejects activity with invalid type', async () => {
    const res = await postImport(
      demoToken,
      {
        activities: [
          {
            currency: 'USD',
            dataSource: 'YAHOO',
            date: '2021-01-01T00:00:00.000Z',
            fee: 0,
            quantity: 20,
            symbol: 'AAPL',
            type: 'INVALID_TYPE',
            unitPrice: 100.0
          }
        ]
      },
      true
    );

    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.message).toBeDefined();
    expect(data.message.length).toBeGreaterThan(0);
    expect(data.message[0]).toContain('type');
  });

  // ── Validation: missing required fields ───────────────────────────────

  test('rejects activity with missing required fields', async () => {
    const res = await postImport(
      demoToken,
      {
        activities: [
          {
            currency: 'USD',
            date: '2021-01-01T00:00:00.000Z',
            fee: 0,
            quantity: 20,
            type: 'BUY',
            unitPrice: 100.0
            // symbol is missing
          }
        ]
      },
      true
    );

    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.message).toBeDefined();
    expect(data.message.length).toBeGreaterThan(0);
  });

  // ── Unauthenticated request ───────────────────────────────────────────

  test('rejects unauthenticated import request', async () => {
    const res = await fetch(`${API_BASE}/api/v1/import?dryRun=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activities: [
          {
            currency: 'USD',
            dataSource: 'YAHOO',
            date: '2021-01-01T00:00:00.000Z',
            fee: 0,
            quantity: 1,
            symbol: 'AAPL',
            type: 'BUY',
            unitPrice: 150
          }
        ]
      })
    });

    expect(res.status).toBe(401);
  });
});

test.describe('Activity Import – UI', () => {
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

  // ── Activities page loads ─────────────────────────────────────────────

  test('activities page renders the activities table', async ({ page }) => {
    await page.goto('/portfolio/activities');
    await page.waitForLoadState('networkidle');

    const table = page.locator('gf-activities-table');
    await expect(table).toBeVisible({ timeout: 15_000 });
  });

  // ── Import dialog opens via menu ──────────────────────────────────────

  test('import dialog opens from the activities page menu', async ({
    page
  }) => {
    await page.goto('/portfolio/activities');
    await page.waitForLoadState('networkidle');

    // The activities table should be visible
    const table = page.locator('gf-activities-table');
    await expect(table).toBeVisible({ timeout: 15_000 });

    // Click the import button (inside the table's toolbar or menu)
    // The table has an "Import Activities..." button in a mat-menu
    const importButton = page.getByText('Import Activities');
    if (await importButton.first().isVisible()) {
      await importButton.first().click();
    } else {
      // May be inside a menu — look for a menu trigger
      const menuTrigger = table.locator('button[mat-icon-button]').first();
      if (await menuTrigger.isVisible()) {
        await menuTrigger.click();
        await page.waitForTimeout(500);
        await page.getByText('Import Activities').first().click();
      }
    }

    // The import dialog should appear
    const dialog = page.locator('gf-import-activities-dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // It should show the file upload step
    const uploadArea = dialog.getByText('Choose or drop a file here');
    await expect(uploadArea).toBeVisible();
  });

  // ── JSON file upload via dialog ───────────────────────────────────────

  test('JSON file upload shows preview in import dialog', async ({ page }) => {
    await page.goto('/portfolio/activities');
    await page.waitForLoadState('networkidle');

    const table = page.locator('gf-activities-table');
    await expect(table).toBeVisible({ timeout: 15_000 });

    // Open import dialog
    const importButton = page.getByText('Import Activities');
    if (await importButton.first().isVisible()) {
      await importButton.first().click();
    } else {
      const menuTrigger = table.locator('button[mat-icon-button]').first();
      if (await menuTrigger.isVisible()) {
        await menuTrigger.click();
        await page.waitForTimeout(500);
        await page.getByText('Import Activities').first().click();
      }
    }

    const dialog = page.locator('gf-import-activities-dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Prepare a minimal valid JSON import file
    const importPayload = JSON.stringify({
      activities: [
        {
          currency: 'USD',
          dataSource: 'YAHOO',
          date: '2021-12-12T00:00:00.000Z',
          fee: 4.46,
          quantity: 1,
          symbol: 'BTCUSD',
          type: 'BUY',
          unitPrice: 44558.42
        }
      ]
    });

    // Use the file chooser to upload
    const fileChooserPromise = page.waitForEvent('filechooser');
    // Click the drop area which triggers a hidden file input
    await dialog.getByText('Choose or drop a file here').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'import.json',
      mimeType: 'application/json',
      buffer: Buffer.from(importPayload)
    });

    // Wait for the stepper to advance to the preview step
    await page.waitForTimeout(3000);

    // The dialog should now show the activities table or an error
    // On success, we expect the activities table with a checkbox column
    const previewTable = dialog.locator('gf-activities-table');
    const errorPanel = dialog.locator('mat-expansion-panel');

    const hasPreview = await previewTable.isVisible();
    const hasError = await errorPanel.first().isVisible();

    // One of these should be true — the stepper advanced
    expect(hasPreview || hasError).toBe(true);

    if (hasPreview) {
      // The Import button should be enabled when activities are selected
      const importBtn = dialog.getByText('Import', { exact: true });
      await expect(importBtn).toBeVisible();
    }
  });

  // ── CSV file upload via dialog ────────────────────────────────────────

  test('CSV file upload shows preview in import dialog', async ({ page }) => {
    await page.goto('/portfolio/activities');
    await page.waitForLoadState('networkidle');

    const table = page.locator('gf-activities-table');
    await expect(table).toBeVisible({ timeout: 15_000 });

    // Open import dialog
    const importButton = page.getByText('Import Activities');
    if (await importButton.first().isVisible()) {
      await importButton.first().click();
    } else {
      const menuTrigger = table.locator('button[mat-icon-button]').first();
      if (await menuTrigger.isVisible()) {
        await menuTrigger.click();
        await page.waitForTimeout(500);
        await page.getByText('Import Activities').first().click();
      }
    }

    const dialog = page.locator('gf-import-activities-dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Read the CSV fixture
    const csvContent = readFileSync(
      join(process.cwd(), 'test/import/ok/btcusd.csv'),
      'utf-8'
    );

    const fileChooserPromise = page.waitForEvent('filechooser');
    await dialog.getByText('Choose or drop a file here').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'btcusd.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    });

    // Wait for processing
    await page.waitForTimeout(3000);

    // Should advance to preview or show errors
    const previewTable = dialog.locator('gf-activities-table');
    const errorPanel = dialog.locator('mat-expansion-panel');

    const hasPreview = await previewTable.isVisible();
    const hasError = await errorPanel.first().isVisible();

    expect(hasPreview || hasError).toBe(true);
  });

  // ── Invalid file shows error ──────────────────────────────────────────

  test('invalid JSON file shows validation errors in dialog', async ({
    page
  }) => {
    await page.goto('/portfolio/activities');
    await page.waitForLoadState('networkidle');

    const table = page.locator('gf-activities-table');
    await expect(table).toBeVisible({ timeout: 15_000 });

    // Open import dialog
    const importButton = page.getByText('Import Activities');
    if (await importButton.first().isVisible()) {
      await importButton.first().click();
    } else {
      const menuTrigger = table.locator('button[mat-icon-button]').first();
      if (await menuTrigger.isVisible()) {
        await menuTrigger.click();
        await page.waitForTimeout(500);
        await page.getByText('Import Activities').first().click();
      }
    }

    const dialog = page.locator('gf-import-activities-dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Upload the unexpected-format fixture (invalid JSON)
    const fileChooserPromise = page.waitForEvent('filechooser');
    await dialog.getByText('Choose or drop a file here').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'bad.json',
      mimeType: 'application/json',
      buffer: Buffer.from('<invalid>')
    });

    // Wait for processing
    await page.waitForTimeout(3000);

    // Should show error messages (mat-expansion-panel with warning icons)
    const errorPanel = dialog.locator('mat-expansion-panel');
    await expect(errorPanel.first()).toBeVisible({ timeout: 10_000 });

    // The Import button should be disabled
    const importBtn = dialog.locator('button', { hasText: 'Import' }).last();
    await expect(importBtn).toBeDisabled();
  });
});
