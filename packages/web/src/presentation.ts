import type { ExperienceMap, Route } from '@experience-map/contracts';
export function synthetic(map: ExperienceMap) { return map.dataStatus.sources === 'fixture' || /合成测试/.test(map.dataStatus.notice); }
export function statusLabel(map: ExperienceMap) {
  if (map.presentation?.completeness === 'sources_only') return '资料已获取 · 整理未完成';
  return synthetic(map) ? '演示案例 · 合成测试数据' : map.dataStatus.mode === 'replay' ? '案例回放' : '实时整理';
}
export function safeSourceUrl(url: string): string | null {
  try { const parsed = new URL(url); return parsed.protocol === 'https:' && !parsed.username && !parsed.password &&
    ['www.zhihu.com', 'zhuanlan.zhihu.com'].includes(parsed.hostname) ? url : null; } catch { return null; }
}
export function planKey(mapId: string, routeId: string) { return `experience-map:plan:v1:${mapId}:${routeId}`; }
export function readCompleted(raw: string | null, route: Route): string[] {
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || !('schemaVersion' in parsed) || parsed.schemaVersion !== '1.0' ||
      !('completedTaskIds' in parsed) || !Array.isArray(parsed.completedTaskIds)) return [];
  const valid = new Set(route.stages.flatMap(s => s.tasks.map(t => t.taskId)));
  return [...new Set(parsed.completedTaskIds.filter((id): id is string => typeof id === 'string' && valid.has(id)))];
}
const escape = (text: string) => text.replace(/[\\`*_{}\[\]<>]/g, '\\$&').replace(/\r?\n/g, ' ');
export function markdownPlan(map: ExperienceMap, route: Route, completed: string[]): string {
  const c = map.constraints;
  const insight = map.presentation?.kind === 'insight';
  const lines = [`# ${escape(route.title)}｜${insight ? '观点笔记' : '行动清单'}`, '', `问题：${escape(map.query ?? '知乎问题')}`,
    `数据状态：${statusLabel(map)}；${escape(map.dataStatus.notice)}`, `来源获取时间：${map.dataStatus.retrievedAt}`,
    `导出时间：${new Date().toISOString()}`, `背景：${escape(c.background ?? '未指定')}；周期：${c.weeks ?? '未指定'} 周；每周：${c.hoursPerWeek ?? '未指定'} 小时；预算：${c.budgetCny ?? '未指定'} 元`,
    '', '> 阶段与行动为整理建议，请结合自身情况核对来源。', ''];
  if (map.questionUrl && !synthetic(map) && safeSourceUrl(map.questionUrl)) lines.push('原问题：' + map.questionUrl, '');
  if (map.presentation?.focus.requested) lines.push('关注点：' + escape(map.presentation.focus.requested), escape(map.presentation.focus.summary), '');
  if (map.presentation?.timingNote) lines.push(escape(map.presentation.timingNote), '');
  const used = new Set<string>();
  for (const stage of route.stages) {
    lines.push('## ' + escape(stage.title) + (!insight && map.presentation?.timing !== 'none' && stage.suggestedWeeks ? ' · ' + escape(stage.suggestedWeeks) : ''), '');
    for (const task of stage.tasks) {
      lines.push((insight ? '- ' : '- [' + (completed.includes(task.taskId) ? 'x' : ' ') + '] ') + escape(task.action), '  ' + (insight ? '判断边界：' : '完成判据：') + escape(task.doneWhen));
      for (const id of task.evidenceIds) {
        const ev = map.evidence.find(e => e.evidenceId === id);
        if (ev) { used.add(ev.sourceId); lines.push(`  依据：${escape(ev.claim)}（${escape(ev.sourceId)}）`); }
      }
    }
    lines.push('');
  }
  lines.push('## 来源', '');
  for (const source of map.sources.filter(s => used.has(s.sourceId))) {
    const url = synthetic(map) ? null : safeSourceUrl(source.url);
    lines.push(`- ${url ? `[${escape(source.title)}](<${url}>)` : `${escape(source.title)}（合成示例或链接不可用）`} · ${escape(source.authorName ?? '作者信息未返回')} · ${source.retrievedAt}`);
  }
  lines.push('', '## 限制说明', '', ...map.limitations.map(l => `- ${escape(l)}`));
  return lines.join('\n');
}
