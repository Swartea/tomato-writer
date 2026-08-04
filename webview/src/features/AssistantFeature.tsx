import { useState } from 'react';
import { ProjectData } from '@tomato-writer/core';
import { hostClient } from '../hostClient';
import { Section } from './shared';

export function AssistantFeature({ project, hasKey }: { project: ProjectData; hasKey: boolean }) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (task: string) => {
    setBusy(true);
    try {
      setOutput(await hostClient.request('runAssistant', { project, task, input }));
    } catch (error) {
      setOutput(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  return <Section title="专项助手" hint="结果不会自动写入正式稿">
    <div className="toolbar">
      {['续写候选', '润色', '压缩', '扩写', '全书一致性检查'].map(task =>
        <button key={task} disabled={!hasKey || busy} onClick={() => void run(task)}>{task}</button>)}
    </div>
    <textarea rows={12} value={input} onChange={event => setInput(event.target.value)} placeholder="粘贴正文或要求" />
    <textarea className="ai-output" rows={18} readOnly value={output} placeholder="AI 结果" />
  </Section>;
}
