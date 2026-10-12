import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PlatformForm } from '@/components/forms';
import { getDb } from '@/lib/db';
import { platformReadiness } from '@/lib/readiness';
import { maskSecret } from '@/lib/settings';
import { requireLeader } from '@/lib/supabase/server';

export default async function KonfigurasiDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireLeader();
  const platform = await getDb().getPlatform(id);
  if (!platform) notFound();

  const readiness = platformReadiness(platform);
  // Password asli tidak dikirim ke browser.
  const { wp_app_password, ...rest } = platform;

  return (
    <>
      <p>
        <Link href="/konfigurasi">← Konfigurasi</Link>
      </p>
      <div className="page-head">
        <h1>{platform.name}</h1>
        {readiness.ready ? (
          <span className="badge done">Siap generate</span>
        ) : (
          <span className="badge warn">Belum lengkap: {readiness.missing.join(', ')}</span>
        )}
      </div>
      <PlatformForm platform={{ ...rest, passwordMask: maskSecret(wp_app_password) }} />
    </>
  );
}
