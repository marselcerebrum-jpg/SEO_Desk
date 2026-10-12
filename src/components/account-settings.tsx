'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import {
  changePassword,
  createAccount,
  deleteAccount,
  resetAccountPassword,
  setAccountRole,
  type ActionState,
} from '@/app/actions';
import type { Account } from '@/lib/accounts';
import { ROLES, type Role } from '@/lib/roles';
import { Message } from './forms';

const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : 'Belum pernah';

export function AccountSettings({ accounts, currentUserId }: { accounts: Account[]; currentUserId: string }) {
  const [state, action, pending] = useActionState(createAccount, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <>
      <form ref={formRef} action={action} className="account-form">
        <label>
          Nama
          <input name="name" placeholder="Nama anggota tim" required />
        </label>
        <label>
          Username / email
          <input name="email" required autoComplete="off" autoCapitalize="none" spellCheck={false} />
        </label>
        <label>
          Password
          <input name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="Minimal 8 karakter" />
        </label>
        <label>
          Jabatan
          <select name="role" defaultValue="staff">
            <option value="staff">{ROLES.staff}</option>
            <option value="leader">{ROLES.leader}</option>
          </select>
        </label>
        <button type="submit" disabled={pending}>
          {pending ? 'Membuat…' : 'Buat akun'}
        </button>
      </form>
      <Message state={state} />

      <div className="table-wrap" style={{ marginTop: 14 }}>
        <table className="dash-table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Username / email</th>
              <th>Jabatan</th>
              <th>Dibuat</th>
              <th>Login terakhir</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  Belum ada akun.
                </td>
              </tr>
            )}
            {accounts.map((a) => (
              <AccountRow key={a.id} account={a} isMe={a.id === currentUserId} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={action} className="password-form">
      <label>
        Password lama
        <input name="current" type="password" required autoComplete="current-password" />
      </label>
      <label>
        Password baru
        <input name="password" type="password" minLength={8} required autoComplete="new-password" placeholder="Minimal 8 karakter" />
      </label>
      <label>
        Ulangi password baru
        <input name="confirm" type="password" minLength={8} required autoComplete="new-password" />
      </label>
      <div className="row">
        <button type="submit" disabled={pending}>
          {pending ? 'Menyimpan…' : 'Ganti password'}
        </button>
        <Message state={state} />
      </div>
    </form>
  );
}

function AccountRow({ account, isMe }: { account: Account; isMe: boolean }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionState>(undefined);
  const run = (task: () => Promise<ActionState>) => startTransition(async () => setResult(await task()));

  return (
    <tr>
      <td>
        <strong>{account.name || '—'}</strong>
        {isMe && <span className="badge done" style={{ marginLeft: 6 }}>Anda</span>}
      </td>
      <td>{account.email}</td>
      <td>
        {isMe ? (
          <span className={`badge ${account.role === 'leader' ? 'warn' : 'draft'}`}>{ROLES[account.role]}</span>
        ) : (
          <select
            className="role-select"
            value={account.role}
            disabled={pending}
            aria-label={`Jabatan ${account.email}`}
            onChange={(e) => {
              const role = e.target.value as Role;
              run(() => setAccountRole(account.id, role));
            }}
          >
            <option value="staff">{ROLES.staff}</option>
            <option value="leader">{ROLES.leader}</option>
          </select>
        )}
      </td>
      <td className="muted">{date(account.createdAt)}</td>
      <td className="muted">{date(account.lastSignInAt)}</td>
      <td className="nowrap">
        {!isMe && (
          <>
            <button
              type="button"
              className="link-button"
              disabled={pending}
              onClick={() => {
                const password = prompt(`Password baru untuk ${account.email} (minimal 8 karakter):`);
                if (password) run(() => resetAccountPassword(account.id, password));
              }}
            >
              Reset password
            </button>
            <button
              type="button"
              className="link-button danger"
              disabled={pending}
              style={{ marginLeft: 12 }}
              onClick={() => {
                if (!confirm(`Hapus akun ${account.email}? Orang ini tidak bisa login lagi.`)) return;
                run(() => deleteAccount(account.id));
              }}
            >
              Hapus
            </button>
          </>
        )}
        <Message state={result} />
      </td>
    </tr>
  );
}
