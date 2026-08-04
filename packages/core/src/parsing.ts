import {
  Character, EmotionalBeat, Foreshadowing, GenerateOptionsKind, OptionCandidate,
  StyleProfile, WorldItem,
} from './types';

export function stripReasoning(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

export function parseModelJson<T = unknown>(raw: string): T {
  const cleaned = stripReasoning(raw).replace(/```(?:json)?/gi, '').trim();
  const objectStart = cleaned.indexOf('{');
  const arrayStart = cleaned.indexOf('[');
  const start = objectStart < 0 ? arrayStart : arrayStart < 0 ? objectStart : Math.min(objectStart, arrayStart);
  const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (start < 0 || end < start) throw new Error('模型未返回可识别的 JSON');
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    throw new Error('模型返回的 JSON 格式无效');
  }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasStrings = (value: Record<string, unknown>, keys: string[]) =>
  keys.every(key => typeof value[key] === 'string');

const stringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

export function parseGeneratedCharacter(value: unknown): Omit<Character, 'id'> {
  if (!isRecord(value) || !hasStrings(value, ['name', 'identity', 'desire', 'flaw', 'relationships', 'voice', 'boundaries', 'arc'])) {
    throw new Error('人物字段不完整');
  }
  return value as unknown as Omit<Character, 'id'>;
}

export function parseGeneratedWorld(value: unknown): Omit<WorldItem, 'id'> {
  if (!isRecord(value) || !hasStrings(value, ['type', 'name', 'content']) ||
      !['rule', 'location', 'item', 'timeline'].includes(String(value.type))) {
    throw new Error('世界观字段不完整');
  }
  return value as unknown as Omit<WorldItem, 'id'>;
}

function nullableChapter(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  throw new Error('伏笔章节字段无效');
}

export function parseGeneratedForeshadowing(value: unknown): Omit<Foreshadowing, 'id'> {
  if (!isRecord(value) || typeof value.content !== 'string' ||
      !['planned', 'planted', 'paid'].includes(String(value.status))) {
    throw new Error('伏笔字段不完整');
  }
  return {
    content: value.content,
    plantedChapter: nullableChapter(value.plantedChapter),
    plannedPayoffChapter: nullableChapter(value.plannedPayoffChapter),
    actualPayoffChapter: nullableChapter(value.actualPayoffChapter),
    status: value.status as Foreshadowing['status'],
  };
}

/** 候选项 label 的长度护栏：过长基本是模型把整段说明塞进了 label。 */
const MAX_LABEL_LENGTH = 120;
/** 单套节拍方案的条数区间（A1）。 */
const BEATS_PER_PLAN = { min: 4, max: 8 };

/** 从多种可能的返回形状里取出候选数组：`[...]` 或 `{options:[...]}` 或 `{candidates:[...]}`。 */
function optionRows(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (isRecord(raw)) {
    for (const key of ['options', 'candidates', 'items', 'list', 'data']) {
      if (Array.isArray(raw[key])) return raw[key] as unknown[];
    }
  }
  throw new Error('模型没有返回候选');
}

/** 从候选项对象里挑出可用作 label 的字段，兼容模型换字段名的情况。 */
function pickLabel(row: Record<string, unknown>): string {
  for (const key of ['label', 'title', 'text', 'name', 'value', 'content']) {
    const candidate = row[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return '';
}

/**
 * 校验一套情绪节拍：必须是 4~8 条结构完整的 `EmotionalBeat`。
 * 不合格返回 null —— 由调用方整套丢弃（A1：宽松处理，避免一条不合格拖垮整批）。
 */
function parseBeatPlan(value: unknown): EmotionalBeat[] | null {
  const rows = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.beats) ? value.beats : null;
  if (!rows || rows.length < BEATS_PER_PLAN.min || rows.length > BEATS_PER_PLAN.max) return null;
  const beats: EmotionalBeat[] = [];
  for (const row of rows) {
    if (!isRecord(row)) return null;
    const chapters = typeof row.chapters === 'string' ? row.chapters.trim() : '';
    const emotion = typeof row.emotion === 'string' ? row.emotion.trim() : '';
    const triggerEvent = typeof row.triggerEvent === 'string' ? row.triggerEvent.trim() : '';
    if (!chapters || !emotion || !triggerEvent) return null;
    beats.push({ chapters, emotion, triggerEvent });
  }
  return beats;
}

/**
 * 解析 `generateOptions` 的模型输出为统一候选信封。
 *
 * 所有候选校验都收敛在这里（trim / 去空 / label 去重 / 长度截断 / beats 结构校验），
 * workflows、host 与 UI 一律信任返回值，不重复校验。
 *
 * @param kind  候选场景，决定 `value` 的校验方式
 * @param raw   `parseModelJson` 的产物
 * @param count 期望条数，超出部分截断
 * @throws 全部候选都不合格时抛出，由上层展示为可重试错误
 */
export function parseOptionCandidates(
  kind: GenerateOptionsKind,
  raw: unknown,
  count: number,
): OptionCandidate[] {
  const rows = optionRows(raw);
  const result: OptionCandidate[] = [];
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const record = isRecord(row) ? row : null;
    let label = typeof row === 'string' ? row.trim() : record ? pickLabel(record) : '';
    if (!label || label.length > MAX_LABEL_LENGTH) {
      if (kind !== 'beats') return;
      label = '';
    }

    let value: unknown;
    if (kind === 'beats') {
      const beats = parseBeatPlan(record ? record.value ?? record.beats ?? record.plan : row);
      if (!beats) return; // A1：单套不合格 → 整套丢弃
      value = beats;
      if (!label) label = `方案${index + 1}`;
    }

    const key = kind === 'beats'
      ? JSON.stringify(value)
      : label;
    if (seen.has(key)) return;
    seen.add(key);

    const note = record && typeof record.note === 'string' && record.note.trim()
      ? record.note.trim()
      : undefined;
    result.push(value === undefined ? { label, note } : { label, value, note });
  });

  if (!result.length) throw new Error('模型没有返回候选');
  return result.slice(0, Math.max(1, count));
}

export function parseGeneratedStyle(value: unknown): Omit<StyleProfile, 'schemaVersion'> {
  if (!isRecord(value) ||
      !hasStrings(value, ['perspective', 'pace', 'emotion', 'sentenceLength', 'protagonistVoice']) ||
      typeof value.dialogueRatio !== 'number' || value.dialogueRatio < 10 || value.dialogueRatio > 80 ||
      !stringArray(value.bannedWords) || !stringArray(value.bannedPatterns) ||
      !stringArray(value.referenceSamples) || !Array.isArray(value.negativeSamples) ||
      !value.negativeSamples.every(item => isRecord(item) && typeof item.text === 'string' && typeof item.reason === 'string')) {
    throw new Error('文风字段不完整');
  }
  return value as unknown as Omit<StyleProfile, 'schemaVersion'>;
}
