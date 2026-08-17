# 番茄写作助手 · 减负专项 —— 实现 Prompt（可直接转发给开发者）

> 这是一份**自包含的实现简报**。接收方不需要任何前置背景，按「必读 → 改动 → 验收」
> 顺序执行即可。下方「实现 Prompt」部分是可直接复制给 AI / 外包开发者的正文。

---

## 背景（给接收方的上下文，1 分钟读完）

`tomato-writer` 是一个 VS Code 扩展，面向中文网文作者，提供「策划 → 大纲 → 章纲 → 正文」
的 AI 辅助写作流。已验证 `npm run build` 通过、运行流健康。

当前最大体验问题：**AI 写作所依赖的两大上下文输入完全靠作者手填**——
1. 「创作资产」（人物 / 世界观 / 伏笔）：8 项字段逐个敲；
2. 「文风档案」（视角/节奏/情绪等 8 字段）：也是手敲。

本次目标：**给这两块加「AI 一键生成」按钮**，复用现有 AI 桥接，把手动输入降到最低。

---

## 实现 Prompt（复制下面整段交给开发者 / AI）

```text
你是 VS Code 扩展「番茄写作助手（tomato-writer）」的前端开发者。这是一个面向
中文网文作者的 AI 辅助写作扩展，技术栈：扩展宿主 TypeScript（编译到 out/），
webview 用 React + Vite（构建到 dist/webview/）。所有 AI 调用经宿主转发，
webview 不能直接 fetch 外部 API。

【本次目标】
为 webview 的「创作资产」面板和「文风档案」面板增加 AI 一键生成能力，
大幅减少作者手动输入。必须复用现有 AI 桥接与提示词体系，禁止引入新依赖。

【第一步：必读文件（先读再写）】
1. webview/src/types.ts       —— 找到 Character / WorldSetting / Foreshadow /
                                  StyleProfile 的真实字段定义，后续 JSON 输出
                                  必须严格对齐这些类型（以文件里实际字段为准）。
2. webview/src/prompts.ts     —— 重点看 buildContext() 和已有的 *Prompt()
                                  函数，以及它们共用的 JSON 解析辅助函数
                                  （如 parseJSON / 提取 ```json 代码块的逻辑）。
                                  新增提示词必须沿用同一套解析方式。
3. webview/src/bridge.ts      —— 看 requestAI(payload) 的入参与返回结构，
                                  这是 webview 调用 AI 的唯一通道。
4. webview/src/App.tsx        —— 所有 UI 是内联 React 组件（含 Assets /
                                  StyleProfile / Planning）。找到这些组件，
                                  观察已有的 busy / hasKey 状态和 AI 调用写法
                                  （例如 Planning 里「AI 补强策划案」按钮的实现，
                                   照抄它的请求/解析/回填模式）。
5. src/extension.ts           —— 看 createProject 如何接收 brainstorm 的 seed
                                  （当前只取 sellingPoint/genreTrack/genre/
                                  titleCandidates，把 tags/why 丢了）。

【第二步：改动 1 — prompts.ts 新增提示词函数】
新增两个纯函数，入参为已收集的项目上下文对象 ctx（含策划案 sellingPoint /
synopsis / coreConflict / genre、已有文风档案、已生成的资产列表），返回给
requestAI 的 prompt 字符串：
  A) assetPrompt(kind, ctx)，kind ∈ 'character' | 'world' | 'foreshadow'
     要求模型只返回一个 JSON 对象，字段严格对齐 types.ts 对应类型：
       - character: { name, identity, desire, flaw, relations, language,
                      boundary, arc }（字段名以 types.ts 为准，差则改）
       - world:     与 WorldSetting 对齐（rules/factions/keyLocations/...）
       - foreshadow:与 Foreshadow 对齐（title/hint/payoffChapter/level/...）
     在 prompt 里明确：基于 ctx 的策划案与文风推导，不要编造与设定冲突的内容；
     输出只能是 JSON，不要任何解释文字。
  B) stylePrompt(genre, ctx)
     基于 genre 推导 StyleProfile 的全部字段（pov/pace/mood/dialogueRatio/
     protagonistVoice/bannedWords/bannedTropes/referenceText/negativeSamples
     等，以 types.ts 为准），同样只返回 JSON。

【第三步：改动 2 — App.tsx 加生成入口】
- Assets 组件：在「人物 / 世界观 / 伏笔」三个子列表各加一个「AI 生成」按钮。
  点击 → 调用 requestAI({ kind:'asset', sub:kind, ctx }) → 解析 JSON →
  合并进对应 state（默认覆盖该类别全部条目，或追加一条新条目，二选一并在
  UI 上给一句提示）。busy 时禁用按钮。
- StyleProfile 组件：加「按题材推导文风」按钮（需 genre 非空，否则提示
  “请先在策划中填写题材”）；并补上 negativeSamples 的编辑输入框
  （当前类型里有但 UI 缺失）。点击 → requestAI({ kind:'style', ctx }) → 回填。
- 所有新增 AI 按钮的 disabled 逻辑统一为：disabled={busy || !hasKey}
  （当前 brainstorm 按钮只判了 busy，无 Key 时点了会报错，需一并修正）。

【第四步：改动 3 — extension.ts 透传（可选但建议）】
createProject 接收 brainstorm seed 时，把 tags / why 也写入项目对象，
不要丢弃（对齐 Project 类型里已有的相关字段，若类型没有则只补 tags）。

【第五步：健壮性】
- 所有 requestAI 调用必须 try/catch；AI 返回非 JSON 或字段缺失时，提示作者
  “生成失败，请重试”，绝不抛错崩溃。
- 文案全中文；任何生成内容不得涉及未成年人或违规题材。

【验收标准】
1. 不引入任何新 npm 依赖。
2. 在 Assets 三个子面板点「AI 生成」能拿到结构化 JSON 并正确回填到 UI。
3. 在 StyleProfile 点「按题材推导文风」能回填 8 字段；negativeSamples 可编辑。
4. 无 API Key 时，所有 AI 按钮为禁用态（灰显）。
5. 运行 npm run build：tsc 编译 0 error，vite 打包成功。

【不要做】
- 不要重写现有组件结构，只增量加按钮、state 与提示词函数。
- 不要改动 buildContext 的现有调用方，除非确认字段已对齐。
- 不要新增外部 API 调用，只用现有 requestAI 通道。
```

---

## 附：需求优先级（供排期参考，非实现必需）

| 编号 | 优先级 | 内容 |
|---|---|---|
| R1 | P0 | 创作资产 AI 生成（人物/世界观/伏笔） |
| R2 | P1 | 文风档案 AI 推导 + negativeSamples 入口 |
| R3 | P1 | 策划闭环：AI 补 genre/targetReader；brainstorm tags 落项目 |
| R4 | P2 | 章节关联人物/伏笔 UI + 上章指令复用 |
| R5 | P2 | 体验收尾（按钮按 hasKey 禁用、空策划警告、文档同步） |

> 上面 Prompt 已覆盖 R1+R2+R3。R4/R5 如需一并交付，请单独追加说明。
