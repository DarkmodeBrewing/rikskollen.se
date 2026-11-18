import { test, expect } from './fixtures';
import { member } from './data';

test('new links and pagination start at top; Back and Forward restore each history entry', async ({ page, app }) => {
  await page.goto('/ledamoter');
  await expect(page.getByText('31 personer', { exact: true })).toBeVisible();
  const link = page.locator(`a[href="/ledamot/${member.personId}"]`);
  await link.scrollIntoViewIfNeeded();
  const listY = await page.evaluate(() => scrollY);
  await link.click();
  await expect(page).toHaveURL(`/ledamot/${member.personId}`);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await page.evaluate(() => scrollTo(0, 500));
  const detailY = await page.evaluate(() => scrollY);
  // A delayed response on traversal must not clamp the saved list position.
  let release!: () => void;
  app.delay = new Promise<void>(resolve => { release = resolve; });
  await page.goBack();
  await expect(page.getByText('Hämtar ledamöter…', { exact: true })).toBeVisible();
  release(); app.delay = null;
  await expect(page.getByText('31 personer', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(listY, 0);
  await page.goForward();
  await expect(page).toHaveURL(`/ledamot/${member.personId}`);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(detailY, 0);
  await page.goBack();
  const next = page.getByRole('navigation', { name: 'Sidindelning' }).getByRole('link', { name: 'Nästa' });
  await next.scrollIntoViewIfNeeded();
  const pagingY = await page.evaluate(() => scrollY);
  expect(pagingY).toBeGreaterThan(0);
  await next.click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText('Sida 2 av 2')).toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await page.goBack();
  await expect(page.getByText('31 personer', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(pagingY, 0);
});
