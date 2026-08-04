import { useEffect, useRef, useState } from 'react';
import { AISettings, ProjectData, ProjectSummary } from '@tomato-writer/core';
import { hostClient } from './hostClient';

const DEFAULT_SETTINGS: AISettings = {
  apiUrl: 'https://api.deepseek.com/chat/completions',
  model: 'deepseek-chat',
  temperature: 0.8,
  maxTokens: 4096,
};

export function useProjectSession() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [libraryRoot, setLibraryRoot] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');
  const timer = useRef<number>();
  const dirty = useRef(false);

  useEffect(() => {
    const unsubscribe = hostClient.subscribe(event => {
      if (event.event === 'projectsChanged') setProjects(event.payload.projects);
      if (event.event === 'legacyMigrated') localStorage.setItem('tomato-writer-migrated', '1');
    });
    void hostClient.request('ready', undefined).then(initial => {
      setProjects(initial.projects);
      setSettings(initial.settings);
      setHasKey(initial.hasApiKey);
      setLibraryRoot(initial.libraryRoot);
    }).catch(reason => setError(reason instanceof Error ? reason.message : String(reason)));
    if (!localStorage.getItem('tomato-writer-migrated')) {
      try {
        const old = localStorage.getItem('tomato-writer-state');
        if (old) void hostClient.request('importLegacy', { state: JSON.parse(old) }).then(imported => {
          if (imported[0]) setProject(imported[0]);
        });
      } catch { /* Ignore invalid legacy browser state. */ }
    }
    return unsubscribe;
  }, []);

  const acceptProject = (next: ProjectData | null) => {
    if (!next) return;
    setProject(next);
    dirty.current = false;
    setError('');
  };

  const update = (change: (value: ProjectData) => void) => {
    setProject(current => {
      if (!current) return current;
      const next = structuredClone(current);
      change(next);
      next.updatedAt = new Date().toISOString();
      dirty.current = true;
      clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        void hostClient.request('saveProject', { project: next }).then(result => {
          setProject(result.project);
          setSaved(result.savedAt);
          dirty.current = false;
          setError('');
        }).catch(reason => setError(reason instanceof Error ? reason.message : String(reason)));
      }, 700);
      return next;
    });
  };

  const saveSettings = async (apiKey?: string) => {
    const result = await hostClient.request('saveSettings', { settings, apiKey });
    setSettings(result.settings);
    setHasKey(result.hasApiKey);
  };

  return {
    projects, project, setProject, acceptProject, update, settings, setSettings, saveSettings,
    libraryRoot, setLibraryRoot, setProjects, hasKey, saved, error, setError, dirty,
  };
}
