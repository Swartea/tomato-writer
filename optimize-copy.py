#!/usr/bin/env python3
# 优化番茄写作助手文案，使其更适配番茄小说风格

import re

filepath = '/Users/swartea/WorkBuddy/2026-06-29-22-22-33/tomato-writer/webview/src/App.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. 核心卖点标题和提示
content = content.replace(
    '核心卖点 — 读者凭什么点进你的故事？',
    '核心卖点 — 一句话让编辑眼前一亮'
)
content = content.replace(
    '番茄短篇的卖点必须一句话能说清。不是\u201C写得好\u201D，而是\u201C这事太刺激/太甜/太反转了\u201D。',
    '番茄编辑审稿平均 30 秒。你的卖点不是"写得好"，而是"这事太刺激了，我必须看下去"。'
)

# 2. 核心卖点 placeholder
content = content.replace(
    '如：普通女孩撞上豪门继承人，却发现两家人有一笔二十年的旧账',
    '例：雨夜撞到的人，第二天坐进了我的面试官席位——而他手里拿着我妈藏了20年的东西'
)
content = content.replace(
    '如：雨夜撞人 → 对方留下一个刻着家徽的怀表 → 女主母亲看到怀表后脸色骤变',
    '例：她捡起来的那只怀表，背面刻的不是名字，是一行日期——她出生的日期'
)

# 3. 情感弧线 option
content = content.replace(
    '<option value="">选择情感走向</option>',
    '<option value="">选情感走向（决定读者追更的爽点在哪）</option>'
)

# 4. 番茄爆款卖点参考标题
content = content.replace(
    '🔥 番茄爆款卖点参考',
    '🔥 番茄爆款卖点参考（直接抄都行）'
)

# 5. 爆款标题提示
content = content.replace(
    '番茄标题不是文学标题。好标题 = 具体数字/时间 + 反转暗示。让人忍不住点进去。',
    '番茄标题 = 具体数字 + 时间锚点 + 反转钩。不是文学标题，是"点击诱饵"。'
)

# 6. 标题 placeholder
content = content.replace(
    '如：雨夜撞上的人，竟是那个失踪十年的...',
    '例：雨夜撞上的人，3天后拿着2亿彩礼上门...'
)

# 7. 开篇设计提示
content = content.replace(
    '番茄短篇的读者耐心只有3秒。开篇必须：场景立住 + 人物登场 + 悬念/冲突第一句就给。',
    '番茄读者滑到你的开篇，3秒内没钩子就划走了。开篇三要素：场景立住 + 人物登场 + 冲突/悬念第一句就给。'
)

# 8. 开篇试写 placeholder
content = content.replace(
    '用你选的开篇风格，写前500字。写不出来就点AI助手帮你生成。',
    '写前500字试试手感。卡住了？点右侧"AI助手"让它帮你生成开篇。'
)

# 9. 字数规划提示
content = content.replace(
    '番茄短篇推荐3-5万字。每章2000-3000字，12-20章。节奏是：快开头→稳发展→快高潮→短收尾。',
    '番茄短篇黄金区间：3-5万字。太短推荐不起来，太长编辑让你转长篇。每章2500字左右，12-20章收完。'
)

# 10. 番茄投稿须知
content = content.replace(
    '<li>✅ 单章不低于 <strong>1,500字</strong>，推荐 <strong>2,500字</strong></li>',
    '<li>✅ 单章 <strong>2,000-3,000字</strong>，太少编辑觉得你水字数</li>'
)
content = content.replace(
    '<li>✅ 总字数 <strong>3-5万</strong> 竞争力最强</li>',
    '<li>✅ 总字数 <strong>3-5万</strong> 过稿率最高，太长容易被劝转长篇</li>'
)
content = content.replace(
    '<li>✅ 开篇 <strong>500字内</strong> 必出钩子</li>',
    '<li>✅ 开篇 <strong>前300字</strong> 必须出钩子，编辑审稿只看这么多</li>'
)

# 11. 写作编辑器 placeholder
content = content.replace(
    '开始你的创作...',
    '从这里开始写，卡住了就点右下角"AI助手"...'
)

# 12. 大纲面板默认文案
content = content.replace(
    '尚未填写故事主线。完成开篇策划后，这里会自动生成故事主线梗概。',
    '还没填故事主线？先去"开篇策划"把题材和卖点定下来，大纲才好写。'
)

# 13. AI 助手初始消息
content = content.replace(
    '你好！我是你的 AI 写作助手。选择上方功能或直接输入需求，我来帮你完成创作任务。我可以帮你续写、润色、生成番茄爆款标题、设计开篇钩子——任何一个环节卡住了，随时找我。\n\n⚠️ 当前为演示模式，接入 API Key 后将获得真实 AI 回复。',
    '卡文了？告诉我你现在写到哪，想要什么走向，我帮你接着写。\n\n我可以：续写 / 润色 / 扩写 / 起标题 / 给灵感 / 写对白\n\n（当前为演示模式，接入 API Key 后就能用真实 AI）'
)

# 14. AI 助手输入框 placeholder
content = content.replace(
    '描述你想要的续写内容，或粘贴文本让我润色... (Ctrl+Enter 发送)',
    '粘贴你的文本，或描述你想要什么（例："帮我续写，男主该出现了"）'
)

# 15. 统计面板
content = content.replace(
    '写作数据 · ',
    '数据看板 · '
)

# 保存
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ 文案优化完成")
