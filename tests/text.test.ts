import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyPlaceholders,
  buildDraftPrompt,
  decodeEntities,
  findCategoryId,
  linkCitations,
  stripCodeFences,
} from '../src/lib/pipeline/text';

const vars = { KEYWORD: 'gaji guru asn', AUDIENCE: 'Fresh Graduate', ROLE: 'ASN', CATEGORY: 'Informasi CPNS' };

test('placeholder diganti, yang tak dikenal dibiarkan', () => {
  assert.equal(
    applyPlaceholders('Tulis __KEYWORD__ untuk __AUDIENCE__ (__UNKNOWN__)', vars),
    'Tulis gaji guru asn untuk Fresh Graduate (__UNKNOWN__)',
  );
});

test('placeholder bergaris bawah: __LINK_CTA__, __ARTIKEL_KOMPETITOR__', () => {
  assert.equal(
    applyPlaceholders('CTA __LINK_CTA__ #__ID_CTA__ ref __ARTIKEL_KOMPETITOR__ __KEYWORD__', {
      ...vars,
      LINK_CTA: 'https://jadiasn.id/daftar',
      ID_CTA: '42',
      ARTIKEL_KOMPETITOR: 'https://a.com',
    }),
    'CTA https://jadiasn.id/daftar #42 ref https://a.com gaji guru asn',
  );
});

test('riset ditempel bila prompt drafting tidak memakai __RESEARCH__', () => {
  const appended = buildDraftPrompt('Tulis __KEYWORD__', { ...vars, RESEARCH: 'fakta A' });
  assert.match(appended, /^Tulis gaji guru asn\n\n### Hasil Riset.*\n\nfakta A$/s);
  const inline = buildDraftPrompt('Riset: __RESEARCH__. Tulis.', { ...vars, RESEARCH: 'fakta A' });
  assert.equal(inline, 'Riset: fakta A. Tulis.');
});

test('sitasi [n] jadi URL, termasuk [10]; tanpa URL dibiarkan', () => {
  const urls = Array.from({ length: 10 }, (_, i) => `https://s${i + 1}.id`);
  assert.equal(linkCitations('a[1] b[10] c[11]', urls), 'a - source: https://s1.id b - source: https://s10.id c[11]');
});

test('code fence dibuang', () => {
  assert.equal(stripCodeFences('```html\n<p>x</p>\n```'), '<p>x</p>');
});

test('nama kategori WP ter-escape tetap cocok', () => {
  assert.equal(decodeEntities('Tips &amp; Trik &#8211; CPNS'), 'Tips & Trik – CPNS');
  const categories = [
    { id: 4, name: 'Informasi CPNS Daerah' },
    { id: 7, name: 'Tips &amp; Trik' },
    { id: 9, name: 'Informasi  CPNS' },
  ];
  assert.equal(findCategoryId(categories, 'tips & trik'), 7);
  assert.equal(findCategoryId(categories, 'Informasi CPNS'), 9);
  assert.equal(findCategoryId(categories, 'Tidak Ada'), null);
});
