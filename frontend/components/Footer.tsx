import Link from 'next/link';

import { fetchServer, type Coordonnees } from '@/lib/api';

export default async function Footer() {
  let coordonnees: Coordonnees | null = null;
  try {
    coordonnees = await fetchServer<Coordonnees>('/api/coordonnees/');
  } catch {
    coordonnees = null;
  }

  return (
    <footer className="relative isolate mt-auto overflow-hidden bg-navy text-white/70">
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-accent/60 to-transparent" />
      <div className="absolute -bottom-40 left-1/2 -z-10 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-violet-600/15 blur-3xl" />
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-3">
        <div>
          <p className="text-lg font-bold text-white">
            {coordonnees?.nom_entreprise || 'MS Solution Informatique'}
          </p>
          <p className="mt-2 text-sm">
            Applications web, logiciels sur mesure et automatisation pour les entreprises.
          </p>
        </div>
        <div className="text-sm">
          <p className="mb-2 font-semibold uppercase tracking-wide text-white/50">
            Coordonnées
          </p>
          {coordonnees?.courriel && (
            <p>
              <a href={`mailto:${coordonnees.courriel}`} className="transition-colors hover:text-white">
                {coordonnees.courriel}
              </a>
            </p>
          )}
          {coordonnees?.telephone && (
            <p>
              <a href={`tel:${coordonnees.telephone}`} className="transition-colors hover:text-white">
                {coordonnees.telephone}
              </a>
            </p>
          )}
          {coordonnees?.adresse && <p>{coordonnees.adresse}</p>}
        </div>
        <div className="text-sm">
          <p className="mb-2 font-semibold uppercase tracking-wide text-white/50">Navigation</p>
          <ul className="space-y-2">
            <li><Link href="/services" className="transition-colors hover:text-white">Services</Link></li>
            <li><Link href="/realisations" className="transition-colors hover:text-white">Réalisations</Link></li>
            <li><Link href="/contact" className="transition-colors hover:text-white">Contact</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/40">
        © {new Date().getFullYear()} {coordonnees?.nom_entreprise || 'MS Solution Informatique'}. Tous droits réservés.
      </div>
    </footer>
  );
}
