import { describe, expect, it } from 'vitest';
import {
  approveCandidateInMemory,
  candidateViolations,
  countCharacters,
  countWords,
  createProjectData,
  dialogueRatio,
  dialogueTarget,
  outlinePrompt,
  outlineWritingBrief,
  parseGeneratedStyle,
  parseModelJson,
  WritingWorkflows,
} from '../packages/core/src';
import type { Clock, CompletionClient, IdFactory } from '../packages/core/src';

const clock: Clock = { now: () => new Date('2026-07-28T00:00:00.000Z') };
let idSequence = 0;
const ids: IdFactory = { create: prefix => `${prefix}-${++idSequence}` };

describe('核心统计与题材规则', () => {
  it('统计中英文词数、非空白字符和中文引号对话占比', () => {
    expect(countWords('你好 world again')).toBe(4);
    expect(countCharacters('你 好\nA')).toBe(3);
    expect(dialogueRatio('他说：“你好。”然后走了。')).toBeGreaterThan(0);
  });

  it('按细分题材策略计算对话目标，未知题材使用通用范围', () => {
    const project = createProjectData('/tmp/book', '书', clock, ids);
    project.planning.genre = '都市脑洞';
    expect(dialogueTarget(project)).toEqual({ min: 35, max: 50 });
    project.planning.genre = '自定义题材';
    expect(dialogueTarget(project)).toEqual({ min: 15, max: 30 });
  });

  it('报告候选长度和对话比例违规', () => {
    expect(candidateViolations('短文', '短文', { min: 35, max: 50 })).toHaveLength(4);
  });
});

describe('模型结果解析', () => {
  it('剥离 think 与代码围栏并解析 JSON', () => {
    expect(parseModelJson('<think>推理</think>```json\n{"ok":true}\n```')).toEqual({ ok: true });
  });

  it('拒绝无 JSON 或不完整文风', () => {
    expect(() => parseModelJson('只有说明')).toThrow('模型未返回可识别的 JSON');
    expect(() => parseGeneratedStyle({ perspective: '第三人称' })).toThrow('文风字段不完整');
  });
});

describe('核心用例与状态迁移', () => {
  it('生成详细大纲时携带创作资产并保留增强结构字段', async () => {
    let request = '';
    const completion: CompletionClient = {
      complete: async input => {
        request = input.messages.map(item => item.content).join('\n');
        return JSON.stringify([{
          title: '故障单提前出现',
          phase: '开局立钩',
          goal: '确认故障单是否真实',
          characters: '林默：核验；周远：阻止',
          event: '林默核对时间戳；现场设备失效',
          conflict: '上报会触发问责',
          turn: '故障单早于事故一天生成',
          payoff: '主角判断得到验证',
          foreshadowing: '铺设：私有签名',
          continuity: '承接裁员通知；留下第二张故障单',
          hook: '下一张故障单指向谁',
        }]);
      },
    };
    const project = createProjectData('/tmp/book', '书', clock, ids);
    project.characters.push({
      id: 'character-1', name: '林默', identity: '工程师', desire: '查明真相',
      flaw: '谨慎', relationships: '', voice: '', boundaries: '不能入侵系统', arc: '',
    });
    const workflows = new WritingWorkflows(completion, clock, ids);
    const rows = await workflows.generateOutline(project);
    expect(rows[0].phase).toBe('开局立钩');
    expect(rows[0].event).toContain('时间戳');
    expect(request).toContain('不能入侵系统');
    expect(outlineWritingBrief(rows[0])).toContain('转折/信息增量');
    expect(outlinePrompt(project)).toContain('关键事件必须能拍成具体场面');
  });

  it('在核心层完成写作、审校和候选质量计算', async () => {
    const responses = [
      '“先行动。”' + '正文'.repeat(650),
      JSON.stringify({
        revisedContent: '“先行动。”' + '修订'.repeat(650),
        pacing: '快',
        consistency: '一致',
        style: '符合',
        aiSmell: 20,
      }),
    ];
    const completion: CompletionClient = {
      complete: async () => responses.shift() || '',
    };
    const project = createProjectData('/tmp/book', '书', clock, ids);
    const workflows = new WritingWorkflows(completion, clock, ids);
    const draft = await workflows.generateChapterCandidate(project, project.chapters[0].id, '加快冲突');
    expect(draft.status).toBe('candidate');
    expect(draft.review.aiSmell).toBe(20);
    expect(draft.context).toContain('加快冲突');
  });

  it('批准候选时更新正式稿、候选与项目状态', () => {
    const project = createProjectData('/tmp/book', '书', clock, ids);
    project.candidates.push({
      id: 'draft-1',
      chapterId: project.chapters[0].id,
      createdAt: clock.now().toISOString(),
      model: 'test',
      promptVersion: 'test',
      contextSummary: '',
      context: '',
      content: '原稿',
      revisedContent: '修订',
      review: { pacing: '', consistency: '', style: '', aiSmell: 0 },
      quality: {
        targetCharacters: { min: 1200, max: 1500 },
        contentCharacters: 2,
        revisedCharacters: 2,
        dialogueTarget: { min: 15, max: 30 },
        contentDialogueRatio: 0,
        revisedDialogueRatio: 0,
        violations: [],
      },
      status: 'candidate',
    });
    approveCandidateInMemory(project, 'draft-1', '人工编辑后的正式稿', clock);
    expect(project.chapters[0].content).toBe('人工编辑后的正式稿');
    expect(project.candidates[0].status).toBe('approved');
    expect(project.status).toBe('completed');
  });
});
