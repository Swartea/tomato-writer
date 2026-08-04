import { useState } from 'react';
import {
  normalizeOutlineNode,
  outlineWritingBrief,
  OutlineNode,
  ProjectData,
} from '@tomato-writer/core';
import { hostClient } from '../hostClient';
import { Field, Section, uid, UpdateProject } from './shared';

const DETAIL_FIELDS: Array<keyof Pick<OutlineNode,
  'phase' | 'goal' | 'characters' | 'event' | 'conflict' | 'turn' |
  'payoff' | 'foreshadowing' | 'continuity' | 'hook'>> = [
  'phase', 'goal', 'characters', 'event', 'conflict',
  'turn', 'payoff', 'foreshadowing', 'continuity', 'hook',
];

const PHASE_GUIDE = ['开局立钩', '压力升级', '主动反击', '高潮兑现', '余波收束'];

function updateChapterFromOutline(project: ProjectData, node: OutlineNode) {
  const chapter = project.chapters.find(item => item.order === node.order);
  if (!chapter) return;
  chapter.title = node.title;
  chapter.outline = outlineWritingBrief(node);
}

export function OutlineFeature({ project, update, hasKey }: {
  project: ProjectData;
  update: UpdateProject;
  hasKey: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const completedDetails = project.outline.reduce((total, node) =>
    total + DETAIL_FIELDS.filter(key => node[key]?.trim()).length, 0);
  const totalDetails = project.outline.length * DETAIL_FIELDS.length;
  const completeness = totalDetails ? Math.round(completedDetails / totalDetails * 100) : 0;
  const phases = [...new Set(project.outline.map(node => node.phase?.trim()).filter(Boolean))];
  const averageWords = project.outline.length
    ? Math.round(project.planning.targetWords / project.outline.length)
    : 0;

  const add = () => update(next => {
    const order = Math.max(0, ...next.outline.map(item => item.order)) + 1;
    next.outline.push(normalizeOutlineNode(
      { title: `第${order}章` },
      order,
      uid('outline'),
    ));
  });

  const generate = async () => {
    setBusy(true);
    try {
      const rows = await hostClient.request('generateOutline', { project });
      update(next => {
        next.outline = rows;
        while (next.chapters.length < rows.length) {
          const order = next.chapters.length + 1;
          next.chapters.push({
            id: uid('chapter'), order, title: `第${order}章`, outline: '', content: '',
            summary: '', status: 'planned', characterIds: [], foreshadowingIds: [],
            updatedAt: new Date().toISOString(),
          });
        }
        rows.forEach(node => updateChapterFromOutline(next, node));
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const edit = (index: number, key: keyof OutlineNode, value: string) => update(next => {
    const node = next.outline[index];
    if (!node) return;
    if (key === 'order' || key === 'id') return;
    node[key] = value as never;
    updateChapterFromOutline(next, node);
  });

  return <div className="stack">
    <Section title="剧情结构总览" hint="先定因果链，再逐章写作">
      <div className="outline-summary">
        <article><span>章节节点</span><strong>{project.outline.length || '—'}</strong></article>
        <article><span>结构完整度</span><strong>{completeness}%</strong></article>
        <article><span>剧情阶段</span><strong>{phases.length || '—'}</strong></article>
        <article><span>预计章均字数</span><strong>{averageWords || '—'}</strong></article>
      </div>
      <div className="outline-phase-guide">
        {PHASE_GUIDE.map((phase, index) =>
          <span key={phase}>{index + 1}. {phase}</span>)}
      </div>
      <div className="notice outline-brief">
        <strong>核心冲突：</strong>{project.planning.coreConflict || '尚未填写'}
        {'\n'}<strong>情绪目标：</strong>{project.planning.emotionalGoal || '尚未填写'}
      </div>
    </Section>

    <div className="toolbar outline-toolbar">
      <button className="primary" disabled={!hasKey || busy} onClick={generate}>
        {busy ? '正在生成详细大纲…' : 'AI 生成详细剧情大纲'}
      </button>
      <button onClick={add}>新增章节节点</button>
      {!hasKey && <span className="muted-text">配置 API Key 后可使用 AI 生成</span>}
    </div>

    {!project.outline.length && <div className="empty">
      还没有剧情大纲。可以由 AI 根据作品策划和创作资产生成，也可以手动新增章节节点。
    </div>}

    {project.outline.map((node, index) =>
      <Section
        key={node.id}
        title={`第${node.order}章${node.title ? ` · ${node.title}` : ''}`}
        hint={node.phase || '未设置剧情阶段'}
      >
        <div className="outline-chapter-head">
          <Field label="章节标题">
            <input value={node.title ?? ''} placeholder="本章标题"
              onChange={event => edit(index, 'title', event.target.value)} />
          </Field>
          <Field label="剧情阶段">
            <input value={node.phase ?? ''} placeholder="如：开局立钩 / 压力升级"
              onChange={event => edit(index, 'phase', event.target.value)} />
          </Field>
        </div>
        <div className="outline-detail-grid">
          <Field label="本章行动目标">
            <textarea rows={2} value={node.goal ?? ''} placeholder="主角本章要完成什么可验证目标"
              onChange={event => edit(index, 'goal', event.target.value)} />
          </Field>
          <Field label="出场人物与立场">
            <textarea rows={2} value={node.characters ?? ''} placeholder="人物、当前立场及关系变化"
              onChange={event => edit(index, 'characters', event.target.value)} />
          </Field>
          <Field label="关键事件（按顺序）">
            <textarea rows={4} value={node.event ?? ''} placeholder={'1. 具体场面或动作\n2. 推进结果\n3. 状态变化'}
              onChange={event => edit(index, 'event', event.target.value)} />
          </Field>
          <Field label="核心冲突与即时风险">
            <textarea rows={4} value={node.conflict ?? ''} placeholder="谁或什么阻止目标，失败会立刻失去什么"
              onChange={event => edit(index, 'conflict', event.target.value)} />
          </Field>
          <Field label="转折 / 信息增量">
            <textarea rows={3} value={node.turn ?? ''} placeholder="本章后人物或读者新知道了什么"
              onChange={event => edit(index, 'turn', event.target.value)} />
          </Field>
          <Field label="情绪回报">
            <textarea rows={3} value={node.payoff ?? ''} placeholder="本章具体兑现的爽点、情绪或答案"
              onChange={event => edit(index, 'payoff', event.target.value)} />
          </Field>
          <Field label="伏笔铺设 / 回收">
            <textarea rows={3} value={node.foreshadowing ?? ''} placeholder="铺设：…… / 回收：…… / 无"
              onChange={event => edit(index, 'foreshadowing', event.target.value)} />
          </Field>
          <Field label="上下章衔接">
            <textarea rows={3} value={node.continuity ?? ''} placeholder="承接什么状态，给下一章留下什么状态"
              onChange={event => edit(index, 'continuity', event.target.value)} />
          </Field>
          <Field label="章末钩子">
            <textarea rows={3} value={node.hook ?? ''} placeholder="下一章必须解决的具体新问题"
              onChange={event => edit(index, 'hook', event.target.value)} />
          </Field>
        </div>
        <div className="toolbar end">
          <button className="danger" onClick={() => update(next => {
            next.outline.splice(index, 1);
          })}>删除此大纲节点</button>
        </div>
      </Section>)}
  </div>;
}
