'use client';

import { useRouter } from 'next/navigation';
import { withBasePath } from '@/lib/paths';
import { useDevSettings } from '@/components/DevSettingsContext';
import { DEV_SETTINGS_DEFAULTS } from '@/lib/dev-settings';

type ToggleRowProps = {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
};

function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <label className="flex items-start justify-between gap-4 py-3 cursor-pointer row-hover px-2 rounded-xl">
      <div className="min-w-0">
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</p>
      </div>
      <div className="relative shrink-0 mt-0.5">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div
          className="w-10 h-5.5 rounded-full transition-colors"
          style={{
            width: 40,
            height: 22,
            background: checked ? 'var(--accent)' : 'rgba(200,215,222,0.8)',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.08)',
          }}
        >
          <div
            className="absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform"
            style={{
              width: 18,
              height: 18,
              top: 2,
              left: checked ? 20 : 2,
              transition: 'left 0.15s ease',
            }}
          />
        </div>
      </div>
    </label>
  );
}

export default function DeveloperSettingsPage() {
  const router = useRouter();
  const { settings, update } = useDevSettings();

  function resetAll() {
    update(DEV_SETTINGS_DEFAULTS);
  }

  const isDefault =
    settings.showFieldKeys === DEV_SETTINGS_DEFAULTS.showFieldKeys &&
    settings.showFieldTypes === DEV_SETTINGS_DEFAULTS.showFieldTypes &&
    settings.showFieldIds === DEV_SETTINGS_DEFAULTS.showFieldIds;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">開発設定</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            デバッグや構造確認に使うUI表示オプションです。設定はブラウザに保存され、他ユーザーには影響しません。
          </p>
        </div>
        <button onClick={() => router.push(withBasePath('/settings'))} className="btn-secondary">
          ← 設定へ戻る
        </button>
      </div>

      <section className="card p-5 space-y-1">
        <div className="mb-3">
          <h2 className="section-title">フィールド表示</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            プロジェクト詳細ページのフィールド行に表示する補助情報を選択します。
          </p>
        </div>
        <div className="divide-y divide-slate-200/70">
          <ToggleRow
            label="項目キーを表示"
            description="各フィールドの識別キー（例: campaign_name）を表示します。API連携やデータ構造の確認に使います。"
            checked={settings.showFieldKeys}
            onChange={(v) => update({ showFieldKeys: v })}
          />
          <ToggleRow
            label="フィールドタイプを表示"
            description="フィールドのデータ型（テキスト・日付・参照など）をラベルで表示します。"
            checked={settings.showFieldTypes}
            onChange={(v) => update({ showFieldTypes: v })}
          />
          <ToggleRow
            label="フィールドIDを表示"
            description="フィールドの内部UUID（データベースID）を表示します。DB操作やデバッグ時に使います。"
            checked={settings.showFieldIds}
            onChange={(v) => update({ showFieldIds: v })}
          />
        </div>
      </section>

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          変更はリアルタイムで反映されます。ページのリロードは不要です。
        </p>
        {!isDefault && (
          <button onClick={resetAll} className="btn-secondary text-xs">
            すべてデフォルトに戻す
          </button>
        )}
      </div>
    </div>
  );
}
