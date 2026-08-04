import {
  Character, EmotionalBeat, Foreshadowing, GenreTrack, OutlineNode, Planning,
  StyleProfile, WorldItem,
} from './types';

type Sections = Map<string, string>;

const TRACK_LABELS: Record<GenreTrack, string> = {
  male: '男频',
  female: '女频',
  mystery: '悬疑',
};

const TRACK_VALUES: Record<string, GenreTrack> = {
  male: 'male',
  female: 'female',
  mystery: 'mystery',
  男频: 'male',
  女频: 'female',
  悬疑: 'mystery',
};

const WORLD_TYPES: Record<WorldItem['type'], string> = {
  rule: '规则',
  location: '地点',
  item: '物品',
  timeline: '时间线',
};

const WORLD_TYPE_VALUES: Record<string, WorldItem['type']> = {
  rule: 'rule',
  location: 'location',
  item: 'item',
  timeline: 'timeline',
  规则: 'rule',
  地点: 'location',
  物品: 'item',
  时间线: 'timeline',
};

const FORESHADOW_STATUS: Record<Foreshadowing['status'], string> = {
  planned: '计划中',
  planted: '已埋下',
  paid: '已回收',
};

const FORESHADOW_STATUS_VALUES: Record<string, Foreshadowing['status']> = {
  planned: 'planned',
  planted: 'planted',
  paid: 'paid',
  计划中: 'planned',
  已埋下: 'planted',
  已回收: 'paid',
};

function normalize(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '');
}

function escapeBody(text: string): string {
  return normalize(text).split('\n').map(line => /^\\?【.+】$/.test(line) ? `\\${line}` : line).join('\n');
}

function unescapeBody(text: string): string {
  return text.split('\n').map(line => line.startsWith('\\【') ? line.slice(1) : line).join('\n');
}

function encodeSections(entries: Array<[string, string | number]>): string {
  return `${entries.map(([name, value]) => `【${name}】\n${escapeBody(String(value))}`).join('\n\n')}\n`;
}

function parseSections(
  text: string,
  file: string,
  allowed: (name: string) => boolean,
): Sections {
  const result = new Map<string, string>();
  let current = '';
  const body: string[] = [];
  const commit = () => {
    if (!current) return;
    if (result.has(current)) throw new Error(`${file}：区块“${current}”重复`);
    result.set(current, unescapeBody(body.join('\n').replace(/\n+$/, '')));
  };
  for (const [index, line] of normalize(text).split('\n').entries()) {
    const match = line.match(/^【(.+)】$/);
    if (match) {
      commit();
      current = match[1].trim();
      body.length = 0;
      if (!allowed(current)) throw new Error(`${file}：第 ${index + 1} 行存在未知区块“${current}”`);
    } else if (!current) {
      if (line.trim()) throw new Error(`${file}：第 ${index + 1} 行必须是“【区块名】”`);
    } else {
      body.push(line);
    }
  }
  commit();
  return result;
}

function requireSection(sections: Sections, name: string, file: string): string {
  if (!sections.has(name)) throw new Error(`${file}：缺少“【${name}】”区块`);
  return sections.get(name) || '';
}

function lines(value: string): string[] {
  return value.split('\n').map(item => item.trim()).filter(Boolean);
}

function optionalNumber(value: string, name: string, file: string): number | null {
  const normalized = value.trim();
  if (!normalized || normalized === '无') return null;
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${file}：“${name}”必须是正整数或“无”`);
  return parsed;
}

function requiredNumber(value: string, name: string, file: string, min = 0): number {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed < min) throw new Error(`${file}：“${name}”必须是不小于 ${min} 的数字`);
  return parsed;
}

function parseEmotionalBeats(value: string, file: string): EmotionalBeat[] {
  return lines(value).map((line, index) => {
    const parts = line.split('｜');
    if (parts.length !== 3) throw new Error(`${file}：“情绪节拍”第 ${index + 1} 行必须为“章节｜情绪｜触发事件”`);
    return { chapters: parts[0].trim(), emotion: parts[1].trim(), triggerEvent: parts[2].trim() };
  });
}

export function encodePlanningTxt(value: Planning): string {
  const conflictType = (value.coreConflictType || '').trim();
  const entries: Array<[string, string | number]> = [
    ['书名', value.title],
    ['题材分轨', TRACK_LABELS[value.genreTrack]],
    ['细分题材', value.genre],
    ['目标读者', value.targetReader],
    ['目标字数', value.targetWords],
    ['内容标签', value.tags.join('\n')],
    ['书名候选', value.titleCandidates.join('\n')],
    ['一句话卖点', value.sellingPoint],
    ['故事梗概', value.synopsis],
    ['核心冲突', value.coreConflict],
  ];
  // 仅在非空时写出新增段：旧项目文件保持零 diff，往返断言不受影响。
  if (conflictType) entries.push(['核心冲突类型', conflictType]);
  entries.push(
    ['情绪目标', value.emotionalGoal],
    ['情绪节拍', value.emotionalBeats.map(item =>
      `${item.chapters}｜${item.emotion}｜${item.triggerEvent}`).join('\n')],
  );
  return encodeSections(entries);
}

export function decodePlanningTxt(text: string, file = '本书策划.txt'): Planning {
  const names = new Set([
    '书名', '题材分轨', '细分题材', '目标读者', '目标字数', '内容标签', '书名候选',
    // 「核心冲突类型」必须进白名单：parseSections 对未知区块名直接抛错，只放宽 requireSection 不够。
    '一句话卖点', '故事梗概', '核心冲突', '核心冲突类型', '情绪目标', '情绪节拍',
  ]);
  const value = parseSections(text, file, name => names.has(name));
  const trackText = requireSection(value, '题材分轨', file).trim();
  const genreTrack = TRACK_VALUES[trackText];
  if (!genreTrack) throw new Error(`${file}：“题材分轨”必须是男频、女频或悬疑`);
  // 可选段：旧文件没有该区块时**整个键都不出现**，绝不能走 requireSection。
  // 不能返回 `coreConflictType: undefined` —— 迁移校验用 isDeepStrictEqual，
  // 「值为 undefined 的键」与「键不存在」并不相等，会误报「本书策划校验不一致」。
  const coreConflictType = value.get('核心冲突类型')?.trim() || '';
  return {
    schemaVersion: 2,
    title: requireSection(value, '书名', file),
    genreTrack,
    genre: requireSection(value, '细分题材', file),
    targetReader: requireSection(value, '目标读者', file),
    targetWords: requiredNumber(requireSection(value, '目标字数', file), '目标字数', file, 1),
    tags: lines(requireSection(value, '内容标签', file)),
    titleCandidates: lines(requireSection(value, '书名候选', file)),
    sellingPoint: requireSection(value, '一句话卖点', file),
    synopsis: requireSection(value, '故事梗概', file),
    coreConflict: requireSection(value, '核心冲突', file),
    ...(coreConflictType ? { coreConflictType } : {}),
    emotionalGoal: requireSection(value, '情绪目标', file),
    emotionalBeats: parseEmotionalBeats(requireSection(value, '情绪节拍', file), file),
  };
}

export function encodeStyleProfileTxt(value: StyleProfile): string {
  const samples: Array<[string, string]> = [];
  value.referenceSamples.forEach((item, index) => samples.push([`参考正文${index + 1}`, item]));
  value.negativeSamples.forEach((item, index) => {
    samples.push([`反例${index + 1}正文`, item.text], [`反例${index + 1}原因`, item.reason]);
  });
  return encodeSections([
    ['叙事视角', value.perspective],
    ['节奏', value.pace],
    ['目标情绪', value.emotion],
    ['对话目标', value.dialogueRatio],
    ['句式长度', value.sentenceLength],
    ['主角语言习惯', value.protagonistVoice],
    ['禁用词', value.bannedWords.join('\n')],
    ['禁用套路', value.bannedPatterns.join('\n')],
    ...samples,
  ]);
}

export function decodeStyleProfileTxt(text: string, file = '文风档案.txt'): StyleProfile {
  const fixed = new Set([
    '叙事视角', '节奏', '目标情绪', '对话目标', '句式长度', '主角语言习惯', '禁用词', '禁用套路',
  ]);
  const value = parseSections(text, file, name =>
    fixed.has(name) || /^参考正文\d+$/.test(name) || /^反例\d+(正文|原因)$/.test(name));
  const referenceSamples = [...value.entries()]
    .filter(([name]) => /^参考正文\d+$/.test(name))
    .sort(([a], [b]) => Number(a.slice(4)) - Number(b.slice(4)))
    .map(([, body]) => body);
  const negativeIndexes = [...new Set([...value.keys()]
    .map(name => name.match(/^反例(\d+)(正文|原因)$/)?.[1])
    .filter((item): item is string => Boolean(item))
    .map(Number))].sort((a, b) => a - b);
  const negativeSamples = negativeIndexes.map(index => ({
    text: requireSection(value, `反例${index}正文`, file),
    reason: requireSection(value, `反例${index}原因`, file),
  }));
  return {
    schemaVersion: 2,
    perspective: requireSection(value, '叙事视角', file),
    pace: requireSection(value, '节奏', file),
    emotion: requireSection(value, '目标情绪', file),
    dialogueRatio: requiredNumber(requireSection(value, '对话目标', file), '对话目标', file, 0),
    sentenceLength: requireSection(value, '句式长度', file),
    protagonistVoice: requireSection(value, '主角语言习惯', file),
    bannedWords: lines(requireSection(value, '禁用词', file)),
    bannedPatterns: lines(requireSection(value, '禁用套路', file)),
    referenceSamples,
    negativeSamples,
  };
}

export function encodeOutlineTxt(value: OutlineNode, writingOutline = ''): string {
  return encodeSections([
    ['章节标题', value.title],
    ['写作章纲', writingOutline],
    ['剧情阶段', value.phase],
    ['本章目标', value.goal],
    ['出场人物', value.characters],
    ['关键事件', value.event],
    ['核心冲突', value.conflict],
    ['转折信息', value.turn],
    ['情绪回报', value.payoff],
    ['伏笔安排', value.foreshadowing],
    ['上下章衔接', value.continuity],
    ['章末钩子', value.hook],
  ]);
}

export function decodeOutlineTxt(text: string, id: string, order: number, file: string): OutlineNode {
  return decodeOutlineDocumentTxt(text, id, order, file).outline;
}

export function decodeOutlineDocumentTxt(
  text: string,
  id: string,
  order: number,
  file: string,
): { outline: OutlineNode; writingOutline: string } {
  const names = new Set([
    '章节标题', '写作章纲', '剧情阶段', '本章目标', '出场人物', '关键事件',
    '核心冲突', '转折信息', '情绪回报', '伏笔安排', '上下章衔接', '章末钩子',
  ]);
  const value = parseSections(text, file, name => names.has(name));
  return {
    writingOutline: requireSection(value, '写作章纲', file),
    outline: {
      id,
      order,
      title: requireSection(value, '章节标题', file),
      phase: value.get('剧情阶段') || '',
      goal: requireSection(value, '本章目标', file),
      characters: value.get('出场人物') || '',
      event: value.get('关键事件') || '',
      conflict: requireSection(value, '核心冲突', file),
      turn: value.get('转折信息') || '',
      payoff: requireSection(value, '情绪回报', file),
      foreshadowing: value.get('伏笔安排') || '',
      continuity: value.get('上下章衔接') || '',
      hook: requireSection(value, '章末钩子', file),
    },
  };
}

export function encodeCharacterTxt(value: Character): string {
  return encodeSections([
    ['姓名', value.name],
    ['身份', value.identity],
    ['欲望', value.desire],
    ['缺陷', value.flaw],
    ['人物关系', value.relationships],
    ['说话习惯', value.voice],
    ['能力边界', value.boundaries],
    ['阶段变化', value.arc],
  ]);
}

export function decodeCharacterTxt(text: string, id: string, file: string): Character {
  const names = new Set(['姓名', '身份', '欲望', '缺陷', '人物关系', '说话习惯', '能力边界', '阶段变化']);
  const value = parseSections(text, file, name => names.has(name));
  return {
    id,
    name: requireSection(value, '姓名', file),
    identity: requireSection(value, '身份', file),
    desire: requireSection(value, '欲望', file),
    flaw: requireSection(value, '缺陷', file),
    relationships: requireSection(value, '人物关系', file),
    voice: requireSection(value, '说话习惯', file),
    boundaries: requireSection(value, '能力边界', file),
    arc: requireSection(value, '阶段变化', file),
  };
}

export function encodeWorldTxt(value: WorldItem): string {
  return encodeSections([
    ['名称', value.name],
    ['类型', WORLD_TYPES[value.type]],
    ['内容', value.content],
  ]);
}

export function decodeWorldTxt(text: string, id: string, file: string): WorldItem {
  const names = new Set(['名称', '类型', '内容']);
  const value = parseSections(text, file, name => names.has(name));
  const typeText = requireSection(value, '类型', file).trim();
  const type = WORLD_TYPE_VALUES[typeText];
  if (!type) throw new Error(`${file}：“类型”必须是规则、地点、物品或时间线`);
  return {
    id,
    name: requireSection(value, '名称', file),
    type,
    content: requireSection(value, '内容', file),
  };
}

export function encodeForeshadowingTxt(value: Foreshadowing): string {
  return encodeSections([
    ['伏笔内容', value.content],
    ['埋下章节', value.plantedChapter ?? '无'],
    ['计划回收章节', value.plannedPayoffChapter ?? '无'],
    ['实际回收章节', value.actualPayoffChapter ?? '无'],
    ['状态', FORESHADOW_STATUS[value.status]],
  ]);
}

export function decodeForeshadowingTxt(text: string, id: string, file: string): Foreshadowing {
  const names = new Set(['伏笔内容', '埋下章节', '计划回收章节', '实际回收章节', '状态']);
  const value = parseSections(text, file, name => names.has(name));
  const statusText = requireSection(value, '状态', file).trim();
  const status = FORESHADOW_STATUS_VALUES[statusText];
  if (!status) throw new Error(`${file}：“状态”必须是计划中、已埋下或已回收`);
  return {
    id,
    content: requireSection(value, '伏笔内容', file),
    plantedChapter: optionalNumber(requireSection(value, '埋下章节', file), '埋下章节', file),
    plannedPayoffChapter: optionalNumber(
      requireSection(value, '计划回收章节', file), '计划回收章节', file),
    actualPayoffChapter: optionalNumber(
      requireSection(value, '实际回收章节', file), '实际回收章节', file),
    status,
  };
}
