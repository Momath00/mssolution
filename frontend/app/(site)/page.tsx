import Image from 'next/image';
import Link from 'next/link';
import { Fragment } from 'react';

import { Icone, ICONES } from '@/components/Icone';
import Reveal from '@/components/Reveal';
import CarteService from '@/components/site/CarteService';
import DemoAnimee from '@/components/site/DemoAnimee';
import Inclinaison from '@/components/site/Inclinaison';
import {
  IlluConception,
  IlluDeveloppement,
  IlluEcoute,
  IlluMiseEnLigne,
  IlluTransformation,
} from '@/components/site/Illustrations';
import { etapes, services, transformation } from '@/components/site/services';
import { fetchServer, mediaUrl, type Realisation } from '@/lib/api';

export const metadata = {
  title: 'Applications web, logiciels sur mesure et automatisation au Québec',
  description:
    "MS Solution Informatique développe des applications web et logicielles sur mesure, automatise vos processus et accompagne la transformation numérique des entreprises du Québec.",
};

const technologies = ['Next.js', 'React', 'TypeScript', 'Django', 'Python', 'PostgreSQL', 'Docker', 'Tailwind CSS'];

const illustrationsEtapes = [IlluEcoute, IlluConception, IlluDeveloppement, IlluMiseEnLigne];

const atouts = ['Conçu pour vos processus', 'Tâches répétitives automatisées', 'Support local au Québec'];

function delai(ms: number) {
  return { '--d': `${ms}ms` } as React.CSSProperties;
}

// Fait apparaître un texte mot par mot à partir du délai donné.
function Mots({ texte, depart, className = '' }: { texte: string; depart: number; className?: string }) {
  return texte.split(' ').map((mot, i) => (
    <Fragment key={i}>
      <span className={`animate-entree inline-block ${className}`} style={delai(depart + i * 70)}>
        {mot}
      </span>{' '}
    </Fragment>
  ));
}

export default async function Home() {
  let realisations: Realisation[] = [];
  try {
    realisations = await fetchServer<Realisation[]>('/api/realisations/');
  } catch {
    realisations = [];
  }

  return (
    <div className="flex flex-col">
      {/* ---------- Héros ---------- */}
      <section className="relative isolate overflow-hidden bg-navy text-white">
        <div className="bg-grille absolute inset-0 -z-10" />
        <div className="animate-halo absolute -left-32 top-10 -z-10 h-96 w-96 rounded-full bg-accent/25 blur-3xl" />
        <div
          className="animate-halo absolute -right-24 bottom-0 -z-10 h-96 w-96 rounded-full bg-violet-600/30 blur-3xl"
          style={{ animationDelay: '-7s' }}
        />

        <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-20 lg:grid-cols-2 lg:py-28">
          <div>
            <p
              className="animate-entree inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80"
              style={delai(0)}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Agence web au Québec
            </p>
            <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              <Mots texte="Nous" depart={100} />
              <Mots
                texte="transformons"
                depart={170}
                className="texte-degrade bg-linear-to-r from-[#ff6b77] via-accent to-violet-400 bg-clip-text text-transparent"
              />
              <Mots texte="vos processus en applications web sur mesure" depart={240} />
            </h1>
            <p className="animate-entree mt-6 max-w-xl text-lg text-white/70" style={delai(700)}>
              Applications logicielles, applications web et automatisation : nous remplaçons vos
              fichiers Excel, vos tâches manuelles et vos outils dépassés par des solutions modernes.
            </p>
            <div className="animate-entree mt-9 flex flex-wrap gap-4" style={delai(800)}>
              <Link
                href="/soumission"
                className="btn-reflet inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold shadow-lg shadow-accent/30 transition-transform hover:-translate-y-0.5"
              >
                Demander une soumission
                <Icone d={ICONES.fleche} className="h-4 w-4" />
              </Link>
              <Link
                href="/realisations"
                className="rounded-full border border-white/25 px-6 py-3 text-sm font-semibold transition-colors hover:bg-white/10"
              >
                Voir nos réalisations
              </Link>
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/60">
              {atouts.map((atout, i) => (
                <li key={atout} className="animate-entree flex items-center gap-2" style={delai(900 + i * 100)}>
                  <Icone d={ICONES.succes} className="h-4 w-4 text-emerald-400" />
                  {atout}
                </li>
              ))}
            </ul>
          </div>

          <div className="animate-entree-3d" style={delai(400)}>
            <Inclinaison>
              <div className="relative">
                <div className="animate-flotte">
                  <DemoAnimee />
                </div>
                {/* Badges flottants qui donnent de la profondeur à la démo */}
                <div className="pointer-events-none absolute -left-8 -top-5 hidden [transform:translateZ(60px)] sm:block">
                  <div className="animate-entree" style={delai(1200)}>
                  <div
                    className="animate-flotte flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-md"
                    style={{ animationDelay: '-2s' }}
                  >
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-amber-400/20 text-amber-300">
                      <Icone d={ICONES.eclair} className="h-3.5 w-3.5" />
                    </span>
                    Automatisation active
                  </div>
                  </div>
                </div>
                <div className="pointer-events-none absolute -right-6 -top-5 hidden [transform:translateZ(80px)] sm:block">
                  <div className="animate-entree" style={delai(1400)}>
                  <div
                    className="animate-flotte flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-md"
                    style={{ animationDelay: '-4s' }}
                  >
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-emerald-400/20 text-emerald-300">
                      <Icone d={ICONES.succes} className="h-3.5 w-3.5" />
                    </span>
                    Données synchronisées
                  </div>
                  </div>
                </div>
              </div>
            </Inclinaison>
          </div>
        </div>

        {/* Technologies en défilement */}
        <div className="relative border-t border-white/10 py-6 [mask-image:linear-gradient(90deg,transparent,black_15%,black_85%,transparent)]">
          <div className="animate-defile flex w-max gap-14 pr-14 hover:[animation-play-state:paused]">
            {[...technologies, ...technologies].map((tech, i) => (
              <span
                key={i}
                aria-hidden={i >= technologies.length}
                className="whitespace-nowrap text-sm font-semibold uppercase tracking-[0.2em] text-white/35"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* À partir d'ici : style clair et calme (inspiré de Notion). */}

      {/* ---------- Services ---------- */}
      <section className="bg-white px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance text-3xl font-bold tracking-tight text-navy sm:text-[2.75rem] sm:leading-tight">
              Des outils pensés pour votre façon de travailler
            </h2>
            <p className="mt-4 text-lg text-black/55">
              Applications web, logiciels et automatisations, de l&apos;analyse à la maintenance.
            </p>
          </Reveal>
          <div className="mt-14 grid gap-5 sm:grid-cols-3">
            {services.slice(0, 3).map((service, i) => (
              <Reveal key={service.titre} delay={i * 80}>
                <CarteService {...service} />
              </Reveal>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/services" className="group inline-flex items-center gap-2 text-sm font-semibold text-navy">
              Voir tous nos services
              <Icone d={ICONES.fleche} className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Transformation : avant / après ---------- */}
      <section className="bg-[#f7f6f3] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance text-3xl font-bold tracking-tight text-navy sm:text-[2.75rem] sm:leading-tight">
              Ce que nous transformons pour vous
            </h2>
            <p className="mt-4 text-lg text-black/55">
              Vos façons de travailler restent les vôtres : nous les rendons plus rapides, plus fiables et automatiques.
            </p>
          </Reveal>
          <Reveal className="mt-10" delay={100}>
            <IlluTransformation className="mx-auto h-auto w-full max-w-xl" />
          </Reveal>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <Reveal delay={100}>
              <div className="h-full rounded-2xl bg-white/60 p-7 ring-1 ring-black/5">
                <p className="text-sm font-semibold text-black/40">Avant</p>
                <ul className="mt-4 space-y-3">
                  {transformation.map((ligne, i) => (
                    <li key={ligne.avant} className="flex items-center gap-3 text-black/45">
                      <Icone d={ICONES.annuler} className="h-4 w-4 shrink-0 text-black/25" />
                      <span className="barre" style={delai(400 + i * 120)}>
                        {ligne.avant}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={200}>
              <div className="h-full rounded-2xl bg-white p-7 shadow-sm ring-1 ring-black/5">
                <p className="text-sm font-semibold text-emerald-600">Avec MS Solution</p>
                <ul className="mt-4 space-y-3">
                  {transformation.map((ligne, i) => (
                    <li key={ligne.apres} className="flex items-center gap-3 font-medium text-navy">
                      <span className="apparait" style={delai(900 + i * 120)}>
                        <Icone d={ICONES.succes} className="h-5 w-5 shrink-0 text-emerald-500" />
                      </span>
                      {ligne.apres}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------- Processus ---------- */}
      <section className="bg-white px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance text-3xl font-bold tracking-tight text-navy sm:text-[2.75rem] sm:leading-tight">
              Comment se déroule votre projet
            </h2>
            <p className="mt-4 text-lg text-black/55">Quatre étapes simples, avec vous à chaque décision.</p>
          </Reveal>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {etapes.map((etape, i) => {
              const Illustration = illustrationsEtapes[i];
              return (
                <Reveal key={etape.titre} delay={i * 100}>
                  <div className="group h-full rounded-2xl bg-[#f7f6f3] p-6 transition-colors duration-300 hover:bg-[#f1efea]">
                    <Illustration className="h-28 w-full" />
                    <p className="mt-5 text-xs font-semibold text-accent">Étape {i + 1}</p>
                    <h3 className="mt-1 text-lg font-semibold text-navy">{etape.titre}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-black/55">{etape.description}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------- Réalisations ---------- */}
      {realisations.length > 0 && (
        <section className="bg-[#f7f6f3] px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <Reveal className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:items-end sm:text-left">
              <div>
                <h2 className="text-balance text-3xl font-bold tracking-tight text-navy sm:text-[2.75rem] sm:leading-tight">
                  Réalisations récentes
                </h2>
                <p className="mt-3 text-lg text-black/55">Des entreprises d&apos;ici qui travaillent autrement.</p>
              </div>
              <Link href="/realisations" className="group inline-flex items-center gap-2 text-sm font-semibold text-navy">
                Toutes nos réalisations
                <Icone d={ICONES.fleche} className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Reveal>
            <div className="mt-12 grid gap-5 sm:grid-cols-3">
              {realisations.slice(0, 3).map((r, i) => (
                <Reveal key={r.id} delay={i * 80}>
                  <div className="group h-full overflow-hidden rounded-2xl bg-white ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/5">
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
                    <div className="p-6">
                      <p className="text-xs font-semibold text-black/45">{r.client}</p>
                      <h3 className="mt-1 font-semibold text-navy">{r.titre}</h3>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------- Appel à l'action ---------- */}
      <section className="bg-white px-6 py-24">
        <Reveal className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <IlluMiseEnLigne className="h-32 w-auto" />
          <h2 className="mt-6 text-balance text-3xl font-bold tracking-tight text-navy sm:text-[2.75rem] sm:leading-tight">
            Un projet en tête ?
          </h2>
          <p className="mt-4 max-w-xl text-lg text-black/55">
            Parlez-nous de vos processus : nous vous dirons ce qui peut être simplifié et automatisé.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/soumission"
              className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#d62f3c]"
            >
              Demander une soumission
            </Link>
            <Link
              href="/contact"
              className="rounded-full px-6 py-3 text-sm font-semibold text-navy ring-1 ring-black/10 transition-colors hover:bg-[#f7f6f3]"
            >
              Nous contacter
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
