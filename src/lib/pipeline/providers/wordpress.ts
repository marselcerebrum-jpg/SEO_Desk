import type { Platform } from '../types';
import { fetchJson, withRetry } from './http';

// Username + Application Password WordPress (bukan password login) dari menu Konfigurasi.
function wpBase(platform: Platform) {
  if (!platform.domain) throw new Error(`Domain ${platform.name} belum diisi (menu Konfigurasi)`);
  const user = platform.wp_username.trim();
  const password = platform.wp_app_password.trim();
  if (!user || !password) throw new Error(`Username/Password WordPress ${platform.name} belum diisi (menu Konfigurasi)`);
  const domain = platform.domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return {
    domain,
    api: `https://${domain}/wp-json/wp/v2`,
    headers: {
      Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
  };
}

export async function testWpConnection(platform: Platform) {
  const { api, headers } = wpBase(platform);
  const me = await fetchJson<{ name: string }>(`${api}/users/me?context=edit`, { headers, timeoutMs: 20_000 });
  return me.name;
}

export async function listCategories(platform: Platform, search: string) {
  const { api, headers } = wpBase(platform);
  const url = `${api}/categories?per_page=100&search=${encodeURIComponent(search)}`;
  return withRetry(() => fetchJson<{ id: number; name: string }[]>(url, { headers, timeoutMs: 30_000 }));
}

export type DraftPost = { title: string; slug: string; content: string; categoryId: number | null };

// Tidak di-retry: request yang timeout bisa saja sudah membuat post, retry = post dobel.
export async function createDraftPost(platform: Platform, post: DraftPost) {
  const { api, headers, domain } = wpBase(platform);
  const created = await fetchJson<{ id: number }>(`${api}/posts`, {
    method: 'POST',
    headers,
    timeoutMs: 60_000,
    body: JSON.stringify({
      title: post.title,
      slug: post.slug,
      content: post.content,
      status: 'draft',
      categories: post.categoryId ? [post.categoryId] : undefined,
      author: platform.wp_author_id ?? undefined,
    }),
  });
  return { id: created.id, editUrl: `https://${domain}/wp-admin/post.php?post=${created.id}&action=edit` };
}
