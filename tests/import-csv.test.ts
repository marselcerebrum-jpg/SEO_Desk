import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCsv, platformRowsFromCsv, repairPrompt } from '../src/lib/import-csv';

test('CSV: kutip ganda, koma dan baris baru di dalam kolom', () => {
  assert.deepEqual(parseCsv('a,"b ""x"", c\nbaris 2",d\r\n1,2,3'), [
    ['a', 'b "x", c\nbaris 2', 'd'],
    ['1', '2', '3'],
  ]);
});

test('placeholder salah ketik dan sisa "", diperbaiki', () => {
  assert.equal(
    repairPrompt(`about: '_KEYWORD', tailored for 'AUDIENCE_'. Done."",`),
    `about: '__KEYWORD__', tailored for '__AUDIENCE__'. Done.`,
  );
  assert.equal(repairPrompt('Keyword: __KEYWORD__ untuk __AUDIENCE__'), 'Keyword: __KEYWORD__ untuk __AUDIENCE__');
});

test('baris platform dibaca sampai LEGEND; #N/A dan https dibersihkan', () => {
  const csv = [
    'No,PLATFORM,Link CTA,Username,Password,System Content Preplexity,Prompt User Preplexity,ID CTA,Domain',
    '1,JadiASN,https://jadiasn.id/,raimon,rahasia,"Sistem\nriset","Riset \'_KEYWORD\'"",",#N/A,jadiasn.id',
    '2,Cerebrum,,u2,,,,,https://cerebrum.id/',
    ',,,,,,,,',
    'LEGEND,,,,,,,,',
    'Nama Variable,Cara nulis,,,,,,,',
  ].join('\n');
  const rows = platformRowsFromCsv(csv);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    platform: 'JadiASN',
    patch: {
      link_cta: 'https://jadiasn.id/',
      wp_username: 'raimon',
      wp_app_password: 'rahasia',
      system_research: 'Sistem\nriset',
      prompt_research: "Riset '__KEYWORD__'",
      id_cta: '',
      domain: 'jadiasn.id',
    },
  });
  assert.equal(rows[1].patch.domain, 'cerebrum.id');
  assert.ok(!('wp_app_password' in rows[1].patch), 'password kosong tidak menimpa');
});
