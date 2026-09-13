export type ApiConfig = { accessSecret?: string; baseUrl: string; timeoutMs: number; modelName: string };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return {
    accessSecret: env.ZHIHU_ACCESS_SECRET || undefined,
    baseUrl: env.ZHIHU_API_BASE_URL ?? 'https://openapi.zhihu.com',
    timeoutMs: Number(env.ZHIHU_TIMEOUT_MS ?? 10000),
    modelName: env.MODEL_NAME ?? 'zhida-fast-1p5'
  };
}

export function redact(value: string): string {
  return '[REDACTED]';
}
