import { getSettings } from '../../settings';
import { fetchJson, withRetry } from './http';

type ChatResponse = {
  choices: { message: { content: string | null; refusal?: string | null }; finish_reason: string }[];
};

export type ChatRequest = {
  system?: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  jsonSchema?: { name: string; schema: Record<string, unknown> };
};

export async function openaiChat(req: ChatRequest): Promise<string> {
  const { openaiApiKey: apiKey, openaiModel } = getSettings();
  if (!apiKey) throw new Error('API key OpenAI belum diisi (menu Konfigurasi)');

  const messages = [
    ...(req.system ? [{ role: 'system', content: req.system }] : []),
    { role: 'user', content: req.user },
  ];

  return withRetry(async () => {
    const data = await fetchJson<ChatResponse>('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: openaiModel,
        messages,
        max_completion_tokens: req.maxTokens,
        temperature: req.temperature,
        top_p: req.topP,
        response_format: req.jsonSchema
          ? { type: 'json_schema', json_schema: { ...req.jsonSchema, strict: true } }
          : undefined,
      }),
    });
    const choice = data.choices[0];
    if (choice?.message.refusal) throw new Error(`OpenAI menolak: ${choice.message.refusal}`);
    if (!choice?.message.content) throw new Error('OpenAI mengembalikan jawaban kosong');
    if (choice.finish_reason === 'length') throw new Error('Jawaban OpenAI terpotong (batas token)');
    return choice.message.content;
  });
}
