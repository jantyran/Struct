'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AIProvider, AISettings } from '@/types';
import { withBasePath } from '@/lib/paths';
import { useAuth } from '@/components/AuthContext';

const PROVIDER_OPTIONS: Array<{ value: AIProvider; label: string; defaultModel: string; defaultBaseUrl: string }> = [
  { value: 'gemini', label: 'Google Gemini', defaultModel: 'gemini-2.5-flash', defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  { value: 'anthropic', label: 'Anthropic', defaultModel: 'claude-haiku-4-5-20251001', defaultBaseUrl: 'https://api.anthropic.com' },
  { value: 'openai', label: 'OpenAI', defaultModel: 'gpt-4o-mini', defaultBaseUrl: 'https://api.openai.com/v1' },
];

const EMPTY_SETTINGS: AISettings = {
  provider: 'gemini',
  model: 'gemini-2.5-flash',
  api_key: '',
  base_url: 'https://generativelanguage.googleapis.com/v1beta',
};

export default function AISettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const canManageAISettings = Boolean(user?.system_permissions?.manage_ai_settings);
  const [settings, setSettings] = useState<AISettings>(EMPTY_SETTINGS);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push(withBasePath('/login'));
      return;
    }
    if (!user.system_permissions?.manage_ai_settings) {
      router.push(withBasePath('/settings'));
      return;
    }

    (async () => {
      const res = await fetch(withBasePath('/api/ai-settings'));
      if (res.status === 401) {
        router.push(withBasePath('/login'));
        return;
      }
      if (res.status === 403) {
        router.push(withBasePath('/settings'));
        return;
      }
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || 'AI設定の取得に失敗しました。');
        return;
      }

      setSettings({
        provider: payload.settings?.provider || EMPTY_SETTINGS.provider,
        model: payload.settings?.model || EMPTY_SETTINGS.model,
        api_key: '',
        base_url: payload.settings?.base_url || EMPTY_SETTINGS.base_url,
      });
      setHasApiKey(Boolean(payload.has_api_key));
    })();
  }, [authLoading, router, user]);

  function updateProvider(provider: AIProvider) {
    const providerMeta = PROVIDER_OPTIONS.find((option) => option.value === provider);
    if (!providerMeta) return;
    setSettings((current) => ({
      ...current,
      provider,
      model: providerMeta.defaultModel,
      base_url: providerMeta.defaultBaseUrl,
    }));
  }

  async function save() {
    setSaving(true);
    setError('');
    const res = await fetch(withBasePath('/api/ai-settings'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings }),
    });
    const payload = await res.json();
    setSaving(false);

    if (res.status === 401) {
      router.push(withBasePath('/login'));
      return;
    }
    if (res.status === 403) {
      router.push(withBasePath('/settings'));
      return;
    }

    if (!res.ok) {
      setError(payload.error || 'AI設定の保存に失敗しました。');
      return;
    }

    setHasApiKey(Boolean(payload.has_api_key));
    setSettings((current) => ({ ...current, api_key: '' }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (authLoading || !user) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="card p-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          読み込み中...
        </div>
      </div>
    );
  }

  if (!canManageAISettings) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="card p-6 space-y-4">
          <div>
            <h1 className="text-xl font-bold">AI設定</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              AI設定管理権限がないため、このページは表示できません。
            </p>
          </div>
          <div>
            <button onClick={() => router.push(withBasePath('/settings'))} className="btn-secondary">
              ← 設定へ戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">AI設定</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            使用するAIプロバイダ、モデル、APIキーを設定します。
          </p>
        </div>
        <button onClick={() => router.push(withBasePath('/settings'))} className="btn-secondary">
          ← 設定へ戻る
        </button>
      </div>

      <div className="card p-5 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">AIプロバイダ</label>
            <select
              className="field-input"
              value={settings.provider}
              onChange={(e) => updateProvider(e.target.value as AIProvider)}
            >
              {PROVIDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">モデル</label>
            <input
              className="field-input"
              value={settings.model}
              onChange={(e) => setSettings((current) => ({ ...current, model: e.target.value }))}
              placeholder="例: claude-haiku-4-5-20251001"
            />
          </div>
        </div>

        <div>
          <label className="field-label">API Base URL</label>
          <input
            className="field-input"
            value={settings.base_url}
            onChange={(e) => setSettings((current) => ({ ...current, base_url: e.target.value }))}
            placeholder="例: https://api.openai.com/v1"
          />
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            既定値のままで通常は問題ありません。互換APIやゲートウェイを使う場合だけ変更してください。
          </p>
        </div>

        <div>
          <label className="field-label">APIキー</label>
          <input
            type="password"
            className="field-input"
            value={settings.api_key}
            onChange={(e) => setSettings((current) => ({ ...current, api_key: e.target.value }))}
            placeholder={hasApiKey ? '保存済みのAPIキーを置き換える場合のみ入力' : 'APIキーを入力してください'}
          />
          <p className="text-xs mt-2" style={{ color: hasApiKey ? 'rgb(110,231,183)' : 'var(--text-muted)' }}>
            {hasApiKey ? 'APIキーは保存済みです。新しいキーを入力すると上書きされます。' : 'まだAPIキーは保存されていません。'}
          </p>
        </div>

        {error && (
          <div className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: 'rgba(248,113,113,0.35)', color: 'rgb(252,165,165)' }}>
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            この設定は、このアカウントの AI生成 と AI補完 に使われます。
          </p>
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? '保存中...' : saved ? '✓ 保存済み' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
