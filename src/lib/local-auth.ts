import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Role } from './roles';
import { DATA_DIR } from './settings';

// Akun mode lokal (sebelum Supabase terhubung). Disimpan terpisah dari local-db.json
// supaya "reset data lokal" tidak ikut menghapus akun.
const FILE = path.join(DATA_DIR, 'accounts.json');

export { isRole, ROLES, type Role } from './roles';

export type LocalAccount = {
  id: string;
  email: string;
  name: string;
  role: Role;
  passwordHash: string;
  createdAt: string;
  lastSignInAt: string | null;
};

type Store = { secret: string; users: LocalAccount[] };

export const SESSION_COOKIE = 'seodesk_session';
export const SESSION_DAYS = 30;

function read(): Store {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8')) as Partial<Store>;
    if (data.secret && Array.isArray(data.users)) return { secret: data.secret, users: data.users };
  } catch {
    // Belum ada file: dibuat saat akun pertama disimpan.
  }
  return { secret: randomBytes(32).toString('hex'), users: [] };
}

function write(store: Store) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, FILE);
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password: string, stored: string) {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

export function listLocalAccounts() {
  return read().users;
}

export function hasLocalAccounts() {
  return read().users.length > 0;
}

export function createLocalAccount(input: { email: string; name: string; role: Role; password: string }) {
  const store = read();
  const email = input.email.toLowerCase();
  if (store.users.some((u) => u.email === email)) throw new Error(`Email ${email} sudah dipakai`);
  const account: LocalAccount = {
    id: randomUUID(),
    email,
    name: input.name,
    role: input.role,
    passwordHash: hashPassword(input.password),
    createdAt: new Date().toISOString(),
    lastSignInAt: null,
  };
  store.users.push(account);
  write(store);
  return account;
}

export function updateLocalAccount(id: string, patch: { role?: Role; password?: string; lastSignInAt?: string }) {
  const store = read();
  const user = store.users.find((u) => u.id === id);
  if (!user) throw new Error('Akun tidak ditemukan');
  if (patch.role) user.role = patch.role;
  if (patch.password) user.passwordHash = hashPassword(patch.password);
  if (patch.lastSignInAt) user.lastSignInAt = patch.lastSignInAt;
  write(store);
}

export function deleteLocalAccount(id: string) {
  const store = read();
  store.users = store.users.filter((u) => u.id !== id);
  write(store);
}

export function findLocalAccountByEmail(email: string) {
  return read().users.find((u) => u.email === email.toLowerCase()) ?? null;
}

// Token sesi = id.kedaluwarsa.tanda-tangan. Hash password ikut ditandatangani, jadi ganti
// password atau hapus akun langsung membatalkan sesi lama.
const sign = (secret: string, payload: string, passwordHash: string) =>
  createHmac('sha256', secret).update(`${payload}.${passwordHash}`).digest('base64url');

export function createSessionToken(account: LocalAccount) {
  const payload = `${account.id}.${Date.now() + SESSION_DAYS * 86_400_000}`;
  return `${payload}.${sign(read().secret, payload, account.passwordHash)}`;
}

export function accountFromSessionToken(token: string | undefined): LocalAccount | null {
  if (!token) return null;
  const [id, expires, signature] = token.split('.');
  if (!id || !expires || !signature || Number(expires) < Date.now()) return null;
  const store = read();
  const user = store.users.find((u) => u.id === id);
  if (!user) return null;
  const expected = Buffer.from(sign(store.secret, `${id}.${expires}`, user.passwordHash));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? user : null;
}
