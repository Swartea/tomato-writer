# 增量 PRD：策划与文风页「选择式填写」改造

> 增量文档，只描述本次变更。未提及部分维持现状。
> 代码锚点：`webview/src/features/PlanningFeature.tsx`、`webview/src/features/shared.tsx`、`packages/core/src/types.ts`（`Planning` L10-14 / `StyleProfile` L30-34）、`packages/contracts/src/index.ts`（`CommandMap`）、`packages/core/src/txtCodecs.ts`（`encode/decodePlanningTxt`）。

## 1. 变更目标

把「策划与文风」页从**全靠手敲**改为**以选代写**：核心字段提供按 `genreTrack` 预置的本地选项（无 API Key 也能用），开放型字段提供「AI 给灵感」按钮 → 返回 3~6 个候选 → 用户点选即填入。

可衡量目标：新建一本书完成核心策划所需手敲字数下降 ≥70%；**无 Key 状态下核心 6 字段（目标读者/标签/核心冲突类型/情绪目标/文风四项）可 100% 靠点选完成**。

## 2. 用户故事

| # | 故事 |
|---|---|
| U1 | 作为新手作者，我希望目标读者、标签这类字段能直接点选，以便不用凭空想词就能把策划填完。 |
| U2 | 作为没配 API Key 的用户，我希望本地预设选项照常可用，以便零配置也能开一本书。 |
| U3 | 作为已选好题材和读者的作者，我希望点一下就拿到 3~6 个书名/卖点候选，以便从中挑而不是从零写。 |
| U4 | 作为想快速定调的作者，我希望核心冲突和情绪目标先用枚举/原型选出方向再微调文字，以便不用一开始就写长段落。 |
| U5 | 作为对文风没概念的作者，我希望叙事视角/节奏/句式长度是下拉枚举，以便知道有哪些合法取值而不是面对空输入框。 |

## 3. 需求池

字段名以现有类型为准。「本地」= 有本地预设选项；「AI」= 有 AI 候选按钮。

### P0（必须有）

| # | 字段（代码名） | 当前形态 | 目标形态 | 本地 | AI | 上游依赖 |
|---|---|---|---|---|---|---|
| R1 | `planning.targetReader` | 单行 `input`（string） | 多选胶囊 + 「自定义…」补充；选中项以「、」拼接写回 string | ✅ 按 `genreTrack` | ✅ `kind=targetReaders` | `genreTrack`、`genre` |
| R2 | `planning.tags` | 逗号输入框 | 多选胶囊（已是 `string[]`，直接映射）+ 自定义追加 | ✅ 按 `genreTrack`/`genre` | ✅ `kind=tags` | `genreTrack`、`genre`、`targetReader` |
| R3 | **`planning.coreConflictType`（新增，可选字段）** | 无 | 单选枚举：人vs人／人vs环境／人vs自我／人vs社会／人vs系统／人vs命运；每项带一行释义 | ✅ 全轨共用 | ❌ | 无 |
| R4 | `planning.coreConflict` | 8 行 `textarea` | 保留 textarea；选中 R3 后自动写入「【人vs系统】」种子前缀 + 该类型的引导句（仅当正文为空时写入，不覆盖已有文本） | — | — | R3 |
| R5 | `planning.emotionalGoal` | 8 行 `textarea` | 情绪原型多选胶囊（爽/燃/甜/虐/悬/治愈/热血/破防/解压/意难平）→ 选中项拼成一句种子文案写入 textarea，用户可继续手改 | ✅ 按 `genreTrack` 排序推荐 | ❌ | `genreTrack` |
| R6 | `styleProfile.perspective` | `input` | 下拉：第一人称／限制性第三人称／全知第三人称／双视角交替／自定义… | ✅ | ❌ | — |
| R7 | `styleProfile.pace` | `input` | 下拉：快节奏／中速推进／慢热铺垫／快慢交替／自定义… | ✅ | ❌ | — |
| R8 | `styleProfile.sentenceLength` | `input` | 下拉：短句优先／长短交错／中等偏长／极短爆点／自定义… | ✅ | ❌ | — |
| R9 | `styleProfile.emotion` | `input` | 多选胶囊（复用 R5 情绪原型池，最多 2 项）→ 「、」拼接写回 string | ✅ | ❌ | R5 |
| R10 | **AI 候选机制底座** | 无 | 新增 `generateOptions` RPC + 通用候选面板组件（见 §4） | — | — | — |
| R11 | `planning.titleCandidates` | 每行一个的 textarea | 保留 textarea；新增「AI 生成书名候选」→ 卡片**多选**追加去重 | ❌ | ✅ `kind=titles` | `genre`+（`sellingPoint`\|`synopsis`\|`tags`）任一 |
| R12 | `planning.sellingPoint` | textarea | 保留 textarea；新增「AI 生成卖点候选」→ 卡片**单选**填入（覆盖前二次确认） | ❌ | ✅ `kind=sellingPoints` | `genre`+（`synopsis`\|`tags`\|`targetReader`）任一 |
| R13 | 无 Key 降级 | 现有按钮 `disabled={!hasKey}` | 全部 AI 按钮沿用该模式，并统一提示「需在 AI 设置中配置 API Key」；本地预设不受影响 | — | — | — |

### P1（应该有）

| # | 字段 | 目标形态 | 本地 | AI | 上游依赖 |
|---|---|---|---|---|---|
| R14 | `planning.emotionalBeats` | 保留 textarea；新增「AI 生成节拍方案」→ 返回 2~3 **套**方案（每套 4~8 条 `EmotionalBeat`），卡片单选采纳 | ❌ | ✅ `kind=beats` | `genre` + `emotionalGoal`\|`coreConflict` |
| R15 | AI 候选面板 | 「再来一批」按钮：保留已选，要求新批次与上批不重复 | — | ✅ | — |
| R16 | AI 候选面板 | 多选型候选支持「全选采纳」快捷键位 | — | — | — |
| R17 | `planning.genre` | 细分题材下拉旁展示题材策略卡摘要（已有 `genreTactic`），帮助用户选读者/标签 | ✅ | — | — |

### P2（可以有）

| # | 项 | 说明 |
|---|---|---|
| R18 | `planning.synopsis` | 「AI 生成梗概骨架」→ 3 条不同走向的一段式骨架，单选填入 |
| R19 | 自定义项沉淀 | 用户手输的读者/标签自定义项在本项目内记忆，下次出现在胶囊列表尾部 |
| R20 | 已选项回灌 | 把 R1~R5 的已选项作为硬约束注入现有 `strengthenPlanning` prompt，避免"AI 补强"覆盖用户选择 |

## 4. AI 候选机制产品规格

- **RPC**：新增 `generateOptions`，用 `kind` 区分场景（`titles` / `sellingPoints` / `tags` / `targetReaders` / `beats`；`synopsis` 留 P2）。方法拆分与否由架构师定，但**对 UI 必须是同一套请求/渲染协议**。
- **入参**：`{ kind, project, count? }`（沿用现有 `strengthenPlanning` 传整个 project 的惯例，prompt 内只取 planning 相关切片）。
- **返回**：统一信封 `{ kind, options: Array<{ label: string; value?: unknown; note?: string }> }`，长度 3~6；`beats` 的 `value` 为 `EmotionalBeat[]`，其余 `value` 缺省时取 `label`。`note` 为可选一行说明（如"偏爽文向"），UI 以次要文字展示。
- **触发门槛**：`genreTrack` 恒有默认值，故门槛为「`genre`、`targetReader`、`tags`、`coreConflictType`、`sellingPoint`、`synopsis` 中至少 1 项非空」。未满足时按钮 disabled，提示「请先选择题材或至少一项上游信息」。
- **呈现**：候选以可点击卡片/胶囊排列在触发按钮下方（不弹模态）。
  - **多选型**：`titles`、`tags`、`targetReaders` —— 点选=追加并去重，再点=取消。
  - **单选型**：`sellingPoints`、`beats` —— 点选=填入；若目标字段已有内容，二次确认后覆盖。
- **状态**：加载中（按钮转「AI 生成中…」并禁用，复用现有 `busy` 模式）／空结果（提示「没生成出候选，换个上游信息再试」）／失败（沿用现有 `note` 区展示错误文案 + 可重试）。
- **约束**：候选**不自动写入** project，必须用户点选才触发 `update()`；候选列表不落盘，切页即丢弃。
- **无 Key**：按钮 disabled + 提示语（同 R13）。

## 5. 本地预设池规格

按 `genreTrack` 分轨；以下为**示例，工程可扩**。所有多选控件末尾保留「＋自定义」输入。

| 池 | 男频 male | 女频 female | 悬疑 mystery |
|---|---|---|---|
| **目标读者** | 下沉市场男／都市白领男／学生党／硬核设定党／爽文老读者／历史军事迷／游戏二次元向 | 都市职场女性／学生党少女／甜宠党／虐恋党／古言宅斗迷／大女主成长向／已婚家庭向 | 硬核推理迷／社会派读者／刑侦剧观众／怪谈猎奇向／短平快反转党／民俗惊悚爱好者 |
| **内容标签** | 金手指／系统／逆袭／扮猪吃虎／无敌流／装逼打脸／日常搞笑／单女主 | 先婚后爱／破镜重圆／双向奔赴／追妻火葬场／复仇爽／事业脑／甜宠／群像 | 反转／密室／连环案／规则怪谈／民俗／单元剧／时间循环／双主角查案 |
| **情绪原型** | 爽／燃／热血／解压／装逼快感／逆袭感 | 甜／虐／治愈／破防／意难平／成长感 | 悬／惊／窒息感／恍然大悟／细思极恐／压抑 |

**核心冲突类型（三轨共用，单选，6 项固定枚举）**：人vs人｜人vs环境｜人vs自我｜人vs社会｜人vs系统｜人vs命运。每项配一句引导语（例：`人vs系统` → "主角与规则/机制博弈，靠理解并利用规则取胜"），用于 R4 种子文本。

**文风枚举**：见 R6~R9，与 `GENRE_TACTICS` 中的 `styleAxis`（搞笑/严肃/混合）不冲突，二者并存。

## 6. 待确认问题

| # | 问题 | PM 倾向 |
|---|---|---|
| Q1 | `targetReader` 是否升级为 `string[]`？升级会牵动 `txtCodecs` + 迁移。 | **不升级**，多选结果「、」拼接写回 string |
| Q2 | `coreConflictType` 是持久化为新字段，还是只作为 `coreConflict` 文本前缀不落库？ | 落库为**可选字段**，便于后续 prompt 使用 |
| Q3 | 情绪原型（R5/R9）多选上限？ | R5 不限（建议 2~3），R9 最多 2 |
| Q4 | AI 候选是否提供「一键全选采纳」？ | 仅多选型提供，列为 P1 |
| Q5 | 节拍方案（R14）采纳后是**覆盖**还是**追加**到现有 `emotionalBeats`？ | 覆盖 + 二次确认（方案是整体设计，混合会破坏节奏曲线） |

## 7. 给架构师的设计约束

**A. 需动类型定义（`packages/core/src/types.ts`）**
- 仅一处：`Planning` 新增可选字段 `coreConflictType?: string`（Q2 若否决则本项取消）。**必须 optional**——`decodePlanningTxt` 用 `requireSection` 严格解析，新增必填段会让所有旧 `本书策划.txt` 直接解析失败。
- `targetReader` 保持 `string`（Q1）。

**B. 仅 UI 形态变化，不动类型**
- `tags`(`string[]`)、`titleCandidates`(`string[]`)、`sellingPoint`/`synopsis`/`emotionalGoal`/`coreConflict`(`string`)、`emotionalBeats`(`EmotionalBeat[]`)、`styleProfile.perspective/pace/sentenceLength/emotion`(`string`) —— 全部沿用现类型，只换控件。

**C. 需新增 RPC：`generateOptions`**
需同步改动 5 处：
1. `packages/contracts/src/index.ts` —— `CommandMap` 新增条目 + `commands` Set 补名 + `validPayload` switch 补 case（校验 `kind` 白名单 + `project` 存在）；
2. `src/adapters/vscodeHost.ts` —— 新增 handler；
3. `packages/core/src/workflows.ts` —— `WritingWorkflows` 新增方法（参考 `recommendSubtype` 的 `parseModelJson` 模式）；
4. `packages/core/src/prompts.ts` —— 新增 options prompt 并 bump `PROMPT_VERSION`（当前 `2026.07-v3`）；
5. `packages/core/src/parsing.ts` —— 新增候选数组的解析/校验（长度、字段类型、去空）。

**D. 持久化影响（仅当 A 生效）**
- `encodePlanningTxt` / `decodePlanningTxt` 新增「核心冲突类型」段，且必须按**可选段**读取（不能用 `requireSection`）；
- `project.ts` `createProject` 补默认值；`schemaVersion` 升级策略由架构师定。

**E. 预设池落位建议**
- 预设池（读者/标签/情绪原型/冲突类型/文风枚举）建议放 `packages/core`（与 `GENRE_TACTICS` 同层），使 prompt 与 UI 共用同一份词表，避免漂移；`GENRE_OPTIONS` 现居 `webview/src/features/shared.tsx`，本次可不迁移。
- 多选胶囊、候选卡片面板建议作为通用原语加入 `webview/src/features/shared.tsx`（现仅有 `Section`/`Field`），供后续页面复用。

**F. 明确不改动**
- `strengthenPlanning`、`deriveStyle`、`recommendSubtype`、`brainstorm` 的签名与现有行为保持不变（R20 若做，只改 prompt 内容不改签名）。
