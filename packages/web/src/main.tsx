import { StrictMode, useEffect, useRef, useState, type ReactNode, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CreateMapJobRequestSchema, type CreateMapJobRequest, type ExperienceMap, type Job, type Route as MapRoute, type Evidence } from '@experience-map/contracts';
import { createHttpClient, createMockClient, resolveMode, errorText, type ClientError } from './api-client.js';
import { markdownPlan, planKey, readCompleted, safeSourceUrl, statusLabel, synthetic } from './presentation.js';
import './styles.css';

// Local development stays deterministic; the production container defaults to
// real server-side Zhihu retrieval unless Render explicitly sets another mode.
const mode = resolveMode(import.meta.env.VITE_DATA_MODE, import.meta.env.PROD);
const api = mode === 'mock' ? createMockClient() : createHttpClient();
const example: CreateMapJobRequest = {
  inputMode: 'topic', query: '大学生如何准备第一份产品经理实习？', questionUrl: null, focus: null,
  constraints: { background: '零实习经历', weeks: 8, hoursPerWeek: 10, budgetCny: 500 }, dataMode: 'replay'
};
const modeLabel = mode === 'mock' ? '离线演示 · 合成数据' : mode === 'replay' ? '接口回放 · 合成数据' : '实时接口 · 待后端验证';
const blankError = (message: string): ClientError => ({ code: 'INVALID_RESPONSE', message, retryable: false });

function Shell({ children }: { children: ReactNode }) {
  return <><a className="skip-link" href="#main">跳到主要内容</a><header className="topbar">
    <Link to="/" className="brand"><span className="brand-mark" aria-hidden="true">知</span>知乎经验地图</Link>
    <span className="top-note">真实经验 · 条件比较 · 来源可追溯</span>
  </header>{children}<footer>知乎经验地图 · 让下一步有出处</footer></>;
}
function Loading({ title = '正在打开经验地图…' }: { title?: string }) {
  return <main id="main" className="page state-page" role="status"><div className="state-icon pulse" aria-hidden="true">✦</div><h1>{title}</h1></main>;
}
function ErrorView({ error, retry }: { error: ClientError; retry?: () => void }) {
  return <main id="main" className="page state-page"><h1>这次整理没有完成</h1><p role="alert">{errorText(error)}</p>
    <div className="form-actions">{retry && <button className="ghost-button" onClick={retry}>再次检查状态</button>}<Link className="primary-button" to="/">返回修改</Link></div></main>;
}
function getDraft(): CreateMapJobRequest {
  try { const parsed = CreateMapJobRequestSchema.safeParse(JSON.parse(sessionStorage.getItem('experience-map:draft') ?? 'null')); if (parsed.success) return parsed.data; } catch { /* Storage is optional. */ }
  return { ...example, query: '', constraints: { background: null, weeks: null, hoursPerWeek: null, budgetCny: null } };
}
function rememberRequest(jobId: string, request: CreateMapJobRequest) {
  try { sessionStorage.setItem(`experience-map:job:${jobId}`, JSON.stringify(request)); } catch { /* Browser can still poll by job ID. */ }
}
function Home() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState(getDraft);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ClientError | null>(null);
  const pending = useRef(false);
  const attempt = useRef<{ body: string; key: string } | null>(null);
  async function submit(payload: CreateMapJobRequest) {
    if (pending.current) return;
    const parsed = CreateMapJobRequestSchema.safeParse(payload);
    if (!parsed.success) { setError(blankError('请检查输入：主题不可为空，问题链接必须有效，周数 1–104、每周小时数 0–168、预算 0–1000000。')); return; }
    pending.current = true; setBusy(true); setError(null);
    const body = JSON.stringify(parsed.data);
    if (attempt.current?.body !== body) attempt.current = { body, key: crypto.randomUUID() };
    const result = await api.createJob(parsed.data, attempt.current.key);
    pending.current = false; setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    rememberRequest(result.data.jobId, parsed.data);
    try { sessionStorage.setItem('experience-map:draft', JSON.stringify(parsed.data)); } catch { /* Optional draft. */ }
    navigate(`/jobs/${encodeURIComponent(result.data.jobId)}`);
  }
  function onSubmit(event: FormEvent) { event.preventDefault(); void submit({ ...draft, dataMode: mode === 'live' ? 'live' : 'replay' }); }
  function setConstraint(key: keyof CreateMapJobRequest['constraints'], value: string) {
    setDraft(current => ({ ...current, constraints: { ...current.constraints, [key]: key === 'background' ? value || null : value === '' ? null : Number(value) } }));
  }
  return <main id="main" className="page home-page"><section className="hero"><div className="eyebrow">知乎内容的下一种读法</div>
    <h1>把零散经验，变成<br /><em>可比较的下一步</em></h1><p className="hero-copy">看清不同建议的前提、分歧与风险，再选择适合自己的行动。</p></section>
    <form className="input-card" onSubmit={onSubmit} noValidate>
      <p className="notice">{modeLabel}。{mode !== 'live' ? '当前只展示固定实习案例，修改输入不会生成新内容。' : '实时能力仍在联调；失败时可明确切换演示案例。'}</p>
      <div className="mode-tabs" role="group" aria-label="输入方式">
        <button type="button" aria-pressed={draft.inputMode === 'topic'} className={draft.inputMode === 'topic' ? 'active' : ''} onClick={() => setDraft(d => ({ ...d, inputMode: 'topic', questionUrl: null, query: '' }))}>输入主题</button>
        <button type="button" aria-pressed={draft.inputMode === 'question_url'} className={draft.inputMode === 'question_url' ? 'active' : ''} onClick={() => setDraft(d => ({ ...d, inputMode: 'question_url', query: null, questionUrl: '' }))}>粘贴知乎问题链接</button>
      </div>
      {draft.inputMode === 'topic' ? <label className="field-label">你正在考虑什么？<textarea maxLength={500} rows={3} value={draft.query ?? ''} onChange={e => setDraft({ ...draft, query: e.target.value })} placeholder="例如：大学生如何准备第一份产品经理实习？" /></label>
        : <label className="field-label">知乎问题链接<input type="url" value={draft.questionUrl ?? ''} onChange={e => setDraft({ ...draft, questionUrl: e.target.value })} placeholder="https://www.zhihu.com/question/..." /></label>}
      <label className="field-label">你最想关注什么？<input maxLength={300} value={draft.focus ?? ''} onChange={e => setDraft({ ...draft, focus: e.target.value || null })} placeholder="可选：时间、成本、作品集、风险……" /></label>
      <button type="button" className="constraints-toggle" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>补充我的条件 <span>{expanded ? '收起' : '展开'}</span></button>
      {expanded && <div className="constraint-grid"><label>我的背景<input maxLength={200} value={draft.constraints.background ?? ''} onChange={e => setConstraint('background', e.target.value)} /></label>
        <label>准备周期（周）<input type="number" min={1} max={104} value={draft.constraints.weeks ?? ''} onChange={e => setConstraint('weeks', e.target.value)} /></label>
        <label>每周投入（小时）<input type="number" min={0} max={168} value={draft.constraints.hoursPerWeek ?? ''} onChange={e => setConstraint('hoursPerWeek', e.target.value)} /></label>
        <label>预算（元）<input type="number" min={0} max={1000000} value={draft.constraints.budgetCny ?? ''} onChange={e => setConstraint('budgetCny', e.target.value)} /></label></div>}
      {error && <p role="alert" className="form-error">{errorText(error)}</p>}
      <div className="form-actions"><button className="ghost-button" type="button" onClick={() => { setDraft(example); setExpanded(true); setError(null); }}>填入实习示例</button>
        <button className="primary-button" disabled={busy}>{busy ? '正在创建任务…' : mode === 'live' ? '生成经验地图 →' : '查看示例地图 →'}</button></div>
    </form><section className="home-foot"><span>摘要不冒充全文</span><button className="text-link" disabled={busy} onClick={() => void submit(example)}>查看已整理案例 →</button></section></main>;
}

const phases = ['queued', 'retrieving', 'organizing', 'validating'] as const;
const phaseLabels = ['排队中', '查找知乎内容', '整理经验路线', '检查来源'];
function JobPage() {
  const { jobId = '' } = useParams(); const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null); const [error, setError] = useState<ClientError | null>(null);
  const [revision, setRevision] = useState(0); const [retrying, setRetrying] = useState(false); const locked = useRef(false);
  useEffect(() => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    setJob(null); setError(null);
    const deadline = setTimeout(() => { setError({ code: 'WAIT_TIMEOUT', message: '等待超过 95 秒，结果尚未确认，可手动再次检查。', retryable: true }); controller.abort(); clearTimeout(timer); }, 95000);
    async function poll() {
      const result = await api.getJob(jobId, controller.signal);
      if (controller.signal.aborted) return;
      if (!result.ok) { clearTimeout(deadline); setError(result.error); return; }
      const current = result.data; setJob(current);
      if (current.status === 'succeeded') {
        clearTimeout(deadline);
        if (current.mapId) navigate(`/maps/${encodeURIComponent(current.mapId)}`, { replace: true });
        else setError(blankError('任务返回成功，但缺少地图编号。'));
        return;
      }
      if (current.status === 'failed' || current.status === 'expired') {
        clearTimeout(deadline); setError(current.error ?? { code: 'JOB_EXPIRED', message: current.message, retryable: false }); return;
      }
      timer = setTimeout(poll, 1500);
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); clearTimeout(deadline); };
  }, [jobId, navigate, revision]);
  async function retryJob() {
    if (locked.current) return;
    let value: unknown;
    try { value = JSON.parse(sessionStorage.getItem(`experience-map:job:${jobId}`) ?? 'null'); } catch { navigate('/'); return; }
    const parsed = CreateMapJobRequestSchema.safeParse(value);
    if (!parsed.success) { navigate('/'); return; }
    locked.current = true; setRetrying(true);
    const result = await api.createJob(parsed.data, crypto.randomUUID());
    locked.current = false; setRetrying(false);
    if (!result.ok) { setError(result.error); return; }
    rememberRequest(result.data.jobId, parsed.data);
    navigate(`/jobs/${encodeURIComponent(result.data.jobId)}`); setRevision(r => r + 1);
  }
  if (error) return <><ErrorView error={error} retry={job?.status !== 'failed' && job?.status !== 'expired' ? () => setRevision(r => r + 1) : undefined} />
    {job?.status === 'failed' && error.retryable && <div className="retry-action"><button className="primary-button" disabled={retrying} onClick={() => void retryJob()}>重新整理</button></div>}</>;
  const index = phases.findIndex(p => p === (job?.status ?? 'queued'));
  return <main id="main" className="page state-page"><div className="state-icon pulse" aria-hidden="true">✦</div><h1>把经验线索放到一起</h1>
    <p role="status">{job?.message ?? '正在检查任务状态'}</p><div className="progress-list">{phases.map((phase, i) => <div key={phase} className={`progress-item ${i === index ? 'current' : i < index ? 'done' : ''}`} aria-current={i === index ? 'step' : undefined}><span>{i < index ? '✓' : i + 1}</span><b>{phaseLabels[i]}</b></div>)}</div>
    <p className="drawer-note">阶段以服务端实际状态为准；返回修改仅停止本页等待。</p><Link to="/" className="text-link">← 返回修改</Link></main>;
}

function useMap(id: string) {
  const [state, setState] = useState<{ map: ExperienceMap | null; error: ClientError | null }>({ map: null, error: null });
  useEffect(() => {
    const controller = new AbortController(); setState({ map: null, error: null });
    void api.getMap(id, controller.signal).then(result => {
      if (!controller.signal.aborted) setState(result.ok ? { map: result.data, error: null } : { map: null, error: result.error });
    });
    return () => controller.abort();
  }, [id]); return state;
}
function DataNotice({ map }: { map: ExperienceMap }) {
  return <div className="notice"><b>{statusLabel(map)}</b> · {map.dataStatus.notice}<br /><small>来源获取于 {new Date(map.dataStatus.retrievedAt).toLocaleString('zh-CN')} · {synthetic(map) ? '示例内容与地址未经真实核验，原文跳转已停用。' : '内容为摘要，请核对原文上下文。'}</small></div>;
}
function Citations({ ids, map, open }: { ids: string[]; map: ExperienceMap; open: (e: Evidence) => void }) {
  return <div className="mini-sources">{ids.map(id => {
    const evidence = map.evidence.find(e => e.evidenceId === id); if (!evidence) return null;
    return <button key={id} className="citation" onClick={() => open(evidence)} aria-label={`查看来源 ${map.evidence.indexOf(evidence) + 1}`}>[{map.evidence.indexOf(evidence) + 1}] 查看依据</button>;
  })}</div>;
}
function SourceDrawer({ map, evidence, close }: { map: ExperienceMap; evidence: Evidence; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const source = map.sources.find(s => s.sourceId === evidence.sourceId)!;
  useEffect(() => {
    const previous = document.activeElement; const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  const url = synthetic(map) ? null : safeSourceUrl(source.url);
  const at = source.quoteableText.indexOf(evidence.quote);
  return <dialog className="source-dialog" ref={dialog} aria-labelledby="source-title" onKeyDown={event => { if (event.key !== 'Tab') return; const targets = dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]'); if (!targets?.length) return; const first = targets[0]; const last = targets[targets.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }} onCancel={close} onClick={e => { if (e.target === dialog.current) close(); }}>
    <div className="source-dialog-content"><button autoFocus className="drawer-close" onClick={close} aria-label="关闭来源">×</button>
      <span className="source-type">{source.contentType === 'article' ? '文章' : '回答摘要'}</span><h2 id="source-title">{source.title}</h2>
      <p className="source-meta">{source.authorName ?? '作者信息未返回'} · {new Date(source.retrievedAt).toLocaleDateString('zh-CN')}</p>
      <DataNotice map={map} /><div className="quote-block"><span>接口返回摘要</span><p>{source.summary}</p></div>
      <div className="quote-block highlight"><span>引用片段及上下文</span><p>{source.quoteableText.slice(0, at)}<mark>{evidence.quote}</mark>{source.quoteableText.slice(at + evidence.quote.length)}</p></div>
      <p>整理说明：{evidence.claim}</p><p className="drawer-note">{evidence.support === 'direct' ? '直接引用' : '背景参考'}，引用存在不等于结论已验证。</p>
      {url ? <a className="primary-button source-link" href={url} target="_blank" rel="noopener noreferrer">查看知乎原文 ↗</a> : <p className="notice">此来源为合成示例或链接不可用，不提供原文跳转。</p>}
    </div></dialog>;
}
function Comparison({ map }: { map: ExperienceMap }) {
  const labels = [...new Set(['时间', '成本', '投入', ...map.routes.flatMap(r => r.tradeoffs.map(t => t.label))])];
  return <section className="comparison" aria-label="路线对比"><h2>按同一维度比较</h2>{['适合条件', ...labels, '风险'].map(label => <div className="compare-row" key={label}>
    <h3>{label}</h3><div className="compare-values">{map.routes.map(r => <div key={r.routeId}><b>{r.title}</b><p>{label === '适合条件' ? r.fit.join('；') || '资料未说明' : label === '风险' ? r.risks.join('；') || '资料未说明' : r.tradeoffs.find(t => t.label === label)?.value ?? '资料未说明'}</p></div>)}</div></div>)}</section>;
}
function MapPage() {
  const { mapId = '' } = useParams(); const { map, error } = useMap(mapId); const [params, setParams] = useSearchParams();
  const [evidence, setEvidence] = useState<Evidence | null>(null); const [compare, setCompare] = useState(false);
  if (error) return <ErrorView error={error} />;
  if (!map) return <Loading />;
  const selected = map.routes.find(r => r.routeId === params.get('routeId')) ?? map.routes[0];
  return <main id="main" className="page map-page"><div className="map-head"><div><span className="status-pill">{statusLabel(map)}</span><h1>{map.query ?? map.questionUrl ?? '知乎问题经验地图'}</h1><p>{map.overview}</p></div><Link to="/" className="text-link">重新整理</Link></div>
    <div className="condition-row"><span>本地图条件</span>{map.constraints.background && <b>{map.constraints.background}</b>}{map.constraints.weeks !== null && <b>{map.constraints.weeks} 周</b>}{map.constraints.hoursPerWeek !== null && <b>每周 {map.constraints.hoursPerWeek} 小时</b>}{map.constraints.budgetCny !== null && <b>预算 ¥{map.constraints.budgetCny}</b>}</div><DataNotice map={map} />
    {!selected ? <section className="route-detail"><h2>暂时没有足够证据形成路线</h2><p>已有来源保留在下方，可以修改条件后重新整理。</p></section> : <>
      <section className="route-grid">{map.routes.map((r, i) => <button key={r.routeId} className={`route-card ${r === selected ? 'selected' : ''}`} aria-pressed={r === selected} onClick={() => setParams({ routeId: r.routeId }, { replace: true })}>
        <span className="route-number">路线 {i + 1}</span><h2>{r.title}</h2><p>{r.strategy}</p><div className="route-tags">{r.fit.map(f => <span key={f}>{f}</span>)}</div><span className="route-cta">{r === selected ? '当前路线 ✓' : '查看这条路线 →'}</span></button>)}</section>
      {map.routes.length > 1 && <button className="ghost-button" aria-expanded={compare} onClick={() => setCompare(!compare)}>{compare ? '收起路线对比' : '比较所有路线'}</button>}
      {compare && map.routes.length > 1 && <Comparison map={map} />}
      <section className="route-detail"><div className="section-heading"><div><span className="eyebrow">当前路线</span><h2>{selected.title}</h2></div><span className="source-count">{new Set(selected.evidenceIds).size} 条引用</span></div>
        <div className="detail-grid"><div className="timeline">{selected.stages.map((stage, i) => <article className="stage-card" key={stage.stageId}><div className="stage-index">{i + 1}</div><div><span className="stage-weeks">{stage.suggestedWeeks}</span><h3>{stage.title}</h3>{stage.tasks.map(task => <div className="task-preview" key={task.taskId}><b>{task.action}</b><span>完成判据：{task.doneWhen}</span><Citations ids={task.evidenceIds} map={map} open={setEvidence} /></div>)}</div></article>)}</div>
          <aside className="side-panel"><div className="side-block"><span className="eyebrow">关键风险</span><ul>{selected.risks.map(r => <li key={r}>{r}</li>)}</ul></div><div className="side-block"><span className="eyebrow">投入取舍</span>{selected.tradeoffs.length ? selected.tradeoffs.map(t => <div className="tradeoff" key={t.label}><span>{t.label}</span><b>{t.value}</b></div>) : <p>资料未说明</p>}</div>
            {map.differences.length > 0 && <div className="side-block"><span className="eyebrow">观点差异</span>{map.differences.map(d => <div key={d.title}><p>{d.summary}</p><Citations ids={d.evidenceIds} map={map} open={setEvidence} /></div>)}</div>}</aside></div></section>
    </>}
    <section className="sources-section"><h2>来源摘要</h2>{map.sources.length ? map.sources.map(s => <article key={s.sourceId}><h3>{s.title}</h3><p>{s.summary}</p><Citations ids={map.evidence.filter(e => e.sourceId === s.sourceId).map(e => e.evidenceId)} map={map} open={setEvidence} /></article>) : <p>没有可展示的来源。</p>}</section>
    <section className="limitations"><span>使用前请知道</span>{map.limitations.map(l => <p key={l}>{l}</p>)}</section><div className="map-actions"><Link className="ghost-button" to="/">← 返回修改</Link>{selected && <Link className="primary-button" to={`/maps/${encodeURIComponent(mapId)}/plan?routeId=${encodeURIComponent(selected.routeId)}`}>选择这条路线，生成清单 →</Link>}</div>
    {evidence && <SourceDrawer map={map} evidence={evidence} close={() => setEvidence(null)} />}</main>;
}
function PlanContent({ map, route }: { map: ExperienceMap; route: MapRoute }) {
  const [completed, setCompleted] = useState<string[]>([]); const [storageError, setStorageError] = useState(''); const [ready, setReady] = useState(false);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const key = planKey(map.mapId, route.routeId);
  useEffect(() => {
    try { setCompleted(readCompleted(localStorage.getItem(key), route)); } catch { setStorageError('本机保存不可用或记录损坏，请导出清单备份。'); }
    setReady(true);
  }, [key, route]);
  function toggle(id: string) {
    const next = completed.includes(id) ? completed.filter(t => t !== id) : [...completed, id]; setCompleted(next);
    try { localStorage.setItem(key, JSON.stringify({ schemaVersion: '1.0', completedTaskIds: next, routeId: route.routeId, updatedAt: new Date().toISOString() })); }
    catch { setStorageError('本机保存不可用，进度暂存在本页，请导出清单。'); }
  }
  function download() {
    const blob = new Blob([markdownPlan(map, route, completed)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = '知乎经验地图-行动清单.md';
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const total = route.stages.reduce((sum, s) => sum + s.tasks.length, 0);
  return <main id="main" className="page plan-page"><Link className="text-link" to={`/maps/${encodeURIComponent(map.mapId)}?routeId=${encodeURIComponent(route.routeId)}`}>← 返回路线比较</Link>
    <div className="plan-head"><span className="status-pill">{route.title}</span><h1>把路线变成今天能开始的事</h1><p>以下为建议安排；勾选进度仅保存在本机。</p><DataNotice map={map} />
      <p role="status">{completed.length}/{total} 项已完成</p><progress aria-label="清单完成进度" value={completed.length} max={total || 1} /></div>
    {storageError && <p className="notice" role="alert">{storageError}</p>}
    <div className="plan-list">{route.stages.map(s => <section className="plan-stage" key={s.stageId}><span className="stage-weeks">{s.suggestedWeeks}</span><h2>{s.title}</h2>{s.tasks.map(t => <div key={t.taskId}><label className={`plan-task ${completed.includes(t.taskId) ? 'complete' : ''}`}><input disabled={!ready} type="checkbox" checked={completed.includes(t.taskId)} onChange={() => toggle(t.taskId)} /><span><b>{t.action}</b><small>完成判据：{t.doneWhen}</small></span></label><Citations ids={t.evidenceIds} map={map} open={setEvidence} /></div>)}</section>)}</div>
    <div className="plan-actions"><button className="ghost-button" onClick={download}>导出 Markdown</button><Link className="primary-button" to={`/maps/${encodeURIComponent(map.mapId)}`}>重新选择路线</Link></div>{evidence && <SourceDrawer map={map} evidence={evidence} close={() => setEvidence(null)} />}</main>;
}
function PlanPage() {
  const { mapId = '' } = useParams(); const [params] = useSearchParams(); const { map, error } = useMap(mapId);
  if (error) return <ErrorView error={error} />; if (!map) return <Loading title="正在准备行动清单…" />;
  const route = map.routes.find(r => r.routeId === params.get('routeId'));
  if (!route) return <main id="main" className="page state-page"><h1>请先选择一条有效路线</h1><Link className="primary-button" to={`/maps/${encodeURIComponent(mapId)}`}>返回经验地图</Link></main>;
  return <PlanContent key={`${mapId}:${route.routeId}`} map={map} route={route} />;
}
function App() {
  return <BrowserRouter><Shell><Routes><Route path="/" element={<Home />} /><Route path="/jobs/:jobId" element={<JobPage />} /><Route path="/maps/:mapId" element={<MapPage />} /><Route path="/maps/:mapId/plan" element={<PlanPage />} /><Route path="*" element={<ErrorView error={blankError('页面不存在。')} />} /></Routes></Shell></BrowserRouter>;
}
const root = document.getElementById('root');
if (!root) throw new Error('Missing app root');
createRoot(root).render(<StrictMode><App /></StrictMode>);

