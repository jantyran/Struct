import type { AISettings } from '@/types';
import { normalizeAISettings } from '@/lib/ai/settings';

function resolveRuntimeSettings(settings?: Partial<AISettings>): AISettings {
  const normalized = normalizeAISettings(settings);

  if (normalized.provider === 'openai') {
    return {
      ...normalized,
      api_key: normalized.api_key || process.env.OPENAI_API_KEY || '',
      base_url: normalized.base_url || 'https://api.openai.com/v1',
    };
  }

  if (normalized.provider === 'gemini') {
    return {
      ...normalized,
      api_key: normalized.api_key || process.env.GEMINI_API_KEY || '',
      base_url: normalized.base_url || 'https://generativelanguage.googleapis.com/v1beta',
    };
  }

  return {
    ...normalized,
    api_key: normalized.api_key || process.env.ANTHROPIC_API_KEY || '',
    base_url: normalized.base_url || 'https://api.anthropic.com',
  };
}

async function generateWithAnthropic(settings: AISettings, prompt: string, systemPrompt: string, maxTokens: number): Promise<string> {
  const response = await fetch(`${settings.base_url.replace(/\/$/, '')}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': settings.api_key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const payload = await response.json() as {
    error?: { message?: string };
    content?: Array<{ type: string; text?: string }>;
  };

  if (!response.ok) {
    throw new Error(payload.error?.message || 'Anthropic API request failed');
  }

  const textBlock = payload.content?.find((block) => block.type === 'text');
  if (!textBlock?.text) throw new Error('Unexpected response type from Anthropic');
  return textBlock.text;
}

async function generateWithOpenAI(settings: AISettings, prompt: string, systemPrompt: string, maxTokens: number): Promise<string> {
  const response = await fetch(`${settings.base_url.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.api_key}`,
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    }),
  });

  const payload = await response.json() as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  };

  if (!response.ok) {
    throw new Error(payload.error?.message || 'OpenAI API request failed');
  }

  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('Unexpected response type from OpenAI');
  return content;
}

async function generateWithGemini(settings: AISettings, prompt: string, systemPrompt: string, maxTokens: number): Promise<string> {
  const response = await fetch(
    `${settings.base_url.replace(/\/$/, '')}/models/${settings.model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': settings.api_key,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          maxOutputTokens: maxTokens,
        },
      }),
    }
  );

  const payload = await response.json() as {
    error?: { message?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  if (!response.ok) {
    throw new Error(payload.error?.message || 'Gemini API request failed');
  }

  const content = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
  if (!content) throw new Error('Unexpected response type from Gemini');
  return content;
}

export async function generateText(
  prompt: string,
  systemPrompt: string,
  maxTokens = 4096,
  settings?: Partial<AISettings>
): Promise<string> {
  const resolved = resolveRuntimeSettings(settings);

  if (!resolved.api_key) {
    throw new Error('AI APIキーが未設定です。設定画面で APIキー を入力してください。');
  }

  if (resolved.provider === 'openai') {
    return generateWithOpenAI(resolved, prompt, systemPrompt, maxTokens);
  }

  if (resolved.provider === 'gemini') {
    return generateWithGemini(resolved, prompt, systemPrompt, maxTokens);
  }

  return generateWithAnthropic(resolved, prompt, systemPrompt, maxTokens);
}
