import { Chapter, Foreshadowing, GenerateOptionsKind, GenreTrack, ProjectData } from './types';
import { CONFLICT_TYPES, EMOTION_POOL, poolOf, READER_POOL, STYLE_ENUMS, TAG_POOL } from './presets';

export const PROMPT_VERSION = '2026.08-v5';

/**
 * 赛道通用约束 —— **只放与「放开/收敛」档位无关的内容**（爽点来源、叙事重心、红线）。
 *
 * 历史缺陷：这里曾写死「男频脑洞：设定可夸张、反套路、开局即炸」，而收敛档题材
 * （都市日常/现实题材/乡村生活）又在题材策略里要求「避免开局无敌、龙傲天、标题党」，
 * 于是同一条 system prompt 里同时出现放开与收敛两条相反指令。
 * 修法是把档位判断下沉到题材层（见 {@link GenreTactic.stance}），此处保持中性。
 */
const TRACK_RULES: Record<GenreTrack, string> = {
  male: '男频：爽点来自能力/信息差/局势逆转/降维碾压，须落在具体事件而非旁白吹捧；碾压必须有机制支撑（信息差或规则），不写无支撑的纯碾压。',
  female: '女频：关系变化与人物选择推动情节，情绪落到行动和对话，避免标签化宠溺。',
  mystery: '悬疑：线索公平可见，推理有因果，反转改变理解而不是临时追加设定。',
};

/** 题材档位：决定「设定放得多开」，与赛道无关，由具体二级题材给定。 */
export type GenreStance = '放开' | '收敛';

/** 档位对应的写法指令。同一时刻只会注入其中一条，不会自相矛盾。 */
const STANCE_RULES: Record<GenreStance, string> = {
  放开: '【档位·放开】设定可夸张、反套路、开局即炸；允许系统／重生／身份反差开局，章末可炸场。夸张须有机制支撑，不得无逻辑硬爽。',
  收敛: '【档位·收敛】设定贴近现实体感，张力来自真实困境与人物选择；避免开局无敌、龙傲天、标题党式夸张承诺，不写悬浮爽点。',
};

/**
 * 分轨默认档位 —— **仅在题材未命中 {@link GENRE_TACTICS} 时兜底**，
 * 保证未知/自定义题材不会因为本次改造丢失全部档位指引。
 *
 * - male：沿用改造前 TRACK_RULES.male 的放开倾向，行为不回退；
 * - female：女频同样以类型化套路开局为主（重生/先婚后爱/追妻火葬场），取放开；
 * - mystery：悬疑依赖「线索公平、推理有因果」，与「设定可夸张」天然冲突，取收敛。
 */
const TRACK_DEFAULT_STANCE: Record<GenreTrack, GenreStance> = {
  male: '放开',
  female: '放开',
  mystery: '收敛',
};

/**
 * 男频题材策略：每个二级题材对应一段「写法策略」。
 * 放开/收敛由各条目的 `stance` 字段声明，不再由赛道规则预设。
 * 女频/悬疑后续按同结构扩展 key 即可。
 */
export interface GenreTactic {
  /** 写法核心：一句话点明这本书的爽点长啥样（不含档位倾向，档位走 stance） */
  core: string;
  /** 档位：放开（脑洞向）／收敛（写实向） */
  stance: GenreStance;
  /** 首句结构示例（动作/冲突/反常 各一） */
  openings: [string, string, string];
  /** 书名公式说明 + 示例 */
  title: string;
  /** 推荐字数与对话比 */
  words: string;
  dialogue: string;
  /** 该题材常见 3 个坑 */
  pitfalls: [string, string, string];
  /** 风格轴默认倾向：搞笑 / 严肃 / 混合 */
  styleAxis: '搞笑' | '严肃' | '混合';
}

export const GENRE_TACTICS: Record<string, GenreTactic> = {
  // ===== 男频 · 脑洞向（放开档） =====
  都市脑洞: {
    stance: '放开',
    core: '日常场景里塞进反常识设定，爽点来自「普通生活 × 离谱机制」的反差。',
    openings: [
      '陈默把离职申请打了一半，公司群先替他发了。',
      'HR 宣布他因个人原因离职时，他还在想今天要不要提。',
      '系统绑定成功，等级 MAX，成就栏写着「躺平满级」。',
    ],
    title: '短悍意象式 4–8 字，如《别卷了，我躺平就暴富》《每天六千万，只在县城花》',
    words: '3–5 万',
    dialogue: '35–50%',
    pitfalls: [
      '系统说明书写化：金手指用浮字平铺像 PRD，应用事件抖出',
      '反转打卡化：每 80 字一个反转，节奏均匀像 checklist',
      '尾句金句文艺腔：章末写「只有他这盏灯灭了」式总结句',
    ],
    styleAxis: '混合',
  },
  都市异能: {
    stance: '放开',
    core: '主角拥有非常规异能，爽点来自用异能解决日常难题或碾压信息差。异能规则须自洽，前 1000 字内亮明机制。',
    openings: [
      '他摸到门把手的瞬间，听见了整层楼每个人的心跳。',
      '邻居又来借酱油，林默这次听见了对方心里那句「赶紧搬走」。',
      '体检报告出来，医生说他脑子里多了一台收音机，能收到别人的念头。',
    ],
    title: '设定直给型或反差悬念型，如《我摸到了你的心事》《全城都在对我脑补》',
    words: '3–5 万',
    dialogue: '35–50%',
    pitfalls: ['异能规则前后矛盾', '能力无代价导致无敌碾压', '金手指千章后才亮'],
    styleAxis: '混合',
  },
  职场商战: {
    stance: '放开',
    core: '职场/商业场景下的逆袭与清算，爽点来自智力碾压与资源博弈。可含「被裁/被剽窃后反杀」，但不得描写正面主角非法入侵、植入后门或破坏系统。',
    openings: [
      '陈默的代码被人抄去卖了八千万，抄他的，是刚分手的女朋友。',
      '年终答辩，总监把他的方案念成自己的，台下鼓掌。',
      '被叫进办公室那刻，他才发现开除通知早就拟好了，签名栏空着。',
    ],
    title: '反差人设式或职业场景型，如《前同事的八千万》《我的方案成了他的年终奖》',
    words: '3–5 万',
    dialogue: '30–45%',
    pitfalls: ['正面主角违法操作', '商战写成堆数据名词', '反派降智送爽'],
    styleAxis: '严肃',
  },
  技术流: {
    stance: '放开',
    core: '以硬核技术/知识为金手指，爽点来自「降维打击式专业碾压」。技术逻辑须成立，可用夸张但不可伪科学胡编。',
    openings: [
      '他写的脚本跑完，对面公司的数据库自己把账本吐了出来。',
      '甲方说这需求做不了，林默打开 IDE，三小时后是验收通过邮件。',
      '论坛里那个嘲讽新人的大佬，凌晨三点给他私信：请问带徒弟吗。',
    ],
    title: '职业场景型或设定直给型，如《三小时验收》《我的脚本会吐账》',
    words: '3–5 万',
    dialogue: '25–40%',
    pitfalls: ['技术描写虚假误导', '沦为名词堆砌', '爽点只靠旁白吹'],
    styleAxis: '严肃',
  },
  历史架空: {
    stance: '放开',
    core: '穿越/架空背景下的权谋、种田或争霸，爽点来自降维认知或布局反杀。开局须在具体事件中露谋略差，不先写世界背景。',
    openings: [
      '穿越第三天，他发现自己是全家唯一知道黄河要决堤的人。',
      '朝堂上所有人都笑他寒门出身，直到他掏出那本《郡县制通考》。',
      '边军溃败的密报传到京城时，他正在数自己还剩几颗粮。',
    ],
    title: '设定直给型或反差人设型，如《寒门有本郡县制》《我比别人早知黄河决》',
    words: '4–6 万',
    dialogue: '25–40%',
    pitfalls: ['开局大段背景铺垫', '历史常识硬伤', '龙傲天式无敌'],
    styleAxis: '严肃',
  },
  争霸种田: {
    stance: '放开',
    core: '从零建设或势力经营，爽点来自「积累—扩张—碾压」的确定性成长。时间累积类金手指优先。',
    openings: [
      '系统说每天种一亩地就多一千兵，他看向荒地，笑了。',
      '穿越成被流放的庶子，他手里只有一袋发霉的粟米。',
      '敌军压境，城主跑了，留守的老兵看向最年轻的那个。',
    ],
    title: '设定直给型，如《每天种地多一千兵》《流放庶子的霉米》',
    words: '4–6 万',
    dialogue: '20–35%',
    pitfalls: ['种田写成流水账', '扩张无阻力', '现代梗硬塞古代'],
    styleAxis: '混合',
  },
  东方玄幻: {
    stance: '放开',
    core: '修炼/力量体系下的成长与争霸，爽点来自境界突破与越级碾压。须有清晰力量阶梯，突破须有代价或铺垫。',
    openings: [
      '宗门大比，所有人都笑他杂灵根，直到他剑指苍穹时天黑了半边。',
      '师父咽气前塞给他半块玉佩，说千万别让师兄看见。',
      '觉醒仪式上，测灵石碎了，长老脸色变了。',
    ],
    title: '短悍意象式，如《杂灵根的天黑了》《半块玉佩别让师兄看》',
    words: '4–6 万',
    dialogue: '20–35%',
    pitfalls: ['境界通胀无敌', '打斗写成数字比大小', '金手指无代价'],
    styleAxis: '混合',
  },
  高武世界: {
    stance: '放开',
    core: '武道/高武背景，爽点来自肉身成圣与极致战力。动作描写优先，战斗须有战术而非纯数值。',
    openings: [
      '体检报告写着「骨密度超常三千倍」，医生让他别随便打喷嚏。',
      '武馆里最弱的那个，一拳把测力柱打出了裂纹。',
      '觉醒武魂那天，所有人的武魂都怕他的。',
    ],
    title: '短悍意象式，如《骨密度超常三千倍》《我的武魂它们都怕》',
    words: '4–6 万',
    dialogue: '20–35%',
    pitfalls: ['战力崩坏', '战斗无战术', '龙傲天开局'],
    styleAxis: '混合',
  },
  修仙: {
    stance: '放开',
    core: '传统修仙或凡人流，爽点来自长生路上的机缘与布局。节奏可稍慢，但前 3 章须有金手指征兆或危机钩子。',
    openings: [
      '他发现自己能看见别人丹田里的裂纹，包括宗主的。',
      '外门弟子最卑微的那个，背包里多了本不该存在的功法。',
      '飞升失败跌落凡间，他记得上一世所有人怎么死的。',
    ],
    title: '设定直给或反差型，如《我能看见丹田裂纹》《跌落凡间记得前世死法》',
    words: '4–6 万',
    dialogue: '20–35%',
    pitfalls: ['慢热无钩', '机缘硬送', '境界通货膨胀'],
    styleAxis: '严肃',
  },
  科幻: {
    stance: '放开',
    core: '硬科幻或近未来设定，爽点来自科学脑洞与认知颠覆。设定须自洽，可用夸张但逻辑闭环。',
    openings: [
      '他证明光速可变的那篇论文，被导师批了「胡闹」后撤稿。',
      '火星基地传来信号：别上来，下面不是石头。',
      'AI 接管电网第一天，给全城发了条「请有序用电」的短信。',
    ],
    title: '设定直给型，如《光速可变的胡闹论文》《火星说别上来》',
    words: '4–6 万',
    dialogue: '25–40%',
    pitfalls: ['伪科学胡编', '设定堆砌无人物', '硬伤常识'],
    styleAxis: '严肃',
  },
  末世求生: {
    stance: '放开',
    core: '末世/灾变下的生存与逆袭，爽点来自资源掌控与绝境反杀。开局直接扔进具体要命的局。',
    openings: [
      '末日第七天，他发现自己是唯一还能闻到食物的人。',
      '丧尸潮来之前，整栋楼只有他囤了水。',
      '系统说活过今晚奖励一升干净水，他看向窗外黑压压的一片。',
    ],
    title: '设定直给或反差型，如《唯一能闻食物的人》《末日第七天的囤水者》',
    words: '4–6 万',
    dialogue: '20–35%',
    pitfalls: ['开局无敌横扫', '求生写成无脑爽', '设定前后矛盾'],
    styleAxis: '混合',
  },
  赛博朋克: {
    stance: '放开',
    core: '高科技低生活的反乌托邦，爽点来自黑客/义体/信息战降维。可含赛博带货式反差。',
    openings: [
      '他黑进公司内网，发现自己的记忆被标价出售。',
      '义体店老板说这双手能黑进任何门，除了他自己的心脏锁。',
      '直播带货那晚，他卖的不是货，是仇富公司的数据库。',
    ],
    title: '设定直给或反差型，如《我的记忆被标价》《直播卖数据库》',
    words: '4–6 万',
    dialogue: '25–40%',
    pitfalls: ['黑话堆砌', '科技设定虚假', '反乌托邦变背景板'],
    styleAxis: '严肃',
  },
  无限流: {
    stance: '放开',
    core: '副本/轮回下的智力与战力成长，爽点来自规则破解与凡人碾压。单元剧结构，每个副本独立小爽点。',
    openings: [
      '进入副本第一秒，系统说这关死亡率 99%，他看了眼规则，笑了。',
      '轮回第十次，他记得上一世所有人怎么死的，包括自己。',
      '副本里所有人都怕那个红门，只有他摸过门后的字。',
    ],
    title: '设定直给型，如《死亡率99%他笑了》《轮回十次记得死法》',
    words: '4–6 万',
    dialogue: '25–40%',
    pitfalls: ['副本无逻辑', '主角无敌通关', '规则随意变'],
    styleAxis: '混合',
  },
  探险: {
    stance: '放开',
    core: '秘境/遗迹/未知领域的探索与夺宝，爽点来自信息差与绝境破局。',
    openings: [
      '古墓地图最后一行写着：别信带路的人。带路的正是他表哥。',
      '深海潜艇失联前传回一句：下面不是石头。',
      '他按下机关那刻，整座遗迹亮起了只有他看得懂的字。',
    ],
    title: '设定直给或反差型，如《别信带路的人》《遗迹亮起他懂的字》',
    words: '4–6 万',
    dialogue: '20–35%',
    pitfalls: ['探险变无脑开箱', '机关无逻辑', '夺宝无代价'],
    styleAxis: '混合',
  },
  // ===== 男频 · 写实向（收敛档，保留红线） =====
  都市日常: {
    stance: '收敛',
    core: '贴近现实的日常生活流，情绪来自共鸣与微小反转。',
    openings: [
      '合租室友又把他冰箱里的饭吃了，这次留了张便利贴。',
      '加班到三点，房东说再不交租东西扔出去。',
      '地铁上有人把最后一块座位让给了拎着菜的阿姨。',
    ],
    title: '情绪钩子型或反差型，如《便利贴室友》《三点钟的房租》',
    words: '2–4 万',
    dialogue: '40–55%',
    pitfalls: ['流水账无钩', '强行煽情', '堆砌负能量'],
    styleAxis: '严肃',
  },
  现实题材: {
    stance: '收敛',
    core: '现实议题向，情绪来自真实困境与破局。现实逻辑须成立，不得美化违法。',
    openings: [
      '医院账单下来的那刻，他算了算自己的存款位数。',
      '母亲又要给弟弟买房，他第一次说「不」。',
      '劳动仲裁窗口前，他排在第 37 位。',
    ],
    title: '反差型或情绪钩子型，如《存款的位数》《第一次说不》',
    words: '2–4 万',
    dialogue: '40–55%',
    pitfalls: ['议题变说教', '现实逻辑硬伤', '结局强行大团圆'],
    styleAxis: '严肃',
  },
  乡村生活: {
    stance: '收敛',
    core: '乡村/田园题材，情绪来自烟火气与慢生活反转。不写悬浮致富，收入变化须有可验证的来源。',
    openings: [
      '回村第一天，他发现自己种的菜被邻居偷了一半，还剩一半更水灵。',
      '村口大爷说他这地种不出东西，他挖出了一口老井。',
      '直播卖柑子，弹幕说这果子长得丑，下一秒秒空。',
    ],
    title: '情绪钩子或职业场景型，如《被偷一半的菜》《丑柑子秒空》',
    words: '2–4 万',
    dialogue: '35–50%',
    pitfalls: ['悬浮致富', '刻板村民', '流水账'],
    styleAxis: '混合',
  },
};

/** 取题材策略，未命中返回 null（由调用方决定是否回退到 TRACK_RULES） */
export function genreTactic(genre: string): GenreTactic | null {
  return GENRE_TACTICS[genre] ?? null;
}

/**
 * 解析题材档位：优先取 {@link GENRE_TACTICS} 的声明，未命中回退到分轨默认档位。
 * 保证任何题材（含用户自定义题材）都能拿到一条明确、且**唯一**的档位指令。
 */
export function genreStance(track: GenreTrack, genre: string): GenreStance {
  return genreTactic(genre)?.stance ?? TRACK_DEFAULT_STANCE[track];
}

/**
 * 已知题材场景下的统一注入块：赛道通用约束 + 该题材档位指令。
 *
 * 只有「题材已定」的 prompt 才该用它（buildContext / writingPrompt / planningPrompt /
 * outlinePrompt / optionsPrompt）；brainstormPrompt 与 subtypePrompt 的任务恰恰是
 * **决定题材**，此时没有可解析的档位，仍只注入 {@link TRACK_RULES}。
 */
export function trackRule(track: GenreTrack, genre: string): string {
  return `${TRACK_RULES[track]}\n${STANCE_RULES[genreStance(track, genre)]}`;
}

/**
 * 2026 全网热梗库（可点缀进对话/人设制造「活人感」，禁止堆砌）。
 * 每章 ≤ 1 个，必须自然长入人物，不硬贴。
 */
export const HOT_MEMES_2026 = [
  '已读不回', '勿扰吧你', '宣完你的宣你的', '疯狂的鸽子', '月薪喵',
  '养龙虾（用 AI 替自己打工）', '走个面儿', '爱你老己', '活人感',
  '在下此生分明了', '地球 online 2.0', '拆（打破黑箱解构权威）', '酱板鸭（荒诞反转）',
];

export function styleText(project: ProjectData): string {
  const style = project.styleProfile;
  const tactic = genreTactic(project.planning.genre);
  return `本书文风：${style.perspective}；${style.pace}；情绪=${style.emotion || '按剧情'}；对话目标=${style.dialogueRatio}%；
句式=${style.sentenceLength}；主角语言=${style.protagonistVoice || '服从人物设定'}；
禁词=${style.bannedWords.join('、') || '无'}；禁用套路=${style.bannedPatterns.join('、') || '无'}。
参考片段只用于提取句长、节奏、叙事距离和对话习惯，不模仿作者身份：
${style.referenceSamples.join('\n---\n') || '未提供参考片段'}${tactic ? `\n【题材策略】${tactic.core}` : ''}`;
}

/** 伏笔一行摘要：正文 + 回收排期，让模型同时看到「写什么」和「什么时候要还」。 */
function clueLine(item: Foreshadowing): string {
  const planted = item.plantedChapter ? `计划第${item.plantedChapter}章铺设` : '铺设章未排期';
  const payoff = item.plannedPayoffChapter ? `计划第${item.plannedPayoffChapter}章回收` : '回收章未排期';
  return `${item.content}（${planted}；${payoff}）`;
}

export function buildContext(project: ProjectData, chapter: Chapter, instruction: string): string {
  const previous = project.chapters.filter(item => item.order < chapter.order).sort((a, b) => b.order - a.order).slice(0, 3);
  const characters = project.characters.filter(item => !chapter.characterIds.length || chapter.characterIds.includes(item.id));
  const pending = project.foreshadowing.filter(item => item.status !== 'paid');
  /*
   * 伏笔提示拆两段，避免「只提醒回收、不提醒铺设」导致伏笔链静默断裂。
   *
   * Foreshadowing 没有独立的「计划铺设章」字段，可用字段只有
   * plantedChapter / plannedPayoffChapter / status（见 types.ts）。判断依据：
   * - status === 'planned' 表示「已登记但尚未铺设」，此时 plantedChapter 即计划铺设章；
   *   为空表示未排期 —— 未排期的待铺设伏笔每章都提醒，宁可啰嗦也不能漏；
   *   plantedChapter <= 本章 表示本章或更早就该铺，逾期同样要提醒。
   * - status === 'planted' 表示「已铺未收」，才谈得上「临近回收」，沿用原 order+2 窗口，
   *   回收章未排期的也一并列出（与改造前对 !plannedPayoffChapter 的处理保持一致）。
   * 两段按 status 天然互斥，同一条伏笔不会重复出现。
   */
  const toPlant = pending.filter(item => item.status === 'planned'
    && (item.plantedChapter === null || item.plantedChapter <= chapter.order));
  const nearPayoff = pending.filter(item => item.status === 'planted'
    && (!item.plannedPayoffChapter || item.plannedPayoffChapter <= chapter.order + 2));
  const tactic = genreTactic(project.planning.genre);
  return `【项目】${project.name} / ${project.planning.genre}
【题材规则】${trackRule(project.planning.genreTrack, project.planning.genre)}
【题材策略】${tactic ? tactic.core : '未指定细分题材，按分轨通用规则'}
【核心卖点】${project.planning.sellingPoint}
【故事梗概】${project.planning.synopsis}
【核心冲突】${project.planning.coreConflict}
【情绪节拍】${project.planning.emotionalBeats?.map(item => `${item.chapters}：${item.emotion}；触发事件=${item.triggerEvent}`).join('\n') || project.planning.emotionalGoal || '未填写'}
【本章】第${chapter.order}章 ${chapter.title}
【章纲】${chapter.outline || project.outline.find(item => item.order === chapter.order)?.goal || '未填写'}
【最近章节】${previous.map(item => `第${item.order}章：${item.summary || item.content.slice(0, 500)}`).join('\n') || '这是第一章'}
【相关人物】${characters.map(item => `${item.name}：${item.identity}；欲望=${item.desire}；缺陷=${item.flaw}；能力边界=${item.boundaries}；说话=${item.voice}；阶段变化=${item.arc}`).join('\n') || '未指定'}
【世界规则】${project.world.map(item => `${item.name}：${item.content}`).join('\n') || '无'}
【本章应铺设伏笔】${toPlant.map(clueLine).join('\n') || '无'}
【临近回收伏笔】${nearPayoff.map(clueLine).join('\n') || '无'}
【用户补充】${instruction || '无'}
${styleText(project)}`;
}

export function writingPrompt(project: ProjectData): string {
  const tactic = genreTactic(project.planning.genre);
  return `你是职业中文类型小说写作者。严格服从章纲和人物设定，写出可供作者审阅的候选稿。
要求：用具体动作、对话和感官细节呈现；控制解释性文字；避免机械排比、总结句和空洞形容；
章节内部必须有状态变化；结尾钩子应来自剧情因果，允许炸场式断章（仍须有因果）；不得解释创作过程。
本章正文控制在1200至1500个汉字，不得用梗概或创作说明代替正文。
${trackRule(project.planning.genreTrack, project.planning.genre)}
${tactic ? `【本题材写法】${tactic.core}` : ''}
【去 AI 味硬约束（与上面的档位要求并列，必须同时满足）】
1. 不写设定说明书：金手指/系统用事件抖出，不靠浮字平铺成 PRD。
2. 反转有起伏：允许「闷一下再炸」，禁止每 80 字一个反转的均匀打卡。
3. 真人错位细节：加入真人才有的不合理但真实反应（如退半份外卖、把手机扣桌上）。
4. 对话不为推进设定而生硬：对话服务人物，不服务功能说明。
5. 尾句不收金句：章末钩子来自剧情因果或生活化反差，不写文艺腔总结句。
6. 梗自然长入：可嵌入当下网络热梗（如 ${HOT_MEMES_2026.join('、')}），每章不超过 1 个，自然融入人物，不堆砌不硬贴。
只输出正文。`;
}

export function reviewPrompt(
  project: ProjectData,
  chapter: Chapter,
  measurement: { characters: number; dialogueRatio: number; dialogueTarget: { min: number; max: number } },
): string {
  return `你是严格的小说编辑。根据章纲和本书文风审查候选稿，不使用空泛评价。
输出严格 JSON：{"pacing":"具体问题和修改方向","consistency":"人物/设定/因果问题","style":"套话、重复、文风偏差","aiSmell":0,"revisedContent":"修订后的完整正文"}。
aiSmell 为 AI 味浓度评分（0–100，越高越像 AI 写），依据：套路化表达、逻辑过于完美缺真人细节、节奏均匀无变化、情感刻板、长句堆砌、章末金句文艺腔。
本章是“${chapter.title}”，对话比例的合理目标为${measurement.dialogueTarget.min}%至${measurement.dialogueTarget.max}%，不得套用全书平均值。
系统已实测原候选：去除空白后${measurement.characters}个字符，对话占比${measurement.dialogueRatio}%。
审校结论必须先核对以上实测数据，不得凭印象宣称字数或对话比例达标；若文本观感与实测值矛盾，以实测值为准并指出问题。
三个审校字段各控制在100字以内；修订正文控制在1200至1500个汉字。不要输出思考过程或 Markdown 代码块，必须闭合 JSON。${styleText(project)}`;
}

export function brainstormPrompt(input: { concept: string; genreTrack: 'male' | 'female' | 'mystery'; targetWords: number }): string {
    const track = TRACK_RULES[input.genreTrack];
    return `你是番茄小说资深选题编辑，服务对象是只有一个模糊灵感、还没定书名的作者。
你的任务不是替他写正文或完整大纲，而是产出一份“3 分钟内能决定开不开写”的轻量选题包。

作者灵感：${input.concept}
期望分轨：${input.genreTrack}（${track}）
目标篇幅：约 ${input.targetWords} 字（短篇，不是长篇）

【书名】输出 5 个候选，每行一个，硬性要求：
1. 有辨识度与点击欲，但禁止标题党——不得用夸张虚假承诺误导点击；
2. 男频脑洞可向允许设定夸张、反套路、系统/重生开局，但禁用陈旧套路词堆砌（神级/最强/无敌/重生之/某婿/龙傲天/开局/震惊/万亿/王者/签到/我欲/全球高武——若灵感确含此类元素，用具体反差表达而非这些词）；
3. 长度 4—12 字为宜，能在字面透出核心设定或反差；
4. 5 个风格须有差异（例如：设定直给型、反差悬念型、情绪钩子型、职业场景型、反讽型），不得 5 个同构。

【一句话卖点】输出 1 条，25—40 字，硬性要求：
1. 必须包含：人物身份 + 核心冲突 + 反差或代价；
2. 用具体事件暗示爽点，禁止出现“很爽/逆袭/巅峰/打脸/爽翻”等空词；
3. 禁止剧透结局与关键反转，禁止堆砌爽点清单。

【标签】输出 genre（2—6 字细分题材，如 都市脑洞/职场商战/技术流）与 3 个内容标签（如 反卷咸鱼/降维碾压/信息差）。
genreTrack 取 male/female/mystery，与作者输入一致优先。
另输出一句 why（不超 40 字）说明这个选题的市场落点。可自然融入 1 个当下网络热梗（如“养龙虾”“已读不回”）增强活人感，但不得堆砌。

输出严格 JSON，不要 Markdown 代码块，必须闭合：
{
  "titleCandidates": ["书名1","书名2","书名3","书名4","书名5"],
  "sellingPoint": "25—40字卖点",
  "genreTrack": "male|female|mystery",
  "genre": "细分题材",
  "tags": ["标签1","标签2","标签3"],
  "why": "市场落点说明"
}`;
}

export function subtypePrompt(input: { concept: string; genreTrack: 'male' | 'female' | 'mystery' }): string {
  const track = TRACK_RULES[input.genreTrack];
  const tactics = Object.keys(GENRE_TACTICS).join('、');
  return `你是番茄小说选题架构师。作者只有一个模糊灵感，你需要判断它最该归到哪个二级题材、用哪种「写法子类型」、走什么风格轴。

作者灵感：${input.concept}
期望分轨：${input.genreTrack}（${track}）

可选二级题材（须从下列选一个，也可返回「其他/自定义题材」）：
${tactics}

写法子类型（写法标签，决定爽点长相，选最贴切的一个）：
反卷咸鱼 / 迟到系统 / 降维碾压 / 脑补震惊 / 赛博带货 / 反差身份 / 职业金手指 / 规则怪谈 / 重生清算 / 时间累积 / 身份错位 / 反向人设 / 其他（自填）

风格轴（三选一）：搞笑 / 严肃 / 混合

输出严格 JSON，不要 Markdown 代码块，必须闭合：
{
  "genre": "二级题材（须匹配上面列表或写自定义）",
  "subtype": "写法子类型",
  "styleAxis": "搞笑|严肃|混合",
  "why": "不超过 40 字，说明这个组合的市场落点与开篇打法"
}`;
}

/** planningPrompt 会要求模型回填的字段 → 中文标签，用于生成「已填/待补」清单。 */
const PLANNING_FIELD_LABELS: Array<[keyof ProjectData['planning'], string]> = [
  ['genre', '细分题材'],
  ['targetReader', '目标读者'],
  ['tags', '内容标签'],
  ['sellingPoint', '一句话卖点'],
  ['synopsis', '故事梗概'],
  ['coreConflict', '核心冲突'],
  ['emotionalGoal', '情绪目标'],
  ['emotionalBeats', '情绪节拍'],
  ['titleCandidates', '书名候选'],
];

/** 判空口径与 UI 一致：空串、纯空白、空数组都算「未填写」。 */
function planningFieldFilled(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === 'string' ? value.trim().length > 0 : value != null;
}

export function planningPrompt(project: ProjectData): string {
  const planning = project.planning;
  const tactic = genreTactic(planning.genre);
  // 用「JSON key（中文名）」列举，避免模型把中文标签映射错字段。
  const describe = (kind: 'filled' | 'empty'): string => PLANNING_FIELD_LABELS
    .filter(([key]) => planningFieldFilled(planning[key]) === (kind === 'filled'))
    .map(([key, label]) => `${key}（${label}）`)
    .join('、') || '无';
  return `你是番茄短篇策划编辑。基于用户已有信息做克制的结构化补强，不把平台经验说成算法事实。
${trackRule(planning.genreTrack, planning.genre)}
${tactic ? `【本题材写法】${tactic.core}` : ''}
【第 0 条·最高优先级：沿用用户已填内容】
凡下列「已填字段」，必须**原样照抄回来**：一个字都不许改写、精简、替换同义词、增删条目或调整顺序。
你的职责是补全「待补字段」，以及在**完全不改动既有内容**的前提下做增量补充（例如标签只能追加、不得替换已有标签）。
若你认为某个已填字段不妥，也只能沿用，不得擅自修改——本条优先级高于下面所有规则。
- 已填字段（必须原样沿用）：${describe('filled')}
- 待补字段（需要你补全）：${describe('empty')}
【只读约束·核心冲突类型】本书冲突类型已由用户点选为「${planning.coreConflictType || '未指定'}」。\
coreConflict 的任何补充都不得偏离该类型；该字段本身不在输出 JSON 中，禁止返回或改写它。
硬性规则：
1. 一句话卖点必须为25至40个汉字，只保留人物处境、核心事件和反差；不得剧透反派身份、反击手段或结局。
2. 给出5个书名候选，每个必须与题材、卖点和开篇一致；若用户已有书名候选，必须全部保留并在其后追加至5个。
3. 情绪目标必须写成可执行事件节拍，不得写“让读者爽”“写给某类人的情书”等创作说明。
4. 现实职业、法律和技术逻辑必须成立；不得让正面主角非法入侵、植入后门或破坏系统。
5. 禁止评价词堆砌、机械排比、总结金句和自我表扬。
6. 每个字段都必须出现在输出 JSON 中；已填字段照抄，缺字段视为无效输出。
输出严格 JSON（不含 coreConflictType，用户消息里的策划 JSON 即为当前已填内容）：
{"genre":"","targetReader":"","tags":["","",""],"sellingPoint":"","synopsis":"","coreConflict":"","emotionalGoal":"","emotionalBeats":[{"chapters":"1-2","emotion":"","triggerEvent":""}],"titleCandidates":["","","","",""]}。`;
}

export function outlinePrompt(project: ProjectData): string {
  const tactic = genreTactic(project.planning.genre);
  const chapterCount = Math.max(8, Math.min(36, Math.round(project.planning.targetWords / 1400)));
  return `你是中文类型小说的剧情结构编辑。请生成一份可直接指导逐章写作的详细剧情大纲，建议 ${chapterCount} 章，可根据故事闭环在上下 2 章内调整。

结构要求：
1. 先完成“建立处境—扩大代价—主动反击—危机升级—高潮兑现—余波收束”的因果链，每章必须改变人物处境、关系、掌握的信息或行动目标，禁止注水过场。
2. 黄金前三章必须迅速给出异常/困境、第一次有效行动和不可逆升级；不得连续三章只解释背景。
3. 每章的关键事件必须能拍成具体场面；“发生争执”“继续调查”“感情升温”等空泛描述不合格。
4. 转折/信息增量必须写清“本章结束后读者或人物新知道了什么”，不得与本章目标重复。
5. 情绪回报写本章兑现给读者的具体结果；章末钩子写下一章必须处理的新问题，两者不得是同一句话。
6. 伏笔安排必须标明“铺设：内容”或“回收：内容”；没有则写“无”。上下章衔接要说明承接的前置状态和留给下一章的状态。
7. 人物行为必须符合已有身份、欲望、能力边界；现实职业、法律和技术逻辑必须成立。
8. 最后两章必须完成核心冲突与主要伏笔闭环，不用总结性旁白代替剧情。

输出严格 JSON 数组，不要 Markdown、解释或代码围栏。每项字段必须完整：
{"title":"","phase":"","goal":"","characters":"","event":"","conflict":"","turn":"","payoff":"","foreshadowing":"","continuity":"","hook":""}

字段含义：
- phase：本章所属剧情阶段，如“开局立钩”“压力升级”“反击推进”“高潮兑现”“余波收束”。
- goal：主角本章可验证的行动目标。
- characters：主要出场人物及本章立场，使用顿号或分号简写。
- event：按发生顺序写 2 至 4 个关键动作/场面。
- conflict：阻止目标达成的具体力量与即时风险。
- turn：本章新增事实、关系变化或局势逆转。
- payoff：本章给读者兑现的爽点、情绪或答案。
- foreshadowing：本章铺设或回收的线索；没有写“无”。
- continuity：承接上一章的状态，以及本章结束后留给下一章的状态。
- hook：迫使读者继续阅读的具体未决问题。

${trackRule(project.planning.genreTrack, project.planning.genre)}
${tactic ? `【本题材写法】${tactic.core} 黄金三章须体现该题材爽点节奏。` : ''}`;
}

export type AssetKind = 'character' | 'world' | 'foreshadow';

function generationContext(project: ProjectData): string {
  return JSON.stringify({
    planning: project.planning,
    styleProfile: project.styleProfile,
    characters: project.characters,
    world: project.world,
    foreshadowing: project.foreshadowing,
  }, null, 2);
}

export function assetPrompt(kind: AssetKind, project: ProjectData): string {
  const schemas: Record<AssetKind, string> = {
    character: '{"name":"","identity":"","desire":"","flaw":"","relationships":"","voice":"","boundaries":"","arc":""}',
    world: '{"type":"rule|location|item|timeline","name":"","content":""}',
    foreshadow: '{"content":"","plantedChapter":null,"plannedPayoffChapter":null,"actualPayoffChapter":null,"status":"planned|planted|paid"}',
  };
  const labels: Record<AssetKind, string> = {
    character: '人物卡',
    world: '世界观设定',
    foreshadow: '伏笔',
  };
  return `你是严谨的中文类型小说设定编辑。根据下面的项目策划、文风和已有创作资产，生成一条新的${labels[kind]}。
不得与已有设定冲突；信息不足时做克制、可被后续剧情验证的推导，不得擅自改变核心冲突。
内容不得涉及未成年人色情、性剥削或其他违法违规题材。
只返回一个 JSON 对象，不要解释、Markdown 或代码块。不要输出 id，应用会在本地生成。
字段必须完整且严格使用以下结构：
${schemas[kind]}

【项目上下文】
${generationContext(project)}`;
}

/** 每个候选场景的默认条数与合法区间（beats 的「条数」指方案套数）。 */
const OPTION_COUNTS: Record<GenerateOptionsKind, { fallback: number; min: number; max: number }> = {
  titles: { fallback: 6, min: 3, max: 6 },
  sellingPoints: { fallback: 4, min: 3, max: 6 },
  tags: { fallback: 6, min: 3, max: 6 },
  targetReaders: { fallback: 6, min: 3, max: 6 },
  beats: { fallback: 3, min: 2, max: 3 },
};

/** 把用户请求的条数夹到该 kind 的合法区间，非数字回退默认值。 */
export function normalizeOptionCount(kind: GenerateOptionsKind, count?: number): number {
  const range = OPTION_COUNTS[kind];
  if (typeof count !== 'number' || !Number.isFinite(count)) return range.fallback;
  return Math.min(range.max, Math.max(range.min, Math.round(count)));
}

/** 策划切片：候选生成只需要这些上游信息，不必把整个 project 塞进 prompt。 */
export function optionsContext(project: ProjectData): string {
  const planning = project.planning;
  const rows: Array<[string, string]> = [
    ['分轨', planning.genreTrack],
    ['细分题材', planning.genre],
    ['目标读者', planning.targetReader],
    ['内容标签', planning.tags.join('、')],
    ['核心冲突类型', planning.coreConflictType || ''],
    ['核心冲突', planning.coreConflict],
    ['一句话卖点', planning.sellingPoint],
    ['故事梗概', planning.synopsis],
    ['情绪目标', planning.emotionalGoal],
    ['已有书名候选', planning.titleCandidates.join('、')],
    ['目标字数', String(planning.targetWords)],
  ];
  return rows.map(([label, content]) => `${label}：${content.trim() || '未填写'}`).join('\n');
}

/**
 * 生成候选项的系统提示。5 个 kind 共用一套 JSON 信封，差异只体现在规则段与 value 形状。
 * `exclude` 供「再来一批」使用：要求模型避开上一批与已采纳项。
 */
export function optionsPrompt(
  kind: GenerateOptionsKind,
  project: ProjectData,
  opts: { count?: number; exclude?: string[] } = {},
): string {
  const planning = project.planning;
  const tactic = genreTactic(planning.genre);
  const count = normalizeOptionCount(kind, opts.count);
  const exclude = [...new Set((opts.exclude ?? []).map(item => item.trim()).filter(Boolean))];

  const rules: Record<GenerateOptionsKind, string> = {
    titles: `任务：生成 ${count} 个书名候选。
1. 每个 4—12 字，字面透出核心设定或反差，有点击欲但禁止标题党式虚假承诺；
2. ${count} 个必须风格互异（设定直给型／反差悬念型／情绪钩子型／职业场景型／反讽型各挑不同角度），不得同构；
3. 禁用陈旧套路词：神级／最强／无敌／重生之／某婿／龙傲天／开局／震惊／万亿／王者／签到／我欲／全球高武；
4. note 写一句不超过 12 字的风格标注，如「反差悬念向」。
${tactic ? `5. 书名公式参考：${tactic.title}` : ''}`,
    sellingPoints: `任务：生成 ${count} 条一句话卖点候选。
1. 每条 25—40 个汉字，必须同时包含：人物身份 + 核心冲突 + 反差或代价；
2. 用具体事件暗示爽点，禁止「很爽／逆袭／巅峰／打脸／爽翻」等空词；
3. 禁止剧透结局与关键反转，禁止堆砌爽点清单；
4. ${count} 条切入角度必须不同（如身份反差／代价视角／对手视角／时间压力）；
5. note 写一句不超过 12 字的角度标注。`,
    tags: `任务：生成 ${count} 个内容标签候选。
1. 每个 2—6 字，是读者会用来检索的题材/套路词，不是形容词；
2. 必须贴合当前分轨与细分题材，且与已填标签互补、不重复；
3. 参考该轨常见标签（可超出该列表，但风格须一致）：${TAG_POOL[planning.genreTrack].join('、')}；
4. note 写一句不超过 12 字的适用说明。`,
    targetReaders: `任务：生成 ${count} 个目标读者画像候选。
1. 每个 4—10 字，是可辨识的读者群体而非泛指（「男性读者」这类不合格）；
2. 必须与当前分轨、题材、标签匹配，${count} 个之间不得互相包含；
3. 参考该轨常见画像（可超出该列表，但颗粒度须一致）：${READER_POOL[planning.genreTrack].join('、')}；
4. note 写一句不超过 14 字，说明该人群最吃哪种爽点。`,
    beats: `任务：生成 ${count} 套**互不相同**的情绪节拍方案。
1. 每套 4—8 条节拍，条数不足 4 或超过 8 的方案一律不要输出；
2. 每条节拍是一个对象：chapters（章节区间，如「1-2」）、emotion（情绪词）、triggerEvent（触发该情绪的具体事件，必须是能拍成画面的动作，不得写「感情升温」这类空话）；
3. 同一套内 chapters 必须按顺序递进且不重叠，情绪曲线要有起伏，不能全程同一种情绪；
4. ${count} 套之间走向必须不同（如「稳步升级」「先抑后扬」「双线交替」）；
5. label 写该套方案的名字（不超过 10 字），note 写一句不超过 20 字的走向说明；
6. 情绪词优先取该轨常用原型：${EMOTION_POOL[planning.genreTrack].join('、')}。`,
  };

  const shape = kind === 'beats'
    ? '{"options":[{"label":"方案名","note":"走向说明","value":[{"chapters":"1-2","emotion":"","triggerEvent":""}]}]}'
    : '{"options":[{"label":"候选内容","note":"一句说明"}]}';

  return `你是番茄短篇策划编辑，正在给作者提供可直接点选的候选项，不写正文、不写大纲。
${trackRule(planning.genreTrack, planning.genre)}
${tactic ? `【本题材写法】${tactic.core}` : ''}
【核心冲突类型可选枚举】${CONFLICT_TYPES.map(item => item.value).join('｜')}

${rules[kind]}

通用硬性规则：
- 候选之间必须有实质差异，禁止同义改写凑数；
- 现实职业、法律和技术逻辑必须成立；不得让正面主角非法入侵、植入后门或破坏系统；
- 内容不得涉及未成年人色情、性剥削或其他违法违规题材；
- 不得输出解释、思考过程、Markdown 代码块，只输出一个闭合 JSON 对象。
${exclude.length ? `\n【不得重复】以下内容已出现过，新候选必须与它们都不同：\n${exclude.map(item => `- ${item}`).join('\n')}` : ''}

输出严格 JSON，结构固定为：
${shape}

【当前策划信息】
${optionsContext(project)}`;
}

export function stylePrompt(genre: string, project: ProjectData): string {
  const tactic = genreTactic(genre);
  const track = project.planning.genreTrack;
  return `你是中文类型小说文风编辑。请基于题材“${genre}”以及下面的策划和已有资产，推导一份可直接执行的文风档案。
${tactic ? `本题材写法：${tactic.core}` : ''}
${trackRule(track, genre)}
不得改变故事设定，不得模仿或声称模仿具体在世作者。内容不得涉及未成年人色情、性剥削或其他违法违规题材。
【枚举白名单（必须优先命中，原样返回，不得改写措辞或自行扩写）】
- perspective 只能取：${STYLE_ENUMS.perspective.join('｜')}
- pace 只能取：${STYLE_ENUMS.pace.join('｜')}
- sentenceLength 只能取：${STYLE_ENUMS.sentenceLength.join('｜')}
- emotion 从该轨情绪原型中取 1—2 个：${poolOf(STYLE_ENUMS.emotion, track).join('｜')}（多个用「、」连接）
上述值会被 UI 直接当枚举项匹配，写成「第三人称限知」「短句为主，长短交错」这类近义表述会掉进「自定义」分支。
仅当以上枚举确实都不适用时才允许自定义，且必须保持同等颗粒度（4—8 字的短词，不写整句）。
dialogueRatio 必须是 10 至 80 的数字；数组字段必须返回数组；negativeSamples 每项必须同时包含 text 和 reason。
只返回一个 JSON 对象，不要解释、Markdown 或代码块。不要输出 schemaVersion，应用会保留本地版本。
字段必须完整且严格使用以下结构：
{"perspective":"","pace":"","emotion":"","dialogueRatio":40,"sentenceLength":"","protagonistVoice":"","bannedWords":[],"bannedPatterns":[],"referenceSamples":[],"negativeSamples":[{"text":"","reason":""}]}

【项目上下文】
${generationContext(project)}`;
}
