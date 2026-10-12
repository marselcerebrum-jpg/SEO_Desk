// Jabatan akun. File ini dipakai juga di komponen client, jadi jangan import modul Node di sini.
export const ROLES = { leader: 'Leader', staff: 'Staff' } as const;
export type Role = keyof typeof ROLES;
export const isRole = (value: unknown): value is Role => value === 'leader' || value === 'staff';
