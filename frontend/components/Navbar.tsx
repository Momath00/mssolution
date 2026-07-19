'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const liens = [
  { href: '/', label: 'Accueil' },
  { href: '/services', label: 'Services' },
  { href: '/realisations', label: 'Réalisations' },
  { href: '/contact', label: 'Contact' },
];

export default function Navbar() {
  const [ouvert, setOuvert] = useState(false);
  const [defile, setDefile] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    function onScroll() {
      setDefile(window.scrollY > 12);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`bg-navy sticky top-0 z-50 transition-shadow duration-300 ${
        defile ? 'shadow-lg shadow-black/20' : 'shadow-none'
      }`}
    >
      <div
        className={`mx-auto flex max-w-6xl items-center justify-between px-6 transition-[padding] duration-300 ${
          defile ? 'py-2' : 'py-3'
        }`}
      >
        <Link href="/" className="flex items-center gap-3" onClick={() => setOuvert(false)}>
          <Image
            src="/logo-icon-trimmed.png"
            alt="MS Solution Informatique"
            width={40}
            height={40}
            priority
            className="transition-all duration-300"
          />
          <span className="flex flex-col leading-none">
            <span className="text-xl font-bold tracking-tight text-white">Solution</span>
            <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/60">
              Informatique
            </span>
          </span>
        </Link>

        <nav className="hidden gap-8 md:flex">
          {liens.map((lien) => {
            const actif = pathname === lien.href;
            return (
              <Link
                key={lien.href}
                href={lien.href}
                className={`group relative py-1 text-sm font-medium transition-colors ${
                  actif ? 'text-white' : 'text-white/80 hover:text-white'
                }`}
              >
                {lien.label}
                <span
                  className={`absolute -bottom-0.5 left-0 h-px bg-white transition-all duration-300 ${
                    actif ? 'w-full' : 'w-0 group-hover:w-full'
                  }`}
                />
              </Link>
            );
          })}
        </nav>
        <Link
          href="/soumission"
          className="hidden rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 md:block"
        >
          Demander une soumission
        </Link>

        <button
          type="button"
          aria-label="Ouvrir le menu"
          onClick={() => setOuvert((v) => !v)}
          className="flex flex-col gap-1.5 md:hidden"
        >
          <span className="h-0.5 w-6 bg-white" />
          <span className="h-0.5 w-6 bg-white" />
          <span className="h-0.5 w-6 bg-white" />
        </button>
      </div>

      {ouvert && (
        <nav className="flex flex-col gap-1 border-t border-white/10 px-6 pb-4 md:hidden">
          {liens.map((lien) => (
            <Link
              key={lien.href}
              href={lien.href}
              onClick={() => setOuvert(false)}
              className="rounded px-2 py-2 text-sm font-medium text-white/80 hover:bg-white/5 hover:text-white"
            >
              {lien.label}
            </Link>
          ))}
          <Link
            href="/soumission"
            onClick={() => setOuvert(false)}
            className="mt-2 rounded-full bg-accent px-4 py-2 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Demander une soumission
          </Link>
        </nav>
      )}
    </header>
  );
}
