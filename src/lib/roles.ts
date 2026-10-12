// Jabatan akun. File ini dipakai juga di komponen client, jadi jangan import modul Node di sini.
export const ROLES = { leader: 'Leader', staff: 'Staff' } as const;
export type Role = keyof typeof ROLES;
export const isRole = (value: unknown): value is Role => value === 'leader' || value === 'staff';

// Supabase Auth wajib email: username tanpa "@" (mis. "admin") disimpan sebagai admin@seodesk.local
// dan ditampilkan kembali sebagai "admin". Email ini tidak pernah dikirimi surat (akun langsung terkonfirmasi).
export const USERNAME_EMAIL_DOMAIN = 'seodesk.local';
export const loginToEmail = (login: string) => (login.includes('@') ? login : `${login}@${USERNAME_EMAIL_DOMAIN}`);
export const displayLogin = (email: string) =>
  email.endsWith(`@${USERNAME_EMAIL_DOMAIN}`) ? email.slice(0, -(USERNAME_EMAIL_DOMAIN.length + 1)) : email;
