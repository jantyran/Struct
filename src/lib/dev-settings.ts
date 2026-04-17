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

const STORAGE_KEY = 'struct_dev_settings';

export function loadDevSettings(): DevSettings {
  if (typeof window === 'undefined') return DEV_SETTINGS_DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEV_SETTINGS_DEFAULTS;
    return { ...DEV_SETTINGS_DEFAULTS, ...(JSON.parse(raw) as Partial<DevSettings>) };
  } catch {
    return DEV_SETTINGS_DEFAULTS;
  }
}

export function saveDevSettings(settings: DevSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
