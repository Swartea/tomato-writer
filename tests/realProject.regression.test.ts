import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { access, cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { ProjectRepository } from '../src/projectRepository';
import type { RecentProjectStore } from '../packages/core/src';

const SOURCE_PROJECT = '/Users/swartea/Documents/自动化测试小说';
let sourceExists = true;
try { await access(join(SOURCE_PROJECT, 'tomato-project.json')); } catch { sourceExists = false; }

describe.skipIf(!sourceExists)('真实前三章项目回归', () => {
  let tempParent = '';
  let copiedRoot = '';
  const recent: RecentProjectStore = {
    read: () => [],
    write: async () => {},
  };
  const repository = new ProjectRepository(recent);

  beforeAll(async () => {
    tempParent = await mkdtemp(join(tmpdir(), 'tomato-real-regression-'));
    copiedRoot = join(tempParent, basename(SOURCE_PROJECT));
    await cp(SOURCE_PROJECT, copiedRoot, { recursive: true });
  });

  afterAll(async () => {
    if (tempParent) await rm(tempParent, { recursive: true, force: true });
  });

  it('打开真实项目并读取前三章', async () => {
    const project = await repository.load(SOURCE_PROJECT);
    expect(project.schemaVersion).toBe(2);
    expect(project.chapters.length).toBeGreaterThanOrEqual(3);
    expect(project.chapters.slice(0, 3).every(chapter => chapter.content.trim().length > 0)).toBe(true);
  });

  it('在副本中保存、备份、导出、关闭后重新打开', async () => {
    const project = await repository.open(copiedRoot);
    const original = project.planning.targetReader;
    project.planning.targetReader = `${original}（回归测试）`;
    await repository.save(project);
    const backup = await repository.backup(project);
    const exported = await repository.exportProject(project, tempParent, 'md');
    const reopened = await repository.open(copiedRoot);
    expect(reopened.planning.targetReader).toBe(`${original}（回归测试）`);
    expect(reopened.chapters.slice(0, 3).every(chapter => chapter.content.trim().length > 0)).toBe(true);
    expect(await readFile(join(backup, 'planning.json'), 'utf8')).toContain('回归测试');
    expect(await readFile(exported, 'utf8')).toContain(reopened.chapters[0].title);
  });

  it('把真实旧项目副本迁移为易读 TXT 并重新打开前三章', async () => {
    const legacy = await repository.open(copiedRoot);
    const migrated = await repository.migrateToReadable(legacy, join(tempParent, '项目库'));
    const reopened = await repository.open(migrated.targetRoot);
    expect(reopened.storageLayout).toBe('readable-txt');
    expect(reopened.schemaVersion).toBe(2);
    expect(reopened.chapters.slice(0, 3).map(chapter => chapter.content))
      .toEqual(legacy.chapters.slice(0, 3).map(chapter => chapter.content));
    expect(reopened.chapters.slice(0, 3).every(
      chapter => ['approved', 'completed'].includes(chapter.status),
    )).toBe(true);
    await access(join(migrated.targetRoot, '正文'));
    await access(join(migrated.targetRoot, '策划', '大纲'));
    await access(join(migrated.targetRoot, '.tomato', 'index.json'));
  });
});
