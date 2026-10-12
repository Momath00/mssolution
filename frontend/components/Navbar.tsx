'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

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
  const progression = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    function onScroll() {
      setDefile(window.scrollY > 12);
      // Barre de lecture : écrite directement dans le style pour ne pas re-rendre à chaque défilement.
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (progression.current) {
        progression.current.style.transform = `scaleX(${max > 0 ? Math.min(window.scrollY / max, 1) : 0})`;
      }
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-all duration-300 ${
        defile || ouvert
          ? 'border-white/10 bg-navy/95 shadow-lg shadow-black/20 backdrop-blur-xl'
          : 'border-transparent bg-navy'
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
            className="transition-transform duration-500 hover:rotate-[-8deg] hover:scale-105"
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
                  className={`absolute -bottom-0.5 left-0 h-0.5 rounded-full bg-accent transition-all duration-300 ${
                    actif ? 'w-full' : 'w-0 group-hover:w-full'
                  }`}
                />
              </Link>
            );
          })}
        </nav>
        <Link
          href="/soumission"
          className="btn-reflet hidden rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-md shadow-accent/30 transition-transform hover:-translate-y-0.5 md:block"
        >
          Demander une soumission
        </Link>

        <button
          type="button"
          aria-label={ouvert ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={ouvert}
          onClick={() => setOuvert((v) => !v)}
          className="relative h-6 w-6 md:hidden"
        >
          <span
            className={`absolute left-0 top-1 h-0.5 w-6 rounded bg-white transition-transform duration-300 ${
              ouvert ? 'translate-y-[7px] rotate-45' : ''
            }`}
          />
          <span
            className={`absolute left-0 top-[11px] h-0.5 w-6 rounded bg-white transition-opacity duration-200 ${
              ouvert ? 'opacity-0' : ''
            }`}
          />
          <span
            className={`absolute left-0 top-[18px] h-0.5 w-6 rounded bg-white transition-transform duration-300 ${
              ouvert ? '-translate-y-[7px] -rotate-45' : ''
            }`}
          />
        </button>
      </div>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out md:hidden ${
          ouvert ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <nav className="flex flex-col gap-1 overflow-hidden px-6" inert={!ouvert}>
          <span className="h-2" />
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
          <span className="h-4" />
        </nav>
      </div>
      <span
        ref={progression}
        aria-hidden
        style={{ transform: 'scaleX(0)' }}
        className="absolute bottom-0 left-0 h-0.5 w-full origin-left bg-linear-to-r from-accent via-[#ff6b77] to-violet-400"
      />
    </header>
  );
}
