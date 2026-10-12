'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Muat ulang data server selama masih ada pipeline yang berjalan.
export function AutoRefresh({ active, intervalMs = 3000 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs, router]);
  return null;
}
