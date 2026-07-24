# 番茄写作助手 · 设计系统（优化版 v0.5.0）

> 本文档是番茄写作助手（tomato-writer）v0.5.0 的**唯一设计事实来源（Single Source of Truth）**。
> 基于 v0.4.0 现状审计重构，目标：在 VS Code 内保持主题自适应的同时，建立可维护的 token 层、
> 清晰的排版阶梯、明确的纵深体系，并把品牌真正用起来。
> 任何界面改造（webview 代码、新增面板、弹窗）都必须回归本文件中定义的 token 与组件参数。

---

## 1. Visual Theme & Atmosphere（视觉主题与氛围）

- **设计哲学**：为「写作」而生的工具，应当像稿纸一样安静、专注，又在关键操作处给出番茄般
  鲜活的能量提示。少装饰、多留白、强对比的层级，让创作者把注意力留给文字本身。
- **视觉基调**：温暖、克制、有手感（warm · restrained · tangible）。中性色带一丝暖意，
  避免冷灰；强调色只属于「番茄红」与「生长绿」两种语义。
- **核心视觉特征关键词**：`专注` · `温暖中性` · `番茄能量` · `清晰层级` · `轻纵深`
- **光影与质感倾向**：以 1px 暖边框 + 极轻扩散阴影建立层级（避免重投影与外发光）；
  激活态用番茄红的「软填充」而非纯描边；写作画布采用衬线字体营造阅读感。
- **品牌资产（必读）**：真实品牌标为 `media/tomato-icon.svg`——红番茄 `#E5483D` + 绿叶 `#2BB673`，
  **绝非 emoji 🍅**。界面中一切品牌露出（侧栏、空状态、关于页）必须使用该 SVG；图标与文字之间
  保留 ≥8px 留白（clear space），最小可识别尺寸 16px。
- **图标语言**：功能/导航图标统一为 **18px 线性 SVG，`stroke: currentColor`，线宽 1.6px**，
  圆角端点（round cap）。**禁止**在导航/功能区混用 emoji 与 SVG。

---

## 2. Color Palette & Roles（调色板与角色）

所有颜色以 HEX + CSS 变量双格式给出。VS Code 主题下，`--bg-*` / `--text-*` / `--border`
优先映射 `--vscode-*` 变量（见下表）；品牌色与语义色为产品自有 token，明/暗双套。

### VS Code Token 映射（实现时替换默认值）
| 我方 token | 映射到 VS Code 变量 | 回退值（light / dark） |
|---|---|---|
| `--bg-base` | `--vscode-editor-background` | `#FFFFFF` / `#1A1715` |
| `--bg-subtle` | `--vscode-sideBar-background` | `#F7F5F4` / `#211D1B` |
| `--bg-sidebar` | `--vscode-sideBar-background` | `#FBF8F7` / `#15110F` |
| `--surface` | `--vscode-editorWidget-background` | `#FFFFFF` / `#241F1C` |
| `--border` | `--vscode-panel-border` | `#ECE7E4` / `#322B27` |
| `--border-strong` | `--vscode-contrastBorder` | `#DCD4D0` / `#423930` |
| `--text-strong` | `--vscode-foreground` | `#1F1B1A` / `#F5EFEC` |
| `--text` | `--vscode-foreground` | `#423B39` / `#D8CFCB` |
| `--text-muted` | `--vscode-descriptionForeground` | `#8A7F7C` / `#948880` |

### Primary / Brand
| 角色 | HEX | CSS 变量 | 使用场景 |
|---|---|---|---|
| 番茄红（主色） | `#E5483D` | `--tomato` | 主按钮、激活态、强调、进度填充 |
| 番茄红·亮（暗色用） | `#FF6B5E` | `--tomato-bright` | 暗色主题下的主色 |
| 番茄红·深 | `#C5392F` | `--tomato-strong` | hover / 按压态 |
| 番茄红·柔 | `rgba(229,72,61,.10)` | `--tomato-soft` | 选中背景、软填充 |
| 生长绿（次品牌） | `#2BB673` | `--leaf` | 成长/进度达成、已完成状态、正向提示 |

### Neutral / Gray Scale（暖中性，非冷灰）
| 角色 | Light HEX | Dark HEX | CSS 变量 | 说明 |
|---|---|---|---|---|
| 背景·基底 | `#FFFFFF` | `#1A1715` | `--bg-base` | 编辑器画布 |
| 背景·次层 | `#F7F5F4` | `#211D1B` | `--bg-subtle` | 面板、卡片底 |
| 背景·侧栏 | `#FBF8F7` | `#15110F` | `--bg-sidebar` | 左侧导航 |
| 表面 | `#FFFFFF` | `#241F1C` | `--surface` | 卡片、弹窗 |
| 边框 | `#ECE7E4` | `#322B27` | `--border` | 1px 分隔线 |
| 边框·强 | `#DCD4D0` | `#423930` | `--border-strong` | hover/聚焦边框 |
| 文本·强 | `#1F1B1A` | `#F5EFEC` | `--text-strong` | 标题 |
| 文本·正文 | `#423B39` | `#D8CFCB` | `--text` | 正文 |
| 文本·弱 | `#8A7F7C` | `#948880` | `--text-muted` | 辅助说明、占位 |

### Semantic Colors
| 语义 | HEX | CSS 变量 | 场景 |
|---|---|---|---|
| 信息 | `#2F6FED` | `--info` | 提示徽章、链接 |
| 成功/达成 | `#2BB673` | `--leaf` | 字数达标、已完成 |
| 警告 | `#E08A1E` | `--warn` | 进行中、需注意 |
| 危险/错误 | `#E5483D` | `--danger` | 删除、校验失败 |

> 状态色（策划中/写作中/已完成/已投稿）统一收敛为：橙 `#E08A1E` / 绿 `#2BB673` /
> 蓝 `#2F6FED` / 紫 `#8B5CF6`，与语义色共用，避免色彩泛滥。
> 品牌 SVG 固定使用 `#E5483D` + `#2BB673`，不随主题变化。

---

## 3. Typography Rules（排版规则）

- **Font Family**
  - 界面（UI）：`-apple-system, "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif`
  - 写作画布（阅读衬线）：`"Noto Serif SC", "Songti SC", "Source Han Serif SC", serif`
  - 等宽（字数/进度数字）：`"JetBrains Mono", "SF Mono", ui-monospace, monospace`
- **设计哲学**：界面用无衬线保证信息密度与可读性；**写作画布切换为衬线**，让「写」与
  「看界面」在情绪上分离，强化专注感。层级靠「字重 + 颜色 + 间距」三件套控制，不靠巨大字号。

### Type Scale
| 级别 | 字号 | 字重 | 行高 | 字距 | 用途 |
|---|---|---|---|---|---|
| Display | 28px | 700 | 1.2 | -0.4px | 欢迎/空状态大标题 |
| Page Title | 20px | 700 | 1.3 | -0.2px | 顶栏页标题 |
| Panel Title | 17px | 700 | 1.35 | 0 | 面板标题 |
| Section | 15px | 600 | 1.4 | 0 | 区块小标题 |
| Body | 13.5px | 400 | 1.55 | 0 | 界面正文 |
| Small | 12.5px | 500 | 1.5 | 0 | 次要文字、按钮 |
| Caption | 11.5px | 500 | 1.4 | 0.2px | 状态、标签 |
| **Writing** | **17px** | **400** | **2.0** | **0.3px** | **写作画布正文** |

---

## 4. Component Stylings（组件样式）

> 以下 CSS 为可直接落地的参数；`var(--*)` 在 webview 中最终映射到第 2 节的 VS Code 变量。

### Buttons
```css
.btn { display:inline-flex; align-items:center; gap:6px; padding:8px 16px;
  border-radius:8px; font-size:13px; font-weight:500; cursor:pointer;
  transition:all .18s cubic-bezier(.4,0,.2,1); border:1px solid transparent; }
.btn--primary { background:var(--tomato); color:#fff; }
.btn--primary:hover { background:var(--tomato-strong); transform:translateY(-1px);
  box-shadow:0 4px 12px rgba(229,72,61,.28); }
.btn--ghost { background:transparent; color:var(--text); border-color:var(--border); }
.btn--ghost:hover { background:var(--bg-subtle); border-color:var(--tomato); }
.btn--danger { color:var(--danger); border-color:var(--border); background:transparent; }
.btn--danger:hover { background:var(--tomato-soft); border-color:var(--danger); }
```

### Cards
```css
.card { background:var(--surface); border:1px solid var(--border);
  border-radius:12px; padding:16px; transition:all .18s; }
.card:hover { border-color:var(--border-strong); box-shadow:0 2px 8px rgba(31,27,26,.06); }
```

### Inputs
```css
.input { width:100%; padding:9px 12px; border:1px solid var(--border);
  border-radius:8px; background:var(--bg-base); color:var(--text); font-size:13px; }
.input:focus { border-color:var(--tomato); box-shadow:0 0 0 3px var(--tomato-soft); }
.input::placeholder { color:var(--text-muted); }
```

### Navigation（侧栏导航项）
```css
.nav-item { display:flex; align-items:center; gap:11px; padding:9px 12px;
  border-radius:8px; color:var(--text-muted); font-size:13px; cursor:pointer; position:relative; }
.nav-item:hover { background:var(--bg-subtle); color:var(--text); }
.nav-item.active { background:var(--tomato-soft); color:var(--tomato); font-weight:600; }
.nav-item.active .nav-ind { position:absolute; left:0; top:50%; transform:translateY(-50%);
  width:3px; height:18px; border-radius:2px; background:var(--tomato); }  /* 左侧细指示条 */
```

### Badges / Tags
```css
.badge { display:inline-flex; align-items:center; gap:4px; padding:3px 10px;
  border-radius:20px; font-size:11.5px; font-weight:500; }
.badge--info { background:rgba(47,111,237,.14); color:var(--info); }
.badge--success { background:rgba(43,182,115,.14); color:var(--leaf); }
.badge--warn { background:rgba(224,138,30,.14); color:var(--warn); }
```

### Modals / Dialogs
```css
.overlay { position:fixed; inset:0; background:rgba(26,23,21,.45); backdrop-filter:blur(2px);
  display:flex; align-items:center; justify-content:center; z-index:99998; }
.dialog { background:var(--surface); border:1px solid var(--border);
  border-radius:16px; box-shadow:0 24px 64px rgba(31,27,26,.18); padding:24px; min-width:360px;
  animation:dialog-in .22s cubic-bezier(.4,0,.2,1); }
@keyframes dialog-in { from { opacity:0; transform:translateY(8px) scale(.98); }
  to { opacity:1; transform:none; } }
```

### 跨视图组件（覆盖全部 6 个面板）

**ProgressBar（进度条）** — 字数/目标达成
```css
.progress { height:6px; border-radius:999px; background:var(--bg-subtle); overflow:hidden; }
.progress__fill { height:100%; border-radius:999px;
  background:linear-gradient(90deg,var(--tomato),#FF8A5E); transition:width .4s var(--ease); }
.progress__fill.is-done { background:var(--leaf); }
```

**Toggle（开关）** — 设置项
```css
.toggle { width:40px; height:22px; border-radius:999px; background:var(--border);
  position:relative; cursor:pointer; transition:background .2s; }
.toggle.on { background:var(--tomato); }
.toggle::after { content:""; position:absolute; top:2px; left:2px; width:18px; height:18px;
  border-radius:50%; background:#fff; transition:left .2s; }
.toggle.on::after { left:20px; }
```

**PlanningCardGroup（策划页·分组选择）** — 替代 v0.4 的 3 列等宽卡
```css
.genre-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; }
.genre { display:flex; gap:12px; padding:14px; border:1px solid var(--border);
  border-radius:12px; cursor:pointer; transition:all .18s; }
.genre:hover { border-color:var(--tomato); background:var(--tomato-soft); }
.genre.active { border-color:var(--tomato); box-shadow:0 0 0 3px var(--tomato-soft); }
.genre__thumb { width:44px; height:44px; border-radius:10px; background:var(--bg-subtle);
  display:flex; align-items:center; justify-content:center; color:var(--tomato); flex-shrink:0; }
.genre__name { font-weight:600; font-size:14px; color:var(--text-strong); }
.genre__desc { font-size:12px; color:var(--text-muted); margin-top:2px; }
```

**OutlineNode（大纲页·章节节点）**
```css
.outline-node { display:flex; align-items:center; gap:10px; padding:11px 14px;
  border:1px solid var(--border); border-radius:10px; background:var(--surface); margin-bottom:8px; }
.outline-node__beat { font-size:12px; color:var(--text-muted); }
.outline-node__bar { width:3px; align-self:stretch; border-radius:2px; background:var(--tomato); }
```

**CharacterCard（角色页·人物卡）**
```css
.char-card { background:var(--surface); border:1px solid var(--border); border-radius:12px;
  padding:16px; display:flex; gap:14px; }
.char-avatar { width:48px; height:48px; border-radius:50%; background:var(--bg-subtle);
  display:flex; align-items:center; justify-content:center; font-weight:700; color:var(--tomato);
  font-family:var(--mono); flex-shrink:0; }
```

**AIMessage（AI 页·对话气泡）**
```css
.msg { max-width:78%; padding:11px 14px; border-radius:14px; font-size:13.5px; line-height:1.55; }
.msg--bot { background:var(--bg-subtle); color:var(--text); border-bottom-left-radius:4px; }
.msg--user { background:var(--tomato); color:#fff; margin-left:auto; border-bottom-right-radius:4px; }
```

**StatCard（统计页·数据卡）**
```css
.stat { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:18px; }
.stat__num { font-family:var(--mono); font-size:28px; font-weight:700; color:var(--text-strong);
  letter-spacing:-.5px; }
.stat__label { font-size:12px; color:var(--text-muted); margin-top:4px; }
```

**Toast（轻提示）**
```css
.toast { position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
  background:var(--surface); border:1px solid var(--border); border-radius:10px;
  padding:10px 16px; font-size:13px; box-shadow:0 8px 24px rgba(31,27,26,.12); z-index:99999; }
```

---

## 5. Layout Principles（布局原则）

- **Spacing System**：4px 基数 → `4 / 8 / 12 / 16 / 20 / 24 / 32 / 40`。
  面板内边距统一 `20px 24px`；卡片内边距 `16px`；区块间距 `24px`。
- **Grid System**：侧栏固定 `212px`（原 196px 略增，给品牌与分组留呼吸）；主区流式。
  内部栅格用 CSS Grid，列间距 `14px`；策划/角色页用 2 列分组。
- **Container**：写作画布正文最大宽度 `720px` 居中，保证中文阅读每行 ~35–40 字；
  统计/策划页内容最大宽度 `960px` 居中。
- **Section Spacing**：面板标题与内容 `18px`；区块之间 `24px`。
- **留白哲学**：写作视图是「美术馆级」留白（密度 4/10）；策划/角色/统计视图信息密度较高
  （6/10），但用卡片分组与 1px 分隔维持节奏，避免 v0.4 的拥挤感。

---

## 6. Depth & Elevation（深度与层级）

- **Shadow System**（阴影向背景色微调，自然不脏）
```css
--shadow-xs: 0 1px 2px rgba(31,27,26,.04);
--shadow-sm: 0 2px 8px rgba(31,27,26,.06);
--shadow-md: 0 8px 24px rgba(31,27,26,.08);
--shadow-lg: 0 24px 64px rgba(31,27,26,.18);  /* 弹窗 */
```
- **Surface Layers**：`bg-base → bg-subtle → surface → overlay`，逐级抬升。
- **Z-index Scale**：侧栏 `10` · 顶栏 `20` · 浮层工具条 `40` · Toast `99999` · 弹窗遮罩 `99998` · 弹窗 `99999`。
- **Backdrop Effects**：弹窗遮罩 `backdrop-filter: blur(2px)`；写作「专注模式」可叠一层
  柔和暗角（vignette）突出当前段落。

---

## 7. Do's and Don'ts（设计规范与禁忌）

**Do's**
1. 品牌色只用于「番茄红 + 生长绿」两种语义，其余交给中性色。
2. 写作画布用衬线字体，与无衬线界面明确区分。
3. 激活态用「软填充（tomato-soft）」而非纯描边，更克制。
4. 层级靠 字重+颜色+间距 三件套，不靠巨大字号。
5. 明/暗主题都通过 token 映射，不在组件里写死颜色。
6. 数字（字数/进度）用等宽字体，便于扫读。
7. 图标/品牌优先用项目自带的番茄 SVG 品牌标与线性图标，保持一致性。

**Don'ts**
1. ❌ 不要用 `#000000` 纯黑作文字或背景。
2. ❌ 不要使用外发光 / 霓虹渐变（AI 味重）。
3. ❌ 不要把 15+ 种字号散落各处——只走 Type Scale。
4. ❌ 不要让 `.muted` 透明度在暗色下弱到看不清（统一用 `--text-muted` token）。
5. ❌ 不要在界面里混用 emoji 图标与 SVG 图标——导航/功能统一图形语言。
6. ❌ 不要 3 个等宽卡片平铺（v0.4 策划页的题材网格）；改用非对称/分组。
7. ❌ 不要让硬编码语义色在用户切主题后对比度崩坏。
8. ❌ 不要把品牌标换成 emoji 🍅。

---

## 8. Responsive Behavior（响应式行为）

- **Breakpoints**：`≤800px` 移动/窄栏 · `801–1100px` 紧凑 · `≥1101px` 标准桌面。
- **Touch Targets**：可点击元素最小 `36×36px`。
- **折叠策略**：
  - `≤800px`：侧栏收为图标栏（仅图标+tooltip）；章节列表改为顶部横向滚动；
    统计卡 2 列；题材网格 1 列；角色卡 1 列。
  - 编辑器在窄屏下章节列表移到顶部，竖向堆叠。
- **Font Scaling**：写作画布在窄屏降至 `16px`；界面字号保持，靠间距压缩。

---

## 9. Agent Prompt Guide（AI 代理提示指南）

### Quick Reference
- 主色 `--tomato:#E5483D`，次品牌 `--leaf:#2BB673`，中性为**暖灰**非冷灰。
- 写作画布 = 衬线；界面 = 无衬线；数字 = 等宽。
- 间距走 4px 基数；圆角 8/12/16；阴影四级（xs→lg）。
- 所有颜色走 token，明/暗双套，禁止写死 HEX 到组件。
- 品牌标固定 `media/tomato-icon.svg`，不可替换为 emoji。

### Component Prompts（可直接复制）
1. `用番茄写作助手设计系统做一个「新建项目」对话框，含书名输入、题材下拉、每日目标数字框，主按钮用 --tomato`
2. `把写作画布重做成衬线字体、行高 2.0、最大宽度 720px 居中，右上角浮一个 AI 续写工具条`
3. `重做侧栏导航：212px，顶部品牌标（番茄SVG），中部分组导航（写作/策划/AI），底部状态`
4. `做一个字数统计卡片：大数字用等宽字体，下方细进度条用 --tomato 渐变填充`
5. `把策划页的题材选择从 3 列等宽卡改成 2 列分组（左图标右文），避免 AI 味`
6. `生成大纲页：章节节点用左侧 3px 番茄指示条 + 标题 + 节拍说明，节点间 8px 间距`
7. `生成角色卡：48px 圆形头像（首字母）+ 姓名/身份/一句话设定，2 列网格`
8. `生成 AI 助手页：bot/user 气泡对话，底部输入框 + 续写/润色/灵感建议 chip`
9. `生成统计页：4 张数据卡（总字数/连续天数/本日目标/完成率），数字等宽，配进度条`
10. `生成一个明/暗双主题的 CSS 变量表，品牌色番茄红+生长绿，中性为暖灰，并映射 --vscode-* 变量`

### Iteration Guide
1. 先定 token（颜色/字号/间距），再画组件，最后拼页面。
2. 每次只改一个维度（颜色 OR 间距 OR 字体），便于定位问题。
3. 暗色下优先检查对比度：`.muted` 类必须用 `--text-muted` token。
4. 番茄红饱和度已压到 <80%，如需更跳，只调 `--tomato` 一个值。
5. 写作画布是产品灵魂，衬线字体缺失时回退系统衬线，不要退化成无衬线。
6. 徽章/标签圆角统一 20px，不要混用方角。
7. 弹窗阴影用 `--shadow-lg`，不要用重黑投影。
8. 图标统一语言：导航用线性 SVG，不与 emoji 混排。
9. 品牌标只用 `media/tomato-icon.svg`，禁止 emoji 替代。
10. 验证明/暗两套时，切换 `prefers-color-scheme` 或 `--theme` 变量，不要分别手改。
