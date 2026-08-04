import { useEffect, useState } from 'react';
import { buildContext, CandidateDraft, countWords, dialogueRatio, ProjectData } from '@tomato-writer/core';
import { hostClient } from '../hostClient';
import { Field, Section, statusName, uid, UpdateProject } from './shared';

export function EditorFeature({ project, update, hasKey, acceptProject }: {
  project: ProjectData;
  update: UpdateProject;
  hasKey: boolean;
  acceptProject: (project: ProjectData) => void;
}) {
  const [chapterId, setChapterId] = useState(project.chapters[0]?.id || '');
  const [instruction, setInstruction] = useState('');
  const [showContext, setShowContext] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draftId, setDraftId] = useState('');
  const chapter = project.chapters.find(item => item.id === chapterId) || project.chapters[0];
  const drafts = project.candidates.filter(item => item.chapterId === chapter?.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const draft = drafts.find(item => item.id === draftId) || drafts[0];
  const context = chapter ? buildContext(project, chapter, instruction) : '';

  const add = () => update(next => {
    const order = next.chapters.length + 1;
    next.chapters.push({
      id: uid('chapter'), order, title: `第${order}章`, outline: '', content: '',
      summary: '', status: 'planned', characterIds: [], foreshadowingIds: [],
      updatedAt: new Date().toISOString(),
    });
  });
  const generate = async () => {
    if (!chapter) return;
    setBusy(true);
    update(next => { next.chapters.find(item => item.id === chapter.id)!.status = 'generating'; });
    try {
      const generated = await hostClient.request('generateChapter', {
        project,
        chapterId: chapter.id,
        instruction,
      }, { timeoutMs: 650_000 });
      update(next => {
        next.candidates.push(generated);
        next.chapters.find(item => item.id === chapter.id)!.status = 'reviewing';
      });
      setDraftId(generated.id);
    } catch (error) {
      update(next => { next.chapters.find(item => item.id === chapter.id)!.status = 'planned'; });
      alert(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  if (!chapter) return <div className="empty">暂无章节</div>;
  return <div className="editor-layout">
    <div className="chapter-list">
      <button className="primary" onClick={add}>新增章节</button>
      {[...project.chapters].sort((a, b) => a.order - b.order).map(item =>
        <button key={item.id} className={item.id === chapter.id ? 'selected' : ''}
          onClick={() => setChapterId(item.id)}>
          <strong>{item.title}</strong>
          <span>{countWords(item.content)}字 · {statusName[item.status]}</span>
        </button>)}
    </div>
    <div className="editor-main">
      <div className="toolbar">
        <input className="title-input" value={chapter.title} onChange={event =>
          update(next => { next.chapters.find(item => item.id === chapter.id)!.title = event.target.value; })} />
        <span>{countWords(chapter.content)}字 · 对话约{dialogueRatio(chapter.content)}%</span>
      </div>
      <Field label="本章章纲"><textarea rows={3} value={chapter.outline} onChange={event =>
        update(next => { next.chapters.find(item => item.id === chapter.id)!.outline = event.target.value; })} /></Field>
      <textarea className="manuscript" value={chapter.content} placeholder="正式稿。AI 不会直接覆盖这里。"
        onChange={event => update(next => {
          next.chapters.find(item => item.id === chapter.id)!.content = event.target.value;
        })} />
      <div className="generation-box">
        <Field label="本次生成补充要求"><textarea value={instruction}
          onChange={event => setInstruction(event.target.value)} /></Field>
        <div className="toolbar">
          <button onClick={() => setShowContext(!showContext)}>查看本次上下文</button>
          <button className="primary" disabled={!hasKey || busy} onClick={generate}>
            {busy ? '写作与审校中…' : '生成章节候选稿'}
          </button>
        </div>
        {showContext && <pre className="context-preview">{context}</pre>}
      </div>
      {draft && <Review draft={draft} drafts={drafts} select={setDraftId}
        project={project} acceptProject={acceptProject} />}
    </div>
  </div>;
}

function Review({ draft, drafts, select, project, acceptProject }: {
  draft: CandidateDraft;
  drafts: CandidateDraft[];
  select: (id: string) => void;
  project: ProjectData;
  acceptProject: (project: ProjectData) => void;
}) {
  const [mode, setMode] = useState<'original' | 'revised'>('revised');
  const [text, setText] = useState(draft.revisedContent);
  useEffect(() => setText(mode === 'revised' ? draft.revisedContent : draft.content), [draft.id, mode]);
  const reject = async () => {
    const next = structuredClone(project);
    const target = next.candidates.find(item => item.id === draft.id);
    if (target) target.status = 'rejected';
    const result = await hostClient.request('saveProject', { project: next });
    acceptProject(result.project);
  };
  const approve = async () => {
    acceptProject(await hostClient.request('approveCandidate', {
      project,
      candidateId: draft.id,
      content: text,
    }));
  };
  return <Section title="候选稿审批" hint="批准前自动备份">
    <div className="toolbar">
      <select value={draft.id} onChange={event => select(event.target.value)}>
        {drafts.map(item => <option value={item.id} key={item.id}>
          {new Date(item.createdAt).toLocaleString()} · {item.status}
        </option>)}
      </select>
      <button onClick={() => setMode('original')}>原候选</button>
      <button onClick={() => setMode('revised')}>审校修订版</button>
    </div>
    <div className={draft.quality.violations.length ? 'notice error' : 'notice'}>
      <strong>硬指标：</strong>原稿 {draft.quality.contentCharacters}字 / 对话{draft.quality.contentDialogueRatio}%；
      修订版 {draft.quality.revisedCharacters}字 / 对话{draft.quality.revisedDialogueRatio}%。
      {draft.quality.violations.length ? draft.quality.violations.join('；') : '长度与本章对话目标均通过。'}
      {' '}AI 味 {draft.review.aiSmell}/100
    </div>
    <div className="review-grid">
      <article><h3>节奏</h3><p>{draft.review.pacing}</p></article>
      <article><h3>一致性</h3><p>{draft.review.consistency}</p></article>
      <article><h3>文风</h3><p>{draft.review.style}</p></article>
      <article><h3>AI 味评分</h3><p>{draft.review.aiSmell}/100（越低越像真人，目标 &lt; 40）</p></article>
    </div>
    <textarea className="candidate-text" value={text} onChange={event => setText(event.target.value)} />
    <div className="toolbar end">
      <button className="danger" onClick={() => void reject()}>拒绝</button>
      <button className="primary" onClick={() => void approve()}>批准为正式稿</button>
    </div>
  </Section>;
}
