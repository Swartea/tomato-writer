import {
  CommandMap,
  CommandName,
  HostClient,
  HostEvent,
  isHostToWebviewMessage,
} from '@tomato-writer/contracts';

export interface HostTransport {
  postMessage(message: unknown): void;
}

interface PendingRequest {
  resolve(value: unknown): void;
  reject(error: Error): void;
  timeout: ReturnType<typeof setTimeout>;
}

export class RpcHostClient implements HostClient {
  private readonly pending = new Map<string, PendingRequest>();
  private readonly completed = new Set<string>();
  private readonly listeners = new Set<(event: HostEvent) => void>();
  private sequence = 0;

  constructor(
    private readonly transport: HostTransport,
    subscribeToMessages: (receive: (message: unknown) => void) => void,
    private readonly now: () => number = Date.now,
  ) {
    subscribeToMessages(value => this.receive(value));
  }

  request<C extends CommandName>(
    command: C,
    payload: CommandMap[C]['payload'],
    options?: { timeoutMs?: number },
  ): Promise<CommandMap[C]['result']> {
    const requestId = `web-${this.now().toString(36)}-${++this.sequence}`;
    const timeoutMs = options?.timeoutMs ?? 320_000;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        this.completed.add(requestId);
        this.transport.postMessage({ type: 'cancel', requestId });
        reject(new Error('请求已超时'));
      }, timeoutMs);
      this.pending.set(requestId, { resolve, reject, timeout });
      this.transport.postMessage({ type: 'request', requestId, command, payload });
    });
  }

  cancel(requestId: string): void {
    this.transport.postMessage({ type: 'cancel', requestId });
    const pending = this.pending.get(requestId);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pending.delete(requestId);
    this.completed.add(requestId);
    pending.reject(new Error('请求已取消'));
  }

  subscribe(listener: (event: HostEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private receive(value: unknown): void {
    if (!isHostToWebviewMessage(value)) return;
    if (value.type === 'event') {
      this.listeners.forEach(listener => listener(value));
      return;
    }
    if (this.completed.has(value.requestId)) return;
    const pending = this.pending.get(value.requestId);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pending.delete(value.requestId);
    this.completed.add(value.requestId);
    if (this.completed.size > 500) this.completed.clear();
    if (value.ok) pending.resolve(value.data);
    else pending.reject(new Error(value.error));
  }
}
