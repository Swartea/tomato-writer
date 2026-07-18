import { useState, useEffect, useRef } from 'react';
import { SettingsPanel } from './SettingsPanel';
import { loadAISettings, callAI, SELLPOINT_PROMPT, NAMING_PROMPT, BOOK_TITLE_PROMPT, OUTLINE_PROMPT, WRITING_PROMPT, AI_DETECT_PROMPT, LOGIC_CHECK_PROMPT, EDITOR_REVIEW_PROMPT } from './aiService';

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

/* ---------- 卖点示例库（根据题材动态推荐） ---------- */
const SELLLPOINT_EXAMPLES = [
  // 都市/现言类
  { genre: '现代言情', sell: '失忆后重逢初恋，他已是她公司的最大股东' },
  { genre: '都市情感', sell: '离婚当天，前夫的死对头拿着结婚证站在我门口' },
  { genre: '都市情感', sell: '合租的室友每晚带不同女人回家，直到那天带回来的是我妈' },
  // 豪门类
  { genre: '豪门总裁', sell: '闪婚残疾大佬3个月，他站起来了，还我失散20年的哥哥' },
  { genre: '豪门总裁', sell: '协议结婚第99天，他撕了离婚协议：我玩真的' },
  { genre: '豪门总裁', sell: '宴会上一杯酒泼过去，泼出了我隐藏10年的真实身份' },
  // 古言类
  { genre: '古言宫斗', sell: '穿成炮灰妃第7天，我用KPI把后宫改成996福报现场' },
  { genre: '古言宫斗', sell: '重生回大婚当天，我当着满朝文武退了这门婚' },
  { genre: '古言宫斗', sell: '作为恶毒女配，我决定摆烂——结果男主黑化了' },
  // 年代/重生类
  { genre: '重生年代', sell: '重生80年代，我靠空间囤货成首富，前夫后悔哭了' },
  { genre: '重生年代', sell: '重生回结婚前一天，我退了婚，嫁给了退伍兵' },
  { genre: '重生年代', sell: '带着超市回70年代，我成了供销社一枝花' },
  // 悬疑类
  { genre: '悬疑推理', sell: '死者留下的日记，每天多出一页——写的是明天的事' },
  { genre: '悬疑推理', sell: '每死一个人我继承一项技能，第7个死者是我爸' },
  { genre: '悬疑推理', sell: '搬到新家的第一晚，天花板传来 upstairs 的脚步声——但我住顶楼' },
  // 赘婿/男频类
  { genre: '赘婿逆袭', sell: '入赘三年被人当狗，直到老丈人跪下叫了一声龙王' },
  { genre: '都市脑洞', sell: '3天后他拿着2亿彩礼上门，我妈才发现他是我失联8年的亲哥' },
  { genre: '都市脑洞', sell: '被开除当天收到三份offer，最高那份来自前老板死对头' },
  // 穿书/快穿类
  { genre: '穿书快穿', sell: '穿成恶毒女配后我摆烂了，结果追我的反派排到法国' },
  { genre: '穿书快穿', sell: '系统让我当恶毒女配，我反手成了团宠' },
];

/* ---------- 角色模板库 ---------- */

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
  const [showSettings, setShowSettings] = useState(false);
  const [aiReady, setAiReady] = useState(false);

  // 检查 AI 是否已配置
  const checkAIReady = () => {
    const cfg = loadAISettings();
    setAiReady(!!cfg.apiKey);
  };

  useEffect(() => {
    checkAIReady();
  }, []);

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
    <>
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
          {activeTab === 'planning' && <PlanningPanel project={currentProject} aiReady={aiReady} onComplete={() => setActiveTab('editor')} onUpdateProject={(updates) => {
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
          {activeTab === 'ai' && <AIPanel aiReady={aiReady} project={currentProject} onOpenSettings={() => setShowSettings(true)} />}
          {activeTab === 'stats' && <StatsPanel project={currentProject} totalWords={totalWords} />}
        </section>
      </main>
    </div>

    {showSettings && <SettingsPanel onClose={() => { setShowSettings(false); checkAIReady(); }} />}
    </>
  );
}

/* ================================================================
 * 开篇策划面板
 * ================================================================ */
function PlanningPanel({ project, aiReady, onComplete, onUpdateProject }: {
  project: Project;
  aiReady: boolean;
  onComplete: () => void;
  onUpdateProject: (updates: Partial<Project>) => void;
}) {
  const [step, setStep] = useState(0);
  const [projectName, setProjectName] = useState(project.name);
  const [genre, setGenre] = useState(project.genre);
  const [sellpointResults, setSellpointResults] = useState<string>('');
  const [isLoadingSellpoint, setIsLoadingSellpoint] = useState(false);
  const [sellpointError, setSellpointError] = useState('');

  // 题材变化时，自动触发 AI 卖点生成
  useEffect(() => {
    if (!genre || !aiReady) return;
    if (!loadAISettings().apiKey) return;
    
    setIsLoadingSellpoint(true);
    setSellpointError('');
    setSellpointResults('');
    
    const prompt = SELLPOINT_PROMPT.replace('{genre}', genre);
    
    callAI([
      { role: 'system', content: prompt },
      { role: 'user', content: `请根据「${genre}」题材生成 10 个爆款卖点` }
    ]).then(result => {
      setSellpointResults(result);
      setIsLoadingSellpoint(false);
    }).catch(err => {
      setSellpointError(err.message || '生成失败');
      setIsLoadingSellpoint(false);
    });
  }, [genre, aiReady]);

  // 一键生成书名
  const generateBookTitles = () => {
    if (!genre) {
      setBookTitleError('请先在第一步选择题材');
      return;
    }
    if (!aiReady) {
      setBookTitleError('请先在设置中配置 AI API Key');
      return;
    }
    setIsLoadingBookTitle(true);
    setBookTitleError('');
    setBookTitleResults('');

    const userPrompt = `题材：${genre}\n书名：${projectName}\n核心卖点：${sellingPoint || '暂无'}\n\n请生成 10 个番茄爆款书名，按"具体数字+时间锚点+反转钩"公式。`;
    
    callAI([
      { role: 'system', content: BOOK_TITLE_PROMPT },
      { role: 'user', content: userPrompt }
    ]).then(result => {
      setBookTitleResults(result);
      setIsLoadingBookTitle(false);
    }).catch(err => {
      setBookTitleError(err.message || '生成失败');
      setIsLoadingBookTitle(false);
    });
  };
  const [coreHook, setCoreHook] = useState('');
  const [targetReader, setTargetReader] = useState('');
  const [titleIdeas, setTitleIdeas] = useState<string[]>(['']);
  const [bookTitleResults, setBookTitleResults] = useState<string>('');
  const [isLoadingBookTitle, setIsLoadingBookTitle] = useState(false);
  const [bookTitleError, setBookTitleError] = useState('');
  const [wordTarget, setWordTarget] = useState(project.targetWords);
  const [openingStyle, setOpeningStyle] = useState('');
  const [sellingPoint, setSellingPoint] = useState('');
  const [emotionalArc, setEmotionalArc] = useState('');
  const [openingDraft, setOpeningDraft] = useState('');

  // 书名实时同步到项目
  useEffect(() => {
    if (projectName !== project.name) {
      onUpdateProject({ name: projectName });
    }
  }, [projectName]);

  // 题材实时同步到项目
  useEffect(() => {
    if (genre !== project.genre) {
      onUpdateProject({ genre });
    }
  }, [genre]);

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
      name: projectName,
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
            <h3>题材定位 — 先给你的故事起个名</h3>
            <p className="plan-hint">书名先随便起一个，后面可以改。选赛道 = 选读者，番茄每个赛道的推荐逻辑不一样，选对了开篇才有方向。</p>
            <div className="plan-field">
              <label>书名 / 项目名</label>
              <input
                className="plan-input"
                placeholder="如：雨夜邂逅、深渊之上、3天后他拿着2亿上门..."
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
              />
            </div>
            {/* ===== 女频赛道（12个）===== */}
            <div className="genre-section-label">🌸 女频赛道</div>
            <div className="genre-grid">
              {[
                { name: '现代言情', desc: '甜宠·虐恋·带球跑，番茄女频基本盘，过稿最快', hot: true, audience: '18-35岁女性' },
                { name: '豪门总裁', desc: '现言脑洞顶流，占热榜30%-40%，闪婚+隐藏身份', hot: true, audience: '20-35岁女性' },
                { name: '古言宫斗', desc: '穿书·宅斗·洗白逆袭，古言脑洞3月榜第一', hot: true, audience: '18-28岁女性' },
                { name: '重生年代', desc: '常青树，2月新增在读是种田文5倍，空间+致富', hot: true, audience: '25-40岁女性' },
                { name: '穿书快穿', desc: '新兴热门，恶毒女配洗白，系统任务流', hot: true, audience: '18-28岁女性' },
                { name: '悬疑言情', desc: '灵异+言情双线，女频悬疑增速最快', hot: false, audience: '20-35岁女性' },
                { name: '校园青春', desc: '清新治愈，暑期流量高峰，适合同人转手', hot: false, audience: '16-25岁女性' },
                { name: '种田美食', desc: '轻松向田园生活，经营+美食，解压首选', hot: false, audience: '25-40岁女性' },
                { name: '幻想言情', desc: '仙侠+言情，女频玄幻，大女主修真', hot: false, audience: '18-30岁女性' },
              ].map(g => (
                <button
                  key={g.name}
                  className={`genre-card ${genre === g.name ? 'selected' : ''}`}
                  onClick={() => setGenre(g.name)}
                >
                  <strong>{g.name}</strong>
                  <small className="muted">{g.desc}</small>
                  <span className="genre-audience">👥 {g.audience}</span>
                  {g.hot && <span className="hot-tag">🔥 热门</span>}
                </button>
              ))}
            </div>

            {/* ===== 男频赛道（10个）===== */}
            <div className="genre-section-label" style={{ marginTop: 16 }}>🔥 男频赛道</div>
            <div className="genre-grid">
              {[
                { name: '都市脑洞', desc: '异能+反套路金手指，男频TOP1，完读率76%', hot: true, audience: '25-35岁男性' },
                { name: '赘婿逆袭', desc: '战神归来·身份反转，30-45岁男性最爱', hot: true, audience: '30-45岁男性' },
                { name: '悬疑推理', desc: '反转密集，"再猜一章"=留存率，短剧改编率高', hot: true, audience: '全年龄' },
                { name: '玄幻修仙', desc: '经典赛道竞争大，需要新设定才能出头', hot: false, audience: '18-30岁男性' },
                { name: '历史军事', desc: '抗战谍战·穿越争霸，考据党最爱', hot: false, audience: '25-40岁男性' },
                { name: '科幻末世', desc: '无限流·末日求生，新兴赛道蓝海', hot: false, audience: '20-35岁男性' },
                { name: '游戏竞技', desc: '电竞·网游·直播，年轻男性受众', hot: false, audience: '16-25岁男性' },
                { name: '系统流', desc: 'AI反内卷等新金手指玩法，经典不衰', hot: false, audience: '22-35岁男性' },
              ].map(g => (
                <button
                  key={g.name}
                  className={`genre-card ${genre === g.name ? 'selected' : ''}`}
                  onClick={() => setGenre(g.name)}
                >
                  <strong>{g.name}</strong>
                  <small className="muted">{g.desc}</small>
                  <span className="genre-audience">👥 {g.audience}</span>
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
                <option value="甜宠升温">甜宠升温（好感→暧昧→告白·最稳路线）</option>
                <option value="虐后反转">虐后反转（误会→虐→真相→甜·催泪爆款）</option>
                <option value="悬念揭底">悬念揭底（谜面→线索→反转·悬疑必备）</option>
                <option value="逆袭爽感">逆袭爽感（低谷→翻盘→巅峰·男频最爱）</option>
                <option value="破镜重圆">破镜重圆（分离→误会→重逢·久别胜新婚）</option>
                <option value="追妻火葬场">追妻火葬场（忽视→失去→追悔·女频爽点天花板）</option>
                <option value="HE治愈向">HE治愈向（创伤→治愈→成长·温暖系）</option>
                <option value="极限拉扯">极限拉扯（相爱相杀→试探→摊牌·强张力）</option>
              </select>
            </div>
            <div className="sellpoint-examples">
              <h4>
                🔥 番茄爆款卖点参考
                {isLoadingSellpoint ? <span className="badge badge--loading">🤖 AI生成中...</span> : 
                 sellpointResults ? <span className="badge badge--success">✅ AI已生成</span> : 
                 aiReady ? <span className="badge badge--info">点击下一步触发</span> : 
                 <span className="badge badge--warn">⚙️ 未配置AI</span>}
              </h4>
              
              {isLoadingSellpoint ? (
                <div className="ai-loading">
                  <div className="ai-loading-spinner"></div>
                  <p className="muted">AI正在根据当前题材「{genre}」生成卖点选项...</p>
                </div>
              ) : sellpointResults ? (
                <div className="sellpoint-ai-results">
                  <p className="plan-hint" style={{ marginTop: 0, marginBottom: 12 }}>
                    🤖 AI根据当前题材 <strong>{genre}</strong> 生成的卖点选项
                  </p>
                  <div className="sellpoint-ai-list">
                    {sellpointResults.split('\n').filter(line => {
                      const trimmed = line.trim();
                      // 跳过空行、标题行和推荐标记行
                      if (!trimmed) return false;
                      if (trimmed.includes('促销文案') || trimmed.includes('卖点选项') || trimmed.includes('、时效性')) return false;
                      if (trimmed.startsWith('⭐')) return false;
                      return true;
                    }).map((line, i) => {
                      const trimmed = line.trim();
                      // 解析 "序号. 卖点 —— 抓住点：xxx" 格式
                      const match = trimmed.match(/^\d+\.\s*(.+?)(?:——|[-—])\s*(?:抓住点[：:]?\s*(.+))?$/);
                      const sellText = match ? match[1].trim() : trimmed.replace(/^\d+\.\s*/, '').trim();
                      if (!sellText) return null;
                      return (
                        <div 
                          key={i} 
                          className="sellpoint-ai-item"
                          onClick={() => setSellingPoint(sellText)}
                          title="点击填入上面的卖点输入框"
                        >
                          <span className="sellpoint-ai-num">{i + 1}</span>
                          <span className="sellpoint-ai-text">{sellText}</span>
                          {match && match[2] && <span className="sellpoint-ai-hook">🎯 {match[2].trim()}</span>}
                        </div>
                      );
                    }).filter(Boolean)}
                  </div>
                  <p className="plan-hint" style={{ fontSize: 12, marginTop: 8 }}>
                    💡 点击任意选项可填入上方卖点输入框
                  </p>
                </div>
              ) : sellpointError ? (
                <div className="sellpoint-ai-error">
                  <p>⚠️ AI生成失败：{sellpointError}</p>
                  {genre && (
                    <button 
                      className="btn btn--small" 
                      onClick={() => {
                        setIsLoadingSellpoint(true);
                        setSellpointError('');
                        const prompt = SELLPOINT_PROMPT.replace('{genre}', genre);
                        callAI([
                          { role: 'system', content: prompt },
                          { role: 'user', content: `请根据「${genre}」题材生成 10 个爆款卖点` }
                        ]).then(result => {
                          setSellpointResults(result);
                          setIsLoadingSellpoint(false);
                        }).catch(err => {
                          setSellpointError(err.message || '生成失败');
                          setIsLoadingSellpoint(false);
                        });
                      }}
                    >
                      重新生成
                    </button>
                  )}
                </div>
              ) : (
                // 没有 AI 结果时显示静态参考示例
                <>
                  {genre && (
                    <p className="plan-hint" style={{ marginTop: 0, marginBottom: 12 }}>
                      当前题材：<strong>{genre}</strong>，以下是适合的卖点范例
                    </p>
                  )}
                  <div className="example-grid">
                    {(() => {
                      const recommended = genre 
                        ? SELLLPOINT_EXAMPLES.filter(ex => {
                            if (ex.genre === genre) return true;
                            if (ex.genre.includes('都市') && genre.includes('都市')) return true;
                            if (ex.genre.includes('豪门') && genre.includes('豪门')) return true;
                            if (ex.genre.includes('古言') && genre.includes('古言')) return true;
                            if (ex.genre.includes('重生') && genre.includes('重生')) return true;
                            if (ex.genre.includes('悬疑') && genre.includes('悬疑')) return true;
                            if (ex.genre.includes('赘婿') && genre.includes('赘婿')) return true;
                            if (ex.genre.includes('穿书') && genre.includes('穿书')) return true;
                            return false;
                          })
                        : SELLLPOINT_EXAMPLES;
                      const displayList = recommended.length > 0 ? recommended : SELLLPOINT_EXAMPLES;
                      return displayList.map((ex, i) => (
                        <ExampleCard key={i} genre={ex.genre} sell={ex.sell} />
                      ));
                    })()}
                  </div>
                </>
              )}
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
              <div className="formula-examples">
                <h4>📌 各赛道爆款标题范例</h4>
                <div className="formula-example-item"><strong>都市脑洞：</strong>3天后他拿着2亿彩礼上门，我妈才发现他是我失联8年的亲哥</div>
                <div className="formula-example-item"><strong>重生年代：</strong>重生80年代，我靠空间囤货成首富，前夫后悔哭了</div>
                <div className="formula-example-item"><strong>豪门总裁：</strong>闪婚残疾大佬3个月，他站起来了，还我失散20年的哥哥</div>
                <div className="formula-example-item"><strong>悬疑灵异：</strong>每死一个人我继承一项技能，第7个死者是我爸</div>
                <div className="formula-example-item"><strong>穿书快穿：</strong>穿成恶毒女配后我摆烂了，结果追我的反派排到法国</div>
              </div>
              <div className="title-warnings">
                <h4>⚠️ 标题禁忌</h4>
                <ul>
                  <li>❌ 不要纯文学标题（如"岁月如歌""青春散场"——读者不点）</li>
                  <li>❌ 不要模糊不清（如"他的故事""那段时光"——不知道讲啥）</li>
                  <li>❌ 不要超过30字（太长记不住）</li>
                  <li>✅ 要有具体数字、时间锚点、反转钩</li>
                  <li>✅ 让读者看到标题就想点进去看"为什么"</li>
                </ul>
              </div>
            </div>

            {/* AI 一键生成书名 */}
            <div className="book-title-ai">
              <div className="book-title-ai-header">
                <div className="book-title-ai-icon">📕</div>
                <div className="book-title-ai-info">
                  <h4>起书名</h4>
                  <p className="muted">一键生成10个爆款书名</p>
                </div>
                <button
                  className={`btn btn--primary ${isLoadingBookTitle ? 'btn--loading' : ''}`}
                  onClick={generateBookTitles}
                  disabled={isLoadingBookTitle}
                >
                  {isLoadingBookTitle ? 'AI生成中...' : '一键生成'}
                </button>
              </div>
              
              {isLoadingBookTitle && (
                <div className="ai-loading">
                  <div className="ai-loading-spinner"></div>
                  <p className="muted">AI 正在根据题材「{genre}」生成10个爆款书名...</p>
                </div>
              )}
              
              {bookTitleError && (
                <div className="book-title-ai-error">
                  ⚠️ {bookTitleError}
                </div>
              )}
              
              {bookTitleResults && !isLoadingBookTitle && (
                <div className="book-title-ai-results">
                  <p className="plan-hint" style={{ marginTop: 0, marginBottom: 10 }}>
                    🤖 AI 已生成 10 个书名，点击可直接填入标题
                  </p>
                  <div className="book-title-ai-list">
                    {bookTitleResults.split('\n').filter(line => {
                      const trimmed = line.trim();
                      if (!trimmed) return false;
                      if (trimmed.startsWith('⭐')) return false;
                      if (trimmed.startsWith('书名') || trimmed.startsWith('推荐') || trimmed.includes('钩子点')) return false;
                      return /^\d+\./.test(trimmed);
                    }).map((line, i) => {
                      const trimmed = line.trim().replace(/^\d+\.\s*/, '');
                      // 解析 "书名 —— 钩子点：xxx" 格式
                      const match = trimmed.match(/^(.+?)(?:——|[-—])\s*(?:钩子点[：:]?\s*(.+))?$/);
                      const titleText = match ? match[1].trim() : trimmed;
                      const hookText = match ? match[2]?.trim() : '';
                      if (!titleText) return null;
                      return (
                        <div
                          key={i}
                          className="book-title-ai-item"
                          onClick={() => {
                            const newIdeas = [...titleIdeas];
                            newIdeas[0] = titleText;
                            setTitleIdeas(newIdeas);
                          }}
                          title="点击填入标题方案"
                        >
                          <span className="book-title-ai-num">{i + 1}</span>
                          <span className="book-title-ai-text">{titleText}</span>
                          {hookText && <span className="book-title-ai-hook">🎯 {hookText}</span>}
                        </div>
                      );
                    }).filter(Boolean)}
                  </div>
                  <p className="plan-hint" style={{ fontSize: 12, marginTop: 8 }}>
                    💡 点击任意书名可填入上方标题方案
                  </p>
                </div>
              )}
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
                <OpeningTemplate type="日常崩塌" desc="平静日常突然断裂，制造强烈反差" example="林小雨结婚3年，以为日子就这么过。直到她在老公手机里看到一条消息：'十年计划已完成80%，可以收网了。'" />
                <OpeningTemplate type="时间倒流" desc="用时间差制造悬念" example="我死后第7天，老公发了条朋友圈：终于自由了。我站在他身后，看着这条朋友圈，想告诉他我也不自由了——因为我变成了鬼。" />
                <OpeningTemplate type="身份揭露" desc="第一句就揭露惊人身份/秘密" example="所有人都以为顾寒川是普通打工人。直到他妈打电话来：'儿子，顾氏集团上市了，你作为大股东记得去敲钟。'" />
                <OpeningTemplate type="物品悬疑" desc="用一个神秘物品引出一个大秘密" example="那只怀表掉在雨地上的时候，林小雨没在意。直到她妈看到它，手里的碗直接碎了。'哪里来的？''一个陌生人掉的。''昨天面试我的那个。'" />
              </div>
            </div>
            <div className="opening-warnings">
              <h4>⚠️ 开篇禁忌（编辑审稿只看前300字）</h4>
              <ul>
                <li>❌ 不要大段环境描写（读者3秒内没钩子就划走）</li>
                <li>❌ 不要缓慢铺垫（前300字必须出冲突/悬念/反差）</li>
                <li>❌ 不要多POV切换（开篇聚焦主视角，不要跳）</li>
                <li>✅ 第一句就要有冲突/悬念/反差（让读者问"为什么"）</li>
                <li>✅ 前500字立住场景 + 人物 + 核心冲突</li>
              </ul>
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
                  <span className="rec-tag rec--medium">中篇 3-5万 ⭐推荐</span>
                  <span className="rec-tag rec--long">长篇 5-10万</span>
                </div>
              </div>
              <div className="word-plan-card">
                <strong>不同赛道字数建议</strong>
                <ul className="word-suggestions">
                  <li>🔥 <strong>都市脑洞/甜宠</strong>：3-5万字，节奏快，10章内出大爽点</li>
                  <li>🔥 <strong>悬疑推理</strong>：5-8万字，线索要埋，反转要合理</li>
                  <li>⭐ <strong>重生年代文</strong>：6-10万字，时代细节要写，节奏可稍慢</li>
                  <li>⭐ <strong>古言宫斗</strong>：8-12万字，人物关系复杂，需要篇幅铺陈</li>
                  <li>💡 <strong>穿书快穿</strong>：4-6万字，单元剧形式，每个任务2-3章</li>
                </ul>
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
                <strong>番茄短篇过稿标准</strong>
                <table className="standard-table">
                  <thead><tr><th>指标</th><th>标准</th><th>说明</th></tr></thead>
                  <tbody>
                    <tr><td>总字数</td><td><strong>3-5万</strong></td><td>太短推荐不起来，太长劝转长篇</td></tr>
                    <tr><td>章节数</td><td><strong>12-20章</strong></td><td>每章2000-3000字</td></tr>
                    <tr><td>开篇留存</td><td><strong>&gt;60%</strong></td><td>前3章决定是否继续追更</td></tr>
                    <tr><td>完读率</td><td><strong>&gt;40%</strong></td><td>完读率决定推荐量级</td></tr>
                    <tr><td>更新频率</td><td><strong>日更2000+</strong></td><td>日更3000+有流量倾斜</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="word-plan-card word-plan-card--full">
                <strong>番茄投稿须知（必读）</strong>
                <ul className="rule-list">
                  <li>✅ 单章 <strong>2,000-3,000字</strong>，太少编辑觉得你水字数</li>
                  <li>✅ 总字数 <strong>3-5万</strong> 过稿率最高，太长容易被劝转长篇</li>
                  <li>✅ 开篇 <strong>前300字</strong> 必须出钩子，编辑审稿只看这么多</li>
                  <li>✅ 每章结尾留 <strong>悬念或转折</strong>，让读者忍不住点下一章</li>
                  <li>✅ <strong>日更2000字+</strong>，断更超过3天推荐量掉50%</li>
                  <li>✅ <strong>完读率&gt;40%</strong> 才有机会上热门推荐位</li>
                  <li>⚠️ 超 10万字 需转长篇赛道，短篇不收</li>
                  <li>⚠️ <strong>避免敏感内容</strong>：政治、宗教、色情、过度血暴</li>
                  <li>⚠️ <strong>不要抄袭/洗稿</strong>：番茄有AI查重系统，直接封号</li>
                  <li>💡 <strong>适配短剧改编</strong>：每10章1个大高潮，改编率更高</li>
                  <li>💡 <strong>封面很重要</strong>：找专业画师，别用AI生成（编辑能看出来）</li>
                  <li>💡 <strong>书名即卖点</strong>：标题里要有数字/时间/反转，不要文艺范</li>
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
        {/* ===== 都市 / 现言赛道 ===== */}
        <div className="char-section-label">🏙️ 都市 / 现言</div>
        <CharacterCard
          name="林小雨"
          role="女主角"
          age="24"
          trait="弄堂长大的设计系毕业生。表面温吞老实人，骨子里有股不认输的劲儿。她妈从小就告诉她：别信有钱人，别进大宅门。但她偏偏都做了。"
          color="#ff6b81"
          tags={['弄堂原生家庭', '设计专业', '倔强内核']}
        />
        <CharacterCard
          name="顾寒川"
          role="男主角"
          age="28"
          trait="顾氏集团继承人，外界标签是冷漠高效不近人情。但他对林小雨的态度从第一天就不正常——不是因为心动，是因为他知道她是谁。"
          color="#3742fa"
          tags={['顾氏继承人', '刻意靠近', '知情者']}
        />

        {/* ===== 古言赛道 ===== */}
        <div className="char-section-label" style={{ marginTop: 16 }}>🏯 古言 / 宫斗</div>
        <CharacterCard
          name="沈婉清"
          role="女主角·古言"
          age="22"
          trait="穿越成炮灰妃子，前世是985高材生。用现代管理术改造后宫，把宫斗变成KPI考核制。表面柔弱实际腹黑，专治各种不服。"
          color="#e74c3c"
          tags={['穿越', '腹黑事业脑', '反套路']}
        />
        <CharacterCard
          name="萧景珩"
          role="男主角·古言"
          age="26"
          trait="当朝三皇子，外号冷面阎王。以为娶了个软柿子王妃，婚后发现她把王府账目做成Excel报表，连暗卫KPI都定了。逐渐真香。"
          color="#1a1a2e"
          tags={['帝王人设', '被拿捏', '真香型']}
        />

        {/* ===== 悬疑赛道 ===== */}
        <div className="char-section-label" style={{ marginTop: 16 }}>🔍 悬疑 / 推理</div>
        <CharacterCard
          name="陆建明"
          role="主角·悬疑"
          age="35"
          trait="老刑警，妻子3年前被杀案件悬而未决。一边办案一边私下查妻死因，两条线索逐渐交汇。冷静执着，有严重的心理创伤和失眠症。"
          color="#2c3e50"
          tags={['创伤型主角', '执着追凶', '暗线驱动']}
        />

        {/* ===== 重生年代赛道 ===== */}
        <div className="char-section-label" style={{ marginTop: 16 }}>📻 年代 / 重生</div>
        <CharacterCard
          name="苏青禾"
          role="女主角·年代"
          age="19"
          trait="重生回1988年结婚前一天。上辈子嫁给渣男守活寡40年，这辈子决定退婚！靠空间发家致富，顺便捡了个退伍兵当老公。"
          color="#d35400"
          tags={['重生', '空间金手指', '搞事业']}
        />
        <CharacterCard
          name="陈建军"
          role="男主角·年代"
          age="24"
          trait="刚退伍的农村小伙，家里穷得叮当响。嘴笨心善，干活不要命。第一次见面就帮苏青禾扛了200斤大米上六楼，一句话没说。"
          color="#27ae60"
          tags={['忠犬型', '行动派', '慢慢开窍']}
        />

        {/* ===== 暗线人物（通用） ===== */}
        <div className="char-section-label" style={{ marginTop: 16 }}>🔑 暗线 / 关键配角</div>
        <CharacterCard
          name="周静兰（林母）"
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
  { icon: '📕', label: '起书名', desc: '一键生成10个爆款书名', prompt: '', autoRun: true },
  { icon: '🏷️', label: '起角色名', desc: '一键生成10个角色名', prompt: '', autoRun: true },
  { icon: '✍️', label: '续写', desc: '根据上下文续写下文', prompt: '请帮我续写下面的内容：\n\n', autoRun: false },
  { icon: '✨', label: '润色', desc: '优化文笔和表达', prompt: '请帮我润色以下文字，保持原意但让文笔更好：\n\n', autoRun: false },
  { icon: '📝', label: '扩写', desc: '丰富细节和描写', prompt: '请帮我扩写以下内容，增加细节和场景描写：\n\n', autoRun: false },
  { icon: '💡', label: '灵感', desc: '获取剧情走向建议', prompt: '我写到这里卡住了，请给我3个剧情走向建议：\n\n', autoRun: false },
  { icon: '🎭', label: '对白', desc: '生成角色对话', prompt: '请根据以下角色设定生成一段对话：\n\n', autoRun: false },
  { icon: '🔍', label: 'AI味检测', desc: '检测文本AI痕迹', prompt: '请检测以下文本的AI味浓度：\n\n', autoRun: false },
  { icon: '🔗', label: '逻辑检查', desc: '检查剧情逻辑漏洞', prompt: '请检查以下内容的逻辑一致性：\n\n', autoRun: false },
  { icon: '👨‍💻', label: '番茄主编评价', desc: '模拟主编审稿评价', prompt: '请以番茄小说主编视角评价以下稿件：\n\n', autoRun: false },
];

// 模拟 AI 回复（未接入 API Key 时的演示回复）
function mockAIResponse(fnLabel: string, _userInput: string): string {
  const responses: Record<string, string> = {
    '续写': '（演示模式 — 接入 API Key 后将获得真实续写）\n\n她站在原地，看着他的背影消失在雨幕里。怀表的金属表面冰凉，贴在掌心，却像有温度一样发烫。\n\n她不知道为什么，总觉得这件事不会就这样结束。',
    '润色': '（演示模式 — 接入 API Key 后将获得真实润色）\n\n已为你优化了表达节奏，增强了画面感和情绪张力。建议在描写中加入更多五感细节（触觉、嗅觉），让读者更有代入感。',
    '扩写': '（演示模式 — 接入 API Key 后将获得真实扩写）\n\n已为你扩展了场景细节：雨势、灯光、人物微表情。增加了环境描写来烘托紧张氛围。',
    '起书名': '【番茄爆款书名候选】\n\n1. 3天后他拿着2亿彩礼上门，我妈才发现他是我失联8年的亲哥 —— 钩子：身份反转+金钱冲击\n2. 结婚3年老公失联，第4年他带着私生子出现在我父亲葬礼上 —— 钩子：时间跨度+葬礼冲突\n3. 我死后第7天，老公发了条朋友圈：终于自由了 —— 钩子：死后视角+反转\n4. 被开除当天，我收到了前老板死对头的offer —— 钩子：打脸+逆袭\n5. 闪婚对象竟是对头公司CEO，婚后才发现他早就知道我是谁 —— 钩子：身份+知情反转\n6. 1次雨夜偶遇，掀翻了两家人20年的旧账 —— 钩子：数字+时间+旧账\n7. 离婚当天前夫死了，留给我的遗产里有一段我没听过的录音 —— 钩子：死亡+录音悬念\n8. 替嫁3年没人发现我是假的，直到真的那个回来了 —— 钩子：替身+真假对峙\n9. 7年前我救的人，现在是我面试官，他假装不认识我 —— 钩子：恩情+假装\n10. 我爸欠债2亿跑路，债主找上门那天我才知道他是我亲哥 —— 钩子：欠债+血缘反转\n\n⭐ 推荐前3：第1、第5、第10个',
    '起角色名': '【女主候选】\n1. 苏晚 - 表面温吞骨子里不认输\n2. 温念 - 嘴硬心软，记仇但重情\n3. 林栖 - 看着乖，主意正\n4. 姜糖 - 甜里带辣，不傻白甜\n5. 沈鹿 - 软但不弱，有底牌\n\n【男主候选】\n1. 陆砚 - 知道她是谁，但不说\n2. 顾寒川 - 冷面话少，做事狠\n3. 沈砚之 - 温和是壳，里头冷\n4. 傅凛 - 不近人情，但有底线\n5. 江衍 - 笑面虎，笑越暖手越黑',
    '起标题': '（演示模式 — 接入 API Key 后将获得真实标题生成）\n\n1. 雨夜撞上的人，3天后坐在了我的面试官席位上\n2. 他留下的怀表，让我妈摔碎了20年的沉默\n3. 1次雨夜偶遇，掀翻了两家人20年的旧账\n4. 面试官是我雨夜撞到的人，7天后他叫我别查下去\n5. 那块鹰纹怀表，是失踪10年的人留下的最后线索',
    '灵感': '（演示模式 — 接入 API Key 后将获得真实建议）\n\n1. 怀表上的字母是顾家暗号，林小雨在设计岗无意中破解了含义\n2. 林母的饭馆其实是为monitoring顾家而开的据点\n3. 顾寒川接近林小雨是奉命销毁证据，但他在执行中动了真感情',
    '对白': '（演示模式 — 接入 API Key 后将获得真实对话生成）\n\n林小雨：你早就知道我是谁。\n顾寒川：从你捡起那块表的那一刻。\n林小雨：那你为什么还让我进顾氏？\n顾寒川：因为你不进来，有些事就永远查不清了。',
  };
  return responses[fnLabel] || '（演示模式）已收到你的请求，接入 API Key 后将获得真实 AI 回复。';
}

function AIPanel({ aiReady, project, onOpenSettings }: { aiReady: boolean; project: Project; onOpenSettings: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'init', from: 'ai', text: aiReady
      ? '你好！我是你的 AI 写作助手。API 已接入，选择上方功能或直接输入需求，我来帮你完成创作任务。'
      : '你好！我是你的 AI 写作助手。选择上方功能或直接输入需求，我来帮你完成创作任务。\n\n⚠️ 当前为演示模式，点击右上角"设置"接入 API Key 后将获得真实 AI 回复。' },
  ]);
  const [prompt, setPrompt] = useState('');
  const [activeFn, setActiveFn] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 检查 API 是否已配置（不再需要，由父组件传入）

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!prompt.trim() || loading) return;
    const inputText = prompt;
    setPrompt('');
    await runAI(activeFn || '续写', inputText);
  };

  const handleFnClick = (fn: typeof AI_FUNCTIONS[number]) => {
    setActiveFn(fn.label);

    // 自动运行的功能：起书名 / 起角色名
    if (fn.autoRun) {
      let autoPrompt = '';
      if (fn.label === '起书名') {
        autoPrompt = `题材：${project.genre}\n现有书名（参考）：${project.name}\n\n请生成 10 个番茄爆款书名，按"具体数字+时间锚点+反转钩"公式。`;
      } else if (fn.label === '起角色名') {
        autoPrompt = `题材：${project.genre}\n书名：${project.name}\n\n请生成 10 个角色名（女主5个 + 男主5个），按番茄爆款人名规律。`;
      }
      runAI(fn.label, autoPrompt);
    } else {
      setPrompt(fn.prompt);
    }
  };

  // 抽取 AI 调用逻辑，支持自动触发
  const runAI = async (fnLabel: string, input: string) => {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = { id: genId(), from: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    if (aiReady) {
      try {
        let systemPrompt = WRITING_PROMPT;
        if (fnLabel === '起角色名') systemPrompt = NAMING_PROMPT;
        else if (fnLabel === '起书名') systemPrompt = BOOK_TITLE_PROMPT;
        else if (fnLabel === '起标题') systemPrompt = BOOK_TITLE_PROMPT;
        else if (fnLabel === '生成大纲') systemPrompt = OUTLINE_PROMPT;
        else if (fnLabel === 'AI味检测') systemPrompt = AI_DETECT_PROMPT;
        else if (fnLabel === '逻辑检查') systemPrompt = LOGIC_CHECK_PROMPT;
        else if (fnLabel === '番茄主编评价') systemPrompt = EDITOR_REVIEW_PROMPT;

        const aiText = await callAI([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input }
        ]);
        setMessages(prev => [...prev, { id: genId(), from: 'ai', text: aiText }]);
      } catch (err: any) {
        setMessages(prev => [...prev, { id: genId(), from: 'ai', text: `⚠️ API 调用失败：${err.message || '未知错误'}\n\n可能原因：网络较慢、API Key 无效、或当前模型响应较慢。请检查设置后重试。` }]);
      }
    } else {
      setTimeout(() => {
        const aiText = mockAIResponse(fnLabel, input);
        setMessages(prev => [...prev, { id: genId(), from: 'ai', text: aiText }]);
      }, 600);
    }
    setLoading(false);
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
        <div className="header-actions">
          <span className={`badge ${aiReady ? 'badge--success' : 'badge--model'}`}>
            {aiReady ? '✓ 已接入 API' : '演示模式'}
          </span>
          <button className="btn btn--ghost btn--sm" onClick={onOpenSettings}>
            ⚙️ 设置
          </button>
        </div>
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
              <button className="btn btn--primary" onClick={handleSend} disabled={!prompt.trim() || loading}>
                {loading ? '思考中...' : '发送 🚀'}
              </button>
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
