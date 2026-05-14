import type { AISettings } from '@/types';
import { normalizeAISettings } from '@/lib/ai/settings';

type GenerationStopReason = 'complete' | 'length';

interface GenerationResult {
  content: string;
  stopReason: GenerationStopReason;
}

const MAX_CONTINUATION_ROUNDS = 3;

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

function buildContinuationPrompt(originalPrompt: string, generatedContent: string): string {
  return `${originalPrompt}

---

前回の出力はAI APIの長さ制限で途中終了しました。
以下の「これまでの出力」の続きを、重複せず自然につなげて完了してください。
出力するのは続きの本文だけにしてください。

## これまでの出力（末尾）
${generatedContent.slice(-6000)}`;
}

async function generateWithAnthropic(settings: AISettings, prompt: string, systemPrompt: string, maxTokens: number): Promise<GenerationResult> {
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
    stop_reason?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error?.message || 'Anthropic API request failed');
  }

  const textBlock = payload.content?.find((block) => block.type === 'text');
  if (!textBlock?.text) throw new Error('Unexpected response type from Anthropic');
  return {
    content: textBlock.text,
    stopReason: payload.stop_reason === 'max_tokens' ? 'length' : 'complete',
  };
}

async function generateWithOpenAI(settings: AISettings, prompt: string, systemPrompt: string, maxTokens: number): Promise<GenerationResult> {
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
    choices?: Array<{ finish_reason?: string; message?: { content?: string } }>;
  };

  if (!response.ok) {
    throw new Error(payload.error?.message || 'OpenAI API request failed');
  }

  const choice = payload.choices?.[0];
  const content = choice?.message?.content;
  if (!content) throw new Error('Unexpected response type from OpenAI');
  return {
    content,
    stopReason: choice?.finish_reason === 'length' ? 'length' : 'complete',
  };
}

async function generateWithGemini(settings: AISettings, prompt: string, systemPrompt: string, maxTokens: number): Promise<GenerationResult> {
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
    candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>;
  };

  if (!response.ok) {
    throw new Error(payload.error?.message || 'Gemini API request failed');
  }

  const candidate = payload.candidates?.[0];
  const content = candidate?.content?.parts?.map((part) => part.text || '').join('').trim();
  if (!content) throw new Error('Unexpected response type from Gemini');
  return {
    content,
    stopReason: candidate?.finishReason === 'MAX_TOKENS' ? 'length' : 'complete',
  };
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

  let content = '';
  let nextPrompt = prompt;

  for (let round = 0; round <= MAX_CONTINUATION_ROUNDS; round += 1) {
    const result = resolved.provider === 'openai'
      ? await generateWithOpenAI(resolved, nextPrompt, systemPrompt, maxTokens)
      : resolved.provider === 'gemini'
        ? await generateWithGemini(resolved, nextPrompt, systemPrompt, maxTokens)
        : await generateWithAnthropic(resolved, nextPrompt, systemPrompt, maxTokens);

    content = `${content}${content && result.content ? '\n' : ''}${result.content}`.trim();

    if (result.stopReason !== 'length') {
      return content;
    }

    nextPrompt = buildContinuationPrompt(prompt, content);
  }

  throw new Error('AI応答が長さ制限で途中終了しました。出力量を減らすか、生成指示を短くして再実行してください。');
}
