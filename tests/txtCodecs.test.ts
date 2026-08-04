import { describe, expect, it } from 'vitest';
import {
  decodeCharacterTxt,
  decodeForeshadowingTxt,
  decodeOutlineDocumentTxt,
  decodePlanningTxt,
  decodeStyleProfileTxt,
  decodeWorldTxt,
  encodeCharacterTxt,
  encodeForeshadowingTxt,
  encodeOutlineTxt,
  encodePlanningTxt,
  encodeStyleProfileTxt,
  encodeWorldTxt,
  type Character,
  type Foreshadowing,
  type OutlineNode,
  type Planning,
  type StyleProfile,
  type WorldItem,
} from '../packages/core/src';

describe('易读 TXT 编解码', () => {
  it('策划和文风可无损往返中文、多行与特殊区块文本', () => {
    const planning: Planning = {
      schemaVersion: 2,
      genreTrack: 'male',
      genre: '都市脑洞',
      targetReader: '成年读者',
      sellingPoint: '一句卖点',
      title: '午夜故障单',
      titleCandidates: ['候选一', '候选二'],
      tags: ['技术流', '悬疑'],
      synopsis: '第一行\n【伪区块】\n第三行',
      coreConflict: '阻止事故',
      emotionalGoal: '紧张',
      emotionalBeats: [{ chapters: '1-2', emotion: '怀疑', triggerEvent: '故障应验' }],
      targetWords: 40000,
    };
    expect(decodePlanningTxt(encodePlanningTxt(planning))).toEqual(planning);

    const style: StyleProfile = {
      schemaVersion: 2,
      perspective: '限制性第三人称',
      pace: '快节奏',
      emotion: '紧张',
      dialogueRatio: 35,
      sentenceLength: '短句优先',
      protagonistVoice: '克制\n准确',
      bannedWords: ['陡然', '命运齿轮'],
      bannedPatterns: ['硬拗金句'],
      referenceSamples: ['样本一\n第二行', '【样本内标题】'],
      negativeSamples: [{ text: '反例正文\n第二行', reason: '过度总结' }],
    };
    expect(decodeStyleProfileTxt(encodeStyleProfileTxt(style))).toEqual(style);
  });

  it('新增“核心冲突类型”可往返，且旧格式缺该段仍可解析', () => {
    const planning: Planning = {
      schemaVersion: 2,
      genreTrack: 'mystery',
      genre: '规则怪谈',
      targetReader: '硬核推理迷、怪谈猎奇向',
      sellingPoint: '一句卖点',
      title: '第七条规则',
      titleCandidates: ['候选一'],
      tags: ['规则怪谈', '反转'],
      synopsis: '梗概',
      coreConflict: '【人vs系统】主角与规则博弈',
      coreConflictType: '人vs系统',
      emotionalGoal: '悬、细思极恐',
      emotionalBeats: [{ chapters: '1-2', emotion: '悬', triggerEvent: '第七条规则出现' }],
      targetWords: 40000,
    };
    const encoded = encodePlanningTxt(planning);
    expect(encoded).toContain('【核心冲突类型】');
    expect(decodePlanningTxt(encoded)).toEqual(planning);

    // 旧文件不含该段：既不能抛「未知区块」，也不能抛「缺少区块」
    const legacy = encodePlanningTxt({ ...planning, coreConflictType: '' });
    expect(legacy).not.toContain('【核心冲突类型】');
    expect(decodePlanningTxt(legacy).coreConflictType).toBeUndefined();
  });

  it('大纲、人物、世界观和伏笔可无损往返', () => {
    const outline: OutlineNode = {
      id: 'outline-1',
      order: 1,
      title: '第一章',
      phase: '开局立钩',
      goal: '发现异常',
      characters: '林默：谨慎核验',
      event: '收到异常故障单\n现场验证',
      conflict: '是否上报',
      turn: '故障单时间早于事故',
      payoff: '验证成功',
      foreshadowing: '铺设：私有标记',
      continuity: '承接入职；留下城市级故障',
      hook: '城市级故障',
    };
    expect(decodeOutlineDocumentTxt(
      encodeOutlineTxt(outline, '写作章纲\n第二行'), outline.id, outline.order, '大纲.txt',
    )).toEqual({ outline, writingOutline: '写作章纲\n第二行' });

    const character: Character = {
      id: 'character-1',
      name: '林默',
      identity: '运维工程师',
      desire: '查明真相',
      flaw: '谨慎',
      relationships: '周远：组长',
      voice: '克制',
      boundaries: '不能预知',
      arc: '主动调查',
    };
    expect(decodeCharacterTxt(encodeCharacterTxt(character), character.id, '人物.txt')).toEqual(character);

    const world: WorldItem = {
      id: 'world-1', type: 'timeline', name: '故障单规则', content: '提前一天生成',
    };
    expect(decodeWorldTxt(encodeWorldTxt(world), world.id, '世界观.txt')).toEqual(world);

    const foreshadowing: Foreshadowing = {
      id: 'foreshadow-1',
      content: '私有标记',
      plantedChapter: 1,
      plannedPayoffChapter: 3,
      actualPayoffChapter: null,
      status: 'planted',
    };
    expect(decodeForeshadowingTxt(
      encodeForeshadowingTxt(foreshadowing), foreshadowing.id, '伏笔.txt',
    )).toEqual(foreshadowing);
  });

  it('旧版大纲 TXT 加载时为新增结构字段补空值', () => {
    const legacy = [
      '【章节标题】', '第一章', '', '【写作章纲】', '发现异常', '',
      '【本章目标】', '确认故障单', '', '【核心冲突】', '上报会被追责', '',
      '【情绪回报】', '异常得到验证', '', '【章末钩子】', '事故扩大', '',
    ].join('\n');
    const document = decodeOutlineDocumentTxt(legacy, 'outline-1', 1, '旧大纲.txt');
    expect(document.outline.phase).toBe('');
    expect(document.outline.event).toBe('');
    expect(document.outline.turn).toBe('');
    expect(document.outline.foreshadowing).toBe('');
    expect(document.outline.continuity).toBe('');
  });

  it('缺失、重复和未知区块返回带文件名的错误', () => {
    expect(() => decodeCharacterTxt('【姓名】\n林默\n', 'id', '林默.txt'))
      .toThrow(/林默\.txt：缺少/);
    expect(() => decodeWorldTxt('【名称】\n规则\n\n【名称】\n重复', 'id', '规则.txt'))
      .toThrow(/规则\.txt：区块“名称”重复/);
    expect(() => decodePlanningTxt('【未知】\n值', '策划.txt'))
      .toThrow(/策划\.txt：第 1 行存在未知区块/);
  });
});
