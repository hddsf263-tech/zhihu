import { describe, expect, it } from 'vitest';
import { loadConfig, redact } from './config.js';

describe('configuration safety', () => {
  it('loads server-only settings without exposing secrets', () => {
    const config = loadConfig({ ZHIHU_ACCESS_SECRET: 'secret-value', ZHIHU_TIMEOUT_MS: '5000', ZHIHU_API_BASE_URL: 'https://example.test', MODEL_NAME: 'model-test' });
    expect(config.accessSecret).toBe('secret-value');
    expect(config.timeoutMs).toBe(5000);
    expect(loadConfig({}).baseUrl).toBe('https://developer.zhihu.com');
    expect(redact(config.accessSecret!)).toBe('[REDACTED]');
  });
});