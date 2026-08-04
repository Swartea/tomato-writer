import { useState } from 'react';
import { isRecord, ProjectData } from '@tomato-writer/core';
import { hostClient } from '../hostClient';
import { Field } from './shared';

export function BrainstormFeature({ onBack, hasKey, acceptProject }: {
  onBack: () => void;
  hasKey: boolean;
  acceptProject: (project: ProjectData) => void;
}) {
  const [concept, setConcept] = useState('');
  const [track, setTrack] = useState<ProjectData['planning']['genreTrack']>('male');
  const [targetWords, setTargetWords] = useState(40000);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState('');
  const generate = async () => {
    if (!concept.trim()) return setError('先写一句你的灵感');
    setBusy(true);
    setError('');
    try {
      const generated = await hostClient.request('brainstorm', {
        concept: concept.trim(), genreTrack: track, targetWords,
      });
      if (!isRecord(generated)) throw new Error('模型返回的构思字段不完整');
      setResult(generated);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };
  const pick = async (title: string) => {
    if (!result) return;
    const project = await hostClient.request('createProject', {
      suggestedName: title,
      seed: {
        sellingPoint: typeof result.sellingPoint === 'string' ? result.sellingPoint : '',
        genreTrack: track,
        genre: typeof result.genre === 'string' ? result.genre : '',
        tags: Array.isArray(result.tags) ? result.tags : [],
        titleCandidates: Array.isArray(result.titleCandidates) ? result.titleCandidates : [],
      },
    });
    if (project) acceptProject(project);
  };
  return <div className="brainstorm">
    <button className="link" onClick={onBack}>← 返回</button>
    <h2>我有个梗，帮我开个头</h2>
    <p className="notice">把脑子里的一句话灵感丢进来，AI 帮你起 5 个书名 + 卖点 + 题材标签。选中书名直接建项目。</p>
    <Field label="核心灵感 / 一句话梗"><textarea rows={3} value={concept}
      onChange={event => setConcept(event.target.value)}
      placeholder="例：程序员被裁当天，发现估值百亿公司的核心代码来自十年前的自己" /></Field>
    <div className="form-grid">
      <Field label="题材分轨"><select value={track}
        onChange={event => setTrack(event.target.value as ProjectData['planning']['genreTrack'])}>
        <option value="male">男频</option><option value="female">女频</option><option value="mystery">悬疑</option>
      </select></Field>
      <Field label="目标字数"><input type="number" value={targetWords}
        onChange={event => setTargetWords(Number(event.target.value))} /></Field>
    </div>
    <button className="primary" disabled={busy || !hasKey} onClick={() => void generate()}>
      {busy ? 'AI 构思中…' : 'AI 生成书名与卖点'}
    </button>
    {!hasKey && <p className="notice">请先在已有项目的 AI 设置中配置 API Key</p>}
    {error && <p className="notice error">{error}</p>}
    {result && <div className="brainstorm-result">
      <p className="notice">{String(result.why || '')}</p>
      <Field label="一句话卖点（25–40字）"><textarea readOnly value={String(result.sellingPoint || '')} /></Field>
      <Field label="细分题材 / 标签"><input readOnly
        value={`${String(result.genre || '')} · ${(result.tags || []).join('、')}`} /></Field>
      <div className="title-candidates">{(result.titleCandidates || []).map((title: string, index: number) =>
        <button key={index} className="title-pick" onClick={() => void pick(title)}>
          {title}<small>用它建项目</small>
        </button>)}</div>
    </div>}
  </div>;
}
