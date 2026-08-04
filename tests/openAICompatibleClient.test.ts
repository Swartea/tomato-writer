import { describe, expect, it, vi } from 'vitest';
import { OpenAICompatibleClient } from '../src/adapters/openAICompatibleClient';
import type { AISettings, SecretStore, SettingsStore } from '../packages/core/src';

const settings = (overrides: Partial<AISettings> = {}): SettingsStore => ({
  read: async () => ({
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-test',
    temperature: 0.8,
    maxTokens: 4096,
    ...overrides,
  }),
  write: async () => {},
});
const secrets: SecretStore = {
  read: async () => 'secret',
  write: async () => {},
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const request = { messages: [{ role: 'user' as const, content: 'hello' }] };

describe('OpenAI 兼容模型适配器', () => {
  it('归一化 OpenAI 正文并剥离 think', async () => {
    const fetcher = vi.fn(async () => response({
      choices: [{ message: { content: '<think>hidden</think>正文' } }],
    }));
    const client = new OpenAICompatibleClient(settings(), secrets, fetcher);
    expect(await client.complete(request)).toBe('正文');
  });

  it('为 MiniMax-M3 使用兼容参数并归一化分段正文', async () => {
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) =>
      response({ base_resp: { status_code: 0 }, choices: [{ message: { content: [{ text: '正' }, { text: '文' }] } }] }));
    const client = new OpenAICompatibleClient(settings({
      apiUrl: 'https://api.minimaxi.com/v1/text/chatcompletion_v2',
      model: 'MiniMax-M3',
    }), secrets, fetcher);
    expect(await client.complete(request)).toBe('正文');
    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(body.max_completion_tokens).toBe(16384);
    expect(body.reasoning_split).toBe(true);
    expect(body.max_tokens).toBeUndefined();
  });

  it.each([
    [response({ error: { message: '余额不足' } }, 402), '余额不足'],
    [response({ base_resp: { status_code: 1001, status_msg: '参数错误' } }), 'MiniMax 状态码 1001'],
    [response({ choices: [{ message: { reasoning_content: 'only reasoning', content: '' } }] }), '模型只返回了推理过程'],
  ])('解析错误响应 %#', async (mockResponse, message) => {
    const client = new OpenAICompatibleClient(settings(), secrets, async () => mockResponse);
    await expect(client.complete(request)).rejects.toThrow(message);
  });

  it('支持外部取消和超时', async () => {
    const hanging = (_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      if (init?.signal?.aborted) {
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        return;
      }
      init?.signal?.addEventListener('abort', () =>
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    });
    const controller = new AbortController();
    const cancelled = new OpenAICompatibleClient(settings(), secrets, hanging, 10_000)
      .complete({ ...request, signal: controller.signal });
    controller.abort();
    await expect(cancelled).rejects.toThrow('请求已取消或超时');
    await expect(new OpenAICompatibleClient(settings(), secrets, hanging, 5).complete(request))
      .rejects.toThrow('请求已取消或超时');
  });
});
