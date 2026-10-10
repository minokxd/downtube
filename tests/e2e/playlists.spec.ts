/// <reference lib="dom" />
import { rm } from 'node:fs/promises';
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { createFixture, type Fixture } from './fixtures';

let fixture: Fixture;
let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  fixture = await createFixture();
  app = await electron.launch({ args: ['.'], env: { ...process.env, DOWNTUBE_USER_DATA: fixture.userData } });
  page = await app.firstWindow();
  // A fresh profile has no engine; the library works without it.
  await page.getByRole('button', { name: 'Kütüphaneye geç' }).click();
  await expect(page.getByRole('heading', { name: 'Kütüphane' })).toBeVisible();
});

test.afterAll(async () => {
  await app?.close();
  if (fixture) await rm(fixture.root, { recursive: true, force: true });
});

test('playlists: create, drag in, pick an emoji, select, reorder and play through', async () => {
  const row = page.locator('.playlist-row', { hasText: 'Kedi videoları' });
  const count = row.locator('.playlist-row-count');

  await page.getByRole('button', { name: 'Yeni playlist' }).click();
  await page.getByRole('textbox', { name: 'Yeni playlist' }).fill('Kedi videoları');
  await page.keyboard.press('Enter');
  await expect(row).toBeVisible();

  // Drag a card onto the playlist in the sidebar.
  await page.locator('.card', { hasText: 'Sample video' }).dragTo(row);
  await expect(count).toHaveText('1');

  // Add the other video from the right-click menu.
  await page.locator('.card', { hasText: 'Second video' }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Playliste ekle' }).click();
  await page.getByRole('menuitem', { name: 'Kedi videoları' }).click();
  await expect(count).toHaveText('2');

  // Ctrl+click selects; the selection bar appears and Escape clears it.
  await page.locator('.card', { hasText: 'Sample video' }).click({ modifiers: ['Control'] });
  await page.locator('.card', { hasText: 'Second video' }).click({ modifiers: ['Control'] });
  await expect(page.locator('.selection-bar')).toContainText('2 seçili');
  await page.screenshot({ path: 'test-results/07-selection.png' });
  await page.keyboard.press('Escape');
  await expect(page.locator('.selection-bar')).toHaveCount(0);

  // An emoji from the playlist's own menu.
  await row.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Emoji seç' }).click();
  await page.screenshot({ path: 'test-results/08-emoji.png' });
  await page.getByRole('menuitemradio', { name: '🐱' }).click();
  await expect(row).toContainText('🐱');

  // Open the playlist and move the second card in front of the first.
  await row.click();
  await expect(page.getByRole('heading', { name: 'Kedi videoları' })).toBeVisible();
  const titles = page.locator('.reorder-slot .card-title');
  await expect(titles).toHaveText(['Sample video', 'Second video']);
  await page.locator('.reorder-slot').nth(1).dragTo(page.locator('.reorder-slot').first(), { targetPosition: { x: 8, y: 40 } });
  await expect(titles).toHaveText(['Second video', 'Sample video']);
  await page.screenshot({ path: 'test-results/09-playlist-dark.png' });

  // Play all: the first video in the list starts and the next one follows when it ends.
  await page.getByRole('button', { name: 'Tümünü oynat' }).click();
  await expect(page.locator('.video-title')).toHaveText('Second video');
  await page.locator('video').evaluate(async (el: HTMLVideoElement) => {
    if (el.readyState < 1) await new Promise((resolve) => el.addEventListener('loadedmetadata', resolve, { once: true }));
    el.currentTime = Math.max(0, el.duration - 0.2);
  });
  await expect(page.locator('.video-title')).toHaveText('Sample video');
  await page.keyboard.press('Escape');
  await expect(page.locator('video')).toHaveCount(0);

  // The same page in the light theme.
  await page.getByRole('button', { name: 'Ayarlar' }).click();
  await page.getByRole('radio', { name: 'Açık' }).click();
  await row.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/10-playlist-light.png' });
});
