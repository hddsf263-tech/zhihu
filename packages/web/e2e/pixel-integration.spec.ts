import { test, expect } from '@playwright/test';
import { replayMap } from '@experience-map/contracts/fixtures';

for (const width of [390, 1440]) {
  test(`pixel world ${width}: assets, five hotspots, editable prompts and guide focus`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    let posts = 0;
    page.on('request', request => { if (request.method() === 'POST') posts++; });
    await page.goto('/');
    await expect(page.locator('.pixel-hotspots button')).toHaveCount(5);
    for (const selector of ['.pixel-art', '.guide-gif']) {
      await expect.poll(() => page.locator(selector).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    }
    await expect(page.getByRole('button', { name: /补充我的条件/ })).toHaveCount(0);
    await expect(page.getByLabel('你最想关注什么？')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: info.outputPath(`home-${width}.png`), fullPage: true });
    for (const [name, query, focus] of [
      ['作品村：先做出可展示的作品', '如何做出第一个能拿得出手的作品？', '作品集'],
      ['投递码头：尽早拿到真实反馈', '第一次投递简历前要准备到什么程度？', '投递反馈'],
      ['技能森林：补齐工具与方法', '入门阶段应该先补齐哪些工具和方法？', '技能'],
    ]) {
      await page.getByRole('button', { name, exact: true }).click();
      await expect(page.getByLabel('你正在考虑什么？')).toHaveValue(query);
      await expect(page.getByLabel('你最想关注什么？')).toHaveValue(focus);
      await expect(page.getByLabel('你正在考虑什么？')).toBeFocused();
    }
    await page.getByRole('button', { name: '粘贴知乎问题链接', exact: true }).click();
    await page.getByLabel('知乎问题链接', { exact: true }).fill('https://www.zhihu.com/question/37076574/answer/2007494342630208492');
    await page.getByRole('button', { name: '刘看山向导：去输入你的问题' }).click();
    await expect(page.getByLabel('知乎问题链接', { exact: true })).toBeFocused();
    await page.getByRole('button', { name: '作品村：先做出可展示的作品' }).click();
    await expect(page.getByLabel('你正在考虑什么？')).toBeFocused();
    await page.getByLabel('你正在考虑什么？').fill('怎么准备从零学日语');
    await expect(page.getByLabel('你正在考虑什么？')).toHaveValue('怎么准备从零学日语');
    expect(posts).toBe(0);
  });
}

test('pixel stamp opens a clearly labelled replay and never replaces normal search', async ({ page }) => {
  await page.goto('/');
  const sent = page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith('/api/v1/maps/jobs'));
  await page.getByRole('button', { name: '证据邮票：打开已整理的实习案例' }).click();
  expect((await sent).postDataJSON().dataMode).toBe('replay');
  await expect(page).toHaveURL(new RegExp(`/maps/${replayMap.mapId}`));
  await expect(page.locator('.map-head .status-pill')).toContainText('演示案例 · 合成测试数据');
});

test('adaptive insight still hides timelines and checkboxes and exports notes after integration', async ({ page }) => {
  const map = structuredClone(replayMap);
  map.routes = [map.routes[0]];
  for (const stage of map.routes[0].stages) stage.suggestedWeeks = '';
  map.presentation = { kind: 'insight', timing: 'none', timingNote: '', completeness: 'complete', focus: { requested: '判断边界', status: 'limited', summary: '来源只覆盖部分情境，需要结合原文。', evidenceIds: [map.evidence[0].evidenceId] } };
  await page.route('**/api/v1/maps/insight-check', r => r.fulfill({ json: map }));
  await page.goto('/maps/insight-check');
  await expect(page.locator('.insight-card').first()).toBeVisible();
  await expect(page.locator('.stage-weeks')).toHaveCount(0);
  await expect(page.locator('.route-grid')).toHaveCount(0);
  await expect(page.getByRole('region', { name: '关注点回应' })).toContainText('来源只覆盖部分情境');
  await page.getByRole('link', { name: /观点笔记/ }).click();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 Markdown' }).click();
  expect((await download).suggestedFilename()).toContain('观点笔记');
});
