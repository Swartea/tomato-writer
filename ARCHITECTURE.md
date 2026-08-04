# 架构与数据模型

## 边界

- `@tomato-writer/core`：唯一领域类型源、默认值、规范化、统计、质量规则、Prompt、模型解析与业务用例。禁止依赖 VS Code、Node 文件系统、DOM 或 React。
- `@tomato-writer/contracts`：Webview 与宿主的命令、响应、事件和运行时消息校验。
- Node 适配器：项目文件、原子写入、备份、导出和旧数据规范化。
- 模型适配器：OpenAI/MiniMax 兼容请求、错误归一化、推理剥离、超时和取消。
- VS Code 适配器：命令、目录选择、Activity Bar、GlobalState、SecretStorage 和 Webview 消息传输。
- React Webview：编辑交互、上下文预览和调用 `HostClient`，不持有 API Key，不编排多次模型请求。

`src/extension.ts` 只导出 VS Code 宿主入口；宿主和 Webview 由 esbuild/Vite 分别打包，`vscode` 保持 external。所有请求带 `requestId`，并发响应按 ID 关联；未知消息、字段缺失、重复请求、超时和取消均在协议边界处理。

## 源码布局

```text
packages/
├── core/
└── contracts/
src/
├── adapters/
└── projectRepository.ts
webview/src/
├── features/
├── hostClient.ts
├── rpcHostClient.ts
└── useProjectSession.ts
```

## 项目目录

新建项目默认进入系统“文稿/番茄写作项目”项目库，一本小说对应一个可独立复制的目录：

```text
小说名/
├── 正文/
├── 策划/
│   └── 大纲/
├── 资产/
│   ├── 人物/
│   ├── 世界观/
│   └── 伏笔/
├── 导出/
├── 备份/
├── .trash/
└── .tomato/
    ├── project.json
    ├── index.json
    └── generations/
```

正文及策划资产使用带中文区块的 UTF-8 TXT；`.tomato/index.json` 仅保存稳定 ID、状态、
顺序和相对路径。所有结构数据保持 `schemaVersion: 2`。外部修改 TXT 后可重新载入项目。
旧版英文目录和 JSON 文件继续按旧布局读写；打开项目不会自动迁移或重写，显式迁移采用
临时目录转换、完整校验、原子改名，且保留源项目。
加载旧候选记录时会补齐缺失字段，并根据候选正文重新计算长度、对话比例和违规项；历史缓存的质量指标不作为事实来源。

## AI 数据流

```text
策划 + 文风 + 当前章纲 + 最近三章 + 人物 + 世界观 + 伏笔
→ 用户预览上下文
→ 写作候选
→ 节奏 / 一致性 / 文风审校
→ 原候选与修订版并排审批
→ 备份
→ 人工批准后写入正式章节
```

Prompt 使用明确版本号。模型结果不能作为正式稿或平台判断的唯一依据。
只有状态仍为候选且正文非空的记录能够通过显式审批写入正式章节；加载、生成和审校本身不会批准候选。

## 当前范围

已实现文件化项目、统一项目树、策划与文风、大纲、人物/世界观/伏笔、逐章候选与审校、人工批准、备份、TXT/Markdown 导出、真实统计和旧数据迁移后端。

尚未实现云同步、多人协作、富文本、跨设备同步和多模型交叉审稿。
