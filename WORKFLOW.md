# 番茄写作助手 — 工作流（Workflow）

> 本文件固化「开发 → 构建 → 调试 → 打包 → 发布」的完整流程，避免再出现
> “webview 没构建就打包”“node_modules 被打进 vsix” 这类一致性问题。

---

## 1. 项目结构（关键路径）

```
tomato-writer/
├── src/extension.ts        # 扩展宿主（TypeScript / commonjs），编译到 out/
├── out/extension.js        # 编译产物（运行时读取，不进 git）
├── webview/                # React + Vite + TS 前端（仅开发期，不进 vsix）
│   └── src/                #   App.tsx / aiService.ts / SettingsPanel.tsx ...
├── dist/webview/           # webview 构建产物（运行时真正加载，不进 git）
├── media/                  # 图标（进 vsix）
├── .vscodeignore           # 控制打进 vsix 的文件
├── .gitignore              # 控制 git 跟踪（dist/ out/ node_modules/ *.vsix 均忽略）
└── package.json
```

**运行时加载关系**：扩展启动时读取 `out/extension.js`，webview 从 `dist/webview`
（`dist/webview/index.html` + `assets/index.js|css`）加载。因此 **`webview/` 源码目录
和 `node_modules/` 都不需要进 vsix**，只有 `dist/` 与 `out/` 是发布必需的。

---

## 2. 技术栈

| 层 | 技术 |
|----|------|
| 扩展宿主 | TypeScript（commonjs）+ VS Code API，`fetch` 代理 AI 请求（绕过 webview CSP） |
| Webview | React 18 + TypeScript + Vite + zustand |
| 构建 | `tsc`（扩展） + `vite build`（webview，输出固定文件名便于 CSP） |
| 打包 | `@vscode/vsce` |

---

## 3. 日常开发 / 调试

1. **启动扩展宿主（F5）**：`.vscode/launch.json` 已配置 “Run Extension”，
   按 F5 打开 Extension Development Host，加载 `out/` + `dist/webview`。
2. **改扩展宿主代码**（`src/extension.ts`）：
   - 单跑 `npm run compile`，或 `npm run watch` 实时增量编译。
3. **改 webview 代码**（`webview/src/*`）：
   - 需重新构建：`npm run webview:build`（输出到 `dist/webview`）。
   - 改完在扩展宿主窗口 `Ctrl/Cmd+R` 重新加载 webview 即可看到效果。
4. **（可选增强）webview 热更新**：目前未接入 Vite dev server；如需热更新，
   可在开发模式把 `asWebviewUri` 指向 `localhost:5173` 并运行 `npm run webview:dev`。

---

## 4. 一键构建

```bash
npm run build          # = webview:build && compile，同时产出 dist/ 与 out/
```

---

## 5. 打包（生成 .vsix）

```bash
npm run package        # = vsce package
```

`package` 会**自动先执行 `vscode:prepublish`**（`webview:build && compile`），
再打包。产物：`tomato-writer-<version>.vsix`。

> ⚠️ 永远不要手动 `vsce package` 后只改源码不重新构建——`vscode:prepublish`
> 已保证顺序，直接 `npm run package` 即可。

**`.vscodeignore` 的作用**（已配置）：排除 `node_modules`、`webview/`、`src/`、
`*.map`、`.vscode`、`optimize-copy.py`、`*.vsix`；并用 `!dist/**`、`!out/**`
否定规则强制保留被 `.gitignore` 忽略的编译产物。效果：vsix 从 ~24MB 降至 ~89KB。

---

## 6. 发布 / 上线

1. 在 `package.json` 更新 `version`（遵循 semver）。
2. 本地自测：`npm run package` 后 `code --install-extension tomato-writer-<v>.vsix`。
3. 提交并打 tag：`git tag v<version>`。
4. 推送 + 发布：
   - 连接 GitHub（Settings → 连接器）后 `git push --tags`；
   - 或 `vsce publish`（需 publisher 已注册并登录）。

---

## 7. 当前进度（截至 2026-07-18）

- **v0.4.0 功能（AI 集成）已基本完成、未提交**：
  - `src/extension.ts`：新增 `aiRequest` 代理（150s 超时，绕过 CSP）。
  - `webview/src/aiService.ts`：AI 配置类型 / localStorage 持久化 / `callAI()`。
  - `webview/src/SettingsPanel.tsx`：设置面板 + OpenAI/DeepSeek/通义/月之暗面预设。
  - `webview/src/App.tsx`、`index.css`：AI 功能 UI。
- **已修复**：打包流程（prepublish 串联 webview 构建）、`.vscodeignore` 瘦身、
  移除未引用的 `openai` 依赖。
- **待办**：提交 WIP → 打 tag v0.4.0 → 连接 GitHub 推送 / 发布（见任务清单 #5）。

---

## 8. 命令速查

| 命令 | 作用 |
|------|------|
| `npm run webview:dev` | 启动 Vite 开发服务器 |
| `npm run webview:build` | 构建 webview → `dist/webview` |
| `npm run compile` / `watch` | 编译扩展宿主 → `out/` |
| `npm run build` | webview 构建 + 扩展编译 |
| `npm run package` | 构建并打包成 vsix |
| F5 | 在 VS Code 内启动扩展调试 |
