import { GenreTrack } from './types';

/**
 * 策划页「选择式填写」的本地预设池 —— 词表的**单一事实源**。
 *
 * UI（webview）与 prompt（prompts.ts）都必须从这里取词，禁止在任何 .tsx 或 prompt 字符串里
 * 硬编码副本，否则两侧词表必然漂移。
 *
 * 本模块无副作用、只依赖 ./types，可被任何层安全引用。
 * 各轨给 4~8 项即可，按需扩展：新增词条只要追加到对应数组，UI 与 prompt 同步生效。
 */

/** 带释义的预设项（用于需要一行引导语的枚举，如核心冲突类型）。 */
export interface PresetOption {
  /** 落库值 */
  value: string;
  /** 展示文案 */
  label: string;
  /** 一行引导语，用于生成种子文案 */
  hint?: string;
}

/** 文风枚举分组（R6/R7/R8 用扁平枚举，R9 复用分轨情绪池）。 */
export interface StyleEnums {
  perspective: string[];
  pace: string[];
  sentenceLength: string[];
  emotion: Record<GenreTrack, string[]>;
}

/** R1 目标读者池：按分轨给推荐序，可扩。 */
export const READER_POOL: Record<GenreTrack, string[]> = {
  male: ['下沉市场男', '都市白领男', '学生党', '硬核设定党', '爽文老读者', '历史军事迷', '游戏二次元向'],
  female: ['都市职场女性', '学生党少女', '甜宠党', '虐恋党', '古言宅斗迷', '大女主成长向', '已婚家庭向'],
  mystery: ['硬核推理迷', '社会派读者', '刑侦剧观众', '怪谈猎奇向', '短平快反转党', '民俗惊悚爱好者'],
};

/** R2 内容标签池：按分轨给推荐序，可扩。 */
export const TAG_POOL: Record<GenreTrack, string[]> = {
  male: ['金手指', '系统', '逆袭', '扮猪吃虎', '无敌流', '装逼打脸', '日常搞笑', '单女主'],
  female: ['先婚后爱', '破镜重圆', '双向奔赴', '追妻火葬场', '复仇爽', '事业脑', '甜宠', '群像'],
  mystery: ['反转', '密室', '连环案', '规则怪谈', '民俗', '单元剧', '时间循环', '双主角查案'],
};

/** R5/R9 共用的情绪原型池：数组顺序即该轨的推荐序。 */
export const EMOTION_POOL: Record<GenreTrack, string[]> = {
  male: ['爽', '燃', '热血', '解压', '装逼快感', '逆袭感'],
  female: ['甜', '虐', '治愈', '破防', '意难平', '成长感'],
  mystery: ['悬', '惊', '窒息感', '恍然大悟', '细思极恐', '压抑'],
};

/** R3 核心冲突类型：三轨共用、单选、6 项固定枚举，hint 用于 R4 种子文案。 */
export const CONFLICT_TYPES: PresetOption[] = [
  {
    value: '人vs人',
    label: '人vs人',
    hint: '主角与具体对手正面博弈，胜负取决于谁先拿到关键筹码。',
  },
  {
    value: '人vs环境',
    label: '人vs环境',
    hint: '主角与灾变、绝境或资源匮乏对抗，代价来自环境本身而非恶意。',
  },
  {
    value: '人vs自我',
    label: '人vs自我',
    hint: '主角最大的阻力是自己的欲望、恐惧或旧伤，破局等于跨过心里那道坎。',
  },
  {
    value: '人vs社会',
    label: '人vs社会',
    hint: '主角与阶层、舆论或潜规则对抗，赢一次不等于改变结构。',
  },
  {
    value: '人vs系统',
    label: '人vs系统',
    hint: '主角与规则/机制博弈，靠理解并利用规则取胜，而不是硬碰硬。',
  },
  {
    value: '人vs命运',
    label: '人vs命运',
    hint: '主角与已知结局或轮回抗争，每次改写都要付出等价代价。',
  },
];

/** R6/R7/R8 文风枚举 + R9 情绪池引用。UI 在末尾自行追加「自定义…」。 */
export const STYLE_ENUMS: StyleEnums = {
  perspective: ['第一人称', '限制性第三人称', '全知第三人称', '双视角交替'],
  pace: ['快节奏', '中速推进', '慢热铺垫', '快慢交替'],
  sentenceLength: ['短句优先', '长短交错', '中等偏长', '极短爆点'],
  emotion: EMOTION_POOL,
};

/** 按分轨安全取池，未知轨回退到男频，避免 UI 拿到 undefined。 */
export function poolOf(pool: Record<GenreTrack, string[]>, track: GenreTrack): string[] {
  return pool[track] ?? pool.male;
}

/** 按 value 或 label 查冲突类型，未命中返回 null。 */
export function conflictType(type: string): PresetOption | null {
  const key = type.trim();
  if (!key) return null;
  return CONFLICT_TYPES.find(item => item.value === key || item.label === key) ?? null;
}

/**
 * R4：由冲突类型生成「核心冲突」种子文案。
 * 形如 `【人vs系统】主角与规则/机制博弈…`；无匹配返回空串（调用方据此跳过写入）。
 */
export function conflictSeedText(type: string): string {
  const matched = conflictType(type);
  if (!matched) return '';
  return `【${matched.label}】${matched.hint ?? ''}`;
}

/**
 * R5：由情绪原型拼一句「情绪目标」种子文案。
 * 空数组返回空串（调用方据此跳过写入）。
 */
export function emotionSeedText(picked: string[]): string {
  const list = [...new Set(picked.map(item => item.trim()).filter(Boolean))];
  if (!list.length) return '';
  const primary = list[0];
  return `读者主线情绪：${list.join('、')}。`
    + `前三章先把「${primary}」立住，`
    + `中段用具体事件逐个兑现${list.length > 1 ? `「${list.slice(1).join('、')}」` : '该情绪的升级形态'}，`
    + '结尾收成读者能复述的一个具体结果。';
}
