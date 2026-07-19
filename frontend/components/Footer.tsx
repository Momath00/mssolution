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
    <footer className="bg-navy mt-auto text-white/70">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 sm:grid-cols-3">
        <div>
          <p className="text-lg font-bold text-white">
            {coordonnees?.nom_entreprise || 'MS Solution Informatique'}
          </p>
          <p className="mt-2 text-sm">
            Plateformes web sur mesure pour les entreprises.
          </p>
        </div>
        <div className="text-sm">
          <p className="mb-2 font-semibold uppercase tracking-wide text-white/50">
            Coordonnées
          </p>
          {coordonnees?.courriel && (
            <p>
              <a href={`mailto:${coordonnees.courriel}`} className="hover:text-white">
                {coordonnees.courriel}
              </a>
            </p>
          )}
          {coordonnees?.telephone && (
            <p>
              <a href={`tel:${coordonnees.telephone}`} className="hover:text-white">
                {coordonnees.telephone}
              </a>
            </p>
          )}
          {coordonnees?.adresse && <p>{coordonnees.adresse}</p>}
        </div>
        <div className="text-sm">
          <p className="mb-2 font-semibold uppercase tracking-wide text-white/50">Navigation</p>
          <ul className="space-y-1">
            <li><Link href="/services" className="hover:text-white">Services</Link></li>
            <li><Link href="/realisations" className="hover:text-white">Réalisations</Link></li>
            <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/40">
        © {new Date().getFullYear()} {coordonnees?.nom_entreprise || 'MS Solution Informatique'}. Tous droits réservés.
      </div>
    </footer>
  );
}
