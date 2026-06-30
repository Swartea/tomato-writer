import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('番茄写作助手已激活');

    // ---- 注册打开主面板命令 ----
    const openCommand = vscode.commands.registerCommand('tomato-writer.open', () => {
        TomatoWriterPanel.createOrShow(context.extensionUri);
    });

    // ---- 注册新建项目命令 ----
    const newProjectCommand = vscode.commands.registerCommand('tomato-writer.newProject', async () => {
        const name = await vscode.window.showInputBox({
            prompt: '请输入项目名称',
            placeHolder: '如：雨夜邂逅',
            title: '新建写作项目',
        });
        if (!name) return;
        // 打开主面板并通知前端创建新项目
        TomatoWriterPanel.createOrShow(context.extensionUri);
        TomatoWriterPanel.currentPanel?.postMessage({ type: 'newProject', name });
    });

    // ---- 注册设置命令 ----
    const settingsCommand = vscode.commands.registerCommand('tomato-writer.openSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'tomatoWriter');
    });

    // ---- 注册打开面板命令（侧边栏树节点点击触发） ----
    const openPanelCommand = vscode.commands.registerCommand('tomato-writer.openPanel', (args?: { panel?: string }) => {
        TomatoWriterPanel.createOrShow(context.extensionUri);
        if (args?.panel) {
            // 延迟一点确保面板已渲染
            setTimeout(() => {
                TomatoWriterPanel.currentPanel?.postMessage({ type: 'switchTab', tab: args.panel });
            }, 300);
        }
    });

    // ---- 注册切换项目命令 ----
    const switchProjectCommand = vscode.commands.registerCommand('tomato-writer.switchProject', (args?: { projectId?: string }) => {
        TomatoWriterPanel.createOrShow(context.extensionUri);
        if (args?.projectId) {
            setTimeout(() => {
                TomatoWriterPanel.currentPanel?.postMessage({ type: 'switchProject', projectId: args.projectId });
            }, 300);
        }
    });

    // ---- 注册树视图数据提供者 ----
    const projectsProvider = new ProjectsTreeDataProvider();
    const projectsView = vscode.window.createTreeView('tomato-writer-projects', {
        treeDataProvider: projectsProvider,
        showCollapseAll: true,
    });

    const navProvider = new NavTreeDataProvider();
    const navView = vscode.window.createTreeView('tomato-writer-nav', {
        treeDataProvider: navProvider,
        showCollapseAll: false,
    });

    context.subscriptions.push(
        openCommand,
        newProjectCommand,
        settingsCommand,
        openPanelCommand,
        switchProjectCommand,
        projectsView,
        navView,
    );
}

export function deactivate() {}

/* ================================================================
 * 树视图数据提供者 — 项目列表
 * ================================================================ */
class ProjectsTreeDataProvider implements vscode.TreeDataProvider<ProjectTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<ProjectTreeItem | undefined | null>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    // 项目数据
    private projects: { id: string; name: string; genre: string; status: string; words: number; chapters: number }[] = [
        { id: 'p1', name: '雨夜邂逅', genre: '都市言情', status: '写作中', words: 3200, chapters: 3 },
        { id: 'p2', name: '末路回声', genre: '悬疑推理', status: '策划中', words: 0, chapters: 1 },
        { id: 'p3', name: '深渊之上', genre: '现代悬疑', status: '已完成', words: 35000, chapters: 14 },
    ];

    refresh(): void {
        this._onDidChangeTreeData.fire(null);
    }

    getTreeItem(element: ProjectTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(_element?: ProjectTreeItem): Thenable<ProjectTreeItem[]> {
        return Promise.resolve(
            this.projects.map(p => {
                const statusIcon = p.status === '写作中' ? '✏️' : p.status === '策划中' ? '📋' : p.status === '已完成' ? '✅' : '📤';
                const item = new ProjectTreeItem(
                    `${statusIcon} ${p.name}`,
                    vscode.TreeItemCollapsibleState.None,
                );
                item.description = `${p.genre} · ${p.words > 0 ? p.words.toLocaleString() + '字' : '空'} · ${p.chapters}章`;
                item.contextValue = 'projectItem';
                item.tooltip = `${p.name}\n${p.genre} · ${p.status}\n${p.chapters}章 · ${p.words.toLocaleString()}字`;
                item.command = {
                    command: 'tomato-writer.switchProject',
                    title: '切换项目',
                    arguments: [{ projectId: p.id }],
                };
                return item;
            })
        );
    }
}

class ProjectTreeItem extends vscode.TreeItem {
    constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState) {
        super(label, collapsibleState);
    }
}

/* ================================================================
 * 树视图数据提供者 — 功能导航
 * ================================================================ */
interface NavEntry {
    key: string;
    label: string;
    icon: string;
    panel: string;
    desc: string;
}

const NAV_ENTRIES: NavEntry[] = [
    { key: 'planning', label: '开篇策划', icon: '🎯', panel: 'planning', desc: '5步引导：题材→卖点→标题→开篇→字数' },
    { key: 'editor', label: '写作编辑器', icon: '✏️', panel: 'editor', desc: '章节写作 + 实时字数 + 自动保存' },
    { key: 'outline', label: '大纲管理', icon: '📑', panel: 'outline', desc: '故事主线 + 节奏曲线 + 分章细纲' },
    { key: 'characters', label: '角色设定', icon: '👥', panel: 'characters', desc: '人物卡 + 世界观设定' },
    { key: 'ai', label: 'AI 助手', icon: '🤖', panel: 'ai', desc: '续写/润色/扩写/起标题/灵感/对白' },
    { key: 'stats', label: '统计看板', icon: '📈', panel: 'stats', desc: '字数统计 + 进度 + 写作目标' },
];

class NavTreeDataProvider implements vscode.TreeDataProvider<NavTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<NavTreeItem | undefined | null>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    getTreeItem(element: NavTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(_element?: NavTreeItem): Thenable<NavTreeItem[]> {
        const navItems = NAV_ENTRIES.map(entry => {
            const item = new NavTreeItem(
                `${entry.icon} ${entry.label}`,
                vscode.TreeItemCollapsibleState.None,
            );
            item.description = entry.desc;
            item.contextValue = 'navItem';
            item.tooltip = `${entry.label}\n${entry.desc}`;
            item.command = {
                command: 'tomato-writer.openPanel',
                title: '打开面板',
                arguments: [{ panel: entry.panel }],
            };
            return item;
        });

        // 加一个"打开设置"节点
        const settingsItem = new NavTreeItem(
            '⚙️ 设置',
            vscode.TreeItemCollapsibleState.None,
        );
        settingsItem.description = 'API Key / 模型 / 写作规范';
        settingsItem.contextValue = 'navItem';
        settingsItem.tooltip = '写作设置\nAPI Key 配置 / 模型选择 / 番茄规范';
        settingsItem.command = {
            command: 'tomato-writer.openSettings',
            title: '打开设置',
            arguments: [],
        };

        return Promise.resolve([...navItems, settingsItem]);
    }
}

class NavTreeItem extends vscode.TreeItem {
    constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState) {
        super(label, collapsibleState);
    }
}

/* ================================================================
 * WebView 面板管理
 * ================================================================ */
class TomatoWriterPanel {
    public static currentPanel: TomatoWriterPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (TomatoWriterPanel.currentPanel) {
            TomatoWriterPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'tomatoWriter',
            '番茄写作助手',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'dist', 'webview')
                ]
            }
        );

        TomatoWriterPanel.currentPanel = new TomatoWriterPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // 接收前端消息
        this._panel.webview.onDidReceiveMessage(
            (message: { type: string; [key: string]: unknown }) => {
                switch (message.type) {
                    case 'info':
                        vscode.window.showInformationMessage(String(message.text));
                        break;
                    case 'error':
                        vscode.window.showErrorMessage(String(message.text));
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    /** 向前端发送消息 */
    public postMessage(msg: { type: string; [key: string]: unknown }) {
        this._panel.webview.postMessage(msg);
    }

    public dispose() {
        TomatoWriterPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private async _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'assets', 'index.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'assets', 'index.css')
        );

        return `<!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>番茄写作助手</title>
                <link href="${styleUri}" rel="stylesheet">
            </head>
            <body>
                <div id="root"></div>
                <script type="module" src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}
