import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { before, test } from 'node:test';

// Modul akun menulis ke <cwd>/data, jadi jalankan di folder sementara.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seodesk-auth-'));
process.chdir(dir);
let auth: typeof import('../src/lib/local-auth');
before(async () => {
  auth = await import('../src/lib/local-auth');
});

test('password: hash scrypt bisa diverifikasi, password salah ditolak', () => {
  const hash = auth.hashPassword('rahasia123');
  assert.match(hash, /^scrypt\$/);
  assert.equal(auth.verifyPassword('rahasia123', hash), true);
  assert.equal(auth.verifyPassword('rahasia124', hash), false);
  assert.equal(auth.verifyPassword('rahasia123', 'bukan-hash'), false);
});

test('akun: email unik, tanpa membedakan huruf besar', () => {
  auth.createLocalAccount({ email: 'Leader@Tim.id', name: 'Leader', role: 'leader', password: 'password-1' });
  assert.throws(() => auth.createLocalAccount({ email: 'leader@tim.id', name: 'X', role: 'staff', password: 'password-2' }));
  assert.equal(auth.findLocalAccountByEmail('LEADER@tim.id')?.role, 'leader');
});

test('sesi: token valid, rusak, dan batal setelah ganti password', () => {
  const staff = auth.createLocalAccount({ email: 'staff@tim.id', name: 'Staff', role: 'staff', password: 'password-1' });
  const token = auth.createSessionToken(staff);
  assert.equal(auth.accountFromSessionToken(token)?.id, staff.id);
  assert.equal(auth.accountFromSessionToken(`${token}x`), null);
  assert.equal(auth.accountFromSessionToken(undefined), null);

  auth.updateLocalAccount(staff.id, { password: 'password-baru' });
  assert.equal(auth.accountFromSessionToken(token), null);

  const fresh = auth.createSessionToken(auth.findLocalAccountByEmail('staff@tim.id')!);
  auth.deleteLocalAccount(staff.id);
  assert.equal(auth.accountFromSessionToken(fresh), null);
});
