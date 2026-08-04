import {
  CompletionClient,
  CompletionRequest,
  SecretStore,
  SettingsStore,
  stripReasoning,
} from '@tomato-writer/core';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class OpenAICompatibleClient implements CompletionClient {
  constructor(
    private readonly settings: SettingsStore,
    private readonly secrets: SecretStore,
    private readonly fetcher: FetchLike = fetch,
    private readonly timeoutMs = 300_000,
  ) {}

  async complete(request: CompletionRequest): Promise<string> {
    const settings = await this.settings.read();
    const apiKey = await this.secrets.read('tomatoWriter.apiKey');
    if (!apiKey) throw new Error('请先在 AI 设置中保存 API Key');

    const controller = new AbortController();
    const abort = () => controller.abort();
    request.signal?.addEventListener('abort', abort, { once: true });
    if (request.signal?.aborted) controller.abort();
    const timeout = setTimeout(abort, this.timeoutMs);
    try {
      const isMiniMax = /^https:\/\/api\.minimax(i)?\.(com|io)\//i.test(settings.apiUrl);
      const requestedTokens = request.maxTokens || settings.maxTokens || 4096;
      const outputTokens = isMiniMax && settings.model === 'MiniMax-M3'
        ? Math.max(requestedTokens, 16384)
        : requestedTokens;
      const response = await this.fetcher(settings.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: settings.model,
          messages: request.messages,
          temperature: settings.temperature,
          ...(isMiniMax
            ? { max_completion_tokens: outputTokens, reasoning_split: true }
            : { max_tokens: outputTokens }),
        }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({})) as Record<string, any>;
      if (!response.ok) {
        throw new Error(
          data.error?.message || data.message || data.base_resp?.status_msg ||
          `API 请求失败 (${response.status})`,
        );
      }
      if (typeof data.base_resp?.status_code === 'number' && data.base_resp.status_code !== 0) {
        throw new Error(data.base_resp.status_msg
          ? `${data.base_resp.status_msg}（MiniMax 状态码 ${data.base_resp.status_code}）`
          : `MiniMax API 状态码 ${data.base_resp.status_code}`);
      }
      const rawContent = data.choices?.[0]?.message?.content ?? data.reply ?? data.output?.text;
      const combined = Array.isArray(rawContent)
        ? rawContent.map(part =>
          typeof part === 'string' ? part : typeof part?.text === 'string' ? part.text : '').join('')
        : rawContent;
      const content = typeof combined === 'string' ? stripReasoning(combined) : combined;
      if (typeof content !== 'string' || !content.trim()) {
        const finishReason = data.choices?.[0]?.finish_reason;
        const detail = data.choices?.[0]?.message?.reasoning_content
          ? '模型只返回了推理过程，没有返回正文'
          : finishReason ? `结束原因：${finishReason}` : '响应中没有正文';
        throw new Error(`模型返回了空内容（${detail}）`);
      }
      return content;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw new Error('请求已取消或超时');
      throw error;
    } finally {
      clearTimeout(timeout);
      request.signal?.removeEventListener('abort', abort);
    }
  }
}
