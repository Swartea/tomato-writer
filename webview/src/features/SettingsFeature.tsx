import { useState } from 'react';
import { AISettings } from '@tomato-writer/core';
import { Field } from './shared';

export function SettingsFeature({ settings, setSettings, hasKey, close, save }: {
  settings: AISettings;
  setSettings: (settings: AISettings) => void;
  hasKey: boolean;
  close: () => void;
  save: (apiKey?: string) => Promise<void>;
}) {
  const [apiKey, setApiKey] = useState('');
  return <div className="modal-backdrop"><div className="modal">
    <h2>AI 设置</h2>
    <p className="notice">API Key 使用 VS Code SecretStorage 保存，不写入项目。自定义地址会收到密钥，请只使用可信服务。</p>
    <Field label="API 地址"><input value={settings.apiUrl}
      onChange={event => setSettings({ ...settings, apiUrl: event.target.value })} /></Field>
    <Field label="模型"><input value={settings.model}
      onChange={event => setSettings({ ...settings, model: event.target.value })} /></Field>
    <Field label={`创造性 ${settings.temperature}`}><input type="range" min="0" max="1.5" step=".1"
      value={settings.temperature}
      onChange={event => setSettings({ ...settings, temperature: Number(event.target.value) })} /></Field>
    <Field label="API Key"><input type="password" value={apiKey}
      placeholder={hasKey ? '已保存；留空不更改' : '请输入 API Key'}
      onChange={event => setApiKey(event.target.value)} /></Field>
    <div className="toolbar end">
      <button onClick={close}>取消</button>
      <button className="primary" onClick={() => void save(apiKey || undefined).then(close)}>安全保存</button>
    </div>
  </div></div>;
}
