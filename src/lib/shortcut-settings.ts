import type { ShortcutActionKey, ShortcutBinding, ShortcutSettings } from '@/types';

export const SHORTCUT_LABELS: Record<ShortcutActionKey, string> = {
  save_current: '保存',
  new_record: '新規追加',
  show_shortcuts_help: 'ショートカット一覧',
};

export const SHORTCUT_DESCRIPTIONS: Record<ShortcutActionKey, string> = {
  save_current: '現在の画面や編集中データを保存します。',
  new_record: '現在開いている画面の文脈で新しいデータやレコードを追加します。',
  show_shortcuts_help: '利用可能なショートカット一覧を表示します。',
};

const DEFAULT_SHORTCUTS: ShortcutSettings = {
  save_current: { enabled: true, combo: 'mod+s' },
  new_record: { enabled: true, combo: 'shift+c' },
  show_shortcuts_help: { enabled: true, combo: 'shift+/' },
};

const ALIAS_MAP: Record<string, string> = {
  command: 'meta',
  cmd: 'meta',
  option: 'alt',
  control: 'ctrl',
  return: 'enter',
  esc: 'escape',
  '?': '/',
};

function normalizeShortcutPart(part: string) {
  const normalized = part.trim().toLowerCase();
  return ALIAS_MAP[normalized] || normalized;
}

function sortModifiers(parts: string[]) {
  const order = ['mod', 'ctrl', 'meta', 'shift', 'alt'];
  return order.filter((modifier) => parts.includes(modifier));
}

export function defaultShortcutSettings(): ShortcutSettings {
  return {
    save_current: { ...DEFAULT_SHORTCUTS.save_current },
    new_record: { ...DEFAULT_SHORTCUTS.new_record },
    show_shortcuts_help: { ...DEFAULT_SHORTCUTS.show_shortcuts_help },
  };
}

export function normalizeShortcutCombo(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  const parts = value
    .split('+')
    .map(normalizeShortcutPart)
    .filter(Boolean);

  if (parts.length === 0) return fallback;

  const modifiers = sortModifiers(parts);
  const lastKey = [...parts].reverse().find((part) => !modifiers.includes(part));

  return [...modifiers, ...(lastKey ? [lastKey] : [])].join('+') || fallback;
}

export function normalizeShortcutBinding(value: unknown, fallback: ShortcutBinding): ShortcutBinding {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...fallback };
  }

  const source = value as Partial<ShortcutBinding>;
  return {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : fallback.enabled,
    combo: normalizeShortcutCombo(source.combo, fallback.combo),
  };
}

export function normalizeShortcutSettings(value: unknown): ShortcutSettings {
  const defaults = defaultShortcutSettings();
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return defaults;
  }

  const source = value as Partial<ShortcutSettings>;
  const normalized = {
    save_current: normalizeShortcutBinding(source.save_current, defaults.save_current),
    new_record: normalizeShortcutBinding(source.new_record, defaults.new_record),
    show_shortcuts_help: normalizeShortcutBinding(source.show_shortcuts_help, defaults.show_shortcuts_help),
  };

  if (['mod+n', 'mod+shift+n'].includes(normalized.new_record.combo)) {
    normalized.new_record.combo = defaults.new_record.combo;
  }

  return normalized;
}

export function normalizeShortcutSettingsRow(row: { shortcut_settings?: string | null } | null | undefined): ShortcutSettings {
  if (!row?.shortcut_settings) return defaultShortcutSettings();
  try {
    return normalizeShortcutSettings(JSON.parse(row.shortcut_settings));
  } catch {
    return defaultShortcutSettings();
  }
}

export function serializeShortcutSettings(settings: ShortcutSettings): string {
  return JSON.stringify(normalizeShortcutSettings(settings));
}

function eventKeyToComboKey(event: KeyboardEvent) {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key.toLowerCase();
  return ALIAS_MAP[key] || key;
}

export function shortcutComboFromKeyboardEvent(event: KeyboardEvent) {
  const key = eventKeyToComboKey(event);
  if (['shift', 'ctrl', 'meta', 'alt'].includes(key)) return '';

  const modifiers = sortModifiers([
    event.ctrlKey || event.metaKey ? 'mod' : '',
    event.shiftKey ? 'shift' : '',
    event.altKey ? 'alt' : '',
  ].filter(Boolean));

  return normalizeShortcutCombo([...modifiers, key].join('+'), '');
}

export function matchesShortcut(event: KeyboardEvent, combo: string) {
  const normalizedCombo = normalizeShortcutCombo(combo, '');
  if (!normalizedCombo) return false;

  const parts = normalizedCombo.split('+');
  const key = parts[parts.length - 1];
  const needsShift = parts.includes('shift');
  const needsAlt = parts.includes('alt');
  const needsCtrl = parts.includes('ctrl');
  const needsMeta = parts.includes('meta');
  const needsMod = parts.includes('mod');

  if (event.shiftKey !== needsShift) return false;
  if (event.altKey !== needsAlt) return false;

  const modPressed = event.ctrlKey || event.metaKey;
  if (needsMod && !modPressed) return false;
  if (!needsMod && event.ctrlKey !== needsCtrl) return false;
  if (!needsMod && event.metaKey !== needsMeta) return false;
  if (needsMod && needsCtrl && !event.ctrlKey) return false;
  if (needsMod && needsMeta && !event.metaKey) return false;

  return eventKeyToComboKey(event) === key;
}

export function formatShortcutCombo(combo: string) {
  const normalized = normalizeShortcutCombo(combo, combo);
  return normalized
    .split('+')
    .map((part) => {
      switch (part) {
        case 'mod':
          return 'Ctrl/Cmd';
        case 'ctrl':
          return 'Ctrl';
        case 'meta':
          return 'Cmd';
        case 'shift':
          return 'Shift';
        case 'alt':
          return 'Alt';
        case '/':
          return '/';
        default:
          return part.length === 1 ? part.toUpperCase() : part;
      }
    })
    .join(' + ');
}
