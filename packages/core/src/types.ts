export type ChapterStatus = 'planned' | 'generating' | 'reviewing' | 'approved' | 'completed';
export type GenreTrack = 'male' | 'female' | 'mystery';
export type ProjectLayout = 'legacy' | 'readable-txt';
export interface EmotionalBeat { chapters: string; emotion: string; triggerEvent: string }

export interface Chapter {
  id: string; order: number; title: string; outline: string; content: string; summary: string;
  status: ChapterStatus; characterIds: string[]; foreshadowingIds: string[]; updatedAt: string;
}
export interface Planning {
  schemaVersion: number; genreTrack: GenreTrack; genre: string; targetReader: string; sellingPoint: string;
  title: string; titleCandidates: string[]; tags: string[]; synopsis: string; coreConflict: string; emotionalGoal: string;
  emotionalBeats: EmotionalBeat[]; targetWords: number;
  /**
   * 核心冲突类型（取值来自 presets.CONFLICT_TYPES[].value，如「人vs系统」）。
   * 必须保持 optional：旧「本书策划.txt」没有该区块，升级为必填会让所有历史项目解析失败。
   */
  coreConflictType?: string;
}

/** AI 候选生成的场景标识；每个 kind 对应一段 prompt 规则与一套 value 校验。 */
export type GenerateOptionsKind = 'titles' | 'sellingPoints' | 'tags' | 'targetReaders' | 'beats';

/**
 * 候选项统一信封。
 * `value` 语义：`beats` 为一整套 `EmotionalBeat[]`；其余 kind 缺省，消费方取 `label`。
 * `note` 为一行次要说明（如「偏爽文向」），UI 以灰字渲染。
 */
export interface OptionCandidate { label: string; value?: unknown; note?: string }

/** `generateOptions` 的统一返回信封，UI 只认这一种形状。 */
export interface GenerateOptionsResult { kind: GenerateOptionsKind; options: OptionCandidate[] }
export interface OutlineNode {
  id: string;
  order: number;
  title: string;
  phase: string;
  goal: string;
  characters: string;
  event: string;
  conflict: string;
  turn: string;
  payoff: string;
  hook: string;
  foreshadowing: string;
  continuity: string;
}
export interface StyleProfile {
  schemaVersion: number; perspective: string; pace: string; emotion: string; dialogueRatio: number;
  sentenceLength: string; protagonistVoice: string; bannedWords: string[]; bannedPatterns: string[];
  referenceSamples: string[]; negativeSamples: { text: string; reason: string }[];
}
export interface Character {
  id: string; name: string; identity: string; desire: string; flaw: string; relationships: string;
  voice: string; boundaries: string; arc: string;
}
export interface WorldItem { id: string; type: 'rule' | 'location' | 'item' | 'timeline'; name: string; content: string }
export interface Foreshadowing {
  id: string; content: string; plantedChapter: number | null; plannedPayoffChapter: number | null;
  actualPayoffChapter: number | null; status: 'planned' | 'planted' | 'paid';
}
export interface CandidateDraft {
  id: string; chapterId: string; createdAt: string; model: string; promptVersion: string;
  contextSummary: string; context: string; content: string; revisedContent: string;
  review: { pacing: string; consistency: string; style: string; aiSmell: number };
  quality: {
    targetCharacters: { min: number; max: number };
    contentCharacters: number; revisedCharacters: number;
    dialogueTarget: { min: number; max: number };
    contentDialogueRatio: number; revisedDialogueRatio: number;
    violations: string[];
  };
  status: 'candidate' | 'approved' | 'rejected';
}
export interface ProjectData {
  schemaVersion: number; id: string; rootPath: string; name: string;
  storageLayout?: ProjectLayout;
  status: 'planning' | 'writing' | 'completed' | 'submitted'; createdAt: string; updatedAt: string;
  planning: Planning; outline: OutlineNode[]; styleProfile: StyleProfile; characters: Character[];
  world: WorldItem[]; foreshadowing: Foreshadowing[]; chapters: Chapter[]; candidates: CandidateDraft[];
}
export interface ProjectSummary {
  id: string; rootPath: string; name: string; genre: string; status: ProjectData['status'];
  words: number; chapters: number; location?: 'library' | 'external';
}
export interface AISettings { apiUrl: string; model: string; temperature: number; maxTokens: number }

export interface ProjectMigrationResult {
  project: ProjectData;
  sourceRoot: string;
  targetRoot: string;
}
