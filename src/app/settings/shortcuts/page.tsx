'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ShortcutActionKey, ShortcutSettings } from '@/types';
import { useAuth } from '@/components/AuthContext';
import { useRegisterShortcutScope, useShortcutSettings } from '@/components/ShortcutProvider';
import { withBasePath } from '@/lib/paths';
import { SHORTCUT_DESCRIPTIONS, SHORTCUT_LABELS, defaultShortcutSettings, formatShortcutCombo, normalizeShortcutSettings, shortcutComboFromKeyboardEvent } from '@/lib/shortcut-settings';

const ACTIONS: ShortcutActionKey[] = ['save_current', 'new_record', 'show_shortcuts_help'];

export default function ShortcutSettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { reloadSettings } = useShortcutSettings();
  const [settings, setSettings] = useState<ShortcutSettings>(defaultShortcutSettings());
  const [canEdit, setCanEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [capturingActionKey, setCapturingActionKey] = useState<ShortcutActionKey | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push(withBasePath('/login'));
      return;
    }

    (async () => {
      const response = await fetch(withBasePath('/api/shortcut-settings'));
      if (response.status === 401) {
        router.push(withBasePath('/login'));
        return;
      }
      if (!response.ok) return;
      const payload = await response.json() as { settings?: ShortcutSettings; can_edit?: boolean };
      setSettings(normalizeShortcutSettings(payload.settings));
      setCanEdit(Boolean(payload.can_edit));
    })();
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!capturingActionKey) return;

    const handleKeydown = (event: KeyboardEvent) => {
      event.preventDefault();

      if (event.key === 'Escape') {
        setCapturingActionKey(null);
        return;
      }

      const combo = shortcutComboFromKeyboardEvent(event);
      if (!combo) return;

      setSettings((current) => ({
        ...current,
        [capturingActionKey]: {
          ...current[capturingActionKey],
          combo,
        },
      }));
      setCapturingActionKey(null);
    };

    window.addEventListener('keydown', handleKeydown, true);
    return () => window.removeEventListener('keydown', handleKeydown, true);
  }, [capturingActionKey]);

  const helpText = useMemo(() => (
    'mod, ctrl, cmd, shift, alt を使えます。例: mod+s / shift+c / shift+/'
  ), []);

  useRegisterShortcutScope('settings-shortcuts', 'ショートカット設定', {
    save_current: canEdit ? () => saveSettings() : undefined,
  });

  async function saveSettings() {
    setSaving(true);
    setMessage('');
    const response = await fetch(withBasePath('/api/shortcut-settings'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings }),
    });
    const payload = await response.json() as { error?: string; settings?: ShortcutSettings };
    setSaving(false);

    if (!response.ok) {
      setMessage(payload.error || '保存に失敗しました');
      return;
    }

    const nextSettings = normalizeShortcutSettings(payload.settings);
    setSettings(nextSettings);
    await reloadSettings();
    setMessage('保存済み');
    window.setTimeout(() => setMessage(''), 2000);
  }

  if (authLoading || !user) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="card p-6 text-sm" style={{ color: 'var(--text-secondary)' }}>読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">ショートカット設定</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            組織全体で使うキーボードショートカットを管理します。保存、新規追加、一覧表示を共通化できます。
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            {helpText} 編集を押したあと、割り当てたいキーをそのまま入力してください。
          </p>
        </div>
        <div className="flex items-center gap-2">
          {message && <span className="text-xs" style={{ color: message === '保存済み' ? 'var(--success)' : '#b34a4a' }}>{message}</span>}
          <button onClick={() => router.push(withBasePath('/settings'))} className="btn-secondary text-sm">← 設定へ戻る</button>
          {canEdit && (
            <button onClick={saveSettings} disabled={saving} className="btn-primary text-sm">
              {saving ? '保存中...' : '保存'}
            </button>
          )}
        </div>
      </div>

      {!canEdit && (
        <div className="card p-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          組織設定管理権限がないため、現在の設定を表示のみできます。
        </div>
      )}

      <div className="space-y-4">
        {ACTIONS.map((actionKey) => (
          <section key={actionKey} className="card p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="section-title">{SHORTCUT_LABELS[actionKey]}</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {SHORTCUT_DESCRIPTIONS[actionKey]}
                </p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: 'rgba(15,154,177,0.1)', color: 'var(--accent)' }}>
                現在: {settings[actionKey].enabled ? formatShortcutCombo(settings[actionKey].combo) : 'OFF'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[120px_1fr_auto] gap-4 items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings[actionKey].enabled}
                  disabled={!canEdit}
                  onChange={(event) => setSettings((current) => ({
                    ...current,
                    [actionKey]: {
                      ...current[actionKey],
                      enabled: event.target.checked,
                    },
                  }))}
                />
                有効にする
              </label>

              <div>
                <label className="field-label">キー組み合わせ</label>
                <div className="field-input flex items-center min-h-[42px]">
                  {capturingActionKey === actionKey
                    ? <span style={{ color: 'var(--accent)' }}>キーを入力してください...</span>
                    : <span>{formatShortcutCombo(settings[actionKey].combo)}</span>}
                </div>
              </div>

              <div className="flex gap-2">
                {capturingActionKey === actionKey ? (
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    onClick={() => setCapturingActionKey(null)}
                  >
                    キャンセル
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    disabled={!canEdit}
                    onClick={() => setCapturingActionKey(actionKey)}
                  >
                    編集
                  </button>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
