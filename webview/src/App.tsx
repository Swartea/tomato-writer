import { useEffect, useState } from 'react';
import { hostClient } from './hostClient';
import { useProjectSession } from './useProjectSession';
import { PlanningFeature } from './features/PlanningFeature';
import { OutlineFeature } from './features/OutlineFeature';
import { EditorFeature } from './features/EditorFeature';
import { AssetsFeature } from './features/AssetsFeature';
import { AssistantFeature } from './features/AssistantFeature';
import { StatsFeature } from './features/StatsFeature';
import { SettingsFeature } from './features/SettingsFeature';
import { BrainstormFeature } from './features/BrainstormFeature';

type Tab = 'planning' | 'editor' | 'outline' | 'characters' | 'ai' | 'stats';
const TABS: [Tab, string][] = [
  ['planning', '策划与文风'],
  ['editor', '写作与审批'],
  ['outline', '剧情大纲'],
  ['characters', '创作资产'],
  ['ai', 'AI 助手'],
  ['stats', '统计'],
];

export default function App() {
  const session = useProjectSession();
  const [tab, setTab] = useState<Tab>('planning');
  const [brainstormOpen, setBrainstormOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [migrationSource, setMigrationSource] = useState('');

  useEffect(() => hostClient.subscribe(event => {
    if (event.event === 'openSettings') setSettingsOpen(true);
    if (event.event === 'switchTab' && TABS.some(([id]) => id === event.payload.tab)) {
      setTab(event.payload.tab as Tab);
    }
  }), []);

  const run = async <T,>(operation: () => Promise<T>): Promise<T | undefined> => {
    try {
      session.setError('');
      return await operation();
    } catch (error) {
      session.setError(error instanceof Error ? error.message : String(error));
      return undefined;
    }
  };

  if (!session.project) {
    const libraryProjects = session.projects.filter(project => project.location !== 'external');
    const externalProjects = session.projects.filter(project => project.location === 'external');
    return <div className="welcome">
      <div className="tomato-mark">T</div>
      <h1>番茄短篇写作台</h1>
      {brainstormOpen
        ? <BrainstormFeature onBack={() => setBrainstormOpen(false)} hasKey={session.hasKey}
          acceptProject={session.acceptProject} />
        : <>
          <p>每本小说保存在独立文件夹。AI 只生成候选稿，不会覆盖正式正文。</p>
          {session.error && <div className="notice error-notice">{session.error}</div>}
          <div className="library-card">
            <div><strong>默认项目库</strong><span>{session.libraryRoot || '正在读取…'}</span></div>
            <div className="button-row compact">
              <button onClick={() => void run(async () => {
                const result = await hostClient.request('selectProjectLibrary', undefined);
                if (result) {
                  session.setLibraryRoot(result.libraryRoot);
                  session.setProjects(result.projects);
                }
              })}>选择项目库</button>
              <button onClick={() => void run(() =>
                hostClient.request('revealProjectLibrary', undefined))}>在 Finder 中显示</button>
            </div>
          </div>
          <div className="button-row">
            <button className="primary" onClick={() => void run(async () =>
              session.acceptProject(await hostClient.request('createProject', {})!))}>
              在项目库新建小说
            </button>
            <button onClick={() => void run(async () =>
              session.acceptProject(await hostClient.request(
                'createProject', { location: 'choose' },
              )!))}>在其他位置新建</button>
            <button onClick={() => void run(async () =>
              session.acceptProject(await hostClient.request('openProject', undefined)!))}>
              打开本地项目
            </button>
            <button onClick={() => setBrainstormOpen(true)}>我有个梗，帮我开个头</button>
          </div>
          {!!libraryProjects.length && <div className="recent-projects">
            <h2>项目库</h2>
            {libraryProjects.map(project => <button key={project.rootPath} onClick={() => void run(async () =>
              session.acceptProject(await hostClient.request('loadProject', { rootPath: project.rootPath })))}>
              <strong>{project.name}</strong>
              <span>{project.genre} · {project.words}字 · {project.chapters}章</span>
            </button>)}
          </div>}
          {!!externalProjects.length && <div className="recent-projects">
            <h2>外部项目</h2>
            {externalProjects.map(project => <button key={project.rootPath} onClick={() => void run(async () =>
              session.acceptProject(await hostClient.request('loadProject', { rootPath: project.rootPath })))}>
              <strong>{project.name}</strong>
              <span>{project.genre} · {project.words}字 · {project.chapters}章</span>
            </button>)}
          </div>}
        </>}
    </div>;
  }

  const project = session.project;
  return <div className="app-shell">
    <aside>
      <div className="brand"><span className="brand-dot" />番茄短篇</div>
      <button className="project-switch" onClick={() => session.setProject(null)}>
        <strong>{project.name}</strong><small>{project.planning.genre}</small>
      </button>
      <nav>{TABS.map(([id, label]) =>
        <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}
      </nav>
      <div className="aside-actions">
        <button onClick={() => void run(async () =>
          session.acceptProject(await hostClient.request(
            'reloadProject', { rootPath: project.rootPath },
          )))}>重新载入项目</button>
        <button onClick={() => void run(() =>
          hostClient.request('revealProjectFolder', { rootPath: project.rootPath }))}>
          在 Finder 中显示
        </button>
        {project.storageLayout === 'legacy' && <button className="primary" onClick={() => {
          if (!window.confirm('将复制到默认项目库并转换为易读 TXT；旧项目不会删除。继续吗？')) return;
          void run(async () => {
            const migrated = await hostClient.request('migrateProject', { project });
            session.acceptProject(migrated.project);
            setMigrationSource(migrated.sourceRoot);
          });
        }}>迁移为易读 TXT</button>}
        <button onClick={() => void run(() => hostClient.request('backupProject', { project }))}>立即备份</button>
        <button onClick={() => setSettingsOpen(true)}>AI 设置 · {session.hasKey ? '已配置' : '未配置'}</button>
      </div>
    </aside>
    <main>
      <header>
        <div><h1>{TABS.find(([id]) => id === tab)?.[1]}</h1><span>{project.rootPath}</span></div>
        <div className={session.error ? 'save-state error' : 'save-state'}>
          {session.error || (session.dirty.current ? '保存中…'
            : session.saved ? `已保存 ${new Date(session.saved).toLocaleTimeString()}` : '文件化存储')}
        </div>
      </header>
      {migrationSource && <div className="migration-notice">
        <span>易读 TXT 项目已创建；旧项目仍保留在：{migrationSource}</span>
        <button onClick={() => void run(() =>
          hostClient.request('revealProjectFolder', { rootPath: migrationSource }))}>
          在 Finder 中显示旧项目
        </button>
        <button onClick={() => setMigrationSource('')}>知道了</button>
      </div>}
      {tab === 'planning' && <PlanningFeature project={project} update={session.update} hasKey={session.hasKey} />}
      {tab === 'outline' && <OutlineFeature project={project} update={session.update} hasKey={session.hasKey} />}
      {tab === 'editor' && <EditorFeature project={project} update={session.update}
        hasKey={session.hasKey} acceptProject={session.acceptProject} />}
      {tab === 'characters' && <AssetsFeature project={project} update={session.update} hasKey={session.hasKey} />}
      {tab === 'ai' && <AssistantFeature project={project} hasKey={session.hasKey} />}
      {tab === 'stats' && <StatsFeature project={project} />}
    </main>
    {settingsOpen && <SettingsFeature settings={session.settings} setSettings={session.setSettings}
      hasKey={session.hasKey} close={() => setSettingsOpen(false)} save={session.saveSettings} />}
  </div>;
}
