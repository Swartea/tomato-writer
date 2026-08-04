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

export function dialogueRatio(text: string): number {
  if (!text.length) return 0;
  const dialogueCharacters = [...text.matchAll(/[“"][^”"]+[”"]/g)]
    .reduce((total, match) => total + match[0].length, 0);
  return Math.round(dialogueCharacters / text.length * 100);
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
