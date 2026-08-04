import { countWords, dialogueRatio, ProjectData } from '@tomato-writer/core';
import { hostClient } from '../hostClient';
import { Section, statusName } from './shared';

export function StatsFeature({ project }: { project: ProjectData }) {
  const total = project.chapters.reduce((sum, chapter) => sum + countWords(chapter.content), 0);
  const approved = project.chapters.filter(chapter => ['approved', 'completed'].includes(chapter.status)).length;
  const accepted = project.candidates.filter(draft => draft.status === 'approved').length;
  return <div className="stack">
    <div className="stats-grid">
      <Stat label="全书字数" value={`${total}`} />
      <Stat label="章节进度" value={`${approved}/${project.chapters.length}`} />
      <Stat label="目标完成" value={`${Math.round(total / Math.max(project.planning.targetWords, 1) * 100)}%`} />
      <Stat label="AI采纳率" value={project.candidates.length
        ? `${Math.round(accepted / project.candidates.length * 100)}%` : '—'} />
    </div>
    <Section title="章节真实数据">
      <table><thead><tr>
        <th>章节</th><th>字数</th><th>对话占比</th><th>状态</th><th>候选</th>
      </tr></thead><tbody>{project.chapters.map(chapter => <tr key={chapter.id}>
        <td>{chapter.title}</td><td>{countWords(chapter.content)}</td>
        <td>{dialogueRatio(chapter.content)}%</td><td>{statusName[chapter.status]}</td>
        <td>{project.candidates.filter(draft => draft.chapterId === chapter.id).length}</td>
      </tr>)}</tbody></table>
    </Section>
    <div className="toolbar">
      <button onClick={() => void hostClient.request(
        'exportProject', { project, format: 'txt', destination: 'project' },
      )}>导出 TXT 到项目</button>
      <button onClick={() => void hostClient.request(
        'exportProject', { project, format: 'md', destination: 'project' },
      )}>导出 Markdown 到项目</button>
      <button onClick={() => void hostClient.request(
        'exportProject', { project, format: 'txt', destination: 'choose' },
      )}>TXT 另存到…</button>
    </div>
  </div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="stat"><span>{label}</span><strong>{value}</strong></div>;
}
