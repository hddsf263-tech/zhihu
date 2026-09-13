import { test, expect, type Page } from '@playwright/test';
import { replayMap, replayJob } from '@experience-map/contracts/fixtures';
import { readFile } from 'node:fs/promises';
const mapPath = `/maps/${replayMap.mapId}`;
async function openMap(page: Page) { await page.goto(mapPath); await expect(page.getByRole('heading', { name: replayMap.query!, exact: true })).toBeVisible(); }

test('real backend replay: mount, validation, create, compare, dialog, progress, reload and export', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const requests: string[] = []; page.on('request', r => requests.push(r.url()));
  await page.goto('/'); await expect(page.getByRole('heading', { level: 1 })).toContainText('把零散经验');
  await page.getByRole('button', { name: '查看示例地图' }).click(); await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: '填入实习示例' }).click();
  const sent = page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith('/api/v1/maps/jobs'));
  await page.getByRole('button', { name: '查看示例地图' }).click();
  expect((await sent).headers()['idempotency-key']).toBeTruthy(); await expect(page).toHaveURL(new RegExp(mapPath));
  await page.getByRole('button', { name: '比较所有路线' }).click(); await expect(page.getByRole('region', { name: '路线对比' })).toBeVisible();
  await page.getByRole('button', { name: /路线 2/ }).click(); await expect(page.locator('.section-heading')).toContainText('边做边投递');
  const source = page.getByRole('button', { name: '查看来源 3', exact: true }).first(); await source.click();
  await expect(page.getByRole('dialog')).toBeVisible(); await expect(page.getByRole('dialog').locator('mark')).toHaveText('尽早投递获取反馈');
  await expect(page.getByRole('dialog').getByRole('link', { name: /查看知乎原文/ })).toHaveCount(0);
  await page.keyboard.press('Tab'); expect(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog')))).toBe(true);
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(source).toBeFocused();
  await page.getByRole('link', { name: /选择这条路线/ }).click();
  const checkbox = page.getByRole('checkbox').first(); await checkbox.check(); await page.reload(); await expect(checkbox).toBeChecked();
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: '导出 Markdown' }).click();
  const download = await downloadPromise; const text = await readFile((await download.path())!, 'utf8');
  expect(text).toContain('\n## 来源\n'); expect(text).toContain('- [x]'); expect(text).toContain('合成测试数据');
  expect(errors).toEqual([]); expect(requests.every(url => new URL(url).hostname === '127.0.0.1')).toBe(true);
});

for (const code of ['UPSTREAM_EMPTY', 'UPSTREAM_RATE_LIMIT', 'UPSTREAM_TIMEOUT', 'MODEL_INVALID_OUTPUT', 'UPSTREAM_AUTH'] as const) {
  test(`terminal ${code} stops polling`, async ({ page }) => {
    let polls = 0;
    await page.route('**/api/v1/maps/jobs/failure', route => { polls++; return route.fulfill({ json: { ...replayJob, jobId: 'failure', status: 'failed', mapId: null, retryable: code === 'UPSTREAM_TIMEOUT', error: { code, message: '服务端失败', retryable: code === 'UPSTREAM_TIMEOUT', requestId: 'req_test' } } }); });
    await page.goto('/jobs/failure'); await expect(page.getByRole('alert')).toBeVisible();
    const count = polls; await page.clock.install(); await page.clock.fastForward(5000); expect(polls).toBe(count);
    if (code === 'UPSTREAM_TIMEOUT') await expect(page.getByRole('button', { name: '重新整理' })).toBeVisible();
  });
}
test('empty routes and invalid route do not spin or select an unintended plan', async ({ page }) => {
  await page.route('**/api/v1/maps/no-routes', r => r.fulfill({ json: { ...replayMap, routes: [] } }));
  await page.goto('/maps/no-routes'); await expect(page.getByRole('heading', { name: '暂时没有足够证据形成路线' })).toBeVisible();
  await page.goto(`${mapPath}/plan?routeId=missing`); await expect(page.getByRole('heading', { name: '请先选择一条有效路线' })).toBeVisible();
});
test('live metadata and actual source link are rendered from response, not fixture label', async ({ page }) => {
  await page.route('**/api/v1/maps/live-test', r => r.fulfill({ json: { ...replayMap, dataStatus: { ...replayMap.dataStatus, mode: 'live', sources: 'zhihu_search', notice: '浏览器测试响应，未调用知乎' } } }));
  await page.goto('/maps/live-test'); await expect(page.locator('.map-head .status-pill')).toHaveText('实时整理');
  await page.getByRole('button', { name: '查看来源 1', exact: true }).first().click();
  await expect(page.getByRole('dialog').getByRole('link', { name: '查看知乎原文 ↗' })).toHaveAttribute('href', replayMap.sources[0].url);
});
test('network failure and malformed map have visible errors', async ({ page }) => {
  await page.route('**/api/v1/maps/network', r => r.abort()); await page.goto('/maps/network'); await expect(page.getByRole('alert')).toContainText('连接中断');
  await page.route('**/api/v1/maps/malformed', r => r.fulfill({ json: { mapId: 'malformed' } })); await page.goto('/maps/malformed'); await expect(page.getByRole('alert')).toContainText('共享契约');
});
for (const width of [360, 390, 768, 1440]) {
  test(`responsive ${width}: homepage, map, compare, drawer and plan`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    async function noOverflow() { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); }
    await page.goto('/'); await noOverflow(); await openMap(page); await page.getByRole('button', { name: '比较所有路线' }).click(); await noOverflow();
    await page.screenshot({ path: info.outputPath(`map-${width}.png`), fullPage: true });
    await page.getByRole('button', { name: '查看来源 1', exact: true }).first().click(); await noOverflow(); await page.keyboard.press('Escape');
    await page.getByRole('link', { name: /选择这条路线/ }).click(); await noOverflow(); await expect(page.getByRole('checkbox').first()).toBeVisible();
  });
}

test('submission is guarded against repeat clicks and preserves zero budget', async ({ page }) => {
  let posts = 0;
  await page.route('**/api/v1/maps/jobs', async route => {
    posts++; expect(route.request().postDataJSON().constraints.budgetCny).toBe(0);
    await new Promise(resolve => setTimeout(resolve, 200));
    await route.fulfill({ status: 202, json: { jobId: replayJob.jobId, status: 'queued', pollAfterMs: 1500 } });
  });
  await page.goto('/'); await page.getByRole('button', { name: '填入实习示例' }).click();
  await page.getByLabel('预算（元）').fill('0');
  const button = page.getByRole('button', { name: '查看示例地图' });
  await button.evaluate((node: HTMLButtonElement) => { node.click(); node.click(); });
  await expect(page).toHaveURL(new RegExp(mapPath)); expect(posts).toBe(1);
});
test('95 second wait boundary stops automatic polling and offers manual recovery', async ({ page }) => {
  let polls = 0;
  await page.clock.install();
  await page.route('**/api/v1/maps/jobs/waiting', r => { polls++; return r.fulfill({ json: { ...replayJob, status: 'retrieving', mapId: null } }); });
  await page.goto('/jobs/waiting'); await expect(page.getByRole('heading', { name: '把经验线索放到一起' })).toBeVisible();
  await page.clock.fastForward(96000); await expect(page.getByRole('alert')).toContainText('95 秒');
  const count = polls; await page.clock.fastForward(10000); expect(polls).toBe(count);
  await expect(page.getByRole('button', { name: '再次检查状态' })).toBeVisible();
});
test('expired jobs stop polling and unavailable local storage leaves an export path', async ({ page }) => {
  await page.route('**/api/v1/maps/jobs/expired', r => r.fulfill({ json: { ...replayJob, status: 'expired', mapId: null, error: null } }));
  await page.goto('/jobs/expired'); await expect(page.getByRole('alert')).toContainText('过期');
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('blocked'); }; });
  await page.goto(`${mapPath}/plan?routeId=route_portfolio`); await page.getByRole('checkbox').first().check();
  await expect(page.getByRole('alert')).toContainText('本机保存不可用'); await expect(page.getByRole('button', { name: '导出 Markdown' })).toBeEnabled();
});
