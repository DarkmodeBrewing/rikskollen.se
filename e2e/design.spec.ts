import { test, expect } from './fixtures';
import { member } from './data';

test('member layout has room to read and chart retains full counts after filtering', async ({
  page,
  request,
  app,
}, testInfo) => {
  await page.goto('/');
  const firstMember = page.locator('.member-directory a').first();
  const row = await firstMember.boundingBox();
  expect(row!.height).toBeGreaterThanOrEqual(100);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await firstMember.focus();
  await expect(firstMember).toBeFocused();
  await page.screenshot({
    path: testInfo.outputPath('members.png'),
    fullPage: true,
  });
  await firstMember.press('Enter');
  const chart = page.getByRole('figure', {
    name: 'Fördelning av källans noteringar',
  });
  await expect(chart).toContainText('25 totalt');
  await expect(chart).toContainText('Oväntat');
  await expect(chart.getByRole('listitem')).toHaveCount(3);
  await page.getByRole('link', { name: 'Ja: 3', exact: true }).click();
  await expect(page).toHaveURL(/voteChoice=Ja/);
  await expect(chart).toContainText('25 totalt');
  await expect(chart.locator('strong')).toHaveText(['21', '3', '1']);
  await expect(page.getByText('3 källposter visas med filtret')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('profile.png'),
    fullPage: true,
  });
  const response = await request.get(`${app.url}/ledamot/${member.personId}`);
  expect(await response.text()).toContain('Fördelning av källans noteringar');
});
