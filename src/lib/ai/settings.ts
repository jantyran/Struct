import type { AIProvider, AISettings } from '@/types';

const DEFAULT_MODELS: Record<AIProvider, string> = {
  anthropic: 'claude-haiku-4-5-20251001',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.5-flash',
};

const DEFAULT_BASE_URLS: Record<AIProvider, string> = {
  anthropic: 'https://api.anthropic.com',
  openai: 'https://api.openai.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
};

export function defaultAISettings(): AISettings {
  return {
    provider: 'gemini',
    model: DEFAULT_MODELS.gemini,
    api_key: '',
    base_url: DEFAULT_BASE_URLS.gemini,
  };
}

export function normalizeAISettings(data: Partial<AISettings> | null | undefined): AISettings {
  const provider: AIProvider = data?.provider === 'openai'
    ? 'openai'
    : data?.provider === 'anthropic'
      ? 'anthropic'
      : 'gemini';
  return {
    provider,
    model: data?.model?.trim() || DEFAULT_MODELS[provider],
    api_key: data?.api_key?.trim() || '',
    base_url: data?.base_url?.trim() || DEFAULT_BASE_URLS[provider],
  };
}

export function normalizeAISettingsRow(row: Record<string, unknown>): AISettings {
  if (!row?.ai_settings) return defaultAISettings();
  try {
    return normalizeAISettings(JSON.parse(row.ai_settings as string));
  } catch {
    return defaultAISettings();
  }
}

export function serializeAISettings(settings: AISettings): string {
  return JSON.stringify(normalizeAISettings(settings));
}

export function maskAISettings(settings: AISettings): AISettings {
  return {
    ...settings,
    api_key: settings.api_key ? `${settings.api_key.slice(0, 6)}••••••••` : '',
  };
}
