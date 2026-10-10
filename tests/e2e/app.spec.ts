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
});

test.afterAll(async () => {
  await app?.close();
  if (fixture) await rm(fixture.root, { recursive: true, force: true });
});

test('setup, library, video, music and settings work together', async () => {
  // A fresh profile has no engine yet, so the setup screen comes first.
  await expect(page.getByRole('heading', { name: 'Motor hazırlanıyor' })).toBeVisible();
  await page.screenshot({ path: 'test-results/01-setup.png' });
  await page.getByRole('button', { name: 'Kütüphaneye geç' }).click();

  await expect(page.getByRole('heading', { name: 'Kütüphane' })).toBeVisible();
  await expect(page.getByText('Sample video')).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/02-library-dark.png' });

  await page.getByRole('button', { name: 'Oynat: Sample video' }).click();
  const video = page.locator('video');
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeGreaterThan(0.5);
  await page.screenshot({ path: 'test-results/03-video.png' });

  // Chapters: marks on the seek bar, the current name next to the time, and a menu that jumps.
  await video.evaluate((el: HTMLVideoElement) => el.pause());
  await expect(page.locator('.video-seek .seek-mark')).toHaveCount(2);
  await page.getByRole('button', { name: 'Bölümler' }).click();
  await page.getByRole('menuitemradio', { name: /Middle part/ }).click();
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeCloseTo(2, 1);
  await expect(page.locator('.video-chapter')).toHaveText('Middle part');
  await page.getByRole('button', { name: 'Bölümler' }).click();
  await page.screenshot({ path: 'test-results/03b-chapters.png' });
  await page.getByRole('menuitemradio', { name: /3\. bölüm/ }).click();
  await expect(page.locator('.video-chapter')).toHaveText('3. bölüm');
  await page.keyboard.press('Escape');
  await expect(video).toHaveCount(0);

  await page.getByRole('tab', { name: 'Müzik' }).click();
  await page.getByText('Sample song').first().dblclick();
  await expect(page.locator('.musicbar')).toContainText('Sample song');
  await expect.poll(() => page.evaluate(() => navigator.mediaSession.playbackState)).toBe('playing');
  await page.screenshot({ path: 'test-results/04-music.png' });

  await page.getByRole('button', { name: 'Ayarlar' }).click();
  await page.getByRole('radio', { name: 'Açık' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/05-settings-light.png' });
  await page.getByRole('button', { name: 'Kütüphane' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/06-library-light.png' });

  await page.getByRole('button', { name: 'Ayarlar' }).click();
  await page.getByRole('combobox', { name: 'Dil' }).selectOption('en');
  await expect(page.getByRole('button', { name: 'Library' })).toBeVisible();
});
