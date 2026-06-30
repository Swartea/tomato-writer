import { useState, useEffect, useRef } from 'react';

/* ---------- 图标组件 ---------- */
const Icon = ({ children, size = 18 }: { children: string; size?: number }) => (
  <span className="nav-icon" style={{ fontSize: size }}>{children}</span>
);

/* ---------- 侧边栏导航项 ---------- */
const NavItems = [
  { key: 'planning' as const, label: '开篇策划', icon: '🎯' },
  { key: 'editor' as const, label: '写作', icon: '✏️' },
  { key: 'outline' as const, label: '大纲', icon: '📑' },
  { key: 'characters' as const, label: '角色', icon: '👥' },
  { key: 'ai' as const, label: 'AI 助手', icon: '🤖' },
  { key: 'stats' as const, label: '统计', icon: '📈' },
];

type TabKey = typeof NavItems[number]['key'];

/* ---------- 数据结构 ---------- */
interface Chapter {
  id: string;
  title: string;
  content: string;
}

interface Project {
  id: string;
  name: string;
  genre: string;
  status: '策划中' | '写作中' | '已完成' | '已投稿';
  targetWords: number;
  chapters: Chapter[];
}

interface ChatMessage {
  id: string;
  from: 'user' | 'ai';
  text: string;
}

/* ---------- 工具函数 ---------- */
function countWords(text: string): number {
  if (!text) return 0;
  // 中文字符按字计数，英文按单词计数
  const chinese = text.match(/[\u4e00-\u9fff]/g) || [];
  const english = text.match(/[a-zA-Z]+/g) || [];
  return chinese.length + english.length;
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ---------- 示例数据 ---------- */
const DEMO_CHAPTER_1 = '林小雨从没想过，自己会在雷雨夜撞上一个人。\n\n那种撞法，不是小说里写的肩膀蹭肩膀、目光交汇心跳加速。是真撞——她跑得太急，脚底一滑，整个人扑出去，膝盖磕在对方皮鞋面上，疼得她当场\u201C嘶\u201D了一声。\n\n对方没动，站得笔直。雨水顺着他的伞骨滑下来，滴在她手背上，凉得她一哆嗦。\n\n\u201C你没事吧？\u201D他问。声音低，像是被雨压住了。\n\n她抬头看他——路灯只剩半盏亮，照出半张脸。轮廓很硬，眉骨高，嘴唇抿成一条线。\n\n\u201C没事。\u201D她站起来，膝盖还在疼，但她不想在陌生人面前蹲下去揉。\n\n他看了她一眼，像是在确认她真的没事，然后转身走了。\n\n走了三步，他停了一下。什么东西掉在地上——一块金属，巴掌大，在雨里闪了一下。\n\n她弯腰捡起来。是个怀表，表面刻着一只展翅的鹰，鹰爪下压着一圈字母。\n\n她看不懂那些字母。\n\n但她妈看得懂——第二天早上，当她把怀表搁在餐桌上的时候，她妈端着碗的手，停了。\n\n碗碎了。';

const DEMO_CHAPTER_2 = '面试通知是早上八点收到的。\n\n林小雨盯着手机屏幕看了三遍，确认不是群发短信。顾氏集团，设计岗，上午十点，带作品集。\n\n她翻出最好的那件白衬衫，熨了两遍，还是觉得不够挺。最后套了件黑色西装外套，对着镜子拽了拽领口。\n\n\u201C妈，我面试去了。\u201D\n\n她妈在厨房里没回头，手里的锅铲顿了一下：\u201C早去早回。\u201D\n\n——没问她面哪家。林小雨觉得正常，她妈从来不问这些。\n\n顾氏集团在新区CBD，玻璃幕墙从一楼贯到顶，阳光打上去像一块冰。她站在门口仰头看了两秒，深吸一口气，推门进去。\n\n前台让她填表，领了临时访客牌，坐电梯到22楼。\n\n走廊很安静，地毯吃掉了脚步声。她被带进一间会议室，对面坐着三个人，中间那个位子空着。\n\n\u201C林小姐是吧？先做个自我介绍。\u201D左边那个戴眼镜的女人说。\n\n她站起来，打开作品集，开始讲。\n\n讲到第三页的时候，会议室的门开了。\n\n一个人走进来，西装深灰，没打领带，步子不快不慢。\n\n他拉开中间那把椅子坐下，抬手示意她继续。\n\n她看了他一眼。\n\n然后她手里的翻页笔掉了。';

function createDemoProjects(): Project[] {
  return [
    {
      id: 'p1',
      name: '雨夜邂逅',
      genre: '都市言情',
      status: '写作中',
      targetWords: 40000,
      chapters: [
        { id: 'c1', title: '第一章 · 雨夜撞人', content: DEMO_CHAPTER_1 },
        { id: 'c2', title: '第二章 · 面试官席位', content: DEMO_CHAPTER_2 },
        { id: 'c3', title: '', content: '' },
      ],
    },
    {
      id: 'p2',
      name: '末路回声',
      genre: '悬疑推理',
      status: '策划中',
      targetWords: 30000,
      chapters: [
        { id: 'c1', title: '', content: '' },
      ],
    },
    {
      id: 'p3',
      name: '深渊之上',
      genre: '现代悬疑',
      status: '已完成',
      targetWords: 35000,
      chapters: Array.from({ length: 14 }, (_, i) => ({
        id: `c${i + 1}`,
        title: `第${i + 1}章 · 深渊${['序章', '暗涌', '裂隙', '坠落', '回声', '迷雾', '暗线', '对峙', '真相', '崩塌', '余震', '抉择', '归途', '终章'][i]}`,
        content: i === 0 ? '深渊不在脚下，在回头的那一眼。\n\n——他站在天台边缘，风把衣摆吹成一面旗。脚下是四十七层的夜景，灯火密得像撒了一把碎星。\n\n身后有人推门。' : '',
      })),
    },
  ];
}

/* ---------- localStorage 持久化 ---------- */
const STORAGE_KEY = 'tomato-writer-state';

interface PersistState {
  projects: Project[];
  currentProjectId: string;
}

function loadState(): PersistState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistState;
  } catch {
    return null;
  }
}

function saveState(state: PersistState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

/* ================================================================
 * 主应用
 * ================================================================ */
function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('planning');
  const [showProjectList, setShowProjectList] = useState(false);

  // 初始化：从 localStorage 加载，没有就用示例数据
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = loadState();
    return saved?.projects || createDemoProjects();
  });
  const [currentProjectId, setCurrentProjectId] = useState<string>(() => {
    const saved = loadState();
    return saved?.currentProjectId || 'p1';
  });

  // 持久化
  useEffect(() => {
    saveState({ projects, currentProjectId });
  }, [projects, currentProjectId]);

  // ---- 接收 VS Code 侧边栏消息 ----
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || !msg.type) return;
      switch (msg.type) {
        case 'switchTab':
          if (msg.tab && NavItems.some(n => n.key === msg.tab)) {
            setActiveTab(msg.tab as TabKey);
          }
          break;
        case 'switchProject':
          if (msg.projectId) {
            setCurrentProjectId(msg.projectId);
            setShowProjectList(false);
          }
          break;
        case 'newProject':
          if (msg.name) {
            const id = genId();
            const proj: Project = {
              id,
              name: msg.name,
              genre: '都市言情',
              status: '策划中',
              targetWords: 40000,
              chapters: [{ id: genId(), title: '', content: '' }],
            };
            setProjects(prev => [...prev, proj]);
            setCurrentProjectId(id);
            setActiveTab('planning');
          }
          break;
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const currentProject = projects.find(p => p.id === currentProjectId) || projects[0];

  /* ----- 项目操作 ----- */
  const switchProject = (projectId: string) => {
    setCurrentProjectId(projectId);
    setShowProjectList(false);
  };

  const newProject = (name?: string) => {
    const id = genId();
    const proj: Project = {
      id,
      name: name || `新项目 ${projects.length + 1}`,
      genre: '都市言情',
      status: '策划中',
      targetWords: 40000,
      chapters: [{ id: genId(), title: '', content: '' }],
    };
    setProjects([...projects, proj]);
    setCurrentProjectId(id);
    setShowProjectList(false);
    setActiveTab('planning');
  };

  /* ----- 章节操作 ----- */
  const updateChapter = (chapterId: string, updates: Partial<Chapter>) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== currentProjectId) return p;
      return {
        ...p,
        chapters: p.chapters.map(c => c.id === chapterId ? { ...c, ...updates } : c),
      };
    }));
  };

  const addChapter = () => {
    setProjects(prev => prev.map(p => {
      if (p.id !== currentProjectId) return p;
      const num = p.chapters.length + 1;
      return {
        ...p,
        chapters: [...p.chapters, { id: genId(), title: `第${num}章`, content: '' }],
      };
    }));
  };

  const deleteChapter = (chapterId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== currentProjectId) return p;
      if (p.chapters.length <= 1) return p; // 至少保留一章
      return { ...p, chapters: p.chapters.filter(c => c.id !== chapterId) };
    }));
  };

  /* ----- 计算项目总字数 ----- */
  const totalWords = currentProject.chapters.reduce((sum, c) => sum + countWords(c.content), 0);

  return (
    <div className="app-layout">
      {/* ====== 左侧导航栏 ====== */}
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">🍅</span>
          <span className="brand-text">番茄短篇</span>
        </div>
        <div className="project-badge" onClick={() => setShowProjectList(!showProjectList)}>
          <span className="project-name">{currentProject.name}</span>
          <span className={`project-status status--${currentProject.status}`}>{currentProject.status}</span>
          <Icon size={14}>⇅</Icon>
        </div>

        {showProjectList && (
          <div className="project-dropdown">
            {projects.map(p => (
              <div
                key={p.id}
                className={`project-item ${p.id === currentProjectId ? 'selected' : ''}`}
                onClick={() => switchProject(p.id)}
              >
                <span className="project-item-name">{p.name}</span>
                <span className={`project-status status--${p.status}`}>{p.status}</span>
                <span className="project-item-meta">{p.genre} · {p.chapters.reduce((s, c) => s + countWords(c.content), 0).toLocaleString()}字</span>
              </div>
            ))}
            <button className="project-new-btn" onClick={() => newProject()}>+ 新建项目</button>
          </div>
        )}

        <nav className="nav-list">
          {NavItems.map(item => (
            <button
              key={item.key}
              className={`nav-btn ${activeTab === item.key ? 'active' : ''}`}
              onClick={() => setActiveTab(item.key)}
              title={item.label}
            >
              <Icon>{item.icon}</Icon>
              <span className="nav-label">{item.label}</span>
              {activeTab === item.key && <span className="nav-indicator" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="version-tag">v0.3.1</span>
        </div>
      </aside>

      {/* ====== 主内容区 ====== */}
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <h1 className="page-title">{NavItems.find(n => n.key === activeTab)?.label}</h1>
            <span className="topbar-project-name">{currentProject.name}</span>
          </div>
          <div className="topbar-right">
            <span className="badge badge--info">番茄短篇规范已启用</span>
          </div>
        </header>

        <section className="panel-area">
          {activeTab === 'planning' && <PlanningPanel project={currentProject} onComplete={() => setActiveTab('editor')} onUpdateProject={(updates) => {
            setProjects(prev => prev.map(p => p.id === currentProjectId ? { ...p, ...updates } : p));
          }} />}
          {activeTab === 'editor' && (
            <EditorPanel
              project={currentProject}
              totalWords={totalWords}
              onUpdateChapter={updateChapter}
              onAddChapter={addChapter}
              onDeleteChapter={deleteChapter}
            />
          )}
          {activeTab === 'outline' && <OutlinePanel project={currentProject} />}
          {activeTab === 'characters' && <CharactersPanel project={currentProject} />}
          {activeTab === 'ai' && <AIPanel />}
          {activeTab === 'stats' && <StatsPanel project={currentProject} totalWords={totalWords} />}
        </section>
      </main>
    </div>
  );
}

/* ================================================================
 * 开篇策划面板
 * ================================================================ */
function PlanningPanel({ project, onComplete, onUpdateProject }: {
  project: Project;
  onComplete: () => void;
  onUpdateProject: (updates: Partial<Project>) => void;
}) {
  const [step, setStep] = useState(0);
  const [genre, setGenre] = useState(project.genre);
  const [coreHook, setCoreHook] = useState('');
  const [targetReader, setTargetReader] = useState('');
  const [titleIdeas, setTitleIdeas] = useState<string[]>(['']);
  const [wordTarget, setWordTarget] = useState(project.targetWords);
  const [openingStyle, setOpeningStyle] = useState('');
  const [sellingPoint, setSellingPoint] = useState('');
  const [emotionalArc, setEmotionalArc] = useState('');
  const [openingDraft, setOpeningDraft] = useState('');

  const steps = [
    { label: '题材定位', icon: '🏷️' },
    { label: '核心卖点', icon: '💡' },
    { label: '爆款标题', icon: '🔥' },
    { label: '开篇设计', icon: '✍️' },
    { label: '字数规划', icon: '📊' },
  ];

  const handleComplete = () => {
    // 保存策划数据到项目
    onUpdateProject({
      genre,
      targetWords: wordTarget,
      status: '写作中',
    });
    onComplete();
  };

  return (
    <div className="panel planning-panel">
      <div className="panel-header-row">
        <h2 className="panel-title">🎯 开篇策划</h2>
        <span className="badge badge--warn">{project.status === '策划中' ? '策划中 · 5步完成' : '已完成策划'}</span>
      </div>

      <div className="planning-progress">
        {steps.map((s, i) => (
          <button
            key={i}
            className={`plan-step ${i === step ? 'current' : ''} ${i < step ? 'done' : ''}`}
            onClick={() => setStep(i)}
          >
            <span className="step-icon">{i < step ? '✓' : s.icon}</span>
            <span className="step-label">{s.label}</span>
          </button>
        ))}
      </div>

      <div className="plan-content">
        {/* Step 0: 题材定位 */}
        {step === 0 && (
          <div className="plan-step-content">
            <h3>题材定位 — 你的故事属于哪个赛道？</h3>
            <p className="plan-hint">选赛道 = 选读者。番茄每个赛道的推荐逻辑不一样，选对了开篇才有方向。</p>
            <div className="genre-grid">
              {[
                { name: '都市言情', desc: '甜宠·虐恋·带球跑，番茄女频基本盘，过稿快', hot: true },
                { name: '悬疑推理', desc: '反转密集，读者的"再猜一章"就是你的留存', hot: true },
                { name: '古言宫斗', desc: '宅斗·权谋，适合慢热型作者，稿费稳定', hot: false },
                { name: '校园青春', desc: '清新治愈，暑期流量高峰，适合同人转手', hot: false },
                { name: '职场逆袭', desc: '爽感路线，男频女频都能做，打脸要快', hot: false },
                { name: '玄幻修仙', desc: '经典赛道，竞争大，需要有新设定才能出头', hot: false },
              ].map(g => (
                <button
                  key={g.name}
                  className={`genre-card ${genre === g.name ? 'selected' : ''}`}
                  onClick={() => setGenre(g.name)}
                >
                  <strong>{g.name}</strong>
                  <small className="muted">{g.desc}</small>
                  {g.hot && <span className="hot-tag">🔥 热门</span>}
                </button>
              ))}
            </div>
            <div className="plan-field">
              <label>目标读者画像</label>
              <input
                className="plan-input"
                placeholder="如：20-35岁女性，爱看甜宠反转，追剧型读者"
                value={targetReader}
                onChange={e => setTargetReader(e.target.value)}
              />
            </div>
            <div className="plan-nav">
              <span />
              <button className="btn btn--primary" onClick={() => setStep(1)}>下一步：核心卖点 →</button>
            </div>
          </div>
        )}

        {/* Step 1: 核心卖点 */}
        {step === 1 && (
          <div className="plan-step-content">
            <h3>核心卖点 — 一句话让编辑眼前一亮</h3>
            <p className="plan-hint">番茄短篇的卖点必须一句话能说清。不是\u201C写得好\u201D，而是\u201C这事太刺激/太甜/太反转了\u201D。</p>
            <div className="plan-field">
              <label>一句话核心卖点</label>
              <textarea
                className="plan-textarea"
                rows={2}
                placeholder="例：雨夜撞到的人，第二天坐进了我的面试官席位——而他手里拿着我妈藏了20年的东西"
                value={sellingPoint}
                onChange={e => setSellingPoint(e.target.value)}
              />
            </div>
            <div className="plan-field">
              <label>核心钩子（开篇前300字要埋什么悬念）</label>
              <textarea
                className="plan-textarea"
                rows={2}
                placeholder="例：她捡起来的那只怀表，背面刻的不是名字，是一行日期——她出生的日期"
                value={coreHook}
                onChange={e => setCoreHook(e.target.value)}
              />
            </div>
            <div className="plan-field">
              <label>情感弧线</label>
              <select
                className="plan-select"
                value={emotionalArc}
                onChange={e => setEmotionalArc(e.target.value)}
              >
                <option value="">选情感走向（决定读者追更的爽点在哪）</option>
                <option value="甜宠升温">甜宠升温（好感→暧昧→告白）</option>
                <option value="虐后反转">虐后反转（误会→虐→真相→甜）</option>
                <option value="悬念揭底">悬念揭底（谜面→线索→反转→真相）</option>
                <option value="逆袭爽感">逆袭爽感（低谷→机遇→翻盘→巅峰）</option>
              </select>
            </div>
            <div className="sellpoint-examples">
              <h4>🔥 番茄爆款卖点参考（直接抄都行）</h4>
              <div className="example-grid">
                <ExampleCard genre="都市言情" sell="失忆后重逢初恋，他已是她公司的最大股东" />
                <ExampleCard genre="悬疑推理" sell="死者留下的日记，每天多出一页——写的是明天的事" />
                <ExampleCard genre="甜宠反转" sell="闪婚对象竟是对头公司的CEO，婚后才发现" />
                <ExampleCard genre="职场逆袭" sell="被开除当天收到三份offer，最高那份来自前老板的死对头" />
              </div>
            </div>
            <div className="plan-nav">
              <button className="btn btn--ghost" onClick={() => setStep(0)}>← 上一步</button>
              <button className="btn btn--primary" onClick={() => setStep(2)}>下一步：爆款标题 →</button>
            </div>
          </div>
        )}

        {/* Step 2: 爆款标题 */}
        {step === 2 && (
          <div className="plan-step-content">
            <h3>爆款标题 — 具体数字 + 时间锚点 + 反转钩</h3>
            <p className="plan-hint">番茄标题 = 具体数字 + 时间锚点 + 反转钩。不是文学标题，是"点击诱饵"。</p>
            <div className="title-formula">
              <div className="formula-box">
                <span className="formula-label">番茄标题公式</span>
                <div className="formula-parts">
                  <span className="formula-part part--number">具体数字</span>
                  <span className="formula-op">+</span>
                  <span className="formula-part part--time">时间锚点</span>
                  <span className="formula-op">+</span>
                  <span className="formula-part part--hook">反转钩</span>
                </div>
                <div className="formula-example">
                  例：<strong>3天后</strong>他拿着<strong>2亿</strong>彩礼上门，我妈才发现他是我<strong>失联8年</strong>的亲哥
                </div>
              </div>
            </div>
            <div className="plan-field">
              <label>你的标题方案（可填多个，AI也能帮你生成）</label>
              {titleIdeas.map((idea, i) => (
                <div key={i} className="title-idea-row">
                  <input
                    className="plan-input title-input"
                    placeholder={i === 0 ? '例：雨夜撞上的人，3天后拿着2亿彩礼上门...' : '备选标题...'}
                    value={idea}
                    onChange={e => {
                      const newIdeas = [...titleIdeas];
                      newIdeas[i] = e.target.value;
                      setTitleIdeas(newIdeas);
                    }}
                  />
                  {titleIdeas.length > 1 && (
                    <button className="btn btn--ghost btn--sm" onClick={() => {
                      setTitleIdeas(titleIdeas.filter((_, j) => j !== i));
                    }}>✕</button>
                  )}
                </div>
              ))}
              <button className="btn btn--ghost btn--sm" onClick={() => setTitleIdeas([...titleIdeas, ''])}>+ 添加备选标题</button>
            </div>
            <div className="plan-nav">
              <button className="btn btn--ghost" onClick={() => setStep(1)}>← 上一步</button>
              <button className="btn btn--primary" onClick={() => setStep(3)}>下一步：开篇设计 →</button>
            </div>
          </div>
        )}

        {/* Step 3: 开篇设计 */}
        {step === 3 && (
          <div className="plan-step-content">
            <h3>开篇设计 — 前500字定生死</h3>
            <p className="plan-hint">番茄读者滑到你的开篇，3秒内没钩子就划走了。开篇三要素：场景立住 + 人物登场 + 冲突/悬念第一句就给。</p>
            <div className="opening-templates">
              <h4>开篇模板参考</h4>
              <div className="template-grid">
                <OpeningTemplate type="冲突开篇" desc="第一句就是矛盾/意外，场景立刻立住" example="林小雨从没想过，自己会在雷雨夜撞上一个人——而那个人，第二天坐在了她的面试官席位上。" />
                <OpeningTemplate type="悬念开篇" desc="埋一个读者忍不住追问的线索" example="那个怀表掉在雨地里的时候，林小雨没在意。直到她妈看到它，手里的碗直接碎了。" />
                <OpeningTemplate type="反差开篇" desc="用极端反差制造好奇心" example="所有人都觉得顾寒川不可能娶一个弄堂里长大的女孩。他确实没娶——他直接把婚戒套在了她手上。" />
              </div>
            </div>
            <div className="plan-field">
              <label>你的开篇风格</label>
              <select
                className="plan-select"
                value={openingStyle}
                onChange={e => setOpeningStyle(e.target.value)}
              >
                <option value="">选择开篇方式</option>
                <option value="冲突">冲突开篇（第一句就是矛盾）</option>
                <option value="悬念">悬念开篇（埋线索，引追问）</option>
                <option value="反差">反差开篇（极端对比造好奇）</option>
                <option value="日常崩塌">日常崩塌（平静→突然断裂）</option>
              </select>
            </div>
            <div className="plan-field">
              <label>开篇试写（前500字）</label>
              <textarea
                className="plan-textarea plan-textarea--long"
                rows={8}
                placeholder={"写前500字试试手感。卡住了？点右侧\u201CAI助手\u201D让它帮你生成开篇。"}
                value={openingDraft}
                onChange={e => setOpeningDraft(e.target.value)}
              />
              {openingDraft && (
                <small className="muted" style={{ marginTop: 4, display: 'block' }}>
                  当前字数：{countWords(openingDraft)} 字 {countWords(openingDraft) >= 500 ? '✓ 达标' : `（还需 ${500 - countWords(openingDraft)} 字）`}
                </small>
              )}
            </div>
            <div className="plan-nav">
              <button className="btn btn--ghost" onClick={() => setStep(2)}>← 上一步</button>
              <button className="btn btn--primary" onClick={() => setStep(4)}>下一步：字数规划 →</button>
            </div>
          </div>
        )}

        {/* Step 4: 字数规划 */}
        {step === 4 && (
          <div className="plan-step-content">
            <h3>字数规划 — 番茄短篇的节奏骨架</h3>
            <p className="plan-hint">番茄短篇黄金区间：3-5万字。太短推荐不起来，太长编辑让你转长篇。每章2500字左右，12-20章收完。</p>
            <div className="word-plan-grid">
              <div className="word-plan-card">
                <strong>总字数目标</strong>
                <div className="word-target-input-row">
                  <input
                    className="plan-input plan-input--number"
                    type="number"
                    value={wordTarget}
                    onChange={e => setWordTarget(parseInt(e.target.value) || 0)}
                  />
                  <span className="muted">字</span>
                </div>
                <div className="word-recommend">
                  <span className="rec-tag rec--short">短篇 1-3万</span>
                  <span className="rec-tag rec--medium">中篇 3-5万</span>
                  <span className="rec-tag rec--long">长篇 5-10万</span>
                </div>
              </div>
              <div className="word-plan-card">
                <strong>章节规划</strong>
                <div className="chapter-plan">
                  <PlanRow label="开篇钩子" words="1章 2,000-3,000字" ratio="10%" />
                  <PlanRow label="发展铺垫" words="4-6章 8,000-15,000字" ratio="35%" />
                  <PlanRow label="高潮反转" words="3-4章 6,000-10,000字" ratio="30%" />
                  <PlanRow label="收尾余韵" words="2章 4,000-6,000字" ratio="15%" />
                </div>
              </div>
              <div className="word-plan-card">
                <strong>番茄投稿须知</strong>
                <ul className="rule-list">
                  <li>✅ 单章 <strong>2,000-3,000字</strong>，太少编辑觉得你水字数</li>
                  <li>✅ 总字数 <strong>3-5万</strong> 过稿率最高，太长容易被劝转长篇</li>
                  <li>✅ 开篇 <strong>前300字</strong> 必须出钩子，编辑审稿只看这么多</li>
                  <li>✅ 每章结尾留 <strong>悬念或转折</strong></li>
                  <li>⚠️ 超 10万字 需转长篇赛道</li>
                </ul>
              </div>
            </div>
            <div className="plan-nav">
              <button className="btn btn--ghost" onClick={() => setStep(3)}>← 上一步</button>
              <button className="btn btn--primary" onClick={handleComplete}>✓ 完成策划，开始写作 →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ExampleCard({ genre, sell }: { genre: string; sell: string }) {
  return (
    <div className="example-card">
      <span className="example-genre">{genre}</span>
      <p className="example-sell">{sell}</p>
    </div>
  );
}

function OpeningTemplate({ type, desc, example }: { type: string; desc: string; example: string }) {
  return (
    <div className="opening-template">
      <strong className="template-type">{type}</strong>
      <small className="muted">{desc}</small>
      <p className="template-example">&ldquo;{example}&rdquo;</p>
    </div>
  );
}

function PlanRow({ label, words, ratio }: { label: string; words: string; ratio: string }) {
  return (
    <div className="plan-row">
      <span className="plan-row-label">{label}</span>
      <span className="plan-row-words">{words}</span>
      <span className="plan-row-ratio">{ratio}</span>
    </div>
  );
}

/* ================================================================
 * 写作编辑器面板
 * ================================================================ */
function EditorPanel({ project, totalWords, onUpdateChapter, onAddChapter, onDeleteChapter }: {
  project: Project;
  totalWords: number;
  onUpdateChapter: (chapterId: string, updates: Partial<Chapter>) => void;
  onAddChapter: () => void;
  onDeleteChapter: (chapterId: string) => void;
}) {
  const [activeChapterId, setActiveChapterId] = useState(project.chapters[0]?.id || '');
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 切换项目时重置选中章节
  useEffect(() => {
    if (project.chapters.length > 0 && !project.chapters.find(c => c.id === activeChapterId)) {
      setActiveChapterId(project.chapters[0].id);
    }
  }, [project.id]);

  const activeChapter = project.chapters.find(c => c.id === activeChapterId) || project.chapters[0];
  if (!activeChapter) {
    return (
      <div className="panel editor-panel">
        <div className="plan-hint">还没有章节，点击下方按钮创建第一章。</div>
        <button className="btn btn--primary" onClick={onAddChapter} style={{ marginTop: 12 }}>+ 创建第一章</button>
      </div>
    );
  }

  const wordCount = countWords(activeChapter.content);
  const targetChapter = 2500;
  const wordStatus = wordCount >= targetChapter ? 'ok' : 'warn';
  const wordStatusText = wordCount >= targetChapter ? '✓ 达标' : `${targetChapter - wordCount}字达标`;

  const handleContentChange = (value: string) => {
    onUpdateChapter(activeChapter.id, { content: value });
    // 自动保存提示
    setSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaved(true), 800);
  };

  const handleTitleChange = (value: string) => {
    onUpdateChapter(activeChapter.id, { title: value });
  };

  const handleSave = () => {
    setSaved(true);
  };

  return (
    <div className="panel editor-panel">
      <div className="toolbar">
        <div className="toolbar-group">
          <button className="btn btn--ghost btn--sm" onClick={onAddChapter} title="新建章节">+ 新章节</button>
          <button className="btn btn--ghost btn--sm" onClick={handleSave} title="保存">
            {saved ? '✓ 已保存' : '💾 保存'}
          </button>
          {project.chapters.length > 1 && (
            <button className="btn btn--ghost btn--sm" onClick={() => onDeleteChapter(activeChapter.id)} title="删除当前章节" style={{ color: '#e74c3c' }}>🗑 删除</button>
          )}
        </div>
        <div className="toolbar-group">
          <span className="toolbar-divider" />
          <button className="btn btn--ghost btn--sm" title="AI 续写">🤖 续写</button>
          <button className="btn btn--ghost btn--sm" title="润色">✨ 润色</button>
        </div>
      </div>

      <div className="editor-layout">
        <aside className="chapter-sidebar">
          <h3 className="section-label">{project.name} · 章节列表</h3>
          <div className="chapter-list">
            {project.chapters.map((ch, i) => (
              <ChapterItem
                key={ch.id}
                num={i + 1}
                title={ch.title || `第${i + 1}章`}
                words={countWords(ch.content)}
                active={ch.id === activeChapterId}
                empty={!ch.content}
                onClick={() => setActiveChapterId(ch.id)}
              />
            ))}
            <button className="add-chapter-btn" onClick={onAddChapter}>+ 添加章节</button>
          </div>
        </aside>

        <div className="editor-zone">
          <div className="editor-header">
            <input
              className="chapter-title-input"
              value={activeChapter.title}
              placeholder={`第${project.chapters.findIndex(c => c.id === activeChapterId) + 1}章标题`}
              onChange={e => handleTitleChange(e.target.value)}
            />
            <div className="editor-meta">
              <span className="word-count">
                <strong>{wordCount.toLocaleString()}</strong> / {targetChapter.toLocaleString()} 字
                <span className={`word-status word-status--${wordStatus}`}>{wordStatusText}</span>
              </span>
            </div>
          </div>
          <div className="editor-body">
            <textarea
              className="writing-area"
              placeholder={"从这里开始写，卡住了就点右下角\u201CAI助手\u201D..."}
              value={activeChapter.content}
              onChange={e => handleContentChange(e.target.value)}
              spellCheck={false}
            />
          </div>
          <div className="editor-footer">
            <span className="footer-hint">
              {saved ? '✓ 已自动保存' : '输入中...'} · Ctrl+Enter AI 续写 · 全书 {totalWords.toLocaleString()} 字
            </span>
            <span className="footer-pos">第 {project.chapters.findIndex(c => c.id === activeChapterId) + 1} / {project.chapters.length} 章</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChapterItem({ num, title, words, active = false, empty = false, onClick }: {
  num: number; title: string; words: number; active?: boolean; empty?: boolean; onClick?: () => void;
}) {
  return (
    <div className={`chapter-item ${active ? 'active' : ''} ${empty ? 'empty' : ''}`} onClick={onClick}>
      <span className="chapter-num">{num}</span>
      <div className="chapter-info">
        <span className="chapter-name">{title}</span>
        {!empty && <span className="chapter-words">{words.toLocaleString()}字</span>}
      </div>
    </div>
  );
}

/* ================================================================
 * 大纲管理面板
 * ================================================================ */
function OutlinePanel({ project }: { project: Project }) {
  return (
    <div className="panel outline-panel">
      <div className="panel-header-row">
        <h2 className="panel-title">故事大纲 · {project.name}</h2>
        <button className="btn btn--primary btn--sm">+ 新建大纲</button>
      </div>

      <div className="outline-grid">
        <Card title="故事主线" icon="📖" accent="#e67e22">
          <p className="card-text">{project.status === '策划中'
            ? '还没填故事主线？先去"开篇策划"把题材和卖点定下来，大纲才好写。'
            : `${project.name}：${project.genre}题材短篇，目标${project.targetWords.toLocaleString()}字，已写${project.chapters.reduce((s, c) => s + countWords(c.content), 0).toLocaleString()}字。`}</p>
          <div className="tag-row">
            <span className="tag tag--genre">{project.genre}</span>
            <span className="tag tag--length">短篇（{(project.targetWords / 10000).toFixed(1)}万字）</span>
            <span className="tag tag--tone">{project.status}</span>
          </div>
        </Card>

        <Card title="节奏安排" icon="〰️" accent="#3498db">
          <div className="pace-list">
            <PaceRow step={1} name="开篇钩子" desc="前500字立住场景+悬念" pace="快" />
            <PaceRow step={2} name="发展" desc="线索逐条浮现，关系推进" pace="中" />
            <PaceRow step={3} name="高潮" desc="身份揭露/真相曝光/对峙" pace="快" />
            <PaceRow step={4} name="回落" desc="真相消化，关系修复" pace="慢" />
            <PaceRow step={5} name="结局" desc="HE收尾，伏笔回收" pace="中" />
          </div>
        </Card>

        <Card title="分章细纲" icon="📋" accent="#2ecc71" wide>
          <table className="detail-table">
            <thead>
              <tr><th>#</th><th>章节名</th><th>字数</th><th>状态</th></tr>
            </thead>
            <tbody>
              {project.chapters.map((ch, i) => {
                const wc = countWords(ch.content);
                return (
                  <tr key={ch.id}>
                    <td>{i + 1}</td>
                    <td>{ch.title || `第${i + 1}章`}</td>
                    <td>{wc > 0 ? wc.toLocaleString() : '—'}</td>
                    <td>{wc >= 2500 ? <span className="badge badge--success">达标</span> : wc > 0 ? <span className="badge badge--warn">进行中</span> : <span className="muted">未写</span>}</td>
                  </tr>
                );
              })}
              {project.chapters.length === 0 && (
                <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 20 }}>暂无章节</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

function Card({ title, icon, children, accent, wide }: {
  title: string; icon: string; children: React.ReactNode; accent?: string; wide?: boolean;
}) {
  return (
    <div className={`card ${wide ? 'card--wide' : ''}`} style={{ '--accent': accent } as React.CSSProperties}>
      <div className="card-header">
        <span className="card-icon">{icon}</span>
        <h3 className="card-title">{title}</h3>
      </div>
      <div className="card-body">{children}</div>
    </div>
  );
}

function PaceRow({ step, name, desc, pace }: { step: number; name: string; desc: string; pace: string }) {
  const paceColor = pace === '快' ? '#e74c3c' : pace === '中' ? '#f39c12' : '#3498db';
  return (
    <div className="pace-row">
      <span className="pace-step">{step}</span>
      <div className="pace-info">
        <strong>{name}</strong>
        <small className="muted">{desc}</small>
      </div>
      <span className="pace-badge" style={{ background: paceColor, color: '#fff' }}>{pace}</span>
    </div>
  );
}

/* ================================================================
 * 角色设定面板
 * ================================================================ */
function CharactersPanel({ project }: { project: Project }) {
  return (
    <div className="panel characters-panel">
      <div className="panel-header-row">
        <h2 className="panel-title">角色与世界观 · {project.name}</h2>
        <div className="header-actions">
          <button className="btn btn--ghost btn--sm">+ 新角色</button>
          <button className="btn btn--ghost btn--sm">+ 世界观</button>
        </div>
      </div>

      <div className="char-grid">
        <CharacterCard
          name="林小雨"
          role="女主角"
          age="24"
          trait="弄堂长大的设计系毕业生。表面是温吞老实人，骨子里有股不认输的劲儿。她妈从小就告诉她：别信有钱人，别进大宅门。但她偏偏都做了。"
          color="#ff6b81"
          tags={['弄堂原生家庭', '设计专业', '倔强内核']}
        />
        <CharacterCard
          name="顾寒川"
          role="男主角"
          age="28"
          trait="顾氏集团继承人，外界标签是冷漠、高效、不近人情。但他对林小雨的态度从第一天就不正常——不是因为心动，是因为他知道她是谁。"
          color="#3742fa"
          tags={['顾氏继承人', '刻意靠近', '知情者']}
        />
        <CharacterCard
          name="林母（周静兰）"
          role="关键暗线人物"
          age="52"
          trait="在弄堂开小饭馆二十年。从不提过去，不提顾家，不提那只鹰纹怀表。她不是不想说——是说了怕女儿重走自己的路。"
          color="#9b59b6"
          tags={['旧账持有者', '沉默守护', '深藏往事']}
        />
      </div>

      <div className="world-section">
        <h3 className="section-label">世界观设定</h3>
        <div className="world-cards">
          <WorldCard title="时间地点" content="2024年夏，滨海市（虚构一线城市）。老城区弄堂 vs 新区CBD，两个世界隔一条江。" icon="🏙️" />
          <WorldCard title="核心场景" content="顾氏集团总部（冰冷的玻璃盒子）、老城弄堂（林母饭馆，油烟和旧照片）、江边咖啡厅（两人的灰色地带）、周家旧宅（已经改成民办诊所，但地下室没拆）" icon="📍" />
          <WorldCard title="隐藏设定" content="鹰纹怀表 = 顾家第二代身份信物。周静兰二十年前是顾家二少爷的未婚妻——那场意外失踪之后，她带着孩子离开了所有与顾家有关的东西。" icon="🔐" />
        </div>
      </div>
    </div>
  );
}

function CharacterCard({ name, role, age, trait, color, tags }: {
  name: string; role: string; age: string; trait: string; color: string; tags?: string[];
}) {
  return (
    <div className="char-card">
      <div className="char-avatar" style={{ background: `linear-gradient(135deg, ${color}22, ${color}44)` }}>
        <span className="char-avatar-letter" style={{ color }}>{name[0]}</span>
      </div>
      <div className="char-detail">
        <div className="char-name-row">
          <strong className="char-name">{name}</strong>
          <span className="char-role" style={{ color, borderColor: color }}>{role}</span>
        </div>
        <span className="char-age muted">{age}岁</span>
        <p className="char-trait">{trait}</p>
        {(tags || []).map(t => <span key={t} className="tag tag--small">{t}</span>)}
      </div>
    </div>
  );
}

function WorldCard({ title, content, icon }: { title: string; content: string; icon: string }) {
  return (
    <div className="world-card">
      <span className="world-card-icon">{icon}</span>
      <div>
        <strong>{title}</strong>
        <p>{content}</p>
      </div>
    </div>
  );
}

/* ================================================================
 * AI 辅助面板
 * ================================================================ */
const AI_FUNCTIONS = [
  { icon: '✍️', label: '续写', desc: '根据上下文续写下文', prompt: '请帮我续写下面的内容：\n\n' },
  { icon: '✨', label: '润色', desc: '优化文笔和表达', prompt: '请帮我润色以下文字，保持原意但让文笔更好：\n\n' },
  { icon: '📝', label: '扩写', desc: '丰富细节和描写', prompt: '请帮我扩写以下内容，增加细节和场景描写：\n\n' },
  { icon: '🔥', label: '起标题', desc: '生成番茄爆款标题', prompt: '请根据以下故事设定，生成5个番茄小说爆款标题（要求：具体数字+时间锚点+反转钩）：\n\n' },
  { icon: '💡', label: '灵感', desc: '获取剧情走向建议', prompt: '我写到这里卡住了，请给我3个剧情走向建议：\n\n' },
  { icon: '🎭', label: '对白', desc: '生成角色对话', prompt: '请根据以下角色设定生成一段对话：\n\n' },
];

// 模拟 AI 回复（未接入 API Key 时的演示回复）
function mockAIResponse(fnLabel: string, _userInput: string): string {
  const responses: Record<string, string> = {
    '续写': '（演示模式 — 接入 API Key 后将获得真实续写）\n\n她站在原地，看着他的背影消失在雨幕里。怀表的金属表面冰凉，贴在掌心，却像有温度一样发烫。\n\n她不知道为什么，总觉得这件事不会就这样结束。',
    '润色': '（演示模式 — 接入 API Key 后将获得真实润色）\n\n已为你优化了表达节奏，增强了画面感和情绪张力。建议在描写中加入更多五感细节（触觉、嗅觉），让读者更有代入感。',
    '扩写': '（演示模式 — 接入 API Key 后将获得真实扩写）\n\n已为你扩展了场景细节：雨势、灯光、人物微表情。增加了环境描写来烘托紧张氛围。',
    '起标题': '（演示模式 — 接入 API Key 后将获得真实标题生成）\n\n1. 雨夜撞上的人，3天后坐在了我的面试官席位上\n2. 他留下的怀表，让我妈摔碎了20年的沉默\n3. 1次雨夜偶遇，掀翻了两家人20年的旧账\n4. 面试官是我雨夜撞到的人，7天后他叫我别查下去\n5. 那块鹰纹怀表，是失踪10年的人留下的最后线索',
    '灵感': '（演示模式 — 接入 API Key 后将获得真实建议）\n\n1. 怀表上的字母是顾家暗号，林小雨在设计岗无意中破解了含义\n2. 林母的饭馆其实是为monitoring顾家而开的据点\n3. 顾寒川接近林小雨是奉命销毁证据，但他在执行中动了真感情',
    '对白': '（演示模式 — 接入 API Key 后将获得真实对话生成）\n\n林小雨：你早就知道我是谁。\n顾寒川：从你捡起那块表的那一刻。\n林小雨：那你为什么还让我进顾氏？\n顾寒川：因为你不进来，有些事就永远查不清了。',
  };
  return responses[fnLabel] || '（演示模式）已收到你的请求，接入 API Key 后将获得真实 AI 回复。';
}

function AIPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'init', from: 'ai', text: '你好！我是你的 AI 写作助手。选择上方功能或直接输入需求，我来帮你完成创作任务。我可以帮你续写、润色、生成番茄爆款标题、设计开篇钩子——任何一个环节卡住了，随时找我。\n\n⚠️ 当前为演示模式，接入 API Key 后将获得真实 AI 回复。' },
  ]);
  const [prompt, setPrompt] = useState('');
  const [activeFn, setActiveFn] = useState<string>('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!prompt.trim()) return;

    const userMsg: ChatMessage = { id: genId(), from: 'user', text: prompt };
    setMessages(prev => [...prev, userMsg]);
    setPrompt('');

    // 模拟 AI 回复
    setTimeout(() => {
      const fnLabel = activeFn || '续写';
      const aiText = mockAIResponse(fnLabel, prompt);
      const aiMsg: ChatMessage = { id: genId(), from: 'ai', text: aiText };
      setMessages(prev => [...prev, aiMsg]);
    }, 600);
  };

  const handleFnClick = (fn: typeof AI_FUNCTIONS[number]) => {
    setActiveFn(fn.label);
    setPrompt(fn.prompt);
  };

  const handleClear = () => {
    setMessages([
      { id: 'init', from: 'ai', text: '对话已清空。有什么需要帮忙的？' },
    ]);
    setPrompt('');
    setActiveFn('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="panel ai-panel">
      <div className="panel-header-row">
        <h2 className="panel-title">🤖 AI 写作助手</h2>
        <span className="badge badge--model">演示模式 · 未接入 API</span>
      </div>

      <div className="ai-layout">
        <div className="ai-fn-grid">
          {AI_FUNCTIONS.map(fn => (
            <button
              key={fn.label}
              className={`ai-fn-card ${activeFn === fn.label ? 'selected' : ''}`}
              onClick={() => handleFnClick(fn)}
              style={activeFn === fn.label ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)' } : undefined}
            >
              <span className="ai-fn-icon">{fn.icon}</span>
              <strong>{fn.label}</strong>
              <small className="muted">{fn.desc}</small>
            </button>
          ))}
        </div>

        <div className="ai-chat-zone">
          <div className="chat-messages">
            {messages.map(msg => (
              <ChatBubble key={msg.id} from={msg.from} text={msg.text} />
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="chat-input-bar">
            <textarea
              className="chat-input"
              placeholder={activeFn ? `已选择「${activeFn}」功能，输入内容后按 Ctrl+Enter 发送` : '粘贴你的文本，或描述你想要什么（例："帮我续写，男主该出现了"）'}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
            />
            <div className="chat-actions">
              <button className="btn btn--ghost btn--sm" onClick={handleClear}>清空</button>
              <button className="btn btn--primary" onClick={handleSend} disabled={!prompt.trim()}>发送 🚀</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ from, text }: { from: 'user' | 'ai'; text: string }) {
  return (
    <div className={`chat-bubble chat-bubble--${from}`}>
      <span className="chat-avatar">{from === 'ai' ? '🤖' : '👤'}</span>
      <p className="chat-text" style={{ whiteSpace: 'pre-wrap' }}>{text}</p>
    </div>
  );
}

/* ================================================================
 * 统计面板
 * ================================================================ */
function StatsPanel({ project, totalWords }: { project: Project; totalWords: number }) {
  const writtenChapters = project.chapters.filter(c => countWords(c.content) > 0).length;
  const totalChapters = project.chapters.length;
  const projectPercent = project.targetWords > 0 ? Math.round((totalWords / project.targetWords) * 100) : 0;

  return (
    <div className="panel stats-panel">
      <div className="panel-header-row">
        <h2 className="panel-title">数据看板 · {project.name}</h2>
        <select className="select-sm" defaultValue="今日">
          <option>今日</option>
          <option>本周</option>
          <option>本月</option>
        </select>
      </div>

      <div className="stat-grid">
        <StatCard label="全书字数" value={totalWords.toLocaleString()} unit="字" target={project.targetWords} percent={projectPercent} icon="📖" />
        <StatCard label="写作时长" value="47" unit="分钟" target={60} percent={78} icon="⏱️" />
        <StatCard label="章节进度" value={`${writtenChapters}`} unit={`/ ${totalChapters} 章`} target={totalChapters} percent={totalChapters > 0 ? Math.round((writtenChapters / totalChapters) * 100) : 0} icon="📝" />
        <StatCard label="连续天数" value="7" unit="天 🔥" target={30} percent={23} icon="🔥" />
      </div>

      <div className="progress-section">
        <h3 className="section-label">每日目标</h3>
        <div className="progress-bar-wrap">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: '100%' }} />
          </div>
          <span className="progress-text">2,580 / 2,000 字 · 已超额完成！🎉</span>
        </div>
      </div>

      <div className="progress-section">
        <h3 className="section-label">项目总进度 · {project.name}</h3>
        <div className="progress-bar-wrap">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${Math.min(projectPercent, 100)}%` }} />
          </div>
          <span className="progress-text">
            {totalWords.toLocaleString()} / {project.targetWords.toLocaleString()} 字 · {projectPercent}%
          </span>
        </div>
      </div>

      <div className="history-section">
        <h3 className="section-label">章节完成情况</h3>
        <table className="detail-table">
          <thead>
            <tr><th>#</th><th>章节名</th><th>字数</th><th>目标</th><th>状态</th></tr>
          </thead>
          <tbody>
            {project.chapters.slice(0, 10).map((ch, i) => {
              const wc = countWords(ch.content);
              return (
                <tr key={ch.id}>
                  <td>{i + 1}</td>
                  <td>{ch.title || `第${i + 1}章`}</td>
                  <td>{wc > 0 ? wc.toLocaleString() : '—'}</td>
                  <td>2,500</td>
                  <td>{wc >= 2500 ? <span className="badge badge--success">达标</span> : wc > 0 ? <span className="badge badge--warn">进行中</span> : <span className="muted">未写</span>}</td>
                </tr>
              );
            })}
            {project.chapters.length === 0 && (
              <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 20 }}>暂无章节数据</td></tr>
            )}
            {project.chapters.length > 10 && (
              <tr><td colSpan={5} className="muted" style={{ textAlign: 'center' }}>... 还有 {project.chapters.length - 10} 章</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, unit, target: _target, percent, icon }: {
  label: string; value: string; unit: string; target: number | string; percent: number; icon: string;
}) {
  const clampedPercent = Math.min(percent, 100);
  const isOver = percent > 100;
  const barColor = isOver ? '#2ed573' : percent >= 80 ? '#ffa502' : '#ff6b6b';

  return (
    <div className="stat-card">
      <div className="stat-top">
        <span className="stat-icon">{icon}</span>
        <span className="stat-label">{label}</span>
      </div>
      <strong className="stat-value">{value} <small className="stat-unit">{unit}</small></strong>
      <div className="stat-bar">
        <div className="stat-bar-fill" style={{ width: `${clampedPercent}%`, background: barColor }} />
      </div>
      <span className={`stat-percent ${isOver ? 'over' : ''}`}>{percent}%</span>
    </div>
  );
}

export default App;
