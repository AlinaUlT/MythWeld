import { expect, test } from '@playwright/test';
import { APP_NAME } from '../src/config/app';

test('SETUP-02 app opens', async ({ page }, testInfo) => {
  await page.goto('./');
  await expect(page).toHaveTitle(APP_NAME);
  await page.screenshot({ path: testInfo.outputPath('home.png') });
});
