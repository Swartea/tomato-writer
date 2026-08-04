import {
  AISettings, ProjectData, ProjectLayout, ProjectMigrationResult, ProjectSummary,
} from './types';

export interface CompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionRequest {
  messages: CompletionMessage[];
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface CompletionClient {
  complete(request: CompletionRequest): Promise<string>;
}

export interface ProjectStore {
  list(libraryRoot?: string): Promise<ProjectSummary[]>;
  create(parentPath: string, name: string, layout?: ProjectLayout): Promise<ProjectData>;
  importLegacy(parentPath: string, legacy: unknown): Promise<ProjectData[]>;
  open(rootPath: string): Promise<ProjectData>;
  load(rootPath: string): Promise<ProjectData>;
  detectLayout(rootPath: string): Promise<ProjectLayout>;
  save(project: ProjectData): Promise<ProjectData>;
  backup(project: ProjectData): Promise<string>;
  approveCandidate(project: ProjectData, candidateId: string, content: string): Promise<ProjectData>;
  exportProject(project: ProjectData, destination: string, format: 'txt' | 'md'): Promise<string>;
  migrateToReadable(project: ProjectData, parentPath: string): Promise<ProjectMigrationResult>;
}

export interface RecentProjectStore {
  read(): Promise<string[]> | string[];
  write(rootPaths: string[]): Promise<void>;
}

export interface ProjectLibraryStore {
  read(): Promise<string> | string;
  write(rootPath: string): Promise<void>;
}

export interface SettingsStore {
  read(): Promise<AISettings>;
  write(settings: AISettings): Promise<void>;
}

export interface SecretStore {
  read(key: string): Promise<string | undefined>;
  write(key: string, value: string): Promise<void>;
}

export interface Clock {
  now(): Date;
}

export interface IdFactory {
  create(prefix: string): string;
}

export const systemClock: Clock = { now: () => new Date() };

export const randomIdFactory: IdFactory = {
  create: prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
};
