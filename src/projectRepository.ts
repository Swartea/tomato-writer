import * as path from 'path';
import { promises as fs } from 'fs';
import { isDeepStrictEqual } from 'util';
import {
  approveCandidateInMemory,
  CandidateDraft,
  Character,
  Clock,
  countWords,
  createProjectData,
  decodeCharacterTxt,
  decodeForeshadowingTxt,
  decodeOutlineDocumentTxt,
  decodePlanningTxt,
  decodeStyleProfileTxt,
  decodeWorldTxt,
  encodeCharacterTxt,
  encodeForeshadowingTxt,
  encodeOutlineTxt,
  encodePlanningTxt,
  encodeStyleProfileTxt,
  encodeWorldTxt,
  Foreshadowing,
  IdFactory,
  normalizeCandidate,
  normalizeOutlineNode,
  OutlineNode,
  Planning,
  ProjectData,
  ProjectLayout,
  ProjectMigrationResult,
  ProjectStore,
  ProjectSummary,
  randomIdFactory,
  RecentProjectStore,
  SCHEMA_VERSION,
  StyleProfile,
  systemClock,
  WorldItem,
} from '@tomato-writer/core';

export type {
  CandidateDraft, Character, Foreshadowing, OutlineNode, Planning,
  ProjectData, ProjectSummary, StyleProfile, WorldItem,
} from '@tomato-writer/core';

const LEGACY_PROJECT_FILE = 'tomato-project.json';
const READABLE_PROJECT_FILE = path.join('.tomato', 'project.json');
const READABLE_INDEX_FILE = path.join('.tomato', 'index.json');
const READABLE_CANDIDATES_FILE = path.join('.tomato', 'generations', 'index.json');

interface ReadableIndex {
  schemaVersion: 2;
  layout: 'readable-txt';
  chapters: Array<{
    id: string;
    order: number;
    title: string;
    summary: string;
    status: ProjectData['chapters'][number]['status'];
    characterIds: string[];
    foreshadowingIds: string[];
    updatedAt: string;
    file: string;
    outlineFile: string;
    outlineId?: string;
  }>;
  characters: Array<{ id: string; file: string }>;
  world: Array<{ id: string; file: string }>;
  foreshadowing: Array<{ id: string; file: string }>;
}

function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim() || '未命名';
}

function relative(...parts: string[]): string {
  return parts.join('/');
}

function numberedName(order: number, title: string): string {
  return `${String(order).padStart(3, '0')}-${safeName(title)}.txt`;
}

async function exists(file: string): Promise<boolean> {
  try { await fs.access(file); return true; } catch { return false; }
}

async function atomicWrite(file: string, value: string): Promise<void> {
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(temp, value.replace(/\r\n?/g, '\n'), 'utf8');
  await fs.rename(temp, file);
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try { return JSON.parse(await fs.readFile(file, 'utf8')) as T; } catch { return fallback; }
}

async function readRequiredJson<T>(file: string): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T;
  } catch (error) {
    throw new Error(`无法读取 ${file}：${error instanceof Error ? error.message : String(error)}`);
  }
}

async function readRequiredText(file: string): Promise<string> {
  try {
    return await fs.readFile(file, 'utf8');
  } catch (error) {
    throw new Error(`无法读取 ${file}：${error instanceof Error ? error.message : String(error)}`);
  }
}

function metadataFor(project: ProjectData) {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: project.id,
    name: project.name,
    storageLayout: 'readable-txt' as const,
    status: project.status,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

function summary(project: ProjectData, location: ProjectSummary['location']): ProjectSummary {
  return {
    id: project.id,
    rootPath: project.rootPath,
    name: project.name,
    genre: project.planning.genre,
    status: project.status,
    words: project.chapters.reduce((sum, chapter) => sum + countWords(chapter.content), 0),
    chapters: project.chapters.length,
    location,
  };
}

export class ProjectRepository implements ProjectStore {
  constructor(
    private readonly recentProjects: RecentProjectStore,
    private readonly clock: Clock = systemClock,
    private readonly ids: IdFactory = randomIdFactory,
  ) {}

  private async roots(): Promise<string[]> {
    return await this.recentProjects.read();
  }

  private async remember(rootPath: string): Promise<void> {
    const roots = await this.roots();
    await this.recentProjects.write([rootPath, ...roots.filter(root => root !== rootPath)]);
  }

  private async libraryRoots(libraryRoot?: string): Promise<string[]> {
    if (!libraryRoot) return [];
    try {
      const entries = await fs.readdir(libraryRoot, { withFileTypes: true });
      return entries.filter(entry => entry.isDirectory()).map(entry => path.join(libraryRoot, entry.name));
    } catch {
      return [];
    }
  }

  async list(libraryRoot?: string): Promise<ProjectSummary[]> {
    const recentRoots = await this.roots();
    const libraryRoots = await this.libraryRoots(libraryRoot);
    const libraryReal = new Set<string>();
    for (const root of libraryRoots) {
      try { libraryReal.add(await fs.realpath(root)); } catch { /* Ignore invalid library children. */ }
    }
    const candidates = [...libraryRoots, ...recentRoots];
    const seen = new Set<string>();
    const summaries: ProjectSummary[] = [];
    const validRecent: string[] = [];
    for (const root of candidates) {
      try {
        const real = await fs.realpath(root);
        if (seen.has(real)) {
          if (recentRoots.includes(root)) validRecent.push(root);
          continue;
        }
        const project = await this.load(root);
        seen.add(real);
        if (recentRoots.includes(root)) validRecent.push(root);
        summaries.push(summary(project, libraryReal.has(real) ? 'library' : 'external'));
      } catch { /* Invalid folders are not projects. */ }
    }
    const uniqueRecent = [...new Set(validRecent)];
    if (uniqueRecent.length !== recentRoots.length) await this.recentProjects.write(uniqueRecent);
    return summaries.sort((a, b) => {
      if (a.location !== b.location) return a.location === 'library' ? -1 : 1;
      return a.name.localeCompare(b.name, 'zh-CN');
    });
  }

  private async uniqueRoot(parentPath: string, name: string): Promise<string> {
    const base = safeName(name) || '未命名小说';
    let candidate = path.join(parentPath, base);
    let suffix = 2;
    while (await exists(candidate)) candidate = path.join(parentPath, `${base}-${suffix++}`);
    return candidate;
  }

  async create(
    parentPath: string,
    name: string,
    layout: ProjectLayout = 'readable-txt',
  ): Promise<ProjectData> {
    await fs.mkdir(parentPath, { recursive: true });
    const rootPath = await this.uniqueRoot(parentPath, name);
    const project = {
      ...createProjectData(rootPath, name, this.clock, this.ids),
      storageLayout: layout,
    };
    await this.writeProject(project);
    await this.remember(rootPath);
    return project;
  }

  async importLegacy(parentPath: string, legacyValue: unknown): Promise<ProjectData[]> {
    const legacy = legacyValue as { projects?: Array<Record<string, unknown>> };
    const imported: ProjectData[] = [];
    for (const old of legacy?.projects || []) {
      const baseName = String(old.name || '迁移小说');
      const project = await this.create(parentPath, baseName, 'readable-txt');
      project.planning.genre = String(old.genre || '都市脑洞');
      project.planning.title = baseName;
      project.planning.targetWords = Number(old.targetWords) || 40000;
      project.status = old.status === '已完成' ? 'completed'
        : old.status === '已投稿' ? 'submitted'
        : old.status === '写作中' ? 'writing' : 'planning';
      const oldChapters = Array.isArray(old.chapters) ? old.chapters as Array<Record<string, unknown>> : [];
      project.chapters = oldChapters.map((chapter, index) => ({
        id: String(chapter.id || this.ids.create('chapter')),
        order: index + 1,
        title: String(chapter.title || `第${index + 1}章`),
        outline: '',
        content: String(chapter.content || ''),
        summary: '',
        status: chapter.content ? 'approved' : 'planned',
        characterIds: [],
        foreshadowingIds: [],
        updatedAt: this.clock.now().toISOString(),
      }));
      if (!project.chapters.length) project.chapters = createProjectData('', baseName, this.clock, this.ids).chapters;
      await this.save(project);
      imported.push(project);
    }
    return imported;
  }

  async open(rootPath: string): Promise<ProjectData> {
    const project = await this.load(rootPath);
    await this.remember(rootPath);
    return project;
  }

  async detectLayout(rootPath: string): Promise<ProjectLayout> {
    if (await exists(path.join(rootPath, READABLE_PROJECT_FILE))) return 'readable-txt';
    if (await exists(path.join(rootPath, LEGACY_PROJECT_FILE))) return 'legacy';
    throw new Error('未找到番茄写作项目标记');
  }

  async load(rootPath: string): Promise<ProjectData> {
    const layout = await this.detectLayout(rootPath);
    return layout === 'readable-txt' ? this.loadReadable(rootPath) : this.loadLegacy(rootPath);
  }

  private async loadLegacy(rootPath: string): Promise<ProjectData> {
    const metadata = await readJson<Partial<ProjectData>>(path.join(rootPath, LEGACY_PROJECT_FILE), {});
    if (!metadata.id) throw new Error('未找到 tomato-project.json');
    const loadedPlanning = await readJson<Partial<Planning>>(path.join(rootPath, 'planning.json'), metadata.planning || {});
    const planning: Planning = {
      schemaVersion: SCHEMA_VERSION,
      genreTrack: loadedPlanning.genreTrack || 'male',
      genre: loadedPlanning.genre || '都市脑洞',
      targetReader: loadedPlanning.targetReader || '',
      sellingPoint: loadedPlanning.sellingPoint || '',
      title: loadedPlanning.title || metadata.name || '未命名小说',
      titleCandidates: loadedPlanning.titleCandidates || [],
      tags: loadedPlanning.tags || [],
      synopsis: loadedPlanning.synopsis || '',
      coreConflict: loadedPlanning.coreConflict || '',
      // 可选字段：只有非空才带上键，与 decodePlanningTxt 保持同一套「空值即键不存在」约定，
      // 否则迁移校验的 isDeepStrictEqual 会因「undefined 键 vs 无键」误报不一致。
      ...(loadedPlanning.coreConflictType?.trim()
        ? { coreConflictType: loadedPlanning.coreConflictType.trim() }
        : {}),
      emotionalGoal: loadedPlanning.emotionalGoal || '',
      emotionalBeats: loadedPlanning.emotionalBeats || [],
      targetWords: loadedPlanning.targetWords || 40000,
    };
    const loadedOutline = await readJson<Partial<OutlineNode>[]>(
      path.join(rootPath, 'outline.json'),
      metadata.outline || [],
    );
    const outline = loadedOutline.map((item, index) =>
      normalizeOutlineNode(item, item.order || index + 1, item.id));
    const loadedStyle = await readJson<Partial<StyleProfile>>(
      path.join(rootPath, 'style-profile.json'), metadata.styleProfile || {});
    const styleProfile: StyleProfile = {
      schemaVersion: SCHEMA_VERSION,
      perspective: loadedStyle.perspective || '限制性第三人称',
      pace: loadedStyle.pace || '快节奏',
      emotion: loadedStyle.emotion || '',
      dialogueRatio: Number.isFinite(loadedStyle.dialogueRatio) ? Number(loadedStyle.dialogueRatio) : 40,
      sentenceLength: loadedStyle.sentenceLength || '短句优先',
      protagonistVoice: loadedStyle.protagonistVoice || '',
      bannedWords: loadedStyle.bannedWords || [],
      bannedPatterns: loadedStyle.bannedPatterns || [],
      referenceSamples: loadedStyle.referenceSamples || [],
      negativeSamples: loadedStyle.negativeSamples || [],
    };
    const characters = await readJson<Character[]>(path.join(rootPath, 'entities', 'characters.json'), []);
    const world = await readJson<WorldItem[]>(path.join(rootPath, 'entities', 'world.json'), []);
    const foreshadowing = await readJson<Foreshadowing[]>(
      path.join(rootPath, 'entities', 'foreshadowing.json'), []);
    const loadedCandidates = await readJson<Partial<CandidateDraft>[]>(
      path.join(rootPath, 'generations', 'index.json'), []);
    const chapterMeta = [...(metadata.chapters || [])].sort((a, b) => a.order - b.order);
    const chapters = await Promise.all(chapterMeta.map(async chapter => ({
      ...chapter,
      content: await fs.readFile(
        path.join(rootPath, 'chapters', `${String(chapter.order).padStart(3, '0')}.md`),
        'utf8',
      ).catch(() => chapter.content || ''),
    })));
    const base = {
      ...(metadata as ProjectData),
      schemaVersion: SCHEMA_VERSION,
      storageLayout: 'legacy' as const,
      rootPath,
      planning,
      outline,
      styleProfile,
      characters,
      world,
      foreshadowing,
      chapters,
      candidates: [],
    };
    return { ...base, candidates: loadedCandidates.map(candidate => normalizeCandidate(candidate, base)) };
  }

  private async loadReadable(rootPath: string): Promise<ProjectData> {
    const metadata = await readRequiredJson<Partial<ProjectData>>(path.join(rootPath, READABLE_PROJECT_FILE));
    if (!metadata.id) throw new Error(`${READABLE_PROJECT_FILE}：缺少项目 ID`);
    const index = await readRequiredJson<ReadableIndex>(path.join(rootPath, READABLE_INDEX_FILE));
    if (index.schemaVersion !== 2 || index.layout !== 'readable-txt') {
      throw new Error(`${READABLE_INDEX_FILE}：不支持的项目索引版本`);
    }
    const planningFile = path.join(rootPath, '策划', '本书策划.txt');
    const styleFile = path.join(rootPath, '策划', '文风档案.txt');
    const planning = decodePlanningTxt(await readRequiredText(planningFile), planningFile);
    const styleProfile = decodeStyleProfileTxt(await readRequiredText(styleFile), styleFile);
    const outline: OutlineNode[] = [];
    const chapters = await Promise.all([...index.chapters].sort((a, b) => a.order - b.order)
      .map(async entry => {
        const outlinePath = path.join(rootPath, entry.outlineFile);
        const document = decodeOutlineDocumentTxt(
          await readRequiredText(outlinePath),
          entry.outlineId || `outline-${entry.id}`,
          entry.order,
          outlinePath,
        );
        if (entry.outlineId) outline.push(document.outline);
        return {
          id: entry.id,
          order: entry.order,
          title: entry.title,
          outline: document.writingOutline,
          content: await readRequiredText(path.join(rootPath, entry.file)),
          summary: entry.summary,
          status: entry.status,
          characterIds: entry.characterIds,
          foreshadowingIds: entry.foreshadowingIds,
          updatedAt: entry.updatedAt,
        };
      }));
    outline.sort((a, b) => a.order - b.order);
    const characters = await Promise.all(index.characters.map(async entry =>
      decodeCharacterTxt(
        await readRequiredText(path.join(rootPath, entry.file)),
        entry.id,
        path.join(rootPath, entry.file),
      )));
    const world = await Promise.all(index.world.map(async entry =>
      decodeWorldTxt(
        await readRequiredText(path.join(rootPath, entry.file)),
        entry.id,
        path.join(rootPath, entry.file),
      )));
    const foreshadowing = await Promise.all(index.foreshadowing.map(async entry =>
      decodeForeshadowingTxt(
        await readRequiredText(path.join(rootPath, entry.file)),
        entry.id,
        path.join(rootPath, entry.file),
      )));
    const loadedCandidates = await readJson<Partial<CandidateDraft>[]>(
      path.join(rootPath, READABLE_CANDIDATES_FILE), []);
    const base: ProjectData = {
      schemaVersion: SCHEMA_VERSION,
      id: metadata.id,
      rootPath,
      name: metadata.name || planning.title || path.basename(rootPath),
      storageLayout: 'readable-txt',
      status: metadata.status || 'planning',
      createdAt: metadata.createdAt || this.clock.now().toISOString(),
      updatedAt: metadata.updatedAt || this.clock.now().toISOString(),
      planning,
      outline,
      styleProfile,
      characters,
      world,
      foreshadowing,
      chapters,
      candidates: [],
    };
    return { ...base, candidates: loadedCandidates.map(candidate => normalizeCandidate(candidate, base)) };
  }

  async save(project: ProjectData): Promise<ProjectData> {
    project.updatedAt = this.clock.now().toISOString();
    await this.writeProject(project);
    await this.remember(project.rootPath);
    return project;
  }

  private async writeProject(project: ProjectData): Promise<void> {
    const layout = project.storageLayout || await this.detectLayout(project.rootPath).catch(() => 'readable-txt');
    if (layout === 'legacy') await this.writeLegacy(project);
    else await this.writeReadable(project);
  }

  private async writeLegacy(project: ProjectData): Promise<void> {
    const root = project.rootPath;
    for (const directory of ['entities', 'chapters', 'reviews', 'generations', 'backups', '.trash']) {
      await fs.mkdir(path.join(root, directory), { recursive: true });
    }
    const metadata = {
      ...project,
      storageLayout: undefined,
      planning: undefined,
      outline: undefined,
      styleProfile: undefined,
      characters: undefined,
      world: undefined,
      foreshadowing: undefined,
      candidates: undefined,
      chapters: project.chapters.map(chapter => ({ ...chapter, content: '' })),
    };
    await Promise.all([
      atomicWrite(path.join(root, LEGACY_PROJECT_FILE), JSON.stringify(metadata, null, 2)),
      atomicWrite(path.join(root, 'planning.json'), JSON.stringify(project.planning, null, 2)),
      atomicWrite(path.join(root, 'outline.json'), JSON.stringify(project.outline, null, 2)),
      atomicWrite(path.join(root, 'style-profile.json'), JSON.stringify(project.styleProfile, null, 2)),
      atomicWrite(path.join(root, 'entities', 'characters.json'), JSON.stringify(project.characters, null, 2)),
      atomicWrite(path.join(root, 'entities', 'world.json'), JSON.stringify(project.world, null, 2)),
      atomicWrite(path.join(root, 'entities', 'foreshadowing.json'), JSON.stringify(project.foreshadowing, null, 2)),
      atomicWrite(path.join(root, 'generations', 'index.json'), JSON.stringify(project.candidates, null, 2)),
      ...project.chapters.map(chapter => atomicWrite(
        path.join(root, 'chapters', `${String(chapter.order).padStart(3, '0')}.md`),
        chapter.content,
      )),
    ]);
  }

  private async writeReadable(project: ProjectData): Promise<void> {
    const root = project.rootPath;
    const directories = [
      '正文', '策划', relative('策划', '大纲'), relative('资产', '人物'),
      relative('资产', '世界观'), relative('资产', '伏笔'), '导出', '备份',
      '.trash', '.tomato', relative('.tomato', 'generations'),
    ];
    await Promise.all(directories.map(directory => fs.mkdir(path.join(root, directory), { recursive: true })));
    const previous = await readJson<ReadableIndex | null>(path.join(root, READABLE_INDEX_FILE), null);
    const index: ReadableIndex = {
      schemaVersion: 2,
      layout: 'readable-txt',
      chapters: [],
      characters: [],
      world: [],
      foreshadowing: [],
    };
    const writes: Array<Promise<void>> = [
      atomicWrite(path.join(root, '策划', '本书策划.txt'), encodePlanningTxt(project.planning)),
      atomicWrite(path.join(root, '策划', '文风档案.txt'), encodeStyleProfileTxt(project.styleProfile)),
      atomicWrite(path.join(root, READABLE_CANDIDATES_FILE), JSON.stringify(project.candidates, null, 2)),
    ];
    for (const chapter of [...project.chapters].sort((a, b) => a.order - b.order)) {
      const file = relative('正文', numberedName(chapter.order, chapter.title));
      const outlineFile = relative('策划', '大纲', numberedName(chapter.order, chapter.title));
      const node = project.outline.find(item => item.order === chapter.order);
      const outlineValue = node || normalizeOutlineNode(
        { title: chapter.title },
        chapter.order,
        `outline-${chapter.id}`,
      );
      index.chapters.push({
        id: chapter.id,
        order: chapter.order,
        title: chapter.title,
        summary: chapter.summary,
        status: chapter.status,
        characterIds: chapter.characterIds,
        foreshadowingIds: chapter.foreshadowingIds,
        updatedAt: chapter.updatedAt,
        file,
        outlineFile,
        outlineId: node?.id,
      });
      writes.push(
        atomicWrite(path.join(root, file), chapter.content),
        atomicWrite(path.join(root, outlineFile), encodeOutlineTxt(outlineValue, chapter.outline)),
      );
    }
    project.characters.forEach((item, itemIndex) => {
      const file = relative('资产', '人物', numberedName(itemIndex + 1, item.name));
      index.characters.push({ id: item.id, file });
      writes.push(atomicWrite(path.join(root, file), encodeCharacterTxt(item)));
    });
    project.world.forEach((item, itemIndex) => {
      const file = relative('资产', '世界观', numberedName(itemIndex + 1, item.name));
      index.world.push({ id: item.id, file });
      writes.push(atomicWrite(path.join(root, file), encodeWorldTxt(item)));
    });
    project.foreshadowing.forEach((item, itemIndex) => {
      const title = item.content.split(/\r?\n/, 1)[0].slice(0, 24) || `伏笔${itemIndex + 1}`;
      const file = relative('资产', '伏笔', numberedName(itemIndex + 1, title));
      index.foreshadowing.push({ id: item.id, file });
      writes.push(atomicWrite(path.join(root, file), encodeForeshadowingTxt(item)));
    });
    await Promise.all(writes);
    await atomicWrite(path.join(root, READABLE_INDEX_FILE), JSON.stringify(index, null, 2));
    await atomicWrite(path.join(root, READABLE_PROJECT_FILE), JSON.stringify(metadataFor(project), null, 2));
    await this.trashStaleReadableFiles(root, previous, index);
    project.storageLayout = 'readable-txt';
  }

  private readableFiles(index: ReadableIndex | null): Set<string> {
    if (!index) return new Set();
    return new Set([
      ...index.chapters.flatMap(item => [item.file, item.outlineFile]),
      ...index.characters.map(item => item.file),
      ...index.world.map(item => item.file),
      ...index.foreshadowing.map(item => item.file),
    ]);
  }

  private async trashStaleReadableFiles(
    root: string,
    previous: ReadableIndex | null,
    current: ReadableIndex,
  ): Promise<void> {
    const stale = [...this.readableFiles(previous)].filter(file => !this.readableFiles(current).has(file));
    if (!stale.length) return;
    const stamp = this.clock.now().toISOString().replace(/[:.]/g, '-');
    for (const file of stale) {
      const source = path.join(root, file);
      if (!await exists(source)) continue;
      const sourceLabel = file.replace(/[\\/]/g, '-');
      const destination = path.join(root, '.trash', `${stamp}-${sourceLabel}`);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.rename(source, destination);
    }
  }

  async backup(project: ProjectData): Promise<string> {
    const stamp = this.clock.now().toISOString().replace(/[:.]/g, '-');
    const readable = (project.storageLayout || await this.detectLayout(project.rootPath)) === 'readable-txt';
    const destination = path.join(project.rootPath, readable ? '备份' : 'backups', stamp);
    await fs.mkdir(destination, { recursive: true });
    const relatives = readable
      ? ['正文', '策划', '资产', '.tomato']
      : [LEGACY_PROJECT_FILE, 'planning.json', 'outline.json', 'style-profile.json',
        'entities', 'chapters', 'generations'];
    for (const item of relatives) {
      const source = path.join(project.rootPath, item);
      if (await exists(source)) await fs.cp(source, path.join(destination, item), { recursive: true });
    }
    return destination;
  }

  async approveCandidate(project: ProjectData, candidateId: string, content: string): Promise<ProjectData> {
    await this.backup(project);
    approveCandidateInMemory(project, candidateId, content, this.clock);
    return this.save(project);
  }

  async exportProject(project: ProjectData, destination: string, format: 'txt' | 'md'): Promise<string> {
    const content = [...project.chapters].sort((a, b) => a.order - b.order)
      .map(chapter => `${format === 'md' ? '# ' : ''}${chapter.title}\n\n${chapter.content}`)
      .join('\n\n');
    const file = path.join(destination, `${safeName(project.name)}.${format}`);
    await atomicWrite(file, content);
    return file;
  }

  async migrateToReadable(project: ProjectData, parentPath: string): Promise<ProjectMigrationResult> {
    await fs.mkdir(parentPath, { recursive: true });
    const targetRoot = await this.uniqueRoot(parentPath, project.name);
    const staging = path.join(parentPath, `.tomato-migrate-${path.basename(targetRoot)}-${Date.now()}`);
    const sourceRoot = project.rootPath;
    try {
      const migrated: ProjectData = {
        ...structuredClone(project),
        rootPath: staging,
        storageLayout: 'readable-txt',
      };
      await this.writeReadable(migrated);
      const verified = await this.loadReadable(staging);
      this.verifyMigration(project, verified);
      await fs.rename(staging, targetRoot);
      const opened = await this.open(targetRoot);
      return { project: opened, sourceRoot, targetRoot };
    } catch (error) {
      await fs.rm(staging, { recursive: true, force: true });
      throw new Error(`项目迁移失败，源项目未改动：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private verifyMigration(source: ProjectData, target: ProjectData): void {
    const fail = (label: string) => { throw new Error(`${label}校验不一致`); };
    if (target.schemaVersion !== SCHEMA_VERSION) fail('schemaVersion');
    if (source.chapters.length !== target.chapters.length) fail('章节数量');
    source.chapters.forEach(chapter => {
      const migrated = target.chapters.find(item => item.id === chapter.id);
      if (!migrated || migrated.content !== chapter.content || migrated.status !== chapter.status) {
        fail(`章节“${chapter.title}”`);
      }
    });
    if (!isDeepStrictEqual(source.planning, target.planning)) fail('本书策划');
    if (!isDeepStrictEqual(source.styleProfile, target.styleProfile)) fail('文风档案');
    if (!isDeepStrictEqual(source.outline, target.outline)) fail('章节大纲');
    if (!isDeepStrictEqual(source.characters, target.characters)) fail('人物资产');
    if (!isDeepStrictEqual(source.world, target.world)) fail('世界观资产');
    if (!isDeepStrictEqual(source.foreshadowing, target.foreshadowing)) fail('伏笔资产');
    const sourceCandidates = source.candidates.map(item => [item.id, item.status]);
    const targetCandidates = target.candidates.map(item => [item.id, item.status]);
    if (JSON.stringify(sourceCandidates) !== JSON.stringify(targetCandidates)) fail('候选状态');
  }
}
