import Image from 'next/image';

import Reveal from '@/components/Reveal';
import PageHero from '@/components/site/PageHero';
import { fetchServer, mediaUrl, type Realisation } from '@/lib/api';

export const metadata = {
  title: 'Réalisations',
  description:
    "Découvrez les applications web, logiciels sur mesure et automatisations conçus par MS Solution Informatique pour ses clients.",
};

export default async function RealisationsPage() {
  let realisations: Realisation[] = [];
  try {
    realisations = await fetchServer<Realisation[]>('/api/realisations/');
  } catch {
    realisations = [];
  }

  return (
    <>
      <PageHero
        surtitre="Portfolio"
        titre="Nos réalisations"
        description="Un aperçu des applications et des automatisations que nous avons conçues pour nos clients."
      />
      <div className="w-full bg-[#f7f6f3]">
      <div className="mx-auto max-w-6xl px-6 py-20">

      {realisations.length === 0 ? (
        <p className="text-center text-black/50">Aucune réalisation publiée pour le moment.</p>
      ) : (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {realisations.map((r, i) => (
            <Reveal key={r.id} delay={(i % 3) * 80}>
              <article className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/5">
                {r.image && (
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#f1efea]">
                    <Image
                      src={mediaUrl(r.image) || r.image}
                      alt={r.titre}
                      fill
                      unoptimized
                      className="object-contain transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  </div>
                )}
                <div className="flex flex-1 flex-col p-6">
                  {r.secteur && (
                    <p className="text-xs font-semibold text-accent">{r.secteur}</p>
                  )}
                  <h2 className="mt-1 text-lg font-semibold text-navy">{r.titre}</h2>
                  <p className="mt-1 text-sm font-medium text-black/50">{r.client}</p>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-black/60">{r.description}</p>
                  {r.lien_site && (
                    <a
                      href={r.lien_site}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent"
                    >
                      Voir le site
                      <span className="transition-transform group-hover:translate-x-1">→</span>
                    </a>
                  )}
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      )}
      </div>
      </div>
    </>
  );
}
