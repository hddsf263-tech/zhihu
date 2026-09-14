import { loadConfig, redact } from './config.js';

export type UpstreamErrorCode = 'UPSTREAM_AUTH' | 'UPSTREAM_RATE_LIMIT' | 'UPSTREAM_TIMEOUT' | 'UPSTREAM_EMPTY' | 'INTERNAL_ERROR';
export class UpstreamError extends Error {
  constructor(public readonly code: UpstreamErrorCode, message: string, public readonly retryable = false) { super(message); }
}

export type ZhihuSource = {
  contentType: 'answer' | 'article' | 'question_answer_summary';
  title?: string;
  questionTitle?: string | null;
  authorName?: string | null;
  summary: string;
  url: string;
  publishedAt?: string | null;
  contentToken?: string;
  authorityLevel?: string | null;
  metrics?: Record<string, number> | null;
};
export type ZhihuClient = {
  search(query: string, signal: AbortSignal): Promise<ZhihuSource[]>;
  questionAnswers(questionUrl: string, signal: AbortSignal): Promise<ZhihuSource[]>;
};

type ApiEnvelope = {
  Code?: number;
  Message?: string;
  Data?: { Items?: unknown[]; Paging?: { IsEnd?: boolean; NextOffset?: number } };
  data?: unknown[];
  items?: unknown[];
};

export class ZhihuHttpClient implements ZhihuClient {
  private readonly config = loadConfig();

  private headers(): Record<string, string> {
    if (!this.config.accessSecret) throw new UpstreamError('UPSTREAM_AUTH', '知乎内容服务未配置 Access Secret。');
    return {
      Authorization: `Bearer ${this.config.accessSecret}`,
      'Content-Type': 'application/json',
      'X-Request-Timestamp': String(Math.floor(Date.now() / 1000))
    };
  }

  async search(query: string, signal: AbortSignal): Promise<ZhihuSource[]> {
    return this.request('/api/v1/content/zhihu_search', { Query: query, Count: '10' }, signal);
  }

  async questionAnswers(questionUrl: string, signal: AbortSignal): Promise<ZhihuSource[]> {
    return this.request('/api/v1/content/question_answers', { QuestionUrl: questionUrl, Offset: '0', Limit: '20' }, signal, 'question_answer_summary');
  }

  private async request(
    path: string,
    query: Record<string, string>,
    signal: AbortSignal,
    fallbackContentType?: ZhihuSource['contentType']
  ): Promise<ZhihuSource[]> {
    const headers = this.headers();
    const url = new URL(path, this.config.baseUrl);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    const timeoutController = new AbortController();
    const onAbort = () => timeoutController.abort();
    signal.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => timeoutController.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(url, { method: 'GET', headers, signal: timeoutController.signal });
      if (response.status === 401 || response.status === 403) throw new UpstreamError('UPSTREAM_AUTH', '知乎内容服务鉴权失败。');
      if (response.status === 429) throw new UpstreamError('UPSTREAM_RATE_LIMIT', '知乎内容服务暂时达到调用限制。');
      if (!response.ok) throw new UpstreamError('INTERNAL_ERROR', '知乎内容服务暂时不可用。', true);
      const payload = await response.json() as ApiEnvelope;
      if (payload.Code === 20001) throw new UpstreamError('UPSTREAM_AUTH', '知乎内容服务鉴权失败。');
      if (payload.Code === 30001) throw new UpstreamError('UPSTREAM_RATE_LIMIT', '知乎内容服务暂时达到调用限制。');
      if (typeof payload.Code === 'number' && payload.Code !== 0) throw new UpstreamError('INTERNAL_ERROR', '知乎内容服务暂时不可用。', true);
      const items = payload.Data?.Items ?? payload.data ?? payload.items ?? [];
      const sources = items.flatMap((item) => normalizeZhihuItem(item, fallbackContentType));
      if (!sources.length) throw new UpstreamError('UPSTREAM_EMPTY', '未找到可整理的知乎内容。');
      return dedupeSources(sources);
    } catch (error) {
      if (error instanceof UpstreamError) throw error;
      if ((error as Error).name === 'AbortError') throw new UpstreamError('UPSTREAM_TIMEOUT', '知乎内容服务响应超时。', true);
      throw new UpstreamError('INTERNAL_ERROR', '知乎内容服务暂时不可用。', true);
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      void redact(this.config.accessSecret ?? '');
    }
  }
}

export function normalizeZhihuItem(item: unknown, fallbackContentType?: ZhihuSource['contentType']): ZhihuSource[] {
  if (!item || typeof item !== 'object') return [];
  const value = item as Record<string, unknown>;
  const summary = pickText(value, ['Summary', 'summary', 'ContentText', 'contentText']);
  const url = pickText(value, ['Url', 'url']);
  if (!summary || !url) return [];
  const rawContentType = pickText(value, ['ContentType', 'contentType']).toLowerCase();
  const contentType = fallbackContentType
    ?? (rawContentType === 'article' ? 'article' : rawContentType === 'question_answer_summary' ? 'question_answer_summary' : 'answer');
  const editTime = value.EditTime ?? value.editTime;
  const nestedQuestion = value.Question && typeof value.Question === 'object' ? value.Question as Record<string, unknown> : undefined;
  const questionTitle = pickText(value, ['QuestionTitle', 'questionTitle', 'QuestionName', 'questionName'])
    || (nestedQuestion ? pickText(nestedQuestion, ['Title', 'title', 'Name', 'name']) : '');
  const metrics = numericMetrics(value, [
    ['voteUpCount', ['VoteUpCount', 'VoteupCount', 'voteUpCount', 'voteupCount', 'LikeCount', 'likeCount']],
    ['commentCount', ['CommentCount', 'commentCount']],
    ['followerCount', ['FollowerCount', 'followerCount', 'AuthorFollowerCount', 'authorFollowerCount']]
  ]);
  return [{
    contentType,
    title: pickText(value, ['Title', 'title']) || undefined,
    questionTitle: questionTitle || null,
    authorName: pickText(value, ['AuthorName', 'authorName']) || null,
    summary,
    url,
    publishedAt: typeof editTime === 'number' ? new Date(editTime * 1000).toISOString() : pickText(value, ['PublishedAt', 'publishedAt']) || null,
    contentToken: pickText(value, ['ContentToken', 'contentToken', 'ContentID', 'contentId']) || undefined,
    authorityLevel: pickText(value, ['AuthorityLevel', 'authorityLevel']) || null,
    metrics
  }];
}

function numericMetrics(value: Record<string, unknown>, fields: Array<[string, string[]]>): Record<string, number> | null {
  const result: Record<string, number> = {};
  for (const [name, keys] of fields) {
    const found = keys.map(key => value[key]).find(item => typeof item === 'number' || (typeof item === 'string' && item.trim() !== '' && Number.isFinite(Number(item))));
    if (found !== undefined && Number.isFinite(Number(found)) && Number(found) >= 0) result[name] = Number(found);
  }
  return Object.keys(result).length ? result : null;
}

function pickText(value: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) if (typeof value[key] === 'string') return value[key].trim();
  return '';
}

export function dedupeSources(sources: ZhihuSource[]): ZhihuSource[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = `${source.url}|${source.summary}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 30);
}