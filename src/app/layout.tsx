import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/icons';
import { NavLinks } from '@/components/nav-links';
import { ROLES } from '@/lib/roles';
import { isSupabaseConfigured } from '@/lib/settings';
import { getCurrentUser } from '@/lib/supabase/server';
import { signOut } from './actions';
import './globals.css';

export const metadata: Metadata = {
  title: 'SEO Desk',
  description: 'Kumpulan tools tim SEO untuk semua platform',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const local = !isSupabaseConfigured();

  return (
    <html lang="id">
      <body>
        {user ? (
          <div className="shell">
            <aside className="sidebar">
              <Link href="/" className="brand-logo" aria-label="SEO Desk, ke Dashboard">
                <span className="brand-mark">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/seo-desk-mark.png" alt="" width={256} height={256} />
                </span>
                <span className="brand-name">SEO Desk</span>
              </Link>
              <NavLinks leader={user.role === 'leader'} />
              <div className="sidebar-foot">
                <span className="avatar" aria-hidden="true">
                  {(user.name || user.email).charAt(0).toUpperCase()}
                </span>
                <span className="user-info">
                  <span className="user-name" title={user.email}>
                    {user.name || user.email}
                  </span>
                  <span className={`role-chip ${user.role}`}>{ROLES[user.role]}</span>
                </span>
                <form action={signOut}>
                  <button className="icon-button" type="submit" aria-label="Keluar" title="Keluar">
                    <Icon name="logout" size={18} />
                  </button>
                </form>
              </div>
            </aside>
            <div className="content">
              {local && (
                <div className="banner">
                  <strong>Mode lokal · Data contoh</strong>
                  <span>
                    Data tersimpan di komputer ini.{' '}
                    {user.role === 'leader' ? (
                      <>
                        Hubungkan database di <Link href="/konfigurasi#database">Konfigurasi</Link> agar bisa dipakai tim.
                      </>
                    ) : (
                      'Leader bisa menghubungkan database agar bisa dipakai tim.'
                    )}
                  </span>
                </div>
              )}
              <main>{children}</main>
            </div>
          </div>
        ) : (
          <main>{children}</main>
        )}
      </body>
    </html>
  );
}
