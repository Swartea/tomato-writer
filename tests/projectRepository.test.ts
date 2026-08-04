import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectRepository } from '../src/projectRepository';
import type { Clock, IdFactory, RecentProjectStore } from '../packages/core/src';

class MemoryRecentProjects implements RecentProjectStore {
  roots: string[] = [];
  read() { return this.roots; }
  async write(roots: string[]) { this.roots = roots; }
}

describe('Node 文件项目适配器', () => {
  let parent: string;
  let recent: MemoryRecentProjects;
  let repository: ProjectRepository;
  beforeEach(async () => {
    parent = await mkdtemp(join(tmpdir(), 'tomato-writer-'));
    recent = new MemoryRecentProjects();
    const clock: Clock = { now: () => new Date('2026-07-28T08:00:00.000Z') };
    let sequence = 0;
    const ids: IdFactory = { create: prefix => `${prefix}-${++sequence}` };
    repository = new ProjectRepository(recent, clock, ids);
  });
  afterEach(async () => {
    const { rm } = await import('node:fs/promises');
    await rm(parent, { recursive: true, force: true });
  });

  it('创建、原子保存、重新打开、备份和导出', async () => {
    const created = await repository.create(parent, '测试书');
    expect(created.storageLayout).toBe('readable-txt');
    expect(await readFile(join(created.rootPath, '策划', '本书策划.txt'), 'utf8')).toContain('【书名】');
    created.chapters[0].content = '第一章正文';
    await repository.save(created);
    const reopened = await repository.open(created.rootPath);
    expect(reopened.chapters[0].content).toBe('第一章正文');
    expect(recent.roots[0]).toBe(created.rootPath);
    expect(await repository.backup(reopened)).toContain(join(created.rootPath, '备份'));
    const exported = await repository.exportProject(reopened, parent, 'md');
    expect(await readFile(exported, 'utf8')).toContain('# 第一章');
    expect(await readFile(join(created.rootPath, '.tomato', 'project.json'), 'utf8'))
      .not.toContain('第一章正文');
    const chapterFile = (await readdir(join(created.rootPath, '正文')))[0];
    expect(await readFile(join(created.rootPath, '正文', chapterFile), 'utf8')).toBe('第一章正文');
  });

  it('加载只规范化内存数据，不自动重写旧项目文件', async () => {
    const created = await repository.create(parent, '旧项目', 'legacy');
    const planningPath = join(created.rootPath, 'planning.json');
    const old = { schemaVersion: 1, title: '旧项目', genre: '自定义旧题材' };
    await writeFile(planningPath, JSON.stringify(old), 'utf8');
    const before = await stat(planningPath);
    const loaded = await repository.load(created.rootPath);
    const after = await stat(planningPath);
    expect(loaded.schemaVersion).toBe(2);
    expect(loaded.storageLayout).toBe('legacy');
    expect(loaded.planning.genre).toBe('自定义旧题材');
    expect(loaded.planning.targetWords).toBe(40000);
    expect(after.mtimeMs).toBe(before.mtimeMs);
    expect(JSON.parse(await readFile(planningPath, 'utf8'))).toEqual(old);
  });

  it('清理最近列表里的失效目录', async () => {
    recent.roots = [join(parent, 'missing')];
    expect(await repository.list()).toEqual([]);
    expect(recent.roots).toEqual([]);
  });

  it('迁移旧版项目并保留正文', async () => {
    const [project] = await repository.importLegacy(parent, {
      projects: [{
        name: '旧版小说',
        genre: '都市脑洞',
        status: '写作中',
        chapters: [{ title: '旧第一章', content: '旧正文' }],
      }],
    });
    expect(project.schemaVersion).toBe(2);
    expect(project.status).toBe('writing');
    expect((await repository.open(project.rootPath)).chapters[0].content).toBe('旧正文');
    expect(project.storageLayout).toBe('readable-txt');
  });

  it('外部修改 TXT 后重载，并在标题改名后把旧文件移入回收站', async () => {
    const project = await repository.create(parent, '外部编辑');
    project.chapters[0].content = '保存前正文';
    await repository.save(project);
    const oldFile = (await readdir(join(project.rootPath, '正文')))[0];
    await writeFile(join(project.rootPath, '正文', oldFile), '外部修改正文', 'utf8');
    const externallyEdited = await repository.load(project.rootPath);
    expect(externallyEdited.chapters[0].content).toBe('外部修改正文');
    externallyEdited.chapters[0].title = '新章名';
    await repository.save(externallyEdited);
    expect((await readdir(join(project.rootPath, '正文')))[0]).toContain('新章名');
    const trashed = await readdir(join(project.rootPath, '.trash'));
    expect(trashed).toHaveLength(2);
    expect(trashed).toContain(
      `2026-07-28T08-00-00-000Z-正文-${oldFile}`,
    );
  });

  it('复制迁移旧布局，验证内容一致且不修改源项目', async () => {
    const source = await repository.create(parent, '待迁移', 'legacy');
    source.chapters[0].content = '迁移正文';
    source.characters.push({
      id: 'character-1',
      name: '林默',
      identity: '运维工程师',
      desire: '查明真相',
      flaw: '过度谨慎',
      relationships: '',
      voice: '克制',
      boundaries: '只能验证',
      arc: '从被动到主动',
    });
    await repository.save(source);
    const sourceMetadata = join(source.rootPath, 'tomato-project.json');
    const before = await readFile(sourceMetadata, 'utf8');
    const destination = join(parent, '项目库');
    const result = await repository.migrateToReadable(source, destination);
    expect(result.sourceRoot).toBe(source.rootPath);
    expect(result.targetRoot).not.toBe(source.rootPath);
    expect(result.project.storageLayout).toBe('readable-txt');
    expect(result.project.chapters[0].content).toBe('迁移正文');
    expect(result.project.characters[0].name).toBe('林默');
    expect(await readFile(sourceMetadata, 'utf8')).toBe(before);
    expect(await repository.detectLayout(source.rootPath)).toBe('legacy');
  });

  it('扫描项目库并与外部最近项目按真实路径去重', async () => {
    const library = join(parent, '项目库');
    const inLibrary = await repository.create(library, '库内项目');
    const outside = await repository.create(parent, '外部项目');
    recent.roots = [outside.rootPath, inLibrary.rootPath];
    const projects = await repository.list(library);
    expect(projects).toHaveLength(2);
    expect(projects.find(item => item.id === inLibrary.id)?.location).toBe('library');
    expect(projects.find(item => item.id === outside.id)?.location).toBe('external');
  });

  it('迁移校验失败时清理临时目录并保持源项目不变', async () => {
    const source = await repository.create(parent, '迁移失败样本', 'legacy');
    source.planning.tags = ['包含\n换行的非法标签'];
    await repository.save(source);
    const sourceFile = join(source.rootPath, 'planning.json');
    const before = await readFile(sourceFile, 'utf8');
    const destination = join(parent, '失败项目库');
    await expect(repository.migrateToReadable(source, destination))
      .rejects.toThrow(/项目迁移失败，源项目未改动/);
    expect(await readFile(sourceFile, 'utf8')).toBe(before);
    expect((await readdir(destination)).filter(name => name.startsWith('.tomato-migrate-'))).toEqual([]);
  });

  it('批准候选前自动备份并在重开后保留人工正文', async () => {
    const project = await repository.create(parent, '审批测试');
    project.candidates.push({
      id: 'draft-1',
      chapterId: project.chapters[0].id,
      createdAt: project.createdAt,
      model: 'test',
      promptVersion: 'test',
      contextSummary: '',
      context: '',
      content: '原候选',
      revisedContent: '修订候选',
      review: { pacing: '', consistency: '', style: '', aiSmell: 0 },
      quality: {
        targetCharacters: { min: 1200, max: 1500 },
        contentCharacters: 3,
        revisedCharacters: 4,
        dialogueTarget: { min: 15, max: 30 },
        contentDialogueRatio: 0,
        revisedDialogueRatio: 0,
        violations: [],
      },
      status: 'candidate',
    });
    await repository.save(project);
    await repository.approveCandidate(project, 'draft-1', '人工确认后的正文');
    expect((await readdir(join(project.rootPath, '备份'))).length).toBeGreaterThan(0);
    const reopened = await repository.open(project.rootPath);
    expect(reopened.chapters[0].content).toBe('人工确认后的正文');
    expect(reopened.candidates[0].status).toBe('approved');
  });
});
