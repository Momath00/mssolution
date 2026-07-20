import Image from 'next/image';
import Link from 'next/link';

import Reveal from '@/components/Reveal';
import { fetchServer, mediaUrl, type Realisation } from '@/lib/api';

export const metadata = {
  title: 'Développement de plateformes web sur mesure au Québec',
  description:
    "MS Solution Informatique conçoit, développe et maintient des sites web, portails clients et outils de gestion sur mesure pour les entreprises du Québec.",
};

const services = [
  {
    titre: 'Sites web sur mesure',
    description: 'Conception et développement de sites vitrines et institutionnels adaptés à votre image de marque.',
  },
  {
    titre: 'Plateformes web applicatives',
    description: 'Portails clients, tableaux de bord et outils internes construits pour vos processus d\'affaires.',
  },
  {
    titre: 'Intégration & maintenance',
    description: 'Hébergement, mises à jour et support continu pour garder votre plateforme performante et sécurisée.',
  },
];

export default async function Home() {
  let realisations: Realisation[] = [];
  try {
    realisations = await fetchServer<Realisation[]>('/api/realisations/');
  } catch {
    realisations = [];
  }

  return (
    <div className="flex flex-col">
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-6 py-24 text-center">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            Des plateformes web sur mesure pour faire grandir votre entreprise
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-white/70">
            MS Solution Informatique conçoit, développe et maintient des sites et applications web
            adaptés aux besoins réels de votre organisation.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Link
              href="/soumission"
              className="rounded-full bg-accent px-6 py-3 text-sm font-semibold hover:opacity-90"
            >
              Demander une soumission
            </Link>
            <Link
              href="/realisations"
              className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold hover:bg-white/10"
            >
              Voir nos réalisations
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          <h2 className="text-center text-2xl font-bold text-navy">Nos services</h2>
        </Reveal>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {services.map((service, i) => (
            <Reveal key={service.titre} delay={i * 100}>
              <div className="h-full rounded-xl border border-black/5 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                <h3 className="font-semibold text-navy">{service.titre}</h3>
                <p className="mt-2 text-sm text-black/60">{service.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link href="/services" className="text-sm font-semibold text-accent hover:underline">
            Voir tous nos services →
          </Link>
        </div>
      </section>

      {realisations.length > 0 && (
        <section className="bg-white/60 px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <h2 className="text-center text-2xl font-bold text-navy">Réalisations récentes</h2>
            </Reveal>
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              {realisations.slice(0, 3).map((r, i) => (
                <Reveal key={r.id} delay={i * 100}>
                  <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                    {r.image && (
                      <div className="relative h-40 w-full bg-black/[0.02]">
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
                      <p className="text-xs font-semibold uppercase tracking-wide text-accent">{r.client}</p>
                      <h3 className="mt-1 font-semibold text-navy">{r.titre}</h3>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link href="/realisations" className="text-sm font-semibold text-accent hover:underline">
                Voir toutes nos réalisations →
              </Link>
            </div>
          </div>
        </section>
      )}

      <Reveal className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h2 className="text-2xl font-bold text-navy">Un projet en tête ?</h2>
        <p className="mt-3 text-black/60">
          Discutons de vos besoins et voyons comment nous pouvons vous accompagner.
        </p>
        <Link
          href="/contact"
          className="mt-6 inline-block rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
        >
          Nous contacter
        </Link>
      </Reveal>
    </div>
  );
}
