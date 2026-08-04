import { RpcHostClient } from './rpcHostClient';

declare function acquireVsCodeApi(): { postMessage(message: unknown): void };

export const hostClient = new RpcHostClient(
  acquireVsCodeApi(),
  receive => addEventListener('message', event => receive(event.data)),
);
