import {
  assetPrompt, AssetKind, brainstormPrompt, buildContext, normalizeOptionCount, optionsContext,
  optionsPrompt, outlinePrompt, planningPrompt, PROMPT_VERSION, reviewPrompt, stylePrompt,
  subtypePrompt, writingPrompt,
} from './prompts';
import { CompletionClient, Clock, IdFactory } from './ports';
import {
  parseGeneratedCharacter, parseGeneratedForeshadowing, parseGeneratedStyle,
  parseGeneratedWorld, parseModelJson, parseOptionCandidates,
} from './parsing';
import {
  CandidateDraft, Character, Foreshadowing, GenerateOptionsKind, GenerateOptionsResult,
  OutlineNode, ProjectData, StyleProfile, WorldItem,
} from './types';
import { normalizeOutlineNode } from './project';
import { candidateViolations, countCharacters, dialogueRatio, dialogueTarget } from './metrics';

export class WritingWorkflows {
  constructor(
    private readonly completion: CompletionClient,
    private readonly clock: Clock,
    private readonly ids: IdFactory,
  ) {}

  private complete(system: string, user: string, signal?: AbortSignal, maxTokens?: number): Promise<string> {
    return this.completion.complete({
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      signal,
      maxTokens,
    });
  }

  completeMessages(messages: Parameters<CompletionClient['complete']>[0]['messages'], signal?: AbortSignal, maxTokens?: number): Promise<string> {
    return this.completion.complete({ messages, signal, maxTokens });
  }

  async recommendSubtype(input: { concept: string; genreTrack: ProjectData['planning']['genreTrack'] }, signal?: AbortSignal): Promise<unknown> {
    return parseModelJson(await this.complete(subtypePrompt(input), JSON.stringify(input), signal, 4000));
  }

  /**
   * 为策划页生成可点选的候选项（书名/卖点/标签/目标读者/情绪节拍方案）。
   *
   * 返回统一信封 `{ kind, options }`；候选**不落盘**，由 UI 决定是否写入 project。
   *
   * @param opts.count   期望条数，会被夹到该 kind 的合法区间
   * @param opts.exclude 「再来一批」时传入上一批 + 已采纳项，要求模型避开
   */
  async generateOptions(
    kind: GenerateOptionsKind,
    project: ProjectData,
    opts: { count?: number; exclude?: string[] } = {},
    signal?: AbortSignal,
  ): Promise<GenerateOptionsResult> {
    const count = normalizeOptionCount(kind, opts.count);
    const raw = parseModelJson(await this.complete(
      optionsPrompt(kind, project, { count, exclude: opts.exclude }),
      optionsContext(project),
      signal,
      kind === 'beats' ? 4000 : 2000,
    ));
    return { kind, options: parseOptionCandidates(kind, raw, count) };
  }

  async strengthenPlanning(project: ProjectData, signal?: AbortSignal): Promise<unknown> {
    return parseModelJson(await this.complete(planningPrompt(project), JSON.stringify(project.planning), signal));
  }

  async deriveStyle(project: ProjectData, signal?: AbortSignal): Promise<Omit<StyleProfile, 'schemaVersion'>> {
    return parseGeneratedStyle(parseModelJson(
      await this.complete(stylePrompt(project.planning.genre, project), '请生成完整文风档案。', signal),
    ));
  }

  async generateOutline(project: ProjectData, signal?: AbortSignal): Promise<OutlineNode[]> {
    const rows = parseModelJson<unknown>(await this.complete(
      outlinePrompt(project),
      JSON.stringify({
        planning: project.planning,
        characters: project.characters,
        world: project.world,
        foreshadowing: project.foreshadowing,
        existingOutline: project.outline,
      }),
      signal,
      12000,
    ));
    if (!Array.isArray(rows)) throw new Error('模型返回的大纲不是数组');
    return rows.map((row, index) => {
      if (typeof row !== 'object' || row === null) throw new Error('大纲字段不完整');
      const value = row as Partial<OutlineNode>;
      for (const key of ['title', 'goal', 'conflict', 'payoff', 'hook'] as const) {
        if (typeof value[key] !== 'string') throw new Error('大纲字段不完整');
      }
      return normalizeOutlineNode(value, index + 1, this.ids.create('outline'));
    });
  }

  async generateChapterCandidate(
    project: ProjectData,
    chapterId: string,
    instruction: string,
    signal?: AbortSignal,
  ): Promise<CandidateDraft> {
    const chapter = project.chapters.find(item => item.id === chapterId);
    if (!chapter) throw new Error('章节不存在');
    const context = buildContext(project, chapter, instruction);
    const content = await this.complete(writingPrompt(project), context, signal, 3000);
    const target = dialogueTarget(project);
    const contentCharacters = countCharacters(content);
    const contentDialogueRatio = dialogueRatio(content);
    let review: { revisedContent?: string; pacing?: string; consistency?: string; style?: string; aiSmell?: number };
    try {
      review = parseModelJson(await this.complete(
        reviewPrompt(project, chapter, {
          characters: contentCharacters,
          dialogueRatio: contentDialogueRatio,
          dialogueTarget: target,
        }),
        `${context}\n\n【候选稿】\n${content}`,
        signal,
        3000,
      ));
    } catch (error) {
      if (signal?.aborted) throw error;
      const reason = error instanceof Error ? error.message : String(error);
      review = {
        revisedContent: content,
        pacing: `审校未完成：${reason}`,
        consistency: '待重新审校',
        style: '待重新审校',
      };
    }
    const revisedContent = review.revisedContent || content;
    return {
      id: this.ids.create('draft'),
      chapterId,
      createdAt: this.clock.now().toISOString(),
      model: 'configured-model',
      promptVersion: PROMPT_VERSION,
      contextSummary: `第${chapter.order}章 ${chapter.title}；完整上下文已随候选保存`,
      context,
      content,
      revisedContent,
      review: {
        pacing: review.pacing || '待重新审校',
        consistency: review.consistency || '待重新审校',
        style: review.style || '待重新审校',
        aiSmell: typeof review.aiSmell === 'number' ? review.aiSmell : 0,
      },
      quality: {
        targetCharacters: { min: 1200, max: 1500 },
        contentCharacters,
        revisedCharacters: countCharacters(revisedContent),
        dialogueTarget: target,
        contentDialogueRatio,
        revisedDialogueRatio: dialogueRatio(revisedContent),
        violations: candidateViolations(content, revisedContent, target),
      },
      status: 'candidate',
    };
  }

  async generateAsset(kind: AssetKind, project: ProjectData, signal?: AbortSignal): Promise<Character | WorldItem | Foreshadowing> {
    const raw = parseModelJson(await this.complete(
      assetPrompt(kind, project), '请生成一条与现有内容互补的新资产。', signal,
    ));
    const id = this.ids.create(kind);
    if (kind === 'character') return { id, ...parseGeneratedCharacter(raw) };
    if (kind === 'world') return { id, ...parseGeneratedWorld(raw) };
    return { id, ...parseGeneratedForeshadowing(raw) };
  }

  runAssistant(project: ProjectData, task: string, input: string, signal?: AbortSignal): Promise<string> {
    return this.complete(
      `你是小说编辑，任务：${task}。遵守本书策划与文风，只输出结果。`,
      `${JSON.stringify(project.planning)}\n${input}`,
      signal,
    );
  }

  async brainstorm(input: { concept: string; genreTrack: ProjectData['planning']['genreTrack']; targetWords: number }, signal?: AbortSignal): Promise<unknown> {
    return parseModelJson(await this.complete(brainstormPrompt(input), JSON.stringify(input), signal, 4000));
  }
}
