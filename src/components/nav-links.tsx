'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from './icons';

const LINKS: { href: string; label: string; icon: IconName; leaderOnly?: boolean }[] = [
  { href: '/', label: 'Dashboard', icon: 'home' },
  { href: '/generator', label: 'Generator', icon: 'file' },
  { href: '/konfigurasi', label: 'Konfigurasi', icon: 'gear', leaderOnly: true },
  { href: '/settings', label: 'Setting', icon: 'sliders' },
];

export function NavLinks({ leader }: { leader: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="nav">
      {LINKS.filter((l) => leader || !l.leaderOnly).map(({ href, label, icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link key={href} href={href} className={active ? 'active' : undefined} aria-current={active ? 'page' : undefined}>
            <Icon name={icon} size={18} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
