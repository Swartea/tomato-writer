import { useState } from 'react';
import {
  AssetKind, Character, Foreshadowing, ProjectData, WorldItem,
} from '@tomato-writer/core';
import { hostClient } from '../hostClient';
import { Section, uid, UpdateProject } from './shared';

export function AssetsFeature({ project, update, hasKey }: {
  project: ProjectData;
  update: UpdateProject;
  hasKey: boolean;
}) {
  const [kind, setKind] = useState<'characters' | 'world' | 'foreshadowing'>('characters');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const generate = async (assetKind: AssetKind) => {
    setBusy(true);
    setNote('');
    try {
      const generated = await hostClient.request('generateAsset', { kind: assetKind, project });
      update(next => {
        if (assetKind === 'character') next.characters.push(generated as Character);
        else if (assetKind === 'world') next.world.push(generated as WorldItem);
        else next.foreshadowing.push(generated as Foreshadowing);
      });
      setNote('已追加 1 条 AI 生成内容，可继续手工修改');
    } catch (error) {
      setNote(error instanceof Error ? error.message : '生成失败，请重试');
    } finally {
      setBusy(false);
    }
  };
  return <div className="stack">
    <div className="toolbar segmented">
      <button onClick={() => setKind('characters')}>人物</button>
      <button onClick={() => setKind('world')}>世界观</button>
      <button onClick={() => setKind('foreshadowing')}>伏笔</button>
    </div>
    {kind === 'characters' && <Section title="人物卡" hint="AI 生成会追加一条">
      <div className="toolbar">
        <button onClick={() => update(next => next.characters.push({
          id: uid('character'), name: '新人物', identity: '', desire: '', flaw: '',
          relationships: '', voice: '', boundaries: '', arc: '',
        }))}>手工新增</button>
        <button className="primary" disabled={busy || !hasKey} onClick={() => void generate('character')}>
          {busy ? '生成中…' : 'AI 生成人物'}
        </button>
      </div>
      <div className="asset-list">{project.characters.map((item, index) =>
        <CharacterRow key={item.id} value={item}
          change={(key, value) => update(next => {
            (next.characters[index] as unknown as Record<string, string>)[key] = value;
          })}
          remove={() => update(next => { next.characters.splice(index, 1); })} />)}
      </div>
    </Section>}
    {kind === 'world' && <Section title="世界观与时间线" hint="AI 生成会追加一条">
      <div className="toolbar">
        <button onClick={() => update(next => next.world.push({
          id: uid('world'), type: 'rule', name: '新设定', content: '',
        }))}>手工新增</button>
        <button className="primary" disabled={busy || !hasKey} onClick={() => void generate('world')}>
          {busy ? '生成中…' : 'AI 生成世界观'}
        </button>
      </div>
      <div className="asset-list">{project.world.map((item, index) =>
        <WorldRow key={item.id} value={item}
          change={(key, value) => update(next => {
            (next.world[index] as unknown as Record<string, string>)[key] = value;
          })}
          remove={() => update(next => { next.world.splice(index, 1); })} />)}
      </div>
    </Section>}
    {kind === 'foreshadowing' && <Section title="伏笔管理" hint="AI 生成会追加一条">
      <div className="toolbar">
        <button onClick={() => update(next => next.foreshadowing.push({
          id: uid('clue'), content: '', plantedChapter: null, plannedPayoffChapter: null,
          actualPayoffChapter: null, status: 'planned',
        }))}>手工新增</button>
        <button className="primary" disabled={busy || !hasKey} onClick={() => void generate('foreshadow')}>
          {busy ? '生成中…' : 'AI 生成伏笔'}
        </button>
      </div>
      <div className="asset-list">{project.foreshadowing.map((item, index) =>
        <ClueRow key={item.id} value={item}
          change={(key, value) => update(next => {
            (next.foreshadowing[index] as unknown as Record<string, unknown>)[key] = value;
          })}
          remove={() => update(next => { next.foreshadowing.splice(index, 1); })} />)}
      </div>
    </Section>}
    {note && <p className={note.startsWith('生成失败') ? 'notice error' : 'notice'}>{note}</p>}
  </div>;
}

function CharacterRow({ value, change, remove }: {
  value: Character;
  change: (key: keyof Character, value: string) => void;
  remove: () => void;
}) {
  return <div className="asset-card character-card">
    <input placeholder="姓名" value={value.name} onChange={e => change('name', e.target.value)} />
    <input placeholder="身份" value={value.identity} onChange={e => change('identity', e.target.value)} />
    <input placeholder="欲望" value={value.desire} onChange={e => change('desire', e.target.value)} />
    <input placeholder="缺陷" value={value.flaw} onChange={e => change('flaw', e.target.value)} />
    <textarea placeholder="人物关系" value={value.relationships} onChange={e => change('relationships', e.target.value)} />
    <textarea placeholder="语言习惯" value={value.voice} onChange={e => change('voice', e.target.value)} />
    <textarea placeholder="能力与行为边界" value={value.boundaries} onChange={e => change('boundaries', e.target.value)} />
    <textarea placeholder="人物弧光" value={value.arc} onChange={e => change('arc', e.target.value)} />
    <button className="danger" onClick={remove}>删除</button>
  </div>;
}

function WorldRow({ value, change, remove }: {
  value: WorldItem;
  change: (key: keyof WorldItem, value: string) => void;
  remove: () => void;
}) {
  return <div className="asset-card">
    <select value={value.type} onChange={e => change('type', e.target.value)}>
      <option value="rule">规则</option><option value="location">地点</option>
      <option value="item">物品</option><option value="timeline">时间线</option>
    </select>
    <input value={value.name} onChange={e => change('name', e.target.value)} />
    <textarea value={value.content} onChange={e => change('content', e.target.value)} />
    <button className="danger" onClick={remove}>删除</button>
  </div>;
}

function ClueRow({ value, change, remove }: {
  value: Foreshadowing;
  change: (key: keyof Foreshadowing, value: unknown) => void;
  remove: () => void;
}) {
  return <div className="asset-card">
    <textarea value={value.content} onChange={e => change('content', e.target.value)} />
    <input type="number" placeholder="埋设章" value={value.plantedChapter || ''}
      onChange={e => change('plantedChapter', Number(e.target.value) || null)} />
    <input type="number" placeholder="回收章" value={value.plannedPayoffChapter || ''}
      onChange={e => change('plannedPayoffChapter', Number(e.target.value) || null)} />
    <select value={value.status} onChange={e => change('status', e.target.value)}>
      <option value="planned">计划</option><option value="planted">已埋</option><option value="paid">已回收</option>
    </select>
    <button className="danger" onClick={remove}>删除</button>
  </div>;
}
