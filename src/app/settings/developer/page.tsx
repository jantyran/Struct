'use client';

import { useRouter } from 'next/navigation';
import { withBasePath } from '@/lib/paths';
import { useDevSettings } from '@/components/DevSettingsContext';
import { DEV_SETTINGS_DEFAULTS, DESIGN_SETTINGS_DEFAULTS, ACCENT_PRESETS, type AccentPreset, type BgStyle } from '@/lib/dev-settings';

// ============================================================
// 共通パーツ
// ============================================================
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="relative cursor-pointer shrink-0">
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div style={{
        width: 40, height: 22,
        borderRadius: 11,
        background: checked ? 'var(--accent)' : 'rgba(200,215,222,0.8)',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.08)',
        transition: 'background 0.15s ease',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute',
          width: 18, height: 18,
          borderRadius: 9,
          background: 'white',
          boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
          top: 2,
          left: checked ? 20 : 2,
          transition: 'left 0.15s ease',
        }} />
      </div>
    </label>
  );
}

function ToggleRow({ label, description, checked, onChange }: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 py-3 cursor-pointer row-hover px-2 rounded-xl">
      <div className="min-w-0">
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</p>
      </div>
      <div className="mt-0.5">
        <Toggle checked={checked} onChange={onChange} />
      </div>
    </label>
  );
}

// ============================================================
// アクセントカラー スウォッチ
// ============================================================
const ACCENT_ORDER: AccentPreset[] = ['cyan', 'indigo', 'emerald', 'orange', 'rose', 'violet'];

function ColorSwatch({ preset, selected, onClick }: {
  preset: AccentPreset; selected: boolean; onClick: () => void;
}) {
  const vars = ACCENT_PRESETS[preset];
  return (
    <button
      onClick={onClick}
      title={vars.label}
      style={{
        width: 36, height: 36,
        borderRadius: '50%',
        background: vars.swatch,
        border: selected ? `3px solid ${vars.swatch}` : '3px solid transparent',
        outline: selected ? `2px solid ${vars.swatch}` : '2px solid transparent',
        outlineOffset: 2,
        boxShadow: selected ? `0 0 0 3px rgba(255,255,255,0.9), 0 4px 12px rgba(0,0,0,0.12)` : '0 2px 6px rgba(0,0,0,0.1)',
        transition: 'all 0.15s ease',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    />
  );
}

// ============================================================
// 背景スタイル選択チップ
// ============================================================
const BG_STYLE_OPTIONS: { value: BgStyle; label: string; desc: string }[] = [
  { value: 'gradient', label: 'グラデーション', desc: 'デフォルト。淡いグラデーション背景' },
  { value: 'flat',     label: 'フラット',       desc: 'シンプルな単色背景' },
  { value: 'minimal',  label: 'ミニマル',       desc: '白基調のクリーンな背景' },
];

// ============================================================
// メインページ
// ============================================================
export default function DeveloperSettingsPage() {
  const router = useRouter();
  const { settings, update, design, updateDesign } = useDevSettings();

  const isDevDefault =
    settings.showFieldKeys === DEV_SETTINGS_DEFAULTS.showFieldKeys &&
    settings.showFieldTypes === DEV_SETTINGS_DEFAULTS.showFieldTypes &&
    settings.showFieldIds === DEV_SETTINGS_DEFAULTS.showFieldIds;

  const isDesignDefault =
    design.accentPreset === DESIGN_SETTINGS_DEFAULTS.accentPreset &&
    design.bgStyle === DESIGN_SETTINGS_DEFAULTS.bgStyle &&
    design.compactMode === DESIGN_SETTINGS_DEFAULTS.compactMode;

  const hasChanges = !isDevDefault || !isDesignDefault;

  function resetAll() {
    update(DEV_SETTINGS_DEFAULTS);
    updateDesign(DESIGN_SETTINGS_DEFAULTS);
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">開発設定</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            UIのカスタマイズや開発向け表示オプションです。設定はブラウザに保存され、他ユーザーには影響しません。
          </p>
        </div>
        <button onClick={() => router.push(withBasePath('/settings'))} className="btn-secondary">
          ← 設定へ戻る
        </button>
      </div>

      {/* ============ デザイン設定 ============ */}
      <section className="card p-5 space-y-5">
        <div>
          <h2 className="section-title">デザイン設定</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            アクセントカラーや背景スタイルを変更します。変更はリアルタイムで反映されます。
          </p>
        </div>

        {/* アクセントカラー */}
        <div>
          <p className="field-label">アクセントカラー</p>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            {ACCENT_ORDER.map((preset) => (
              <div key={preset} className="flex flex-col items-center gap-1.5">
                <ColorSwatch
                  preset={preset}
                  selected={design.accentPreset === preset}
                  onClick={() => updateDesign({ accentPreset: preset })}
                />
                <span className="text-[0.625rem]" style={{ color: design.accentPreset === preset ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {ACCENT_PRESETS[preset].label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 背景スタイル */}
        <div>
          <p className="field-label">背景スタイル</p>
          <div className="grid grid-cols-3 gap-2 mt-1.5">
            {BG_STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => updateDesign({ bgStyle: opt.value })}
                className="rounded-xl border p-3 text-left transition-colors"
                style={{
                  borderColor: design.bgStyle === opt.value ? 'var(--accent)' : 'var(--border)',
                  background: design.bgStyle === opt.value ? 'var(--accent-soft)' : 'rgba(255,255,255,0.7)',
                }}
              >
                <p className="text-xs font-semibold" style={{ color: design.bgStyle === opt.value ? 'var(--accent)' : 'var(--text-primary)' }}>
                  {opt.label}
                </p>
                <p className="text-[0.6875rem] mt-0.5" style={{ color: 'var(--text-muted)' }}>{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* コンパクトモード */}
        <div className="divide-y divide-slate-200/70">
          <ToggleRow
            label="コンパクトモード"
            description="カードや余白を詰めて、より多くの情報を表示します。"
            checked={design.compactMode}
            onChange={(v) => updateDesign({ compactMode: v })}
          />
        </div>
      </section>

      {/* ============ フィールド表示設定 ============ */}
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

      {/* フッター */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          変更はリアルタイムで反映されます。ページのリロードは不要です。
        </p>
        {hasChanges && (
          <button onClick={resetAll} className="btn-secondary text-xs">
            すべてデフォルトに戻す
          </button>
        )}
      </div>
    </div>
  );
}
