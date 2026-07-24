import { useState } from 'react';
import { loadAISettings, saveAISettings, AISettings } from './aiService';

/* ---------- 预设 API 配置 ---------- */
const API_PRESETS = [
  { name: 'OpenAI', url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
  { name: 'DeepSeek', url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-v4-flash' },
  { name: '通义千问', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', model: 'qwen-turbo' },
  { name: '月之暗面', url: 'https://api.moonshot.cn/v1/chat/completions', model: 'moonshot-v1-8k' },
];

/* ---------- 设置面板组件 ---------- */
export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<AISettings>(loadAISettings);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    saveAISettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handlePreset = (preset: typeof API_PRESETS[0]) => {
    const newSettings = { ...settings, apiUrl: preset.url, model: preset.model };
    setSettings(newSettings);
    // 选择预设后立即保存，不需要再点"保存"按钮
    saveAISettings(newSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2>AI 设置</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="settings-body">
          {/* API 预设 */}
          <div className="setting-section">
            <label>快速选择 API 平台</label>
            <div className="preset-buttons">
              {API_PRESETS.map(p => (
                <button key={p.name} className="preset-btn" onClick={() => handlePreset(p)}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div className="setting-section">
            <label>API Key <span className="required">*</span></label>
            <input
              type="password"
              className="setting-input"
              placeholder="sk-..."
              value={settings.apiKey}
              onChange={e => setSettings({ ...settings, apiKey: e.target.value })}
            />
            <p className="setting-hint">你的 API Key 仅保存在本地，不会上传到任何服务器</p>
          </div>

          {/* API URL */}
          <div className="setting-section">
            <label>API 地址</label>
            <input
              type="text"
              className="setting-input"
              value={settings.apiUrl}
              onChange={e => setSettings({ ...settings, apiUrl: e.target.value })}
            />
          </div>

          {/* 模型选择 */}
          <div className="setting-section">
            <label>模型</label>
            <input
              type="text"
              className="setting-input"
              value={settings.model}
              onChange={e => setSettings({ ...settings, model: e.target.value })}
            />
            <p className="setting-hint">填写你使用的模型名称（如 gpt-4, deepseek-chat 等）</p>
          </div>

          {/* 温度 */}
          <div className="setting-section">
            <label>创造性（温度）：{settings.temperature}</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={settings.temperature}
              onChange={e => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
            />
            <div className="range-labels">
              <span>严谨</span>
              <span>平衡</span>
              <span>创意</span>
            </div>
          </div>

          {/* 最大 token */}
          <div className="setting-section">
            <label>最大生成长度</label>
            <input
              type="number"
              className="setting-input"
              value={settings.maxTokens}
              onChange={e => setSettings({ ...settings, maxTokens: parseInt(e.target.value) || 2000 })}
            />
          </div>

          {/* 保存按钮 */}
          <button className="save-settings-btn" onClick={handleSave}>
            {saved ? '已保存' : '保存设置'}
          </button>

          {/* 使用说明 */}
          <div className="setting-tips">
            <h4>使用说明</h4>
            <ul>
              <li>支持所有 OpenAI 兼容格式的 API</li>
              <li>国内用户推荐使用 DeepSeek（便宜好用）</li>
              <li>API Key 仅保存在你的本地浏览器，不会泄露</li>
              <li>没有 API Key？可以用演示模式先体验功能</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
