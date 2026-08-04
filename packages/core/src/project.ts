import { CandidateDraft, OutlineNode, ProjectData } from './types';
import { Clock, IdFactory } from './ports';
import { candidateViolations, countCharacters, dialogueRatio, dialogueTarget } from './metrics';

export const SCHEMA_VERSION = 2;

export function normalizeOutlineNode(
  value: Partial<OutlineNode>,
  order = value.order || 1,
  id = value.id || `outline-${order}`,
): OutlineNode {
  return {
    id,
    order,
    title: value.title || `第${order}章`,
    phase: value.phase || '',
    goal: value.goal || '',
    characters: value.characters || '',
    event: value.event || '',
    conflict: value.conflict || '',
    turn: value.turn || '',
    payoff: value.payoff || '',
    hook: value.hook || '',
    foreshadowing: value.foreshadowing || '',
    continuity: value.continuity || '',
  };
}

export function outlineWritingBrief(value: OutlineNode): string {
  const rows: Array<[string, string]> = [
    ['剧情阶段', value.phase],
    ['本章目标', value.goal],
    ['出场人物', value.characters],
    ['关键事件', value.event],
    ['核心冲突', value.conflict],
    ['转折/信息增量', value.turn],
    ['情绪回报', value.payoff],
    ['伏笔铺设/回收', value.foreshadowing],
    ['上下章衔接', value.continuity],
    ['章末钩子', value.hook],
  ];
  return rows.filter(([, content]) => content.trim())
    .map(([label, content]) => `${label}：${content.trim()}`)
    .join('\n');
}

export function createProjectData(
  rootPath: string,
  name: string,
  clock: Clock,
  ids: IdFactory,
): ProjectData {
  const now = clock.now().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: ids.create('project'),
    rootPath,
    name,
    status: 'planning',
    createdAt: now,
    updatedAt: now,
    planning: {
      schemaVersion: SCHEMA_VERSION, genreTrack: 'male', genre: '都市脑洞',
      targetReader: '', sellingPoint: '', title: name, titleCandidates: [], tags: [],
      // coreConflictType 刻意不给默认值：全链路遵循「空值即键不存在」，
      // 保证内存对象与 TXT/JSON 落盘结果深度相等（迁移校验依赖这一点）。
      synopsis: '', coreConflict: '', emotionalGoal: '', emotionalBeats: [], targetWords: 40000,
    },
    outline: [],
    styleProfile: {
      schemaVersion: SCHEMA_VERSION, perspective: '限制性第三人称', pace: '快节奏',
      emotion: '', dialogueRatio: 40, sentenceLength: '短句优先', protagonistVoice: '',
      bannedWords: [], bannedPatterns: [], referenceSamples: [], negativeSamples: [],
    },
    characters: [], world: [], foreshadowing: [],
    chapters: [{
      id: ids.create('chapter'), order: 1, title: '第一章', outline: '', content: '',
      summary: '', status: 'planned', characterIds: [], foreshadowingIds: [], updatedAt: now,
    }],
    candidates: [],
  };
}

export function normalizeCandidate(
  candidate: Partial<CandidateDraft>,
  project: ProjectData,
): CandidateDraft {
  const chapter = project.chapters.find(item => item.id === candidate.chapterId);
  const content = candidate.content || '';
  const revisedContent = candidate.revisedContent || content;
  const target = dialogueTarget(project);
  return {
    id: candidate.id || '',
    chapterId: candidate.chapterId || '',
    createdAt: candidate.createdAt || project.updatedAt,
    model: candidate.model || 'configured-model',
    promptVersion: candidate.promptVersion || '',
    contextSummary: candidate.contextSummary || `第${chapter?.order || '?'}章 ${chapter?.title || ''}`,
    context: candidate.context || candidate.contextSummary || '',
    content,
    revisedContent,
    review: {
      pacing: candidate.review?.pacing || '待审校',
      consistency: candidate.review?.consistency || '待审校',
      style: candidate.review?.style || '待审校',
      aiSmell: typeof candidate.review?.aiSmell === 'number' ? candidate.review.aiSmell : 0,
    },
    quality: {
      targetCharacters: candidate.quality?.targetCharacters || { min: 1200, max: 1500 },
      contentCharacters: countCharacters(content),
      revisedCharacters: countCharacters(revisedContent),
      dialogueTarget: target,
      contentDialogueRatio: dialogueRatio(content),
      revisedDialogueRatio: dialogueRatio(revisedContent),
      violations: candidateViolations(content, revisedContent, target),
    },
    status: candidate.status === 'approved' || candidate.status === 'rejected' ? candidate.status : 'candidate',
  };
}

export function approveCandidateInMemory(
  project: ProjectData,
  candidateId: string,
  content: string,
  clock: Clock,
): ProjectData {
  const candidate = project.candidates.find(item => item.id === candidateId);
  if (!candidate) throw new Error('候选稿不存在');
  if (candidate.status !== 'candidate') throw new Error('只有待审批的候选稿可以批准');
  if (!content.trim()) throw new Error('不能将空内容批准为正式稿');
  const chapter = project.chapters.find(item => item.id === candidate.chapterId);
  if (!chapter) throw new Error('章节不存在');
  project.candidates.forEach(item => {
    if (item.chapterId === chapter.id && item.status === 'approved') item.status = 'rejected';
  });
  candidate.status = 'approved';
  candidate.revisedContent = content;
  candidate.quality.revisedCharacters = countCharacters(content);
  candidate.quality.revisedDialogueRatio = dialogueRatio(content);
  candidate.quality.violations = candidateViolations(
    candidate.content,
    content,
    candidate.quality.dialogueTarget,
    candidate.quality.targetCharacters,
  );
  chapter.content = content;
  chapter.status = 'approved';
  chapter.updatedAt = clock.now().toISOString();
  project.updatedAt = chapter.updatedAt;
  project.status = project.chapters.every(item => ['approved', 'completed'].includes(item.status))
    ? 'completed' : 'writing';
  return project;
}
