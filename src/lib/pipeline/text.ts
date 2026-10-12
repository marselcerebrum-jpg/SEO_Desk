export type PromptVars = {
  KEYWORD: string;
  AUDIENCE: string;
  ROLE: string;
  CATEGORY: string;
  /** Alias CATEGORY; nama yang dipakai di prompt sheet lama. */
  TOPIC?: string;
  LINK_CTA?: string;
  ID_CTA?: string;
  ARTIKEL_KOMPETITOR?: string;
  RESEARCH?: string;
};

export function applyPlaceholders(template: string, vars: PromptVars): string {
  return template.replace(/__([A-Z][A-Z_]*?)__/g, (match, name: string) => {
    const value = vars[name as keyof PromptVars];
    return value === undefined ? match : value;
  });
}

// Di n8n hasil riset tidak pernah sampai ke penulis. Kalau prompt drafting
// tidak memakai __RESEARCH__, riset ditempel di akhir prompt.
export function buildDraftPrompt(template: string, vars: PromptVars): string {
  const prompt = applyPlaceholders(template, vars);
  if (template.includes('__RESEARCH__') || !vars.RESEARCH) return prompt;
  return `${prompt}\n\n### Hasil Riset (gunakan sebagai sumber fakta)\n\n${vars.RESEARCH}`;
}

// Ganti penanda [n] dari Perplexity dengan URL sumbernya. Penanda tanpa
// pasangan URL dibiarkan, bukan diganti "undefined" seperti di n8n.
export function linkCitations(text: string, citations: string[]): string {
  return text.replace(/\[(\d+)\]/g, (match, n: string) => {
    const url = citations[Number(n) - 1];
    return url ? ` - source: ${url}` : match;
  });
}

export function stripCodeFences(text: string): string {
  return text.replace(/```[a-zA-Z]*\n?/g, '').trim();
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

// WordPress REST mengembalikan nama kategori dalam bentuk HTML-escaped (mis. "&amp;").
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isNaN(point) ? match : String.fromCodePoint(point);
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

export function normalizeName(text: string): string {
  return decodeEntities(text).replace(/\s+/g, ' ').trim().toLowerCase();
}

export function findCategoryId(categories: { id: number; name: string }[], wanted: string): number | null {
  const target = normalizeName(wanted);
  return categories.find((c) => normalizeName(c.name) === target)?.id ?? null;
}
