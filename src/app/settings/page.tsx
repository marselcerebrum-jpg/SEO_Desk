import Link from 'next/link';
import { AccountSettings, ChangePasswordForm } from '@/components/account-settings';
import { DropdownEditor } from '@/components/dropdown-editor';
import { listAccounts } from '@/lib/accounts';
import { getDb } from '@/lib/db';
import { displayLogin } from '@/lib/roles';
import { isSupabaseConfigured } from '@/lib/settings';
import { requireUser } from '@/lib/supabase/server';

const TABS = [
  ['akun', 'Akun', true],
  ['dropdown', 'Atur dropdown', true],
  ['password', 'Ganti password', false],
] as const;
type Tab = (typeof TABS)[number][0];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabParam } = await searchParams;
  const user = await requireUser();
  const leader = user.role === 'leader';
  // Staff hanya punya tab Ganti password.
  const tabs = TABS.filter(([, , leaderOnly]) => leader || !leaderOnly);
  const tab: Tab = tabs.find(([key]) => key === tabParam)?.[0] ?? tabs[0][0];
  const db = getDb();

  return (
    <>
      <div className="page-head">
        <h1>Setting</h1>
      </div>

      {tabs.length > 1 && (
        <nav className="settings-tabs" aria-label="Bagian setting">
          {tabs.map(([key, label]) => (
            <Link key={key} href={`/settings?tab=${key}`} className={key === tab ? 'active' : undefined} aria-current={key === tab ? 'page' : undefined}>
              {label}
            </Link>
          ))}
        </nav>
      )}

      {tab === 'akun' && (
        <section className="card">
          <div className="table-head">
            <h2>Akun tim</h2>
          </div>
          <p className="muted" style={{ marginTop: 0 }}>
            Akun langsung bisa dipakai login. <strong>Leader</strong> bisa membuka semua menu;{' '}
            <strong>Staff</strong> hanya Dashboard, Generator, Log Harian, dan ganti password sendiri.
            {!isSupabaseConfigured() && ' Saat ini akun tersimpan di komputer ini (mode lokal).'}
          </p>
          <AccountSettings accounts={await listAccounts()} currentUserId={user.id} />
        </section>
      )}

      {tab === 'dropdown' && (
        <DropdownEditor
          options={await db.listOptions()}
          platforms={(await db.listPlatforms()).map(({ id, name }) => ({ id, name }))}
        />
      )}

      {tab === 'password' && (
        <section className="card" style={{ maxWidth: 560 }}>
          <h2>Ganti password</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Mengganti password akun yang sedang dipakai ({displayLogin(user.email)}).
          </p>
          <ChangePasswordForm />
        </section>
      )}
    </>
  );
}
