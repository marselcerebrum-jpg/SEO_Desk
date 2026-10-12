import type { openaiChat } from './providers/openai';
import type { perplexityResearch } from './providers/perplexity';
import type { createDraftPost, listCategories } from './providers/wordpress';
import { applyPlaceholders, buildDraftPrompt, findCategoryId, linkCitations, stripCodeFences } from './text';
import type { Keyword, Platform, RunRow, StepLog, StepName } from './types';

export type PipelineDeps = {
  research: typeof perplexityResearch;
  chat: typeof openaiChat;
  listCategories: typeof listCategories;
  createDraftPost: typeof createDraftPost;
  saveRun: (id: string, patch: Partial<RunRow>) => Promise<void>;
  saveKeyword: (id: string, patch: Partial<Keyword>) => Promise<void>;
};

const META_SCHEMA = {
  name: 'article_meta',
  schema: {
    type: 'object',
    properties: {
      slug: { type: 'string' },
      title: { type: 'string' },
      meta: { type: 'string' },
    },
    required: ['slug', 'title', 'meta'],
    additionalProperties: false,
  },
};

// Tiap tahap AI butuh minimal salah satu: System Content atau Prompt User
// (di sheet lama, instruksi HTML ditaruh di System Content dan Prompt User-nya kosong).
export const PROMPT_STEPS = [
  ['Perplexity', 'system_research', 'prompt_research'],
  ['Drafting', 'system_draft', 'prompt_draft'],
  ['HTML', 'system_html', 'prompt_html'],
  ['Slug Meta', 'system_meta', 'prompt_meta'],
] as const;

export function missingPromptSteps(platform: Platform): string[] {
  return PROMPT_STEPS.filter(([, system, user]) => !platform[system].trim() && !platform[user].trim()).map(
    ([label]) => label,
  );
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

// Menjalankan semua tahap untuk satu run. Output yang sudah ada di `run`
// (hasil run gagal sebelumnya) dipakai ulang supaya tahap itu tidak diulang.
export async function executeRun(
  initial: RunRow,
  keyword: Keyword,
  platform: Platform,
  deps: PipelineDeps,
): Promise<RunRow> {
  const run: RunRow = { ...initial, steps: [] };

  // Simpan berurutan; tahap paralel tidak boleh saling menimpa dengan snapshot lama.
  let saving = Promise.resolve();
  const persist = (patch: Partial<RunRow>) => {
    saving = saving.catch(() => {}).then(() => deps.saveRun(run.id, patch));
    return saving;
  };

  async function step(name: StepName, fn: () => Promise<string | void>) {
    const log: StepLog = { name, status: 'running', started_at: new Date().toISOString() };
    run.steps.push(log);
    run.current_step = name;
    await persist({ current_step: name, steps: run.steps });
    try {
      const note = await fn();
      log.status = note === 'skipped' ? 'skipped' : 'done';
      if (note && note !== 'skipped') log.note = note;
    } catch (error) {
      log.status = 'error';
      log.error = errorMessage(error);
      throw error;
    } finally {
      log.finished_at = new Date().toISOString();
      await persist({ steps: run.steps });
    }
  }

  const vars = {
    KEYWORD: keyword.keyword.trim(),
    AUDIENCE: keyword.audience.trim(),
    ROLE: keyword.role.trim(),
    CATEGORY: keyword.category.trim(),
    TOPIC: keyword.category.trim(),
    LINK_CTA: platform.link_cta.trim(),
    ID_CTA: platform.id_cta.trim(),
    ARTIKEL_KOMPETITOR: platform.artikel_kompetitor.trim(),
  };
  const fill = (template: string) => applyPlaceholders(template, vars);

  try {
    await step('validasi', async () => {
      const missing = (
        [
          ['keyword', vars.KEYWORD],
          ['kategori', vars.CATEGORY],
          ['role', vars.ROLE],
          ['audience', vars.AUDIENCE],
        ] as const
      ).filter(([, value]) => !value);
      if (missing.length) throw new Error(`Keyword belum lengkap: ${missing.map(([n]) => n).join(', ')}`);
      if (!platform.active) throw new Error(`Platform ${platform.name} nonaktif`);
      if (!platform.domain) throw new Error(`Domain ${platform.name} belum diisi (menu Konfigurasi)`);
      const missingPrompts = missingPromptSteps(platform);
      if (missingPrompts.length) {
        throw new Error(`Prompt ${platform.name} belum diisi: ${missingPrompts.join(', ')} (menu Konfigurasi)`);
      }
    });

    await step('konfigurasi', async () => `${platform.name} · ${platform.domain}`);

    await step('kategori', async () => {
      if (run.category_id) return 'skipped';
      const categories = await deps.listCategories(platform, vars.CATEGORY);
      run.category_id = findCategoryId(categories, vars.CATEGORY);
      if (!run.category_id) {
        if (!platform.is_testing) {
          throw new Error(`Kategori "${vars.CATEGORY}" tidak ditemukan di ${platform.domain}`);
        }
        return 'Kategori tidak ditemukan; Testing tetap lanjut tanpa kategori';
      }
      await persist({ category_id: run.category_id });
      return `ID ${run.category_id}`;
    });

    await step('riset', async () => {
      if (run.research) return 'skipped';
      const result = await deps.research(fill(platform.system_research), fill(platform.prompt_research));
      run.research = linkCitations(result.text, result.citations);
      await persist({ research: run.research });
      return `${result.citations.length} sumber`;
    });

    await step('tulis', async () => {
      if (run.draft) return 'skipped';
      run.draft = await deps.chat({
        system: fill(platform.system_draft) || undefined,
        user: buildDraftPrompt(platform.prompt_draft, { ...vars, RESEARCH: run.research ?? '' }),
      });
      await persist({ draft: run.draft });
    });

    const parallel = await Promise.allSettled([
      step('metadata', async () => {
        if (run.title && run.slug && run.meta) return 'skipped';
        const text = await deps.chat({
          system: fill(platform.system_meta) || undefined,
          user: `${fill(platform.prompt_meta)}\n\nContent: ${run.draft}`,
          maxTokens: 400,
          temperature: 0.4,
          topP: 0.9,
          jsonSchema: META_SCHEMA,
        });
        const parsed = JSON.parse(text) as { slug: string; title: string; meta: string };
        run.title = parsed.title.trim();
        run.slug = parsed.slug.trim();
        run.meta = parsed.meta.trim();
        await persist({ title: run.title, slug: run.slug, meta: run.meta });
      }),
      step('html', async () => {
        if (run.html) return 'skipped';
        run.html = await deps.chat({
          system: fill(platform.system_html) || undefined,
          user: `${fill(platform.prompt_html)}\n\n### Input Content\n\n${run.draft}\n`,
        });
        await persist({ html: run.html });
      }),
    ]);
    const failed = parallel.find((r) => r.status === 'rejected');
    if (failed) throw failed.reason;

    await step('gabung', async () => {
      run.content = stripCodeFences(run.html ?? '');
      await persist({ content: run.content });
    });

    let editUrl: string | null = null;
    await step('draft_wp', async () => {
      if (run.wp_post_id) return 'skipped';
      const post = await deps.createDraftPost(platform, {
        title: run.title!,
        slug: run.slug!,
        content: run.content!,
        categoryId: run.category_id,
      });
      run.wp_post_id = post.id;
      editUrl = post.editUrl;
      await persist({ wp_post_id: run.wp_post_id });
      return `Post #${post.id}`;
    });

    run.status = 'success';
    run.current_step = null;
    run.finished_at = new Date().toISOString();
    await persist({ status: 'success', current_step: null, finished_at: run.finished_at });
    await deps.saveKeyword(keyword.id, {
      status: 'generated',
      title: run.title,
      slug: run.slug,
      meta: run.meta,
      wp_post_id: run.wp_post_id,
      wp_edit_url:
        editUrl ??
        `https://${platform.domain!.replace(/^https?:\/\//, '').replace(/\/+$/, '')}/wp-admin/post.php?post=${run.wp_post_id}&action=edit`,
      last_error: null,
    });
    return run;
  } catch (error) {
    const message = errorMessage(error);
    run.status = 'error';
    run.error = message;
    run.finished_at = new Date().toISOString();
    await persist({ status: 'error', error: message, finished_at: run.finished_at }).catch(() => {});
    await deps.saveKeyword(keyword.id, { status: 'error', last_error: message }).catch(() => {});
    return run;
  }
}
