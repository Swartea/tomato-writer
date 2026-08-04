import * as vscode from 'vscode';
import {
  AISettings, ProjectLibraryStore, RecentProjectStore, SecretStore, SettingsStore,
} from '@tomato-writer/core';

const SETTINGS_KEY = 'tomatoWriter.aiSettings';
const ROOTS_KEY = 'tomatoWriter.projectRoots';
const LIBRARY_KEY = 'tomatoWriter.projectLibraryRoot';

export const DEFAULT_AI_SETTINGS: AISettings = {
  apiUrl: 'https://api.deepseek.com/chat/completions',
  model: 'deepseek-chat',
  temperature: 0.8,
  maxTokens: 4096,
};

export class VsCodeRecentProjectStore implements RecentProjectStore {
  constructor(private readonly state: vscode.Memento) {}
  read(): string[] {
    return this.state.get<string[]>(ROOTS_KEY, []);
  }
  async write(rootPaths: string[]): Promise<void> {
    await this.state.update(ROOTS_KEY, rootPaths);
  }
}

export class VsCodeProjectLibraryStore implements ProjectLibraryStore {
  constructor(
    private readonly state: vscode.Memento,
    private readonly defaultRoot: string,
  ) {}
  read(): string {
    return this.state.get<string>(LIBRARY_KEY, this.defaultRoot);
  }
  async write(rootPath: string): Promise<void> {
    await this.state.update(LIBRARY_KEY, rootPath);
  }
}

export class VsCodeSettingsStore implements SettingsStore {
  constructor(private readonly state: vscode.Memento) {}
  async read(): Promise<AISettings> {
    return this.state.get<AISettings>(SETTINGS_KEY, DEFAULT_AI_SETTINGS);
  }
  async write(settings: AISettings): Promise<void> {
    await this.state.update(SETTINGS_KEY, settings);
  }
}

export class VsCodeSecretStore implements SecretStore {
  constructor(private readonly secrets: vscode.SecretStorage) {}
  async read(key: string): Promise<string | undefined> {
    return await this.secrets.get(key);
  }
  async write(key: string, value: string): Promise<void> {
    await this.secrets.store(key, value);
  }
}
