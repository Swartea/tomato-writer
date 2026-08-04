import {
  AISettings, AssetKind, CandidateDraft, CompletionMessage, GenerateOptionsKind, OptionCandidate,
  ProjectData, ProjectSummary,
} from '@tomato-writer/core';

/** `generateOptions` 的 kind 白名单，类型与运行时校验共用同一份。 */
const OPTION_KINDS: GenerateOptionsKind[] = ['titles', 'sellingPoints', 'tags', 'targetReaders', 'beats'];

export interface CommandMap {
  ready: {
    payload: undefined;
    result: { projects: ProjectSummary[]; settings: AISettings; hasApiKey: boolean; libraryRoot: string };
  };
  createProject: {
    payload: {
      suggestedName?: string;
      location?: 'library' | 'choose';
      seed?: {
        sellingPoint?: string;
        genreTrack?: ProjectData['planning']['genreTrack'];
        genre?: string;
        titleCandidates?: string[];
        tags?: string[];
      };
    };
    result: ProjectData | null;
  };
  selectProjectLibrary: {
    payload: undefined;
    result: { libraryRoot: string; projects: ProjectSummary[] } | null;
  };
  revealProjectLibrary: { payload: undefined; result: { libraryRoot: string } };
  revealProjectFolder: { payload: { rootPath: string }; result: { rootPath: string } };
  migrateProject: {
    payload: { project: ProjectData };
    result: { project: ProjectData; sourceRoot: string; targetRoot: string };
  };
  reloadProject: { payload: { rootPath: string }; result: ProjectData };
  openProject: { payload: undefined; result: ProjectData | null };
  loadProject: { payload: { rootPath: string }; result: ProjectData };
  saveProject: { payload: { project: ProjectData }; result: { project: ProjectData; savedAt: string } };
  approveCandidate: { payload: { project: ProjectData; candidateId: string; content: string }; result: ProjectData };
  backupProject: { payload: { project: ProjectData }; result: { destination: string } };
  exportProject: {
    payload: { project: ProjectData; format: 'txt' | 'md'; destination?: 'project' | 'choose' };
    result: { file: string } | null;
  };
  getSettings: { payload: undefined; result: { settings: AISettings; hasApiKey: boolean } };
  saveSettings: { payload: { settings: AISettings; apiKey?: string }; result: { settings: AISettings; hasApiKey: boolean } };
  importLegacy: { payload: { state: unknown }; result: ProjectData[] };
  recommendSubtype: { payload: { concept: string; genreTrack: ProjectData['planning']['genreTrack'] }; result: unknown };
  generateOptions: {
    payload: { kind: GenerateOptionsKind; project: ProjectData; count?: number; exclude?: string[] };
    result: { kind: GenerateOptionsKind; options: OptionCandidate[] };
  };
  strengthenPlanning: { payload: { project: ProjectData }; result: unknown };
  deriveStyle: { payload: { project: ProjectData }; result: ProjectData['styleProfile'] };
  generateOutline: { payload: { project: ProjectData }; result: ProjectData['outline'] };
  generateChapter: { payload: { project: ProjectData; chapterId: string; instruction: string }; result: CandidateDraft };
  generateAsset: { payload: { kind: AssetKind; project: ProjectData }; result: ProjectData['characters'][number] | ProjectData['world'][number] | ProjectData['foreshadowing'][number] };
  runAssistant: { payload: { project: ProjectData; task: string; input: string }; result: string };
  brainstorm: { payload: { concept: string; genreTrack: ProjectData['planning']['genreTrack']; targetWords: number }; result: unknown };
  complete: { payload: { messages: CompletionMessage[]; maxTokens?: number }; result: string };
}

export type CommandName = keyof CommandMap;

export type HostRequest<C extends CommandName = CommandName> = C extends CommandName ? {
  type: 'request';
  requestId: string;
  command: C;
  payload: CommandMap[C]['payload'];
} : never;

export type HostResponse =
  | { type: 'response'; requestId: string; ok: true; data: unknown }
  | { type: 'response'; requestId: string; ok: false; error: string };

export type HostCancel = { type: 'cancel'; requestId: string };

export type HostEvent =
  | { type: 'event'; event: 'openSettings'; payload?: undefined }
  | { type: 'event'; event: 'switchTab'; payload: { tab: string } }
  | { type: 'event'; event: 'projectsChanged'; payload: { projects: ProjectSummary[] } }
  | { type: 'event'; event: 'legacyMigrated'; payload?: undefined };

export type WebviewToHostMessage = HostRequest | HostCancel;
export type HostToWebviewMessage = HostResponse | HostEvent;

const commands = new Set<CommandName>([
  'ready', 'createProject', 'selectProjectLibrary', 'revealProjectLibrary',
  'revealProjectFolder', 'migrateProject', 'reloadProject',
  'openProject', 'loadProject', 'saveProject',
  'approveCandidate', 'backupProject', 'exportProject', 'getSettings', 'saveSettings',
  'importLegacy', 'recommendSubtype', 'generateOptions', 'strengthenPlanning', 'deriveStyle',
  'generateOutline', 'generateChapter', 'generateAsset', 'runAssistant', 'brainstorm', 'complete',
]);

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function validPayload(command: CommandName, payload: unknown): boolean {
  const hasProject = (value: unknown): value is Record<string, unknown> & { project: Record<string, unknown> } =>
    record(value) && record(value.project);
  switch (command) {
    case 'ready':
    case 'openProject':
    case 'getSettings':
    case 'selectProjectLibrary':
    case 'revealProjectLibrary':
      return payload === undefined;
    case 'createProject':
      return record(payload) &&
        (payload.location === undefined || payload.location === 'library' || payload.location === 'choose');
    case 'revealProjectFolder':
    case 'reloadProject':
      return record(payload) && typeof payload.rootPath === 'string';
    case 'migrateProject':
      return hasProject(payload);
    case 'loadProject':
      return record(payload) && typeof payload.rootPath === 'string';
    case 'saveProject':
    case 'strengthenPlanning':
    case 'deriveStyle':
    case 'generateOutline':
      return hasProject(payload);
    case 'approveCandidate':
      return hasProject(payload) && typeof payload.candidateId === 'string' && typeof payload.content === 'string';
    case 'backupProject':
      return hasProject(payload);
    case 'exportProject':
      return hasProject(payload) && (payload.format === 'txt' || payload.format === 'md') &&
        (payload.destination === undefined ||
          payload.destination === 'project' || payload.destination === 'choose');
    case 'saveSettings':
      return record(payload) && record(payload.settings) &&
        (payload.apiKey === undefined || typeof payload.apiKey === 'string');
    case 'importLegacy':
      return record(payload) && Object.prototype.hasOwnProperty.call(payload, 'state');
    case 'recommendSubtype':
      return record(payload) && typeof payload.concept === 'string' &&
        ['male', 'female', 'mystery'].includes(String(payload.genreTrack));
    case 'generateOptions':
      return hasProject(payload) &&
        OPTION_KINDS.includes(String(payload.kind) as GenerateOptionsKind) &&
        (payload.count === undefined || typeof payload.count === 'number') &&
        (payload.exclude === undefined || Array.isArray(payload.exclude));
    case 'generateChapter':
      return hasProject(payload) && typeof payload.chapterId === 'string' && typeof payload.instruction === 'string';
    case 'generateAsset':
      return hasProject(payload) && ['character', 'world', 'foreshadow'].includes(String(payload.kind));
    case 'runAssistant':
      return hasProject(payload) && typeof payload.task === 'string' && typeof payload.input === 'string';
    case 'brainstorm':
      return record(payload) && typeof payload.concept === 'string' &&
        ['male', 'female', 'mystery'].includes(String(payload.genreTrack)) &&
        typeof payload.targetWords === 'number';
    case 'complete':
      return record(payload) && Array.isArray(payload.messages);
  }
}

export function isWebviewToHostMessage(value: unknown): value is WebviewToHostMessage {
  if (!record(value) || typeof value.requestId !== 'string' || !value.requestId) return false;
  if (value.type === 'cancel') return true;
  if (value.type !== 'request' || typeof value.command !== 'string' ||
      !commands.has(value.command as CommandName)) return false;
  return validPayload(value.command as CommandName, value.payload);
}

export function isHostToWebviewMessage(value: unknown): value is HostToWebviewMessage {
  if (!record(value)) return false;
  if (value.type === 'response') {
    return typeof value.requestId === 'string' && typeof value.ok === 'boolean' &&
      (value.ok ? Object.prototype.hasOwnProperty.call(value, 'data') : typeof value.error === 'string');
  }
  if (value.type !== 'event' || typeof value.event !== 'string') return false;
  return ['openSettings', 'switchTab', 'projectsChanged', 'legacyMigrated'].includes(value.event);
}

export interface HostClient {
  request<C extends CommandName>(
    command: C,
    payload: CommandMap[C]['payload'],
    options?: { timeoutMs?: number },
  ): Promise<CommandMap[C]['result']>;
  cancel(requestId: string): void;
  subscribe(listener: (event: HostEvent) => void): () => void;
}
