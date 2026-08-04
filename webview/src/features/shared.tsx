import { ReactNode, useState } from 'react';
import { Chapter, OptionCandidate, ProjectData } from '@tomato-writer/core';

export type UpdateProject = (change: (project: ProjectData) => void) => void;

/** 多选写回 string 字段的统一约定：用「、」拼接。 */
export const joinCn = (items: string[]): string =>
  [...new Set(items.map(item => item.trim()).filter(Boolean))].join('、');

/** joinCn 的反解：兼容用户手输的英文逗号、中文逗号与顿号。 */
export const splitCn = (value: string): string[] =>
  value.split(/[,，、]/).map(item => item.trim()).filter(Boolean);

/** 自定义项标记：EnumSelect 中「自定义…」选项的哨兵值。 */
const CUSTOM = '__custom__';

export const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const statusName: Record<Chapter['status'], string> = {
  planned: '待写',
  generating: '生成中',
  reviewing: '待审批',
  approved: '已批准',
  completed: '已完成',
};

export const GENRE_OPTIONS: Record<ProjectData['planning']['genreTrack'], { label: string; items: string[] }[]> = {
  male: [
    { label: '都市与现实', items: ['都市脑洞', '都市日常', '都市异能', '职场商战', '技术流', '娱乐圈', '乡村生活', '现实题材'] },
    { label: '历史与战争', items: ['历史架空', '朝堂权谋', '科举仕途', '战争军事', '争霸种田', '谍战特工'] },
    { label: '玄幻与仙侠', items: ['东方玄幻', '异世大陆', '高武世界', '传统武侠', '修仙', '凡人流', '御兽', '灵气复苏'] },
    { label: '科幻与冒险', items: ['科幻', '星际文明', '末世求生', '赛博朋克', '游戏竞技', '电子竞技', '无限流', '探险'] },
  ],
  female: [
    { label: '现代情感', items: ['现代言情', '都市婚恋', '先婚后爱', '破镜重圆', '久别重逢', '职场成长', '娱乐圈', '豪门世家'] },
    { label: '女性成长', items: ['女性成长', '现实生活', '家庭伦理', '年代生活', '创业经商', '大女主', '群像成长'] },
    { label: '古代题材', items: ['古代言情', '宫斗宅斗', '朝堂权谋', '种田经商', '医术药香', '穿越古代', '重生复仇', '探案言情'] },
    { label: '幻想题材', items: ['仙侠言情', '玄幻言情', '奇幻言情', '兽世', '末世言情', '科幻言情', '悬疑言情', '无限流'] },
  ],
  mystery: [
    { label: '推理与刑侦', items: ['悬疑推理', '本格推理', '社会派推理', '刑侦破案', '法医探案', '律师调查', '密室谜案', '历史谜案'] },
    { label: '心理与社会', items: ['心理悬疑', '社会悬疑', '家庭悬疑', '职场悬疑', '都市怪谈', '谍战悬疑'] },
    { label: '惊悚与幻想', items: ['民俗悬疑', '惊悚', '规则怪谈', '无限流', '科幻悬疑', '末世悬疑', '反转短篇', '冒险解谜'] },
  ],
};

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return <section className="card">
    <div className="section-title"><h2>{title}</h2>{hint && <span>{hint}</span>}</div>
    {children}
  </section>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

/**
 * 多选胶囊：受控组件，点选/取消由调用方通过 onChange 落库。
 *
 * - `options` 为预设池；`selected` 中不在池内的值会自动追加到尾部展示，保证用户自定义项可见可取消。
 * - `max` 达上限后未选中项禁用（R9 上限 2）；不传则不限（R5）。
 * - `allowCustom` 在末尾提供「＋自定义」输入，回车追加。
 */
export function ChipMultiSelect({ options, selected, onChange, max, allowCustom = true, placeholder }: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  max?: number;
  allowCustom?: boolean;
  placeholder?: string;
}) {
  const [custom, setCustom] = useState('');
  const picked = new Set(selected);
  const extras = selected.filter(item => !options.includes(item));
  const all = [...options, ...extras];
  const full = typeof max === 'number' && selected.length >= max;

  const toggle = (item: string) => {
    if (picked.has(item)) return onChange(selected.filter(value => value !== item));
    if (full) return;
    onChange([...selected, item]);
  };

  const addCustom = () => {
    const values = splitCn(custom).filter(item => !picked.has(item));
    if (!values.length) return setCustom('');
    const room = typeof max === 'number' ? Math.max(0, max - selected.length) : values.length;
    if (room > 0) onChange([...selected, ...values.slice(0, room)]);
    setCustom('');
  };

  return <div className="chip-block">
    <div className="chip-row">
      {all.map(item => <button
        type="button"
        key={item}
        className={picked.has(item) ? 'chip selected' : 'chip'}
        disabled={full && !picked.has(item)}
        onClick={() => toggle(item)}
      >{item}</button>)}
      {!all.length && <span className="chip-empty">该分轨暂无预设，请用右侧自定义添加</span>}
    </div>
    {allowCustom && <div className="chip-custom">
      <input
        value={custom}
        placeholder={placeholder || '自定义，回车添加（可用顿号分隔多个）'}
        disabled={full}
        onChange={event => setCustom(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addCustom(); } }}
      />
      <button type="button" disabled={full || !custom.trim()} onClick={addCustom}>＋ 添加</button>
    </div>}
  </div>;
}

/**
 * 枚举下拉：受控组件，末尾固定提供「自定义…」兜底。
 * 当前值不在枚举内时自动切到自定义模式并展开输入框（回显逻辑对齐现有细分题材写法）。
 */
export function EnumSelect({ options, value, onChange, placeholder }: {
  options: string[];
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  // 空值走「未选择」；非空且不在枚举内则自动切到自定义模式。
  // 另用本地 flag 记住「用户主动选了自定义…」，避免刚切过去、还没输入就被空值弹回。
  const [manual, setManual] = useState(false);
  const custom = manual || (value !== '' && !options.includes(value));
  return <div className="enum-select">
    <select
      value={custom ? CUSTOM : value}
      onChange={event => {
        const next = event.target.value;
        setManual(next === CUSTOM);
        onChange(next === CUSTOM ? '' : next);
      }}
    >
      <option value="">未选择</option>
      {options.map(item => <option value={item} key={item}>{item}</option>)}
      <option value={CUSTOM}>自定义…</option>
    </select>
    {custom && <input
      value={value}
      placeholder={placeholder || '填写自定义取值'}
      onChange={event => onChange(event.target.value)}
    />}
  </div>;
}

/**
 * AI 候选卡片面板：**纯展示、零业务**，不感知 project、不调 RPC。
 *
 * - `mode='multi'`：点选=追加/取消，选中态由 `selected` 回显，去重由调用方负责；
 * - `mode='single'`：点选=填入，「已有内容需二次确认」也由调用方负责；
 * - `onMore` 不传则不渲染「再来一批」。
 */
export function CandidateCards({ options, mode, selected = [], onToggle, onPick, onMore, onSelectAll, busy = false }: {
  options: OptionCandidate[];
  mode: 'multi' | 'single';
  selected?: string[];
  onToggle?: (option: OptionCandidate) => void;
  onPick?: (option: OptionCandidate) => void;
  onMore?: () => void;
  onSelectAll?: () => void;
  busy?: boolean;
}) {
  if (!options.length) return <p className="notice">没生成出候选，换个上游信息再试</p>;
  const picked = new Set(selected);
  return <div className="candidate-panel">
    <div className="candidate-grid">
      {options.map((option, index) => {
        const on = mode === 'multi' && picked.has(option.label);
        return <button
          type="button"
          key={`${option.label}-${index}`}
          className={on ? 'candidate-card selected' : 'candidate-card'}
          disabled={busy}
          onClick={() => (mode === 'multi' ? onToggle?.(option) : onPick?.(option))}
        >
          <strong>{option.label}</strong>
          {option.note && <span className="candidate-note">{option.note}</span>}
          {on && <span className="candidate-flag">已采纳</span>}
        </button>;
      })}
    </div>
    <div className="toolbar">
      {onMore && <button type="button" disabled={busy} onClick={onMore}>
        {busy ? 'AI 生成中…' : '再来一批'}
      </button>}
      {mode === 'multi' && onSelectAll && <button type="button" disabled={busy} onClick={onSelectAll}>
        全选采纳
      </button>}
    </div>
  </div>;
}
