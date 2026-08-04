import { ReactNode, useState } from 'react';
import {
  CONFLICT_TYPES, conflictSeedText, conflictType, EMOTION_POOL, EmotionalBeat, emotionSeedText,
  GenerateOptionsKind, genreTactic, isRecord, OptionCandidate, poolOf, ProjectData, READER_POOL,
  STYLE_ENUMS, TAG_POOL,
} from '@tomato-writer/core';
import { hostClient } from '../hostClient';
import {
  CandidateCards, ChipMultiSelect, EnumSelect, Field, GENRE_OPTIONS, joinCn, Section, splitCn,
  UpdateProject,
} from './shared';
import { useOptionCandidates } from './useOptionCandidates';

const stringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

const CONFLICT_VALUES = CONFLICT_TYPES.map(item => item.value);

export function PlanningFeature({ project, update, hasKey }: {
  project: ProjectData;
  update: UpdateProject;
  hasKey: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [subtypeBusy, setSubtypeBusy] = useState(false);
  const [subtypeHint, setSubtypeHint] = useState('');
  const [tacticOpen, setTacticOpen] = useState(false);
  const planning = project.planning;
  const styleProfile = project.styleProfile;
  const tactic = genreTactic(planning.genre);
  const genreGroups = GENRE_OPTIONS[planning.genreTrack];
  const knownGenre = genreGroups.some(group => group.items.includes(planning.genre));
  const emotionPool = poolOf(EMOTION_POOL, planning.genreTrack);

  // R5 情绪原型是 emotionalGoal 的输入辅助，本身不落库；从已有文案里回显一次即可。
  const [emotionPicks, setEmotionPicks] = useState<string[]>(
    () => emotionPool.filter(item => planning.emotionalGoal.includes(item)),
  );
  // 记录上一次由胶囊写入的种子文案，用于判断 textarea 是否已被用户手改。
  const [emotionSeed, setEmotionSeed] = useState('');

  const { candidates, busyKind, error, ask, more, clear } = useOptionCandidates(project);

  const plan = (key: keyof ProjectData['planning'], value: unknown) => update(next => {
    (next.planning as unknown as Record<string, unknown>)[key] = value;
    if (key === 'title' && typeof value === 'string') next.name = value;
  });
  const style = (key: keyof ProjectData['styleProfile'], value: unknown) => update(next => {
    (next.styleProfile as unknown as Record<string, unknown>)[key] = value;
  });

  /** R10 触发门槛：上游六项中至少一项非空，否则模型没有可依据的信息。 */
  const canAsk = [
    planning.genre, planning.targetReader, planning.tags.join(''),
    planning.coreConflictType || '', planning.sellingPoint, planning.synopsis,
  ].some(item => item.trim());
  // A5：无 Key 的提示优先于信息不足的提示。
  const askHint = !hasKey
    ? '需在 AI 设置中配置 API Key'
    : canAsk ? '' : '请先选择题材或至少填一项上游信息';

  /**
   * R3/R4：选中冲突类型后，仅当核心冲突正文为空时写入种子前缀，绝不覆盖已有文本。
   * 清空时删除整个键（而不是写 ''），维持全链路「空值即键不存在」的约定。
   */
  const pickConflictType = (value: string) => update(next => {
    const picked = value.trim();
    if (!picked) {
      delete next.planning.coreConflictType;
      return;
    }
    next.planning.coreConflictType = picked;
    const seed = conflictSeedText(picked);
    if (seed && !next.planning.coreConflict.trim()) next.planning.coreConflict = seed;
  });

  /** R5：情绪原型 → 种子文案。用户手改过就只保留，不再覆盖。 */
  const pickEmotions = (picked: string[]) => {
    setEmotionPicks(picked);
    const seed = emotionSeedText(picked);
    update(next => {
      const current = next.planning.emotionalGoal.trim();
      if (!current || current === emotionSeed.trim()) next.planning.emotionalGoal = seed;
    });
    setEmotionSeed(seed);
  };

  /**
   * R11/R12/R14 + R13/R15/R16 的统一渲染：AI 按钮 + 候选面板。
   * 组件只做展示与门控，写回逻辑由各字段自己的 onToggle/onPick 决定。
   */
  const aiOptions = (
    kind: GenerateOptionsKind,
    label: string,
    mode: 'multi' | 'single',
    handlers: {
      selected?: string[];
      adopted?: string[];
      onToggle?: (option: OptionCandidate) => void;
      onPick?: (option: OptionCandidate) => void;
      onSelectAll?: () => void;
    },
  ): ReactNode => {
    const busyHere = busyKind === kind;
    const options = candidates[kind];
    return <div className="candidate-block">
      <div className="field-actions">
        <button type="button" disabled={!hasKey || busyKind !== null || !canAsk} onClick={() => ask(kind)}>
          {busyHere ? 'AI 生成中…' : label}
        </button>
        {options && <button type="button" disabled={busyHere} onClick={() => clear(kind)}>收起候选</button>}
        {askHint && <span className="notice">{askHint}</span>}
      </div>
      {options && <CandidateCards
        options={options}
        mode={mode}
        busy={busyHere}
        selected={handlers.selected}
        onToggle={handlers.onToggle}
        onPick={handlers.onPick}
        onSelectAll={handlers.onSelectAll}
        onMore={() => more(kind, handlers.adopted ?? handlers.selected ?? [])}
      />}
    </div>;
  };

  const recommendSubtype = async () => {
    if (!hasKey) return setSubtypeHint('请先在已有项目的 AI 设置中配置 API Key');
    setSubtypeBusy(true);
    setSubtypeHint('');
    try {
      const concept = planning.synopsis || planning.sellingPoint || project.name || '一个普通人的离谱日常';
      const data = await hostClient.request('recommendSubtype', {
        concept,
        genreTrack: planning.genreTrack,
      });
      if (!isRecord(data) || typeof data.genre !== 'string') throw new Error('推荐字段不完整');
      plan('genre', data.genre);
      setSubtypeHint(
        `AI 推荐：题材「${data.genre}」· 写法「${data.subtype || '—'}」· 风格轴「${data.styleAxis || '—'}」。${data.why || ''}（可手改下方细分题材）`,
      );
    } catch (failure) {
      setSubtypeHint(failure instanceof Error ? failure.message : '推荐失败，请重试');
    } finally {
      setSubtypeBusy(false);
    }
  };

  const strengthen = async () => {
    setBusy(true);
    try {
      const data = await hostClient.request('strengthenPlanning', { project });
      if (!isRecord(data)) throw new Error('策划字段不完整');
      update(next => Object.assign(next.planning, {
        genre: typeof data.genre === 'string' ? data.genre : next.planning.genre,
        targetReader: typeof data.targetReader === 'string' ? data.targetReader : next.planning.targetReader,
        tags: stringArray(data.tags) ? data.tags : next.planning.tags,
        sellingPoint: typeof data.sellingPoint === 'string' ? data.sellingPoint : next.planning.sellingPoint,
        synopsis: typeof data.synopsis === 'string' ? data.synopsis : next.planning.synopsis,
        coreConflict: typeof data.coreConflict === 'string' ? data.coreConflict : next.planning.coreConflict,
        emotionalGoal: typeof data.emotionalGoal === 'string' ? data.emotionalGoal : next.planning.emotionalGoal,
        titleCandidates: stringArray(data.titleCandidates) ? data.titleCandidates : [],
        emotionalBeats: Array.isArray(data.emotionalBeats) ? data.emotionalBeats : [],
      }));
      setNote(`策划已补强，并保存 ${stringArray(data.titleCandidates) ? data.titleCandidates.length : 0} 个标题候选`);
    } catch (failure) {
      setNote(failure instanceof Error ? failure.message : '生成失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  const deriveStyle = async () => {
    if (!planning.genre.trim()) return setNote('请先在策划中填写题材');
    setBusy(true);
    try {
      const generated = await hostClient.request('deriveStyle', { project });
      update(next => Object.assign(next.styleProfile, generated));
      setNote('文风档案已按题材生成并保存');
    } catch (failure) {
      setNote(failure instanceof Error ? failure.message : '生成失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  const selectedConflict = conflictType(planning.coreConflictType || '');

  return <div className="content-grid">
    <Section title="本书策划" hint="核心字段可纯点选完成，无需 API Key">
      <div className="form-grid">
        <Field label="题材分轨">
          <select value={planning.genreTrack} onChange={event => plan('genreTrack', event.target.value)}>
            <option value="male">男频</option><option value="female">女频</option><option value="mystery">悬疑</option>
          </select>
        </Field>
        <Field label="细分题材">
          <select value={knownGenre ? planning.genre : '__custom__'} onChange={event =>
            plan('genre', event.target.value === '__custom__' ? '' : event.target.value)}>
            {genreGroups.map(group => <optgroup label={group.label} key={group.label}>
              {group.items.map(item => <option value={item} key={item}>{item}</option>)}
            </optgroup>)}
            <option value="__custom__">其他 / 自定义题材…</option>
          </select>
        </Field>
        {!knownGenre && <Field label="自定义细分题材">
          <input value={planning.genre} onChange={event => plan('genre', event.target.value)}
            placeholder="例如：非遗美食经营、航空职场" />
        </Field>}
        <Field label="书名"><input value={planning.title} onChange={event => plan('title', event.target.value)} /></Field>
        <Field label="目标字数"><input type="number" value={planning.targetWords}
          onChange={event => plan('targetWords', Number(event.target.value))} /></Field>
      </div>

      {/* R17：策略卡摘要紧贴细分题材，辅助后面选读者与标签；完整卡片折叠保留 */}
      {tactic && <>
        <p className="tactic-brief">
          <strong>写法核心：</strong>{tactic.core}<br />
          <strong>书名公式：</strong>{tactic.title}
        </p>
        <div className="field-actions">
          <button type="button" onClick={() => setTacticOpen(!tacticOpen)}>
            {tacticOpen ? '收起题材策略卡' : '展开题材策略卡'}
          </button>
        </div>
        {tacticOpen && <Section title="题材策略卡" hint="选定细分题材后显示写法打法">
          <p><strong>写法核心：</strong>{tactic.core}</p>
          <p><strong>首句结构（动作 / 冲突 / 反常）：</strong></p>
          <ul>{tactic.openings.map((opening, index) => <li key={index}>{opening}</li>)}</ul>
          <p><strong>书名公式：</strong>{tactic.title}</p>
          <p><strong>推荐字数：</strong>{tactic.words} ｜ <strong>对话比：</strong>{tactic.dialogue} ｜ <strong>风格轴：</strong>{tactic.styleAxis}</p>
          <p><strong>常见 3 坑：</strong></p>
          <ul>{tactic.pitfalls.map((pitfall, index) => <li key={index}>{pitfall}</li>)}</ul>
        </Section>}
      </>}

      <div className="toolbar">
        <button className="primary" disabled={!hasKey || subtypeBusy} onClick={recommendSubtype}>
          {subtypeBusy ? 'AI 推荐中…' : 'AI 推荐子类型'}
        </button>
        {subtypeHint && <span className="notice">{subtypeHint}</span>}
      </div>

      {/* R11 书名候选：AI 卡片多选追加去重 */}
      <Field label="书名候选（每行一个）"><textarea value={planning.titleCandidates.join('\n')}
        onChange={event => plan('titleCandidates', event.target.value.split('\n').map(x => x.trim()).filter(Boolean))} /></Field>
      {aiOptions('titles', 'AI 生成书名候选', 'multi', {
        selected: planning.titleCandidates,
        onToggle: option => {
          const exists = planning.titleCandidates.includes(option.label);
          plan('titleCandidates', exists
            ? planning.titleCandidates.filter(item => item !== option.label)
            : [...planning.titleCandidates, option.label]);
        },
        onSelectAll: () => plan('titleCandidates', [
          ...new Set([...planning.titleCandidates, ...(candidates.titles ?? []).map(item => item.label)]),
        ]),
      })}

      {/* R1 目标读者：多选胶囊 +「、」拼接写回 string */}
      <Field label="目标读者（可多选，自动以「、」拼接）">
        <ChipMultiSelect
          options={poolOf(READER_POOL, planning.genreTrack)}
          selected={splitCn(planning.targetReader)}
          onChange={next => plan('targetReader', joinCn(next))}
          placeholder="自定义读者画像，回车添加"
        />
      </Field>
      {aiOptions('targetReaders', 'AI 给读者画像灵感', 'multi', {
        selected: splitCn(planning.targetReader),
        onToggle: option => {
          const current = splitCn(planning.targetReader);
          const exists = current.includes(option.label);
          plan('targetReader', joinCn(exists
            ? current.filter(item => item !== option.label)
            : [...current, option.label]));
        },
        onSelectAll: () => plan('targetReader', joinCn([
          ...splitCn(planning.targetReader), ...(candidates.targetReaders ?? []).map(item => item.label),
        ])),
      })}

      {/* R2 内容标签：多选胶囊，本就是 string[]，直接映射 */}
      <Field label="内容标签（可多选）">
        <ChipMultiSelect
          options={poolOf(TAG_POOL, planning.genreTrack)}
          selected={planning.tags}
          onChange={next => plan('tags', next)}
          placeholder="自定义标签，回车添加"
        />
      </Field>
      {aiOptions('tags', 'AI 给标签灵感', 'multi', {
        selected: planning.tags,
        onToggle: option => {
          const exists = planning.tags.includes(option.label);
          plan('tags', exists
            ? planning.tags.filter(item => item !== option.label)
            : [...planning.tags, option.label]);
        },
        onSelectAll: () => plan('tags', [
          ...new Set([...planning.tags, ...(candidates.tags ?? []).map(item => item.label)]),
        ]),
      })}

      {/* R12 一句话卖点：AI 卡片单选填入，覆盖前二次确认 */}
      <Field label="一句话卖点（25–40字）"><textarea value={planning.sellingPoint}
        onChange={event => plan('sellingPoint', event.target.value)} /></Field>
      {aiOptions('sellingPoints', 'AI 生成卖点候选', 'single', {
        onPick: option => {
          if (planning.sellingPoint.trim() && !window.confirm('将覆盖现有一句话卖点，确认？')) return;
          plan('sellingPoint', option.label);
        },
      })}

      <Field label="故事梗概"><textarea rows={8} value={planning.synopsis}
        onChange={event => plan('synopsis', event.target.value)} /></Field>

      {/* R3 核心冲突类型：单选枚举 + 自定义兜底 */}
      <Field label="核心冲突类型">
        <EnumSelect
          options={CONFLICT_VALUES}
          value={planning.coreConflictType || ''}
          onChange={pickConflictType}
          placeholder="自定义冲突类型"
        />
      </Field>
      {selectedConflict?.hint && <p className="chip-hint">{selectedConflict.hint}</p>}

      <div className="form-grid">
        <Field label="核心冲突"><textarea rows={8} value={planning.coreConflict}
          onChange={event => plan('coreConflict', event.target.value)} /></Field>
        <Field label="情绪目标概述"><textarea rows={8} value={planning.emotionalGoal}
          onChange={event => plan('emotionalGoal', event.target.value)} /></Field>
      </div>

      {/* R5 情绪原型：选中后生成种子文案写入情绪目标（不覆盖手改内容） */}
      <Field label="情绪原型（建议 2~3 项，点选后自动生成情绪目标草稿）">
        <ChipMultiSelect
          options={emotionPool}
          selected={emotionPicks}
          onChange={pickEmotions}
          placeholder="自定义情绪原型，回车添加"
        />
      </Field>

      {/* R14 情绪节拍：AI 返回 2~3 套，单选整套覆盖（Q5） */}
      <Field label="可执行情绪节拍（章节｜情绪｜触发事件）">
        <textarea rows={7} value={planning.emotionalBeats.map(
          beat => `${beat.chapters}｜${beat.emotion}｜${beat.triggerEvent}`,
        ).join('\n')} onChange={event => plan('emotionalBeats', event.target.value.split('\n')
          .filter(Boolean).map(row => {
            const [chapters = '', emotion = '', triggerEvent = ''] = row.split('｜');
            return { chapters, emotion, triggerEvent };
          }))} />
      </Field>
      {aiOptions('beats', 'AI 生成节拍方案', 'single', {
        onPick: option => {
          const beats = option.value as EmotionalBeat[] | undefined;
          if (!Array.isArray(beats) || !beats.length) return setNote('该方案结构不完整，换一套试试');
          if (planning.emotionalBeats.length &&
            !window.confirm('节拍方案是整体设计，采纳将覆盖现有全部节拍，确认？')) return;
          plan('emotionalBeats', beats);
          setNote(`已采纳节拍方案「${option.label}」，共 ${beats.length} 条`);
        },
      })}

      {error && <p className="notice">{error}</p>}
      <button className="primary" disabled={!hasKey || busy} onClick={strengthen}>
        {busy ? 'AI 生成中…' : 'AI 补强策划案'}
      </button>
      {note && <p className="notice">{note}</p>}
    </Section>

    <Section title="本书文风档案" hint="每本书独立定义">
      <div className="toolbar"><button className="primary" disabled={busy || !hasKey} onClick={deriveStyle}>
        {busy ? 'AI 生成中…' : '按题材推导文风'}
      </button></div>
      <div className="form-grid">
        {/* R6 / R7 / R8：改为枚举下拉 + 自定义兜底 */}
        <Field label="叙事视角">
          <EnumSelect options={STYLE_ENUMS.perspective} value={styleProfile.perspective}
            onChange={next => style('perspective', next)} />
        </Field>
        <Field label="节奏">
          <EnumSelect options={STYLE_ENUMS.pace} value={styleProfile.pace}
            onChange={next => style('pace', next)} />
        </Field>
        <Field label="句式长度">
          <EnumSelect options={STYLE_ENUMS.sentenceLength} value={styleProfile.sentenceLength}
            onChange={next => style('sentenceLength', next)} />
        </Field>
        <Field label={`对话目标 ${styleProfile.dialogueRatio}%`}><input type="range" min="10" max="80"
          value={styleProfile.dialogueRatio} onChange={event => style('dialogueRatio', Number(event.target.value))} /></Field>
      </div>
      {/* R9：情绪原型多选，最多 2 项，「、」拼接写回 string */}
      <Field label="目标情绪（最多 2 项）">
        <ChipMultiSelect
          options={emotionPool}
          selected={splitCn(styleProfile.emotion)}
          onChange={next => style('emotion', joinCn(next))}
          max={2}
          placeholder="自定义目标情绪，回车添加"
        />
      </Field>
      <Field label="主角语言习惯"><textarea value={styleProfile.protagonistVoice}
        onChange={event => style('protagonistVoice', event.target.value)} /></Field>
      <div className="form-grid">
        <Field label="禁用词（逗号分隔）"><textarea value={styleProfile.bannedWords.join(',')}
          onChange={event => style('bannedWords', event.target.value.split(/[,，]/).map(x => x.trim()).filter(Boolean))} /></Field>
        <Field label="禁用套路（每行一项）"><textarea value={styleProfile.bannedPatterns.join('\n')}
          onChange={event => style('bannedPatterns', event.target.value.split('\n').filter(Boolean))} /></Field>
      </div>
      <Field label="认可的参考正文（用 --- 分隔）"><textarea rows={8}
        value={styleProfile.referenceSamples.join('\n---\n')}
        onChange={event => style('referenceSamples', event.target.value.split(/\n---\n/).filter(Boolean))} /></Field>
      <div className="subsection-title"><strong>反例样本</strong>
        <button onClick={() => update(next => next.styleProfile.negativeSamples.push({ text: '', reason: '' }))}>新增反例</button>
      </div>
      {styleProfile.negativeSamples.map((sample, index) => <div className="negative-sample" key={index}>
        <textarea placeholder="不希望出现的文本" value={sample.text}
          onChange={event => update(next => { next.styleProfile.negativeSamples[index].text = event.target.value; })} />
        <textarea placeholder="不采用的原因" value={sample.reason}
          onChange={event => update(next => { next.styleProfile.negativeSamples[index].reason = event.target.value; })} />
        <button className="danger" onClick={() => update(next => { next.styleProfile.negativeSamples.splice(index, 1); })}>删除</button>
      </div>)}
    </Section>
  </div>;
}
