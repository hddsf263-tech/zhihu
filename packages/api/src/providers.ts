import { loadConfig, redact } from './config.js';

export type UpstreamErrorCode = 'UPSTREAM_AUTH' | 'UPSTREAM_RATE_LIMIT' | 'UPSTREAM_TIMEOUT' | 'UPSTREAM_EMPTY' | 'INTERNAL_ERROR';
export class UpstreamError extends Error {
  constructor(public readonly code: UpstreamErrorCode, message: string, public readonly retryable = false) { super(message); }
}
export type ZhihuSource = { contentType: 'answer' | 'article' | 'question_answer_summary'; title?: string; authorName?: string | null; summary: string; url: string; publishedAt?: string | null; contentToken?: string };
export type ZhihuClient = { search(query: string, signal: AbortSignal): Promise<ZhihuSource[]>; questionAnswers(questionUrl: string, signal: AbortSignal): Promise<ZhihuSource[]> };

export class ZhihuHttpClient implements ZhihuClient {
  private readonly config = loadConfig();
  private headers(): Record<string, string> {
    if (!this.config.accessSecret) throw new UpstreamError('UPSTREAM_AUTH', '知乎内容服务未配置 Access Secret。');
    return { Authorization: `Bearer ${this.config.accessSecret}`, 'Content-Type': 'application/json', 'X-Request-Timestamp': String(Math.floor(Date.now() / 1000)) };
  }
  async search(query: string, signal: AbortSignal): Promise<ZhihuSource[]> { return this.request('/v1/zhihu/search', { query }, signal); }
  async questionAnswers(questionUrl: string, signal: AbortSignal): Promise<ZhihuSource[]> { return this.request('/v1/zhihu/question_answers', { questionUrl }, signal); }
  private async request(path: string, body: Record<string, string>, signal: AbortSignal): Promise<ZhihuSource[]> {
    const headers = this.headers();
    try {
      const response = await fetch(`${this.config.baseUrl}${path}`, { method: 'POST', headers, body: JSON.stringify(body), signal });
      if (response.status === 401 || response.status === 403) throw new UpstreamError('UPSTREAM_AUTH', '知乎内容服务鉴权失败。');
      if (response.status === 429) throw new UpstreamError('UPSTREAM_RATE_LIMIT', '知乎内容服务暂时达到调用限制。');
      if (!response.ok) throw new UpstreamError('INTERNAL_ERROR', '知乎内容服务暂时不可用。', true);
      const payload = await response.json() as { Code?: number; Message?: string; data?: unknown[]; items?: unknown[] };
      if (payload.Code === 30001) throw new UpstreamError('UPSTREAM_RATE_LIMIT', '知乎内容服务暂时达到调用限制。');
      const items = payload.data ?? payload.items ?? [];
      const sources = items.flatMap((item) => normalizeZhihuItem(item));
      if (!sources.length) throw new UpstreamError('UPSTREAM_EMPTY', '未找到可整理的知乎内容。');
      return dedupeSources(sources);
    } catch (error) {
      if (error instanceof UpstreamError) throw error;
      if ((error as Error).name === 'AbortError') throw new UpstreamError('UPSTREAM_TIMEOUT', '知乎内容服务响应超时。', true);
      throw new UpstreamError('INTERNAL_ERROR', '知乎内容服务暂时不可用。', true);
    } finally {
      // Never log Authorization or request body. Redaction helper is intentionally kept local to this boundary.
      void redact(this.config.accessSecret ?? '');
    }
  }
}

export function normalizeZhihuItem(item: unknown): ZhihuSource[] {
  if (!item || typeof item !== 'object') return [];
  const value = item as Record<string, unknown>;
  const summary = typeof value.Summary === 'string' ? value.Summary.trim() : typeof value.summary === 'string' ? value.summary.trim() : '';
  const url = typeof value.Url === 'string' ? value.Url : typeof value.url === 'string' ? value.url : '';
  if (!summary || !url) return [];
  const contentType = value.ContentType === 'article' || value.contentType === 'article' ? 'article' : 'answer';
  return [{ contentType, title: typeof value.Title === 'string' ? value.Title : undefined, authorName: typeof value.AuthorName === 'string' ? value.AuthorName : null, summary, url, publishedAt: typeof value.PublishedAt === 'string' ? value.PublishedAt : null, contentToken: typeof value.ContentToken === 'string' ? value.ContentToken : undefined }];
}

export function dedupeSources(sources: ZhihuSource[]): ZhihuSource[] {
  const seen = new Set<string>();
  return sources.filter((source) => { const key = `${source.url}|${source.summary}`; if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 10);
}
