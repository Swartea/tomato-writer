import { useCallback, useState } from 'react';
import { GenerateOptionsKind, OptionCandidate, ProjectData } from '@tomato-writer/core';
import { hostClient } from '../hostClient';

type CandidateMap = Partial<Record<GenerateOptionsKind, OptionCandidate[]>>;

export interface OptionCandidatesApi {
  /** 各 kind 的当前批候选；只存在 React state，不落盘，切页即弃 */
  candidates: CandidateMap;
  /** 正在生成的 kind，null 表示空闲；同一时刻只允许一个请求 */
  busyKind: GenerateOptionsKind | null;
  /** 最近一次失败的文案，成功后清空 */
  error: string;
  /** 首次生成：清掉旧批再请求 */
  ask: (kind: GenerateOptionsKind, count?: number) => void;
  /** 再来一批：排除「当前批 + 已采纳项」，不跨批累积 */
  more: (kind: GenerateOptionsKind, adopted?: string[], count?: number) => void;
  /** 丢弃某个 kind 的候选 */
  clear: (kind: GenerateOptionsKind) => void;
}

/**
 * 策划页 AI 候选态。
 *
 * 把「请求 / 加载态 / 错误 / exclude 计算」从 PlanningFeature 里抽出来，
 * 组件侧只负责「点了哪个候选、写回哪个字段」。
 */
export function useOptionCandidates(project: ProjectData): OptionCandidatesApi {
  const [candidates, setCandidates] = useState<CandidateMap>({});
  const [busyKind, setBusyKind] = useState<GenerateOptionsKind | null>(null);
  const [error, setError] = useState('');

  const run = useCallback(async (
    kind: GenerateOptionsKind,
    exclude: string[],
    count?: number,
  ) => {
    setBusyKind(kind);
    setError('');
    try {
      const data = await hostClient.request('generateOptions', {
        kind,
        project,
        ...(count === undefined ? {} : { count }),
        ...(exclude.length ? { exclude } : {}),
      });
      setCandidates(previous => ({ ...previous, [kind]: data.options }));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '生成候选失败，请重试');
    } finally {
      setBusyKind(null);
    }
  }, [project]);

  const ask = useCallback((kind: GenerateOptionsKind, count?: number) => {
    setCandidates(previous => ({ ...previous, [kind]: undefined }));
    void run(kind, [], count);
  }, [run]);

  const more = useCallback((kind: GenerateOptionsKind, adopted: string[] = [], count?: number) => {
    // A4：exclude 只含「当前批 + 已采纳项」，不做跨批累积，避免 prompt 无限膨胀。
    const current = (candidates[kind] ?? []).map(option => option.label);
    void run(kind, [...new Set([...current, ...adopted])], count);
  }, [candidates, run]);

  const clear = useCallback((kind: GenerateOptionsKind) => {
    setCandidates(previous => ({ ...previous, [kind]: undefined }));
  }, []);

  return { candidates, busyKind, error, ask, more, clear };
}
