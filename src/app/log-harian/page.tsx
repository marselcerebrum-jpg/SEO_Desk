import { DailyLogView } from '@/components/daily-log';
import { listAccounts } from '@/lib/accounts';
import { todayInJakarta } from '@/lib/daily-log';
import { getDb } from '@/lib/db';
import { displayLogin } from '@/lib/roles';
import { requireUser } from '@/lib/supabase/server';

export default async function LogHarianPage({ searchParams }: { searchParams: Promise<{ anggota?: string }> }) {
  const { anggota } = await searchParams;
  const me = await requireUser();
  // Leader bisa membaca log anggota tim; tiap orang hanya bisa menulis log miliknya.
  const members = me.role === 'leader' ? await listAccounts() : [];
  const target = members.find((m) => m.id === anggota) ?? null;
  const ownerId = target?.id ?? me.id;

  return (
    <DailyLogView
      logs={await getDb().listDailyLogs(ownerId)}
      today={todayInJakarta()}
      userName={me.name || displayLogin(me.email)}
      readOnly={ownerId !== me.id}
      members={members.map((m) => ({ id: m.id, name: m.name || m.email }))}
      selectedMember={ownerId}
    />
  );
}
