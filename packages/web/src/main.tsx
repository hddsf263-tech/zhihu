import { StrictMode, useEffect, useRef, useState, type ReactNode, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CreateMapJobRequestSchema, type CreateMapJobRequest, type ExperienceMap, type Job, type Route as MapRoute, type Evidence } from '@experience-map/contracts';
import { createHttpClient, createMockClient, resolveMode, errorText, type ClientError } from './api-client.js';
import { markdownPlan, planKey, readCompleted, safeSourceUrl, statusLabel, synthetic } from './presentation.js';
import './styles.css';
import './pixel-world.css';

// Local development stays deterministic; the production container defaults to
// real server-side Zhihu retrieval unless Render explicitly sets another mode.
const mode = resolveMode(import.meta.env.VITE_DATA_MODE, import.meta.env.PROD);
const api = mode === 'mock' ? createMockClient() : createHttpClient();
const example: CreateMapJobRequest = {
  inputMode: 'topic', query: '大学生如何准备第一份产品经理实习？', questionUrl: null, focus: null,
  constraints: { background: '零实习经历', weeks: 8, hoursPerWeek: 10, budgetCny: 500 }, dataMode: 'replay'
};
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
// Place prompts and artwork are preserved from main e5b4b98.
const mapPlaces = [
  { id: 'portfolio', className: 'portfolio', title: '作品村', hint: '先做出可展示的作品', query: '如何做出第一个能拿得出手的作品？', focus: '作品集' },
  { id: 'feedback', className: 'feedback', title: '投递码头', hint: '尽早拿到真实反馈', query: '第一次投递简历前要准备到什么程度？', focus: '投递反馈' },
  { id: 'skills', className: 'skills', title: '技能森林', hint: '补齐工具与方法', query: '入门阶段应该先补齐哪些工具和方法？', focus: '技能' },
];
function Home() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState(getDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ClientError | null>(null);
  const pending = useRef(false);
  const attempt = useRef<{ body: string; key: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const queryRef = useRef<HTMLTextAreaElement>(null);
  const questionUrlRef = useRef<HTMLInputElement>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  useEffect(() => {
    if (focusRequest > 0) (draft.inputMode === 'topic' ? queryRef.current : questionUrlRef.current)?.focus({ preventScroll: true });
  }, [focusRequest, draft.inputMode]);
  function revealInput() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setFocusRequest(count => count + 1);
  }
  function startFromPlace(place: typeof mapPlaces[number]) {
    setDraft(current => ({ ...current, inputMode: 'topic', questionUrl: null, query: place.query, focus: place.focus }));
    setError(null);
    revealInput();
  }

  async function submit(payload: CreateMapJobRequest) {
    if (pending.current) return;
    const parsed = CreateMapJobRequestSchema.safeParse({ ...payload, constraints: { background: null, weeks: null, hoursPerWeek: null, budgetCny: null } });
    if (!parsed.success) { setError(blankError('请检查输入：主题不可为空，或粘贴有效的知乎问题、回答链接。')); return; }
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

  return <main id="main" className="page home-page"><section className="pixel-world" aria-label="知乎像素经验地图">
      <img className="pixel-art" src="/assets/approved-map-ui-clean.png" alt="知乎像素经验地图：作品村、投递码头、技能森林，以及举着路牌的刘看山向导" />
      <span className="guide-plate" aria-hidden="true" />
      <img className="guide-gif" src="/assets/liukanshan-guide.gif" alt="刘看山动态向导" />
      <div className="pixel-hotspots">
        {mapPlaces.map(place => <button type="button" key={place.id} className={`hotspot ${place.className}`} disabled={busy} onClick={() => startFromPlace(place)} aria-label={`${place.title}：${place.hint}`}><span className="sr-only">{place.title}：{place.hint}</span></button>)}
        <button type="button" className="hotspot guide-hotspot" onClick={revealInput} aria-label="刘看山向导：去输入你的问题"><span className="sr-only">刘看山向导：去输入你的问题</span></button>
        <button type="button" className="hotspot stamp-hotspot" disabled={busy} onClick={() => void submit(example)} aria-label="证据邮票：打开已整理的实习案例"><span className="sr-only">证据邮票：打开已整理的实习案例</span></button>
      </div>
    </section>
    <p className="pixel-caption">点地图上的地点，小山会把它变成可以直接检索的问题；也可以直接在下面写下你自己的问题。</p>
    <section className="hero"><div className="eyebrow">知乎内容的下一种读法</div>
    <h1>把零散经验，变成<br /><em>可比较的下一步</em></h1><p className="hero-copy">看清不同建议的前提、分歧与风险，再选择适合自己的行动。</p>
    <div className="how-it-works" aria-label="产品工作方式"><div><span>01</span><b>提出一个具体问题</b><small>主题或知乎问题链接都可以</small></div><i aria-hidden="true">→</i><div><span>02</span><b>对照不同经验路径</b><small>按条件、投入和风险比较</small></div><i aria-hidden="true">→</i><div><span>03</span><b>带走一份行动清单</b><small>每一步都有来源可以回看</small></div></div></section>
    <form ref={formRef} className="input-card" onSubmit={onSubmit} noValidate>
      <div className="mode-tabs" role="group" aria-label="输入方式">
        <button type="button" aria-pressed={draft.inputMode === 'topic'} className={draft.inputMode === 'topic' ? 'active' : ''} onClick={() => setDraft(d => ({ ...d, inputMode: 'topic', questionUrl: null, query: '' }))}>输入主题</button>
        <button type="button" aria-pressed={draft.inputMode === 'question_url'} className={draft.inputMode === 'question_url' ? 'active' : ''} onClick={() => setDraft(d => ({ ...d, inputMode: 'question_url', query: null, questionUrl: '' }))}>粘贴知乎问题链接</button>
      </div>
      {draft.inputMode === 'topic' ? <label className="field-label">你正在考虑什么？<textarea ref={queryRef} maxLength={500} rows={3} value={draft.query ?? ''} onChange={e => setDraft({ ...draft, query: e.target.value })} placeholder="例如：大学生如何准备第一份产品经理实习？" /></label>
        : <label className="field-label">知乎问题链接<input ref={questionUrlRef} type="url" value={draft.questionUrl ?? ''} onChange={e => setDraft({ ...draft, questionUrl: e.target.value })} placeholder="https://www.zhihu.com/question/..." /></label>}
      <label className="field-label">你最想关注什么？<input maxLength={300} value={draft.focus ?? ''} onChange={e => setDraft({ ...draft, focus: e.target.value || null })} placeholder="可选：时间、成本、作品集、风险……" /></label>
      {error && <p role="alert" className="form-error">{errorText(error)}</p>}
      <div className="form-actions"><button className="primary-button" disabled={busy}>{busy ? '正在连接服务，请稍候…' : '生成经验地图 →'}</button></div>
    </form></main>;
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
    const deadline = setTimeout(() => { setError({ code: 'WAIT_TIMEOUT', message: '整理仍在进行，结果尚未确认，可以再次检查状态。', retryable: true }); controller.abort(); clearTimeout(timer); }, 180000);
    let transientFailures = 0;
    async function poll() {
      const result = await api.getJob(jobId, controller.signal);
      if (controller.signal.aborted) return;
      if (!result.ok) {
        if (result.error.code === 'NETWORK_ERROR' && transientFailures < 5) { transientFailures += 1; timer = setTimeout(poll, 3000); return; }
        clearTimeout(deadline); setError(result.error); return;
      }
      transientFailures = 0;
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
  const labels = [...new Set([...map.routes.flatMap(r => r.tradeoffs.map(t => t.label))])];
  return <section className="comparison" aria-label="路线对比"><h2>按同一维度比较</h2>{['适合条件', ...labels, '风险'].map(label => <div className="compare-row" key={label}>
    <h3>{label}</h3><div className="compare-values">{map.routes.map(r => <div key={r.routeId}><b>{r.title}</b><p>{label === '适合条件' ? r.fit.join('；') || '资料未说明' : label === '风险' ? r.risks.join('；') || '资料未说明' : r.tradeoffs.find(t => t.label === label)?.value ?? '资料未说明'}</p></div>)}</div></div>)}</section>;
}
function mapDisplayTitle(map: ExperienceMap): string {
  return map.query?.trim() || '知乎问题';
}
function mapIsProcessLike(map: ExperienceMap): boolean { return map.presentation?.kind === 'insight'; }
function stagePaceVisible(map: ExperienceMap, text: string): boolean {
  return map.presentation?.timing !== 'none' && !mapIsProcessLike(map) && Boolean(text.trim());
}
function mapStructureLabel(map: ExperienceMap): string {
  if (map.presentation?.completeness === 'sources_only') return '已找到资料 · 整理未完成';
  if (mapIsProcessLike(map)) return '观点与依据';
  if (map.routes.length > 1) return map.routes.length + ' 条参考路线';
  return map.differences.length ? '共同主线 · 含关键分歧' : '行动流程';
}
function sourceMetrics(source: ExperienceMap['sources'][number]): string {
  return [['voteUpCount', '赞同'], ['commentCount', '评论']]
    .flatMap(([key, label]) => typeof source.metrics?.[key] === 'number'
      ? [source.metrics[key].toLocaleString('zh-CN') + ' ' + label] : []).join(' · ');
}
function MapPage() {
  const { mapId = '' } = useParams(); const { map, error } = useMap(mapId); const [params, setParams] = useSearchParams();
  const [evidence, setEvidence] = useState<Evidence | null>(null); const [compare, setCompare] = useState(false);
  if (error) return <ErrorView error={error} />;
  if (!map) return <Loading />;
  const selected = map.routes.find(r => r.routeId === params.get('routeId')) ?? map.routes[0];
  const insight = mapIsProcessLike(map);
  const partial = map.presentation?.completeness === 'sources_only';
  const focus = map.presentation?.focus;
  const questionId = map.questionUrl?.match(/\/question\/(\d+)/u)?.[1];
  const originalQuestionUrl = !synthetic(map) && map.inputMode === 'question_url'
    ? safeSourceUrl(map.questionUrl?.replace(/\/answer\/.*$/, '') ?? '') : null;
  return <main id="main" className={'page map-page' + (insight ? ' insight-page' : '')}>
    <div className="map-head"><div>
      <span className="status-pill">{partial ? '资料已获取 · 待整理' : statusLabel(map)}</span>
      {questionId && <span className="question-context">#{questionId} · 基于该问题下的回答整理</span>}
      <h1>{mapDisplayTitle(map)}</h1><p>{map.overview}</p>
      {originalQuestionUrl && <a className="question-origin" href={originalQuestionUrl} target="_blank" rel="noopener noreferrer">查看原问题 ↗</a>}
    </div><Link to="/" className="text-link">重新整理</Link></div>
    {Object.values(map.constraints).some(v => v !== null) && <div className="condition-row"><span>本地图条件</span>
      {map.constraints.background && <b>{map.constraints.background}</b>}
      {map.constraints.weeks !== null && <b>{map.constraints.weeks} 周</b>}
      {map.constraints.hoursPerWeek !== null && <b>每周 {map.constraints.hoursPerWeek} 小时</b>}
      {map.constraints.budgetCny !== null && <b>预算 ¥{map.constraints.budgetCny}</b>}</div>}
    <DataNotice map={map} />
    {focus?.requested && <section className={'focus-review ' + focus.status} aria-label="关注点回应">
      <h2>你关注的：{focus.requested}</h2><p>{focus.summary}</p>
      <Citations ids={focus.evidenceIds} map={map} open={setEvidence} />
    </section>}
    {selected && <section className="map-summary" aria-label="地图概览"><div className="summary-lead">
      <span className="eyebrow">{mapStructureLabel(map)}</span><h2>{insight ? '先理解观点，再核对依据' : selected.title}</h2>
      <p>{selected.strategy}</p></div><div className="summary-stats">
        {!insight && <div><b>{map.routes.length}</b><span>{map.routes.length === 1 ? '条主流程' : '条参考路线'}</span></div>}
        <div><b>{map.sources.length}</b><span>个来源摘要</span></div>
        <div><b>{selected.stages.length}</b><span>{insight ? '个理解维度' : '个行动阶段'}</span></div>
      </div></section>}
    {!selected ? <section className="route-detail"><h2>{partial ? '资料已找到，尚未形成可靠整理' : '暂时没有足够证据形成路线'}</h2>
      <p>可先查阅下方来源，或返回修改后重新整理。</p></section> : <>
      {map.routes.length > 1 && <section className="route-grid">{map.routes.map((r, i) => <button key={r.routeId}
        className={'route-card ' + (r === selected ? 'selected' : '')} aria-pressed={r === selected}
        onClick={() => setParams({ routeId: r.routeId }, { replace: true })}>
        <span className="route-number">{'路线 ' + (i + 1)}</span><h2>{r.title}</h2><p>{r.strategy}</p>
        <div className="route-tags">{r.fit.map(f => <span key={f}>{f}</span>)}</div>
        <div className="route-meta"><span>{r.stages.length} 个阶段</span><span>{new Set(r.evidenceIds).size} 条引用</span></div>
        <span className="route-cta">{r === selected ? '当前路线 ✓' : '查看这条路线 →'}</span>
      </button>)}</section>}
      {map.routes.length > 1 && !insight && <button className="ghost-button" aria-expanded={compare}
        onClick={() => setCompare(!compare)}>{compare ? '收起路线对比' : '比较所有路线'}</button>}
      {compare && map.routes.length > 1 && !insight && <Comparison map={map} />}
      <section className="route-detail"><div className="section-heading"><div><span className="eyebrow">{insight ? '观点梳理' : '当前路线'}</span>
        <h2>{selected.title}</h2></div><span className="source-count">{new Set(selected.evidenceIds).size} 条引用</span></div>
        {map.presentation?.timingNote && <p className="timing-note">{map.presentation.timingNote}</p>}
        <div className="detail-grid"><div className={insight ? 'insight-sections' : 'timeline'}>
          {selected.stages.map((stage, i) => <article className={insight ? 'insight-card' : 'stage-card'} key={stage.stageId}>
            {!insight && <div className="stage-index">{i + 1}</div>}<div>
              {stagePaceVisible(map, stage.suggestedWeeks) && <span className="stage-weeks">{stage.suggestedWeeks}</span>}
              <h3>{stage.title}</h3>{stage.tasks.map(task => <div className="task-preview" key={task.taskId}>
                <b>{task.action}</b><span>{insight ? '判断边界：' : '完成判据：'}{task.doneWhen}</span>
                <Citations ids={task.evidenceIds} map={map} open={setEvidence} />
              </div>)}
            </div>
          </article>)}</div>
          <aside className="side-panel">
            {!!selected.fit.length && <div className="side-block"><span className="eyebrow">适用条件</span><ul>{selected.fit.map(f => <li key={f}>{f}</li>)}</ul></div>}
            {!!selected.risks.length && <div className="side-block"><span className="eyebrow">{insight ? '理解时的提醒' : '关键风险'}</span><ul>{selected.risks.map(r => <li key={r}>{r}</li>)}</ul></div>}
            {!!selected.tradeoffs.length && <div className="side-block"><span className="eyebrow">{insight ? '需要权衡' : '投入取舍'}</span>
              {selected.tradeoffs.map(t => <div className="tradeoff" key={t.label}><span>{t.label}</span><b>{t.value}</b></div>)}</div>}
            {!!map.differences.length && <div className="side-block"><span className="eyebrow">观点差异</span>
              {map.differences.map(d => <div key={d.title}><h3 className="difference-title">{d.title}</h3><p>{d.summary}</p><Citations ids={d.evidenceIds} map={map} open={setEvidence} /></div>)}</div>}
          </aside>
        </div>
      </section>
    </>}
    <section className="sources-section"><div className="section-heading"><div><span className="eyebrow">可回看的依据</span><h2>来源摘要</h2></div>
      <span className="source-count">{map.sources.length} 个来源</span></div>
      {map.sources.map(s => <article key={s.sourceId}><div className="source-row">
        <span className="source-type">{s.contentType === 'article' ? '文章' : '回答摘要'}</span>
        {s.authorName && <span>{s.authorName}</span>}{sourceMetrics(s) && <span>{sourceMetrics(s)}</span>}
      </div><h3>{s.title}</h3><p>{s.summary}</p>
      <Citations ids={map.evidence.filter(e => e.sourceId === s.sourceId).map(e => e.evidenceId)} map={map} open={setEvidence} />
      {!synthetic(map) && safeSourceUrl(s.url) && <a className="text-link" href={safeSourceUrl(s.url)!} target="_blank" rel="noopener noreferrer">查看原文 ↗</a>}
      </article>)}
    </section>
    <section className="limitations"><span>使用前请知道</span>{map.limitations.map(l => <p key={l}>{l}</p>)}</section>
    <div className="map-actions"><Link className="ghost-button" to="/">← 返回修改</Link>
      {selected && <Link className="primary-button" to={'/maps/' + encodeURIComponent(mapId) + '/plan?routeId=' + encodeURIComponent(selected.routeId)}>
        {insight ? '查看与导出观点笔记 →' : '选择这条路线，生成清单 →'}
      </Link>}
    </div>
    {evidence && <SourceDrawer map={map} evidence={evidence} close={() => setEvidence(null)} />}
  </main>;
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
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = mapIsProcessLike(map) ? '知乎经验地图-观点笔记.md' : '知乎经验地图-行动清单.md';
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const total = route.stages.reduce((sum, s) => sum + s.tasks.length, 0);
  return <main id="main" className="page plan-page"><Link className="text-link" to={`/maps/${encodeURIComponent(map.mapId)}?routeId=${encodeURIComponent(route.routeId)}`}>← 返回经验地图</Link>
    <div className="plan-head"><span className="status-pill">{route.title}</span><h1>{mapIsProcessLike(map) ? '把观点整理成可回看的内容' : '把路线变成今天能开始的事'}</h1><p>{mapIsProcessLike(map) ? '以下内容按理解和验证顺序排列，不代表固定时间表。' : '以下为建议安排；勾选进度仅保存在本机。'}</p><DataNotice map={map} />
      {!mapIsProcessLike(map) && <><p role="status">{completed.length}/{total} 项已完成</p><progress aria-label="清单完成进度" value={completed.length} max={total || 1} /></>}</div>
    {storageError && <p className="notice" role="alert">{storageError}</p>}
    <div className="plan-list">{route.stages.map(s => <section className="plan-stage" key={s.stageId}>{stagePaceVisible(map, s.suggestedWeeks) && <span className="stage-weeks">{s.suggestedWeeks}</span>}<h2>{s.title}</h2>{s.tasks.map(t => <div key={t.taskId}>{mapIsProcessLike(map) ? <div className="plan-task"><span><b>{t.action}</b><small>适用边界：{t.doneWhen}</small></span></div> : <label className={`plan-task ${completed.includes(t.taskId) ? 'complete' : ''}`}><input disabled={!ready} type="checkbox" checked={completed.includes(t.taskId)} onChange={() => toggle(t.taskId)} /><span><b>{t.action}</b><small>完成判据：{t.doneWhen}</small></span></label>}<Citations ids={t.evidenceIds} map={map} open={setEvidence} /></div>)}</section>)}</div>
    <div className="plan-actions"><button className="ghost-button" onClick={download}>导出 Markdown</button><Link className="primary-button" to={`/maps/${encodeURIComponent(map.mapId)}`}>{mapIsProcessLike(map) ? '返回观点梳理' : '重新选择路线'}</Link></div>{evidence && <SourceDrawer map={map} evidence={evidence} close={() => setEvidence(null)} />}</main>;
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
