import { describe, expect, it } from 'vitest';
import { parseOptionCandidates, type EmotionalBeat } from '../packages/core/src';

/** 造 n 条结构完整的情绪节拍，用于测试单套方案的条数边界。 */
const beats = (n: number): EmotionalBeat[] =>
  Array.from({ length: n }, (_, index) => ({
    chapters: `${index + 1}`,
    emotion: '悬',
    triggerEvent: `事件${index + 1}`,
  }));

const labels = (rows: { label: string }[]) => rows.map(row => row.label);

describe('parseOptionCandidates：候选校验的唯一收敛点', () => {
  describe('beats：单套 4~8 条边界，越界整套丢弃', () => {
    it('保留 4 条与 8 条的下上边界方案', () => {
      const result = parseOptionCandidates('beats', [
        { label: '下边界', value: beats(4) },
        { label: '上边界', value: beats(8) },
      ], 5);
      expect(labels(result)).toEqual(['下边界', '上边界']);
      expect(result[0].value).toHaveLength(4);
      expect(result[1].value).toHaveLength(8);
    });

    it('3 条与 9 条越界的方案被整套丢弃，其余照常返回', () => {
      const result = parseOptionCandidates('beats', [
        { label: '太少', value: beats(3) },
        { label: '刚好', value: beats(6) },
        { label: '太多', value: beats(9) },
      ], 5);
      expect(labels(result)).toEqual(['刚好']);
    });

    it('单条节拍字段缺失时整套丢弃，而不是只丢那一条', () => {
      const broken = [...beats(5)];
      broken[2] = { chapters: '3', emotion: '悬', triggerEvent: '   ' } as EmotionalBeat;
      const result = parseOptionCandidates('beats', [
        { label: '含残条', value: broken },
        { label: '完好', value: beats(5) },
      ], 5);
      expect(labels(result)).toEqual(['完好']);
      expect(result[0].value).toHaveLength(5);
    });

    it('兼容 beats/plan 别名与裸数组，并为无 label 的方案补默认名', () => {
      const result = parseOptionCandidates('beats', [
        { label: '别名 beats', beats: beats(4) },
        { plan: beats(5) },
        beats(6),
      ], 5);
      expect(labels(result)).toEqual(['别名 beats', '方案2', '方案3']);
    });

    it('内容完全相同的两套方案按结构去重', () => {
      const result = parseOptionCandidates('beats', [
        { label: '甲', value: beats(4) },
        { label: '乙', value: beats(4) },
      ], 5);
      expect(labels(result)).toEqual(['甲']);
    });
  });

  describe('label：trim、去空与去重', () => {
    it('字符串候选先 trim 再去空、去重，保持首次出现顺序', () => {
      const result = parseOptionCandidates('tags', ['  逆袭 ', '逆袭', '', '   ', '系统'], 6);
      expect(labels(result)).toEqual(['逆袭', '系统']);
    });

    it('跨字段别名取到的同名 label 同样去重', () => {
      const result = parseOptionCandidates('targetReaders', [
        { label: '学生党' }, { title: '学生党' }, { text: ' 学生党 ' }, { name: '甜宠党' },
      ], 6);
      expect(labels(result)).toEqual(['学生党', '甜宠党']);
    });

    it('按 count 截断，且保留非空 note', () => {
      const result = parseOptionCandidates('titles', [
        { label: '书名一', note: ' 钩子强 ' }, { label: '书名二', note: '   ' }, { label: '书名三' },
      ], 2);
      expect(labels(result)).toEqual(['书名一', '书名二']);
      expect(result[0].note).toBe('钩子强');
      expect(result[1].note).toBeUndefined();
    });
  });

  describe('非法结构：丢弃而非抛错', () => {
    it('缺 label、类型不符的行被静默丢弃，合格项照常返回', () => {
      const result = parseOptionCandidates('titles', [
        { note: '只有备注' }, 42, null, [], { label: '  ' }, { label: '唯一合格书名' },
      ], 6);
      expect(labels(result)).toEqual(['唯一合格书名']);
    });

    it('label 超长（>120）被丢弃', () => {
      const result = parseOptionCandidates('sellingPoints', [
        'A'.repeat(121), 'B'.repeat(120),
      ], 6);
      expect(labels(result)).toEqual(['B'.repeat(120)]);
    });

    it('beats 的 value 类型错（非数组）被丢弃而非抛错', () => {
      const result = parseOptionCandidates('beats', [
        { label: '字符串 value', value: '不是数组' },
        { label: '对象 value', value: { chapters: '1' } },
        { label: '数组含非对象', value: ['文本', ...beats(3)] },
        { label: '合格', value: beats(4) },
      ], 5);
      expect(labels(result)).toEqual(['合格']);
    });

    it('从 options / candidates 信封中取数组', () => {
      expect(labels(parseOptionCandidates('tags', { options: ['系统'] }, 6))).toEqual(['系统']);
      expect(labels(parseOptionCandidates('tags', { candidates: ['逆袭'] }, 6))).toEqual(['逆袭']);
    });

    it('无候选数组或全部不合格时抛出可重试错误', () => {
      expect(() => parseOptionCandidates('tags', { ok: true }, 6)).toThrow('模型没有返回候选');
      expect(() => parseOptionCandidates('tags', ['', '   '], 6)).toThrow('模型没有返回候选');
      expect(() => parseOptionCandidates('beats', [{ label: '空', value: beats(2) }], 5))
        .toThrow('模型没有返回候选');
    });
  });
});
