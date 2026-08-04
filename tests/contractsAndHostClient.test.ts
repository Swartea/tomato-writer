import { describe, expect, it, vi } from 'vitest';
import { isHostToWebviewMessage, isWebviewToHostMessage } from '../packages/contracts/src';
import { RpcHostClient } from '../webview/src/rpcHostClient';

describe('协议运行时校验', () => {
  it('拒绝未知命令、缺字段和无 requestId 消息', () => {
    expect(isWebviewToHostMessage({ type: 'request', requestId: '1', command: 'ready', payload: undefined })).toBe(true);
    expect(isWebviewToHostMessage({ type: 'request', requestId: '1b', command: 'ready' })).toBe(true);
    expect(isWebviewToHostMessage({ type: 'request', requestId: '1', command: 'unknown', payload: {} })).toBe(false);
    expect(isWebviewToHostMessage({ type: 'request', command: 'ready', payload: undefined })).toBe(false);
    expect(isWebviewToHostMessage({ type: 'request', requestId: '1', command: 'loadProject', payload: {} })).toBe(false);
    expect(isWebviewToHostMessage({
      type: 'request', requestId: '2', command: 'selectProjectLibrary', payload: undefined,
    })).toBe(true);
    expect(isWebviewToHostMessage({
      type: 'request', requestId: '3', command: 'createProject', payload: { location: 'invalid' },
    })).toBe(false);
    expect(isWebviewToHostMessage({
      type: 'request', requestId: '4', command: 'reloadProject', payload: { rootPath: '/book' },
    })).toBe(true);
    expect(isWebviewToHostMessage({
      type: 'request', requestId: '5', command: 'migrateProject', payload: {},
    })).toBe(false);
    expect(isHostToWebviewMessage({ type: 'response', requestId: '1', ok: false })).toBe(false);
  });

  it('校验 generateOptions 的 kind 白名单与可选参数', () => {
    const request = (payload: unknown) =>
      isWebviewToHostMessage({ type: 'request', requestId: 'g', command: 'generateOptions', payload });
    expect(request({ kind: 'titles', project: {} })).toBe(true);
    expect(request({ kind: 'beats', project: {}, count: 3, exclude: ['旧方案'] })).toBe(true);
    expect(request({ kind: 'synopsis', project: {} })).toBe(false);
    expect(request({ kind: 'titles' })).toBe(false);
    expect(request({ kind: 'titles', project: {}, count: '6' })).toBe(false);
    expect(request({ kind: 'titles', project: {}, exclude: '旧书名' })).toBe(false);
  });
});

describe('HostClient 请求关联', () => {
  it('正确关联乱序并发响应、错误与重复响应', async () => {
    const sent: any[] = [];
    let receive!: (message: unknown) => void;
    const client = new RpcHostClient(
      { postMessage: message => sent.push(message) },
      listener => { receive = listener; },
      () => 1,
    );
    const first = client.request('loadProject', { rootPath: '/one' });
    const second = client.request('loadProject', { rootPath: '/two' });
    receive({ type: 'response', requestId: sent[1].requestId, ok: true, data: { id: 'two' } });
    receive({ type: 'response', requestId: sent[0].requestId, ok: false, error: '失败' });
    receive({ type: 'response', requestId: sent[1].requestId, ok: true, data: { id: 'duplicate' } });
    await expect(second).resolves.toEqual({ id: 'two' });
    await expect(first).rejects.toThrow('失败');
  });

  it('超时后发送取消并清理请求', async () => {
    vi.useFakeTimers();
    const sent: any[] = [];
    const client = new RpcHostClient(
      { postMessage: message => sent.push(message) },
      () => {},
      () => 1,
    );
    const promise = client.request('ready', undefined, { timeoutMs: 50 });
    const assertion = expect(promise).rejects.toThrow('请求已超时');
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
    expect(sent.at(-1).type).toBe('cancel');
    vi.useRealTimers();
  });

  it('转发宿主事件', () => {
    let receive!: (message: unknown) => void;
    const listener = vi.fn();
    const client = new RpcHostClient({ postMessage: () => {} }, next => { receive = next; });
    client.subscribe(listener);
    receive({ type: 'event', event: 'openSettings' });
    expect(listener).toHaveBeenCalledOnce();
  });
});
