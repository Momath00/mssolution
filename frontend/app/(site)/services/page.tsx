import Link from 'next/link';

import Reveal from '@/components/Reveal';
import CarteService from '@/components/site/CarteService';
import { IlluConception } from '@/components/site/Illustrations';
import PageHero from '@/components/site/PageHero';
import { services } from '@/components/site/services';

export const metadata = {
  title: 'Services',
  description:
    "Applications web, logiciels sur mesure, automatisation des processus, transformation numérique, intégrations API et hébergement : découvrez les services de MS Solution Informatique.",
};

export default function ServicesPage() {
  return (
    <>
      <PageHero
        surtitre="Services"
        titre="Applications, automatisation et transformation numérique"
        description="Nous développons les applications web et logicielles qui simplifient votre quotidien, et nous automatisons ce qui peut l'être."
      />

      <div className="w-full bg-white">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service, i) => (
            <Reveal key={service.titre} delay={(i % 3) * 80}>
              <CarteService {...service} />
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-20 flex flex-col items-center gap-8 rounded-3xl bg-[#f7f6f3] px-8 py-12 text-center sm:flex-row sm:text-left">
          <IlluConception className="h-28 w-auto shrink-0" />
          <div className="flex-1">
            <h2 className="text-2xl font-bold tracking-tight text-navy sm:text-3xl">Un besoin spécifique ?</h2>
            <p className="mt-2 text-black/55">Parlons de votre projet et bâtissons ensemble la solution qu&apos;il vous faut.</p>
          </div>
          <Link
            href="/soumission"
            className="shrink-0 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#d62f3c]"
          >
            Demander une soumission
          </Link>
        </Reveal>
      </div>
      </div>
    </>
  );
}
