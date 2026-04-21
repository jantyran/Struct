'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ShortcutActionKey, ShortcutSettings } from '@/types';
import { withBasePath } from '@/lib/paths';
import { defaultShortcutSettings, formatShortcutCombo, matchesShortcut, normalizeShortcutSettings } from '@/lib/shortcut-settings';
import { useAuth } from '@/components/AuthContext';

type ShortcutHandlers = Partial<Record<'save_current' | 'new_record', () => void | Promise<void>>>;

type RegisteredShortcutScope = {
  id: string;
  label?: string;
  handlers: ShortcutHandlers;
};

type ShortcutContextValue = {
  settings: ShortcutSettings;
  reloadSettings: () => Promise<void>;
  registerScope: (scope: RegisteredShortcutScope) => () => void;
  openHelp: () => void;
  closeHelp: () => void;
};

const ShortcutContext = createContext<ShortcutContextValue>({
  settings: defaultShortcutSettings(),
  reloadSettings: async () => {},
  registerScope: () => () => {},
  openHelp: () => {},
  closeHelp: () => {},
});

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || target.isContentEditable;
}

function ShortcutHelpDialog({
  open,
  onClose,
  settings,
  activeScopeLabel,
}: {
  open: boolean;
  onClose: () => void;
  settings: ShortcutSettings;
  activeScopeLabel?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card w-full max-w-xl p-6 space-y-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">キーボードショートカット</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {activeScopeLabel ? `現在の文脈: ${activeScopeLabel}` : '現在の画面で有効なショートカットです。'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-secondary text-sm">閉じる</button>
        </div>

        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {([
            ['save_current', '保存'],
            ['new_record', '新規追加'],
            ['show_shortcuts_help', 'ショートカット一覧'],
          ] as const).map(([key, label]) => (
            <div key={key} className="py-3 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {settings[key].enabled ? '有効' : '無効'}
                </p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: 'rgba(15,154,177,0.1)', color: 'var(--accent)' }}>
                {settings[key].enabled ? formatShortcutCombo(settings[key].combo) : 'OFF'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ShortcutProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [settings, setSettings] = useState<ShortcutSettings>(defaultShortcutSettings());
  const [helpOpen, setHelpOpen] = useState(false);
  const scopesRef = useRef<RegisteredShortcutScope[]>([]);
  const latestSettingsRef = useRef(settings);

  const reloadSettings = useCallback(async () => {
    if (!user) {
      setSettings(defaultShortcutSettings());
      return;
    }
    const response = await fetch(withBasePath('/api/shortcut-settings'));
    if (response.status === 401) {
      router.push(withBasePath('/login'));
      return;
    }
    if (!response.ok) return;
    const payload = await response.json() as { settings?: ShortcutSettings };
    setSettings(normalizeShortcutSettings(payload.settings));
  }, [router, user]);

  useEffect(() => {
    latestSettingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (loading) return;
    void reloadSettings();
  }, [loading, reloadSettings]);

  const registerScope = useCallback((scope: RegisteredShortcutScope) => {
    scopesRef.current = [...scopesRef.current.filter((item) => item.id !== scope.id), scope];
    return () => {
      scopesRef.current = scopesRef.current.filter((item) => item.id !== scope.id);
    };
  }, []);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;

      const nextSettings = latestSettingsRef.current;
      const activeScope = scopesRef.current[scopesRef.current.length - 1];

      if (
        nextSettings.show_shortcuts_help.enabled &&
        matchesShortcut(event, nextSettings.show_shortcuts_help.combo)
      ) {
        event.preventDefault();
        setHelpOpen(true);
        return;
      }

      if (
        nextSettings.save_current.enabled &&
        matchesShortcut(event, nextSettings.save_current.combo) &&
        activeScope?.handlers.save_current
      ) {
        event.preventDefault();
        void activeScope.handlers.save_current();
        return;
      }

      if (
        nextSettings.new_record.enabled &&
        matchesShortcut(event, nextSettings.new_record.combo) &&
        activeScope?.handlers.new_record
      ) {
        if (!isEditableTarget(event.target)) {
          event.preventDefault();
          void activeScope.handlers.new_record();
        }
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

  const value = useMemo<ShortcutContextValue>(() => ({
    settings,
    reloadSettings,
    registerScope,
    openHelp: () => setHelpOpen(true),
    closeHelp: () => setHelpOpen(false),
  }), [reloadSettings, registerScope, settings]);

  const activeScopeLabel = scopesRef.current[scopesRef.current.length - 1]?.label;

  return (
    <ShortcutContext.Provider value={value}>
      {children}
      <ShortcutHelpDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        settings={settings}
        activeScopeLabel={activeScopeLabel}
      />
    </ShortcutContext.Provider>
  );
}

export function useShortcutSettings() {
  return useContext(ShortcutContext);
}

export function useRegisterShortcutScope(id: string, label: string | undefined, handlers: ShortcutHandlers) {
  const { registerScope } = useShortcutSettings();
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => registerScope({
    id,
    label,
    handlers: handlersRef.current,
  }), [id, label, registerScope, handlers.save_current, handlers.new_record]);
}
