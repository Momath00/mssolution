'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { apiUrlClient } from '@/lib/api';

const liens = [
  {
    href: '/dashboard',
    label: "Vue d'ensemble",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M3.75 12 12 3.75 20.25 12M5.25 10.5V20.25h13.5V10.5"
      />
    ),
  },
  {
    href: '/dashboard/realisations',
    label: 'Réalisations',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M3.75 5.25h16.5v13.5H3.75zM3.75 15l4.5-4.5 3 3 5.25-5.25 4.25 4.25"
      />
    ),
  },
  {
    href: '/dashboard/clients',
    label: 'Clients',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M15 19.5v-1.5a3.75 3.75 0 0 0-3.75-3.75H6.75A3.75 3.75 0 0 0 3 18v1.5M9.375 11.25a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM21 19.5v-1.5a3.75 3.75 0 0 0-2.625-3.578M15.375 5.108a3 3 0 0 1 0 5.784"
      />
    ),
  },
  {
    href: '/dashboard/facturation',
    label: 'Facturation',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M7.5 3.75h6.879a1.5 1.5 0 0 1 1.06.44l3.372 3.371a1.5 1.5 0 0 1 .439 1.061V19.5a1.5 1.5 0 0 1-1.5 1.5h-10.25a1.5 1.5 0 0 1-1.5-1.5V5.25a1.5 1.5 0 0 1 1.5-1.5ZM9 12h6M9 15.5h6M9 8.5h3"
      />
    ),
  },
  {
    href: '/dashboard/parametres',
    label: 'Paramètres',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.15.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.108 1.204.166.397.506.71.93.78l.894.15c.542.09.94.56.94 1.11v1.093c0 .55-.398 1.02-.94 1.11l-.894.15c-.424.07-.764.383-.93.78-.164.398-.142.854.108 1.204l.527.738c.32.447.269 1.06-.12 1.449l-.774.774c-.389.39-1.001.44-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.108-.397.165-.71.505-.78.929l-.15.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.149-.894c-.07-.424-.384-.764-.78-.93-.398-.164-.855-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.449-.12l-.774-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.893-.15c-.542-.09-.94-.56-.94-1.11v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.384.93-.78.164-.398.142-.855-.108-1.205l-.527-.737a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.108.397-.166.71-.506.78-.93l.15-.894Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
      />
    ),
  },
];

const titres: Record<string, string> = {
  '/dashboard': "Vue d'ensemble",
  '/dashboard/realisations': 'Réalisations',
  '/dashboard/clients': 'Clients',
  '/dashboard/facturation': 'Facturation',
  '/dashboard/parametres': 'Paramètres',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const titre = titres[pathname] || 'Administration';

  async function onLogout() {
    await fetch(apiUrlClient('/api/auth/logout/'), { method: 'POST', credentials: 'include' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="bg-admin-bg flex min-h-screen flex-col">
      <header className="bg-navy sticky top-0 z-40 shadow-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Image src="/logo-icon-trimmed.png" alt="MS Solution Informatique" width={34} height={34} />
            <div className="flex items-center gap-3 border-l border-white/15 pl-3">
              <span className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-white/40 sm:inline">
                Administration
              </span>
              <span className="text-sm font-semibold text-white">{titre}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              target="_blank"
              className="hidden text-xs font-medium text-white/60 transition-colors hover:text-white sm:block"
            >
              Voir le site public ↗
            </Link>
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:border-white/30 hover:text-white"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  stroke="currentColor"
                  d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M18 12h-9m9 0-3-3m3 3-3 3"
                />
              </svg>
              Se déconnecter
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-6 py-8 pb-24 md:pb-8">
        <aside className="sticky top-20 hidden w-56 shrink-0 self-start md:block">
          <nav className="bg-navy flex flex-col gap-1 rounded-xl p-2 shadow-sm">
            {liens.map((lien) => {
              const actif = pathname === lien.href;
              return (
                <Link
                  key={lien.href}
                  href={lien.href}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    actif ? 'bg-accent text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0" stroke="currentColor">
                    {lien.icon}
                  </svg>
                  {lien.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="min-w-0 flex-1 rounded-xl border border-black/5 bg-white p-6 shadow-sm">{children}</div>
      </div>

      <nav className="bg-navy fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-white/10 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_10px_rgba(0,0,0,0.15)] md:hidden">
        {liens.map((lien) => {
          const actif = pathname === lien.href;
          return (
            <Link
              key={lien.href}
              href={lien.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                actif ? 'text-accent' : 'text-white/60'
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 shrink-0" stroke="currentColor">
                {lien.icon}
              </svg>
              {lien.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
