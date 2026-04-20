// ============================================================
// フィールド表示設定
// ============================================================
export type DevSettings = {
  showFieldKeys: boolean;
  showFieldTypes: boolean;
  showFieldIds: boolean;
};

export const DEV_SETTINGS_DEFAULTS: DevSettings = {
  showFieldKeys: false,
  showFieldTypes: true,
  showFieldIds: false,
};

const DEV_STORAGE_KEY = 'struct_dev_settings';

export function loadDevSettings(): DevSettings {
  if (typeof window === 'undefined') return DEV_SETTINGS_DEFAULTS;
  try {
    const raw = localStorage.getItem(DEV_STORAGE_KEY);
    if (!raw) return DEV_SETTINGS_DEFAULTS;
    return { ...DEV_SETTINGS_DEFAULTS, ...(JSON.parse(raw) as Partial<DevSettings>) };
  } catch {
    return DEV_SETTINGS_DEFAULTS;
  }
}

export function saveDevSettings(settings: DevSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(settings));
}

// ============================================================
// デザイン設定
// ============================================================
export type AccentPreset = 'cyan' | 'indigo' | 'emerald' | 'orange' | 'rose' | 'violet';
export type BgStyle = 'gradient' | 'flat' | 'minimal';

export type DesignSettings = {
  accentPreset: AccentPreset;
  bgStyle: BgStyle;
  compactMode: boolean;
};

export const DESIGN_SETTINGS_DEFAULTS: DesignSettings = {
  accentPreset: 'cyan',
  bgStyle: 'gradient',
  compactMode: false,
};

const DESIGN_STORAGE_KEY = 'struct_design_settings';

export type AccentVars = {
  label: string;
  swatch: string;
  accent: string;
  accentHover: string;
  accentLight: string;
  accentSoft: string;
  shadowRgb: string;
};

export const ACCENT_PRESETS: Record<AccentPreset, AccentVars> = {
  cyan:    { label: 'シアン',    swatch: '#0f9ab1', accent: '#0f9ab1', accentHover: '#0a8196', accentLight: '#7ed7de', accentSoft: '#e3f8fa', shadowRgb: '15,154,177' },
  indigo:  { label: 'インディゴ', swatch: '#4f46e5', accent: '#4f46e5', accentHover: '#4338ca', accentLight: '#a5b4fc', accentSoft: '#eef2ff', shadowRgb: '79,70,229' },
  emerald: { label: 'エメラルド', swatch: '#059669', accent: '#059669', accentHover: '#047857', accentLight: '#6ee7b7', accentSoft: '#d1fae5', shadowRgb: '5,150,105' },
  orange:  { label: 'オレンジ',  swatch: '#ea580c', accent: '#ea580c', accentHover: '#c2410c', accentLight: '#fdba74', accentSoft: '#fff7ed', shadowRgb: '234,88,12' },
  rose:    { label: 'ローズ',    swatch: '#e11d48', accent: '#e11d48', accentHover: '#be123c', accentLight: '#fda4af', accentSoft: '#fff1f2', shadowRgb: '225,29,72' },
  violet:  { label: 'バイオレット', swatch: '#7c3aed', accent: '#7c3aed', accentHover: '#6d28d9', accentLight: '#c4b5fd', accentSoft: '#f5f3ff', shadowRgb: '124,58,237' },
};

const BG_STYLES: Record<BgStyle, string> = {
  gradient: [
    'radial-gradient(circle at top left, rgba(126, 215, 222, 0.28), transparent 28%)',
    'radial-gradient(circle at top right, rgba(255, 210, 163, 0.22), transparent 24%)',
    'linear-gradient(180deg, #f9feff 0%, #eef8fb 100%)',
  ].join(', '),
  flat:     'linear-gradient(180deg, #f4fbff 0%, #f4fbff 100%)',
  minimal:  'linear-gradient(180deg, #ffffff 0%, #f8fafb 100%)',
};

export function applyDesignSettings(design: DesignSettings): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const preset = ACCENT_PRESETS[design.accentPreset];

  root.style.setProperty('--accent', preset.accent);
  root.style.setProperty('--accent-hover', preset.accentHover);
  root.style.setProperty('--accent-light', preset.accentLight);
  root.style.setProperty('--accent-soft', preset.accentSoft);
  root.style.setProperty('--shadow-soft', `0 22px 50px rgba(${preset.shadowRgb}, 0.12)`);
  root.style.setProperty('--btn-primary-shadow', `0 14px 28px rgba(${preset.shadowRgb}, 0.24)`);

  document.body.style.background = BG_STYLES[design.bgStyle];

  if (design.compactMode) {
    root.setAttribute('data-compact', '');
  } else {
    root.removeAttribute('data-compact');
  }
}

export function loadDesignSettings(): DesignSettings {
  if (typeof window === 'undefined') return DESIGN_SETTINGS_DEFAULTS;
  try {
    const raw = localStorage.getItem(DESIGN_STORAGE_KEY);
    if (!raw) return DESIGN_SETTINGS_DEFAULTS;
    return { ...DESIGN_SETTINGS_DEFAULTS, ...(JSON.parse(raw) as Partial<DesignSettings>) };
  } catch {
    return DESIGN_SETTINGS_DEFAULTS;
  }
}

export function saveDesignSettings(settings: DesignSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DESIGN_STORAGE_KEY, JSON.stringify(settings));
}
