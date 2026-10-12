import { getSettings } from '../../settings';
import { fetchJson, withRetry } from './http';

type PerplexityResponse = {
  choices: { message: { content: string } }[];
  citations?: string[];
  search_results?: { url: string }[];
};

export type ResearchResult = { text: string; citations: string[] };

export async function perplexityResearch(system: string, user: string): Promise<ResearchResult> {
  const { perplexityApiKey: apiKey, perplexityModel } = getSettings();
  if (!apiKey) throw new Error('API key Perplexity belum diisi (menu Konfigurasi)');

  return withRetry(async () => {
    const data = await fetchJson<PerplexityResponse>('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: perplexityModel,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    const text = data.choices[0]?.message.content;
    if (!text) throw new Error('Perplexity mengembalikan jawaban kosong');
    return { text, citations: data.citations ?? data.search_results?.map((r) => r.url) ?? [] };
  });
}
