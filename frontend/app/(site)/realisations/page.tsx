import Image from 'next/image';

import Reveal from '@/components/Reveal';
import { fetchServer, mediaUrl, type Realisation } from '@/lib/api';

export const metadata = { title: 'Réalisations — MS Solution Informatique' };

export default async function RealisationsPage() {
  let realisations: Realisation[] = [];
  try {
    realisations = await fetchServer<Realisation[]>('/api/realisations/');
  } catch {
    realisations = [];
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-3xl font-bold text-navy">Nos réalisations</h1>
      <p className="mt-2 max-w-2xl text-black/60">
        Un aperçu des plateformes web que nous avons conçues pour nos clients.
      </p>

      {realisations.length === 0 ? (
        <p className="mt-10 text-black/50">Aucune réalisation publiée pour le moment.</p>
      ) : (
        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {realisations.map((r, i) => (
            <Reveal key={r.id} delay={(i % 3) * 100}>
              <article className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                {r.image && (
                  <div className="relative h-44 w-full bg-black/[0.02]">
                    <Image
                      src={mediaUrl(r.image) || r.image}
                      alt={r.titre}
                      fill
                      unoptimized
                      className="object-contain p-8 transition-transform duration-500 hover:scale-105"
                    />
                  </div>
                )}
                <div className="p-5">
                  {r.secteur && (
                    <p className="text-xs font-semibold uppercase tracking-wide text-accent">{r.secteur}</p>
                  )}
                  <h2 className="mt-1 text-lg font-semibold text-navy">{r.titre}</h2>
                  <p className="mt-1 text-sm font-medium text-black/50">{r.client}</p>
                  <p className="mt-2 text-sm text-black/60">{r.description}</p>
                  {r.lien_site && (
                    <a
                      href={r.lien_site}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-block text-sm font-semibold text-accent hover:underline"
                    >
                      Voir le site →
                    </a>
                  )}
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
