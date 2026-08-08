import { ProjectData } from './types';
import { genreTactic } from './prompts';

export interface NumberRange {
  min: number;
  max: number;
}

export function countWords(text: string): number {
  return (text.match(/[\u4e00-\u9fff]/g) || []).length + (text.match(/[a-zA-Z]+/g) || []).length;
}

export function countCharacters(text: string): number {
  return [...text.replace(/\s/g, '')].length;
}

/**
 * 对话片段匹配：每种引号**成对**匹配，互不串味。
 *
 * - `“…”` 中文弯引号、`「…」` 直角引号、`『…』` 双层直角引号、`"…"` 英文直引号；
 * - 用「分支交替」而不是字符类 `[“"]…[”"]`，避免 `“…"` 这类左右不同源的非法配对；
 * - 中文网文（尤其番茄男频）大量使用 `「」`，缺了它会让对话占比恒为 0%，
 *   进而误导闸门与修订指令，属于必须覆盖的口径。
 *
 * 注：嵌套如 `「他说『好』」` 由最外层分支整体吃掉，不会重复计数。
 */
const DIALOGUE_PATTERN = /“[^”]*”|「[^」]*」|『[^』]*』|"[^"]*"/g;

/**
 * 对话占比（百分比整数）。
 *
 * 分子与分母都走 {@link countCharacters}（去空白字符数），与全项目字数口径一致；
 * 若分母用 text.length（含空白）而分子去空白，同一段正文会有 2~3pp 的系统性偏差，
 * 在 `35–50%` 这类窄目标窗口里足以造成误判。
 */
export function dialogueRatio(text: string): number {
  const total = countCharacters(text);
  if (!total) return 0;
  const dialogueCharacters = [...text.matchAll(DIALOGUE_PATTERN)]
    .reduce((sum, match) => sum + countCharacters(match[0]), 0);
  return Math.round(dialogueCharacters / total * 100);
}

export function parseDialogueRange(text: string): NumberRange {
  const match = text.match(/(\d+)\D+(\d+)/);
  return match ? { min: Number(match[1]), max: Number(match[2]) } : { min: 15, max: 30 };
}

export function dialogueTarget(project: ProjectData): NumberRange {
  const tactic = genreTactic(project.planning.genre);
  return tactic ? parseDialogueRange(tactic.dialogue) : { min: 15, max: 30 };
}

export function candidateViolations(
  content: string,
  revisedContent: string,
  target: NumberRange,
  characterTarget: NumberRange = { min: 1200, max: 1500 },
): string[] {
  const contentCharacters = countCharacters(content);
  const revisedCharacters = countCharacters(revisedContent);
  const contentDialogueRatio = dialogueRatio(content);
  const revisedDialogueRatio = dialogueRatio(revisedContent);
  return [
    ...(contentCharacters < characterTarget.min || contentCharacters > characterTarget.max
      ? [`原候选长度${contentCharacters}字，要求${characterTarget.min}—${characterTarget.max}字`] : []),
    ...(revisedCharacters < characterTarget.min || revisedCharacters > characterTarget.max
      ? [`修订版长度${revisedCharacters}字，要求${characterTarget.min}—${characterTarget.max}字`] : []),
    ...(contentDialogueRatio < target.min || contentDialogueRatio > target.max
      ? [`原候选对话占比${contentDialogueRatio}%，本章目标${target.min}—${target.max}%`] : []),
    ...(revisedDialogueRatio < target.min || revisedDialogueRatio > target.max
      ? [`修订版对话占比${revisedDialogueRatio}%，本章目标${target.min}—${target.max}%`] : []),
  ];
}
