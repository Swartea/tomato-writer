import { describe, expect, it } from 'vitest';
import {
  approveCandidateInMemory,
  buildContext,
  candidateViolations,
  countCharacters,
  countWords,
  createProjectData,
  dialogueRatio,
  dialogueTarget,
  genreStance,
  optionsPrompt,
  outlinePrompt,
  outlineWritingBrief,
  parseGeneratedStyle,
  parseModelJson,
  planningPrompt,
  PROMPT_VERSION,
  STYLE_ENUMS,
  stylePrompt,
  writingPrompt,
  WritingWorkflows,
} from '../packages/core/src';
import type { Clock, CompletionClient, Foreshadowing, IdFactory } from '../packages/core/src';

const clock: Clock = { now: () => new Date('2026-07-28T00:00:00.000Z') };
let idSequence = 0;
const ids: IdFactory = { create: prefix => `${prefix}-${++idSequence}` };

/** 取 prompt 中以 `【标签】` 开头、到下一个 `【` 为止的整段文本，便于按段落断言。 */
const sectionOf = (text: string, label: string): string => {
  const start = text.indexOf(`【${label}】`);
  if (start < 0) return '';
  const rest = text.slice(start + label.length + 2);
  const end = rest.indexOf('【');
  return end < 0 ? rest : rest.slice(0, end);
};

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

/**
 * P0-1 回归：dialogueRatio 曾用字符类 `[“"][^”"]+[”"]` 且分母取 text.length。
 * 三个后果：直角引号 `「」` 完全不计（中文网文对白恒判 0%）、分子分母口径不一致、允许左右错配。
 * 下列断言按「成对匹配 + 分子分母同走 countCharacters」的新口径校准。
 */
describe('对话占比口径（P0-1）', () => {
  const cornerQuoteBody = [
    '林默把辞职信压在键盘下。',
    '「你真要走？」周远问。',
    '「我留下也只是替人背锅。」',
    '「那你想好去哪了吗？」',
    '「没想好，先离开这儿。」',
    '他没回头。',
  ].join('\n');
  const curlyQuoteBody = cornerQuoteBody.replace(/「/g, '“').replace(/」/g, '”');

  it('同一段文字用「」与“”应得到完全相同的占比', () => {
    expect(dialogueRatio(cornerQuoteBody)).toBe(dialogueRatio(curlyQuoteBody));
    // 改造前直角引号版本恒为 0%，弯引号版本却有值——正是这个落差误导了闸门与修订指令。
    expect(dialogueRatio(cornerQuoteBody)).toBe(67);
  });

  it('分子分母同走 countCharacters，空白不再影响结果', () => {
    const compact = '“你好。”然后走了。';
    const spaced = '  “你好。”\n\n  然后走了。  ';
    expect(dialogueRatio(compact)).toBe(dialogueRatio(spaced));
    // 对白 5 字符 / 全文 10 字符（均已去空白）
    expect(dialogueRatio(compact)).toBe(50);
  });

  it('覆盖双层直角引号与英文直引号，嵌套片段不重复计数', () => {
    expect(dialogueRatio('『就这样。』')).toBe(100);
    expect(dialogueRatio('"ok"')).toBe(100);
    expect(dialogueRatio('「他说『好』。」')).toBe(100);
  });

  it('左右不同源的错配引号不计入对话', () => {
    expect(dialogueRatio('“你好" 他说')).toBe(0);
  });

  it('空文本与纯空白返回 0', () => {
    expect(dialogueRatio('')).toBe(0);
    expect(dialogueRatio('   \n\t ')).toBe(0);
  });
});

/**
 * P1 回归：TRACK_RULES.male 曾写死「设定可夸张、反套路、开局即炸」并被 writingPrompt 无条件注入，
 * 与收敛档题材（都市日常/现实题材/乡村生活）的「避免开局无敌、龙傲天」同时出现在一条 system prompt 里。
 * 改造后档位下沉到题材层，任一 prompt 中只允许出现一条档位指令。
 */
describe('题材档位与赛道规则（P1）', () => {
  const projectOf = (genre: string, track: 'male' | 'female' | 'mystery' = 'male') => {
    const project = createProjectData('/tmp/book', '书', clock, ids);
    project.planning.genreTrack = track;
    project.planning.genre = genre;
    return project;
  };

  it('放开档题材只注入放开档指令', () => {
    const prompt = writingPrompt(projectOf('都市脑洞'));
    expect(prompt).toContain('档位·放开');
    expect(prompt).not.toContain('档位·收敛');
    expect(prompt).toContain('开局即炸');
  });

  it('收敛档题材不再同时出现放开档指令', () => {
    for (const genre of ['都市日常', '现实题材', '乡村生活']) {
      const prompt = writingPrompt(projectOf(genre));
      expect(prompt).toContain('档位·收敛');
      expect(prompt).not.toContain('档位·放开');
      expect(prompt).not.toContain('开局即炸');
    }
  });

  it('未命中 GENRE_TACTICS 的题材回退到分轨默认档位，不丢档位指引', () => {
    expect(genreStance('male', '非遗美食经营')).toBe('放开');
    expect(genreStance('mystery', '非遗美食经营')).toBe('收敛');
    const fallback = writingPrompt(projectOf('非遗美食经营'));
    expect(fallback).toContain('档位·放开');
    const mystery = writingPrompt(projectOf('非遗美食经营', 'mystery'));
    expect(mystery).toContain('档位·收敛');
  });

  it('所有已知题材的 prompt 注入点都只带一条档位指令', () => {
    const project = projectOf('都市日常');
    const chapter = project.chapters[0];
    const prompts = [
      buildContext(project, chapter, ''),
      writingPrompt(project),
      planningPrompt(project),
      outlinePrompt(project),
      optionsPrompt('titles', project),
      stylePrompt(project.planning.genre, project),
    ];
    for (const prompt of prompts) {
      expect(prompt).toContain('档位·收敛');
      expect(prompt).not.toContain('档位·放开');
    }
  });
});

/**
 * P2 回归：buildContext 的伏笔过滤只有 `plannedPayoffChapter <= order + 2`，
 * 于是远期伏笔在它本该被铺设的章节反而不可见，伏笔链静默断裂。
 */
describe('伏笔上下文拆分（P2）', () => {
  const clue = (patch: Partial<Foreshadowing> & Pick<Foreshadowing, 'id' | 'content'>): Foreshadowing => ({
    plantedChapter: null, plannedPayoffChapter: null, actualPayoffChapter: null, status: 'planned', ...patch,
  });

  it('远期伏笔在第 1 章出现在「本章应铺设」里', () => {
    const project = createProjectData('/tmp/book', '书', clock, ids);
    project.foreshadowing.push(
      clue({ id: 'f1', content: '私有签名', plannedPayoffChapter: 3 }),
      clue({ id: 'f2', content: '第二张故障单', plannedPayoffChapter: 9 }),
      clue({ id: 'f3', content: '旧承诺', plantedChapter: 1, plannedPayoffChapter: 2, status: 'planted' }),
      clue({ id: 'f4', content: '远期已铺线索', plantedChapter: 1, plannedPayoffChapter: 20, status: 'planted' }),
      clue({ id: 'f5', content: '已还清的债', plantedChapter: 1, plannedPayoffChapter: 2, actualPayoffChapter: 2, status: 'paid' }),
    );
    const context = buildContext(project, project.chapters[0], '');
    const plant = sectionOf(context, '本章应铺设伏笔');
    const payoff = sectionOf(context, '临近回收伏笔');

    // 改造前 f2 在第 1 章完全不可见
    expect(plant).toContain('第二张故障单');
    expect(plant).toContain('私有签名');
    expect(plant).toContain('计划第9章回收');
    // 已铺未收且临近回收窗口内
    expect(payoff).toContain('旧承诺');
    // 远期已铺的暂不打扰，已回收的不再提
    expect(payoff).not.toContain('远期已铺线索');
    expect(context).not.toContain('已还清的债');
    // 两段按 status 互斥，不重复
    expect(plant).not.toContain('旧承诺');
    expect(payoff).not.toContain('第二张故障单');
  });

  it('无伏笔时两段都显式写「无」，不留空提示', () => {
    const project = createProjectData('/tmp/book', '书', clock, ids);
    const context = buildContext(project, project.chapters[0], '');
    expect(sectionOf(context, '本章应铺设伏笔').trim()).toBe('无');
    expect(sectionOf(context, '临近回收伏笔').trim()).toBe('无');
  });
});

/**
 * P0-2 (a)(b) 回归：planningPrompt 既没要求沿用用户已填内容，
 * 也没把 coreConflictType 作为只读约束告知模型，导致补强后 chip 与正文自相矛盾。
 */
describe('策划补强 prompt（P0-2）', () => {
  const seeded = () => {
    const project = createProjectData('/tmp/book', '书', clock, ids);
    project.planning.targetReader = '一线互联网码农';
    project.planning.tags = ['反卷咸鱼', '摸鱼暴富'];
    project.planning.coreConflict = '【人vs系统】主角与规则博弈。';
    project.planning.coreConflictType = '人vs系统';
    return project;
  };

  it('把已填字段与待补字段显式列进 prompt，并要求原样沿用', () => {
    const prompt = planningPrompt(seeded());
    const filled = prompt.split('\n').find(line => line.startsWith('- 已填字段')) ?? '';
    const empty = prompt.split('\n').find(line => line.startsWith('- 待补字段')) ?? '';
    expect(prompt).toContain('原样照抄');
    expect(filled).toContain('targetReader（目标读者）');
    expect(filled).toContain('tags（内容标签）');
    expect(filled).toContain('coreConflict（核心冲突）');
    expect(filled).not.toContain('synopsis');
    expect(empty).toContain('synopsis（故事梗概）');
    expect(empty).toContain('titleCandidates（书名候选）');
  });

  it('coreConflictType 作为只读约束注入，且不出现在输出 schema 里', () => {
    const prompt = planningPrompt(seeded());
    expect(prompt).toContain('本书冲突类型已由用户点选为「人vs系统」');
    expect(prompt).toContain('禁止返回或改写它');
    expect(prompt).not.toContain('"coreConflictType"');
  });

  it('未点选冲突类型时降级为「未指定」，不伪造枚举值', () => {
    const project = createProjectData('/tmp/book', '书', clock, ids);
    expect(planningPrompt(project)).toContain('本书冲突类型已由用户点选为「未指定」');
  });
});

/** P3 回归：stylePrompt 未给枚举白名单，模型返回近义表述让 UI EnumSelect 掉进「自定义」分支。 */
describe('文风 prompt 枚举白名单（P3）', () => {
  it('注入 STYLE_ENUMS 三组白名单与该轨情绪原型', () => {
    const project = createProjectData('/tmp/book', '书', clock, ids);
    const prompt = stylePrompt(project.planning.genre, project);
    expect(prompt).toContain('枚举白名单');
    for (const value of [
      ...STYLE_ENUMS.perspective, ...STYLE_ENUMS.pace, ...STYLE_ENUMS.sentenceLength,
      ...STYLE_ENUMS.emotion[project.planning.genreTrack],
    ]) {
      expect(prompt).toContain(value);
    }
  });
});

describe('prompt 版本', () => {
  it('prompt 内容有实质变更时 PROMPT_VERSION 必须同步 bump', () => {
    expect(PROMPT_VERSION).toBe('2026.08-v5');
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
