import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import {
  AISettings,
  ProjectData,
  ProjectSummary,
  randomIdFactory,
  systemClock,
  WritingWorkflows,
} from '@tomato-writer/core';
import {
  CommandMap,
  CommandName,
  HostEvent,
  HostRequest,
  isWebviewToHostMessage,
} from '@tomato-writer/contracts';
import { ProjectRepository } from '../projectRepository';
import { OpenAICompatibleClient } from './openAICompatibleClient';
import {
  VsCodeRecentProjectStore,
  VsCodeProjectLibraryStore,
  VsCodeSecretStore,
  VsCodeSettingsStore,
} from './vscodeStores';

let repository: ProjectRepository;
let projectsProvider: ProjectsTreeDataProvider;
let projectFilesProvider: ProjectFilesTreeDataProvider;

export function activate(context: vscode.ExtensionContext) {
  const recent = new VsCodeRecentProjectStore(context.globalState);
  const library = new VsCodeProjectLibraryStore(
    context.globalState,
    path.join(os.homedir(), 'Documents', '番茄写作项目'),
  );
  const settings = new VsCodeSettingsStore(context.globalState);
  const secrets = new VsCodeSecretStore(context.secrets);
  repository = new ProjectRepository(recent, systemClock, randomIdFactory);
  const completion = new OpenAICompatibleClient(settings, secrets);
  const workflows = new WritingWorkflows(completion, systemClock, randomIdFactory);
  projectsProvider = new ProjectsTreeDataProvider(repository, library);
  projectFilesProvider = new ProjectFilesTreeDataProvider();

  const show = () => TomatoWriterPanel.createOrShow(
    context, repository, projectsProvider, projectFilesProvider,
    library, settings, secrets, workflows,
  );
  const open = vscode.commands.registerCommand('tomato-writer.open', show);
  const create = vscode.commands.registerCommand('tomato-writer.newProject', async () => {
    show();
    await TomatoWriterPanel.currentPanel?.createProject({});
  });
  const openProject = vscode.commands.registerCommand('tomato-writer.openProject', async () => {
    show();
    await TomatoWriterPanel.currentPanel?.openProject();
  });
  const openSettings = vscode.commands.registerCommand('tomato-writer.openSettings', () => {
    show();
    TomatoWriterPanel.currentPanel?.postEvent({ type: 'event', event: 'openSettings' });
  });
  const openPanel = vscode.commands.registerCommand('tomato-writer.openPanel', (args?: { panel?: string }) => {
    show();
    if (args?.panel) {
      TomatoWriterPanel.currentPanel?.postEvent({
        type: 'event', event: 'switchTab', payload: { tab: args.panel },
      });
    }
  });
  const switchProject = vscode.commands.registerCommand(
    'tomato-writer.switchProject',
    async (args?: { rootPath?: string }) => {
      show();
      if (args?.rootPath) await TomatoWriterPanel.currentPanel?.loadProject(args.rootPath);
    },
  );
  const refreshFiles = vscode.commands.registerCommand(
    'tomato-writer.refreshFiles',
    () => projectFilesProvider.refresh(),
  );
  const projectsView = vscode.window.createTreeView('tomato-writer-projects', {
    treeDataProvider: projectsProvider,
    showCollapseAll: false,
  });
  const filesView = vscode.window.createTreeView('tomato-writer-files', {
    treeDataProvider: projectFilesProvider,
    showCollapseAll: true,
  });
  projectFilesProvider.attach(filesView);
  const navView = vscode.window.createTreeView('tomato-writer-nav', {
    treeDataProvider: new NavTreeDataProvider(),
    showCollapseAll: false,
  });
  context.subscriptions.push(
    open, create, openProject, openSettings, openPanel, switchProject, refreshFiles,
    projectsView, filesView, navView,
  );
}

export function deactivate() {}

class ProjectsTreeDataProvider implements vscode.TreeDataProvider<ProjectTreeItem> {
  private readonly changed = new vscode.EventEmitter<ProjectTreeItem | undefined | null>();
  readonly onDidChangeTreeData = this.changed.event;
  constructor(
    private readonly repo: ProjectRepository,
    private readonly library: VsCodeProjectLibraryStore,
  ) {}
  refresh() { this.changed.fire(null); }
  getTreeItem(item: ProjectTreeItem) { return item; }
  async getChildren(): Promise<ProjectTreeItem[]> {
    return (await this.repo.list(await this.library.read())).map(project => new ProjectTreeItem(project));
  }
}

class ProjectTreeItem extends vscode.TreeItem {
  constructor(project: ProjectSummary) {
    super(project.name, vscode.TreeItemCollapsibleState.None);
    const status = {
      planning: '策划中', writing: '写作中', completed: '已完成', submitted: '已投稿',
    }[project.status];
    this.description = `${project.genre} · ${project.words.toLocaleString()}字 · ${project.chapters}章`;
    this.tooltip = `${project.name}\n${status}\n${project.rootPath}`;
    this.contextValue = 'projectItem';
    this.iconPath = new vscode.ThemeIcon(project.status === 'completed' ? 'pass-filled' : 'book');
    this.command = {
      command: 'tomato-writer.switchProject',
      title: '打开项目',
      arguments: [{ rootPath: project.rootPath }],
    };
  }
}

const HIDDEN_PROJECT_ENTRIES = new Set(['.tomato', '.trash', '.git', 'node_modules']);
const VISIBLE_TEXT_EXTENSIONS = new Set(['.txt', '.md', '.json']);
const CHINESE_PROJECT_ENTRY_NAMES: Record<string, string> = {
  backups: '备份',
  chapters: '正文',
  entities: '创作资产',
  generations: '候选稿',
  reviews: '审校记录',
  'outline.json': '剧情大纲',
  'planning.json': '本书策划',
  'style-profile.json': '文风档案',
  'tomato-project.json': '项目索引',
  'characters.json': '人物',
  'world.json': '世界观',
  'foreshadowing.json': '伏笔',
  'index.json': '索引',
};

function projectFileDisplayName(name: string, parentDirectory: string): string {
  const translated = CHINESE_PROJECT_ENTRY_NAMES[name];
  if (translated) return translated;
  const extension = path.extname(name);
  const stem = extension ? name.slice(0, -extension.length) : name;
  const numbered = stem.match(/^(\d{1,4})(?:[-_ ](.+))?$/);
  if (!numbered) return name;
  const title = numbered[2]?.trim() ?? '';
  const parent = path.basename(parentDirectory);
  if (['chapters', '正文', '大纲'].includes(parent)) {
    const redundantTitle = /^第[一二三四五六七八九十百零〇两0-9]+章$/.test(title);
    return `第${Number(numbered[1])}章${title && !redundantTitle ? ` ${title}` : ''}`;
  }
  if (['人物', '世界观', '伏笔'].includes(parent)) return title || name;
  return name;
}

class ProjectFilesTreeDataProvider implements vscode.TreeDataProvider<ProjectFileTreeItem> {
  private readonly changed = new vscode.EventEmitter<ProjectFileTreeItem | undefined | null>();
  readonly onDidChangeTreeData = this.changed.event;
  private rootPath = '';
  private view?: vscode.TreeView<ProjectFileTreeItem>;

  attach(view: vscode.TreeView<ProjectFileTreeItem>) {
    this.view = view;
    this.updateDescription();
  }

  setProject(rootPath: string) {
    this.rootPath = rootPath;
    this.updateDescription();
    this.refresh();
  }

  refresh() {
    this.changed.fire(null);
  }

  getTreeItem(item: ProjectFileTreeItem) {
    return item;
  }

  async getChildren(parent?: ProjectFileTreeItem): Promise<ProjectFileTreeItem[]> {
    if (!this.rootPath) {
      return [ProjectFileTreeItem.message('请先从“我的项目”选择一本小说')];
    }
    if (parent?.kind === 'message' || (parent && parent.kind !== 'directory')) return [];
    const directory = parent?.uri?.fsPath ?? this.rootPath;
    try {
      const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(directory));
      return entries
        .filter(([name, type]) => this.visible(name, type))
        .sort(([leftName, leftType], [rightName, rightType]) => {
          const leftDirectory = Boolean(leftType & vscode.FileType.Directory);
          const rightDirectory = Boolean(rightType & vscode.FileType.Directory);
          if (leftDirectory !== rightDirectory) return leftDirectory ? -1 : 1;
          return leftName.localeCompare(rightName, 'zh-CN', { numeric: true });
        })
        .map(([name, type]) => {
          const uri = vscode.Uri.file(path.join(directory, name));
          const directoryEntry = Boolean(type & vscode.FileType.Directory);
          return new ProjectFileTreeItem(
            projectFileDisplayName(name, directory),
            uri,
            directoryEntry ? 'directory' : 'file',
          );
        });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return [ProjectFileTreeItem.message(`无法读取项目文件：${message}`)];
    }
  }

  private visible(name: string, type: vscode.FileType): boolean {
    if (HIDDEN_PROJECT_ENTRIES.has(name) || name.startsWith('.')) return false;
    if (type & vscode.FileType.Directory) return true;
    return VISIBLE_TEXT_EXTENSIONS.has(path.extname(name).toLowerCase());
  }

  private updateDescription() {
    if (this.view) this.view.description = this.rootPath ? path.basename(this.rootPath) : '';
  }
}

type ProjectFileItemKind = 'directory' | 'file' | 'message';

class ProjectFileTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    readonly uri: vscode.Uri | undefined,
    readonly kind: ProjectFileItemKind,
  ) {
    super(
      label,
      kind === 'directory'
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
    );
    this.contextValue = `projectFile.${kind}`;
    if (kind === 'message') {
      this.iconPath = new vscode.ThemeIcon('info');
      return;
    }
    this.resourceUri = uri;
    this.tooltip = uri?.fsPath;
    this.iconPath = new vscode.ThemeIcon(kind === 'directory' ? 'folder' : 'file-text');
    if (kind === 'file' && uri) {
      this.command = {
        command: 'vscode.open',
        title: '打开项目文件',
        arguments: [uri],
      };
    }
  }

  static message(label: string) {
    return new ProjectFileTreeItem(label, undefined, 'message');
  }
}

const NAV = [
  ['planning', '开篇策划', 'target'],
  ['editor', '写作与审批', 'edit'],
  ['outline', '剧情大纲', 'list-tree'],
  ['characters', '创作资产', 'organization'],
  ['ai', 'AI 助手', 'sparkle'],
  ['stats', '真实统计', 'graph'],
] as const;

class NavTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  getTreeItem(item: vscode.TreeItem) { return item; }
  getChildren(): vscode.TreeItem[] {
    const items = NAV.map(([panel, label, icon]) => {
      const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
      item.iconPath = new vscode.ThemeIcon(icon);
      item.command = {
        command: 'tomato-writer.openPanel',
        title: label,
        arguments: [{ panel }],
      };
      return item;
    });
    const settings = new vscode.TreeItem('AI 设置', vscode.TreeItemCollapsibleState.None);
    settings.iconPath = new vscode.ThemeIcon('settings-gear');
    settings.command = { command: 'tomato-writer.openSettings', title: 'AI 设置' };
    return [...items, settings];
  }
}

class TomatoWriterPanel {
  static currentPanel: TomatoWriterPanel | undefined;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly aborters = new Map<string, AbortController>();
  private readonly activeRequests = new Set<string>();

  static createOrShow(
    context: vscode.ExtensionContext,
    repo: ProjectRepository,
    provider: ProjectsTreeDataProvider,
    files: ProjectFilesTreeDataProvider,
    library: VsCodeProjectLibraryStore,
    settings: VsCodeSettingsStore,
    secrets: VsCodeSecretStore,
    workflows: WritingWorkflows,
  ) {
    if (this.currentPanel) {
      this.currentPanel.panel.reveal();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'tomatoWriter',
      '番茄写作助手',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview')],
      },
    );
    this.currentPanel = new TomatoWriterPanel(
      panel, context, repo, provider, files, library, settings, secrets, workflows,
    );
  }

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext,
    private readonly repo: ProjectRepository,
    private readonly provider: ProjectsTreeDataProvider,
    private readonly files: ProjectFilesTreeDataProvider,
    private readonly library: VsCodeProjectLibraryStore,
    private readonly settings: VsCodeSettingsStore,
    private readonly secrets: VsCodeSecretStore,
    private readonly workflows: WritingWorkflows,
  ) {
    panel.onDidDispose(() => this.dispose(), null, this.disposables);
    panel.webview.onDidReceiveMessage(message => void this.handle(message), null, this.disposables);
    // Register the bridge before loading the page. The Webview sends `ready`
    // as soon as its module runs, so assigning HTML first can lose that request.
    panel.webview.html = this.html();
  }

  postEvent(event: HostEvent) {
    void this.panel.webview.postMessage(event);
  }

  private respond(requestId: string, data: unknown) {
    void this.panel.webview.postMessage({ type: 'response', requestId, ok: true, data });
  }

  private fail(requestId: string, error: unknown) {
    const text = error instanceof Error ? error.message : String(error);
    void this.panel.webview.postMessage({ type: 'response', requestId, ok: false, error: text });
  }

  private async handle(value: unknown) {
    if (!isWebviewToHostMessage(value)) {
      const requestId = typeof value === 'object' && value &&
        typeof (value as { requestId?: unknown }).requestId === 'string'
        ? String((value as { requestId: string }).requestId) : '';
      if (requestId) this.fail(requestId, new Error('未知或格式无效的宿主消息'));
      return;
    }
    if (value.type === 'cancel') {
      this.aborters.get(value.requestId)?.abort();
      return;
    }
    if (this.activeRequests.has(value.requestId)) {
      this.fail(value.requestId, new Error('重复的 requestId'));
      return;
    }
    this.activeRequests.add(value.requestId);
    const controller = new AbortController();
    this.aborters.set(value.requestId, controller);
    try {
      this.respond(value.requestId, await this.execute(value, controller.signal));
    } catch (error) {
      this.fail(value.requestId, error);
      if (!(error instanceof Error && error.message === '请求已取消或超时')) {
        void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
      }
    } finally {
      this.aborters.delete(value.requestId);
      this.activeRequests.delete(value.requestId);
    }
  }

  private async execute<C extends CommandName>(
    request: HostRequest<C>,
    signal: AbortSignal,
  ): Promise<CommandMap[C]['result']> {
    const payload = request.payload as any;
    let result: unknown;
    switch (request.command) {
      case 'ready':
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(await this.library.read()));
        result = {
          projects: await this.repo.list(await this.library.read()),
          settings: await this.settings.read(),
          hasApiKey: Boolean(await this.secrets.read('tomatoWriter.apiKey')),
          libraryRoot: await this.library.read(),
        };
        break;
      case 'createProject':
        result = await this.createProject(payload || {});
        break;
      case 'selectProjectLibrary':
        result = await this.selectProjectLibrary();
        break;
      case 'revealProjectLibrary': {
        const libraryRoot = await this.library.read();
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(libraryRoot));
        await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(libraryRoot));
        result = { libraryRoot };
        break;
      }
      case 'revealProjectFolder':
        await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(String(payload.rootPath)));
        result = { rootPath: String(payload.rootPath) };
        break;
      case 'migrateProject': {
        const migrated = await this.repo.migrateToReadable(payload.project, await this.library.read());
        this.files.setProject(migrated.project.rootPath);
        await this.projectsChanged();
        void vscode.window.showInformationMessage(
          `迁移完成：${migrated.targetRoot}。旧项目仍保留在 ${migrated.sourceRoot}`,
        );
        result = migrated;
        break;
      }
      case 'reloadProject':
        result = await this.loadProject(String(payload.rootPath));
        break;
      case 'openProject':
        result = await this.openProject();
        break;
      case 'loadProject':
        result = await this.loadProject(String(payload.rootPath));
        break;
      case 'saveProject': {
        const project = await this.repo.save(payload.project);
        this.provider.refresh();
        this.files.setProject(project.rootPath);
        result = { project, savedAt: systemClock.now().toISOString() };
        break;
      }
      case 'approveCandidate':
        result = await this.repo.approveCandidate(
          payload.project, String(payload.candidateId), String(payload.content),
        );
        this.provider.refresh();
        this.files.setProject((result as ProjectData).rootPath);
        break;
      case 'backupProject': {
        const destination = await this.repo.backup(payload.project);
        this.files.setProject(payload.project.rootPath);
        void vscode.window.showInformationMessage(`备份已保存：${destination}`);
        result = { destination };
        break;
      }
      case 'exportProject':
        result = await this.exportProject(payload.project, payload.format, payload.destination);
        break;
      case 'getSettings':
        result = {
          settings: await this.settings.read(),
          hasApiKey: Boolean(await this.secrets.read('tomatoWriter.apiKey')),
        };
        break;
      case 'saveSettings':
        await this.settings.write(payload.settings as AISettings);
        if (payload.apiKey) await this.secrets.write('tomatoWriter.apiKey', payload.apiKey);
        result = {
          settings: await this.settings.read(),
          hasApiKey: Boolean(await this.secrets.read('tomatoWriter.apiKey')),
        };
        break;
      case 'importLegacy':
        result = await this.importLegacy(payload.state);
        break;
      case 'recommendSubtype':
        result = await this.workflows.recommendSubtype(payload, signal);
        break;
      case 'generateOptions':
        result = await this.workflows.generateOptions(
          payload.kind, payload.project, { count: payload.count, exclude: payload.exclude }, signal,
        );
        break;
      case 'strengthenPlanning':
        result = await this.workflows.strengthenPlanning(payload.project, signal);
        break;
      case 'deriveStyle':
        result = {
          schemaVersion: 2,
          ...await this.workflows.deriveStyle(payload.project, signal),
        };
        break;
      case 'generateOutline':
        result = await this.workflows.generateOutline(payload.project, signal);
        break;
      case 'generateChapter':
        result = await this.workflows.generateChapterCandidate(
          payload.project, payload.chapterId, payload.instruction, signal,
        );
        break;
      case 'generateAsset':
        result = await this.workflows.generateAsset(payload.kind, payload.project, signal);
        break;
      case 'runAssistant':
        result = await this.workflows.runAssistant(
          payload.project, payload.task, payload.input, signal,
        );
        break;
      case 'brainstorm':
        result = await this.workflows.brainstorm(payload, signal);
        break;
      case 'complete':
        result = await this.workflows.completeMessages(payload.messages, signal, payload.maxTokens);
        break;
    }
    return result as CommandMap[C]['result'];
  }

  async createProject(payload: CommandMap['createProject']['payload']): Promise<ProjectData | null> {
    let projectName = payload.suggestedName?.trim();
    if (!projectName) {
      const input = await vscode.window.showInputBox({
        title: '新建番茄短篇',
        prompt: '小说名称（可留空，稍后补；也能用「AI 补强策划案」生成书名）',
        placeHolder: '如：雨夜来信',
      });
      if (input === undefined) return null;
      projectName = input.trim() || `未命名小说-${Date.now().toString(36)}`;
    }
    let parentPath = await this.library.read();
    if (payload.location === 'choose') {
      const selected = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: '在此创建小说文件夹',
      });
      if (!selected?.[0]) return null;
      parentPath = selected[0].fsPath;
    }
    const project = await this.repo.create(parentPath, projectName, 'readable-txt');
    const seed = payload.seed;
    if (seed) {
      if (typeof seed.sellingPoint === 'string') project.planning.sellingPoint = seed.sellingPoint;
      if (seed.genreTrack) project.planning.genreTrack = seed.genreTrack;
      if (typeof seed.genre === 'string') project.planning.genre = seed.genre;
      if (seed.titleCandidates) project.planning.titleCandidates = seed.titleCandidates;
      if (seed.tags) project.planning.tags = seed.tags;
      await this.repo.save(project);
    }
    this.files.setProject(project.rootPath);
    await this.projectsChanged();
    return project;
  }

  private async selectProjectLibrary(): Promise<CommandMap['selectProjectLibrary']['result']> {
    const selected = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      defaultUri: vscode.Uri.file(await this.library.read()),
      openLabel: '设为番茄写作项目库',
    });
    if (!selected?.[0]) return null;
    await this.library.write(selected[0].fsPath);
    await vscode.workspace.fs.createDirectory(selected[0]);
    const projects = await this.repo.list(selected[0].fsPath);
    this.provider.refresh();
    this.postEvent({ type: 'event', event: 'projectsChanged', payload: { projects } });
    return { libraryRoot: selected[0].fsPath, projects };
  }

  async openProject(): Promise<ProjectData | null> {
    const selected = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      openLabel: '打开番茄小说项目',
    });
    return selected?.[0] ? this.loadProject(selected[0].fsPath) : null;
  }

  async loadProject(rootPath: string): Promise<ProjectData> {
    const project = await this.repo.open(rootPath);
    this.files.setProject(project.rootPath);
    await this.projectsChanged();
    return project;
  }

  private async importLegacy(state: unknown): Promise<ProjectData[]> {
    const count = Array.isArray((state as { projects?: unknown[] })?.projects)
      ? (state as { projects: unknown[] }).projects.length : 0;
    if (!count) return [];
    const answer = await vscode.window.showInformationMessage(
      `发现旧版中的 ${count} 个项目。是否迁移到默认项目库？旧数据会继续保留。`,
      '迁移到项目库',
      '暂不迁移',
    );
    if (answer !== '迁移到项目库') return [];
    const imported = await this.repo.importLegacy(await this.library.read(), state);
    if (imported[0]) this.files.setProject(imported[0].rootPath);
    this.postEvent({ type: 'event', event: 'legacyMigrated' });
    await this.projectsChanged();
    return imported;
  }

  private async exportProject(
    project: ProjectData,
    format: 'txt' | 'md',
    destination: 'project' | 'choose' = 'project',
  ): Promise<{ file: string } | null> {
    let destinationPath = path.join(project.rootPath, '导出');
    if (destination === 'choose') {
      const selected = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: '导出到此目录',
      });
      if (!selected?.[0]) return null;
      destinationPath = selected[0].fsPath;
    }
    const file = await this.repo.exportProject(project, destinationPath, format);
    this.files.setProject(project.rootPath);
    void vscode.window.showInformationMessage(`已导出：${file}`);
    return { file };
  }

  private async projectsChanged() {
    this.provider.refresh();
    this.postEvent({
      type: 'event',
      event: 'projectsChanged',
      payload: { projects: await this.repo.list(await this.library.read()) },
    });
  }

  private dispose() {
    TomatoWriterPanel.currentPanel = undefined;
    this.aborters.forEach(controller => controller.abort());
    while (this.disposables.length) this.disposables.pop()?.dispose();
  }

  private html(): string {
    const webview = this.panel.webview;
    const script = webview.asWebviewUri(vscode.Uri.joinPath(
      this.context.extensionUri, 'dist', 'webview', 'assets', 'index.js',
    ));
    const style = webview.asWebviewUri(vscode.Uri.joinPath(
      this.context.extensionUri, 'dist', 'webview', 'assets', 'index.css',
    ));
    const nonce = Math.random().toString(36).slice(2);
    return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource};">
    <link href="${style}" rel="stylesheet"><title>番茄写作助手</title></head><body><div id="root"></div><script nonce="${nonce}" type="module" src="${script}"></script></body></html>`;
  }
}
