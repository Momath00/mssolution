'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

// Lecteur de démonstration à onglets de l'accueil. Chaque onglet montre une
// fonctionnalité réelle du logiciel :
// - si `video` est renseigné, la vidéo (MP4 muet, 5 à 10 s, déposée dans
//   public/videos/) est jouée et passe à l'onglet suivant à la fin ;
// - sinon, une scène animée en CSS la remplace. La barre de progression de la
//   scène déclenche alors l'onglet suivant à la fin de son animation.

const DUREE_SCENE_MS = 5200;

interface Chapitre {
  titre: string;
  legende: string;
  // Chemins relatifs à public/, ex. '/videos/facturation.mp4'. Laisser vide tant
  // que la vidéo n'est pas tournée : la scène animée s'affiche à la place.
  video?: string;
  affiche?: string;
}

const chapitres: Chapitre[] = [
  { titre: 'Facturation', legende: 'Factures, paiements et soldes suivis en temps réel' },
  { titre: 'Planification', legende: 'Interventions et équipes planifiées en quelques clics' },
  { titre: 'Automatisation', legende: 'Rappels et relances envoyés sans intervention' },
];

function d(ms: number) {
  return { '--d': `${ms}ms` } as React.CSSProperties;
}

function SceneFacturation() {
  const barres = [40, 65, 50, 80, 60, 92, 75];
  return (
    <div className="flex h-full">
      <div className="demo-monte w-12 shrink-0 space-y-2 border-r border-white/10 p-2" style={d(0)}>
        <div className="h-5 w-5 rounded-md bg-accent" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-1.5 w-full rounded bg-white/20" />
        ))}
      </div>
      <div className="flex-1 p-3">
        <div className="grid grid-cols-3 gap-2">
          {[
            ['Facturé', '48 200 $'],
            ['Encaissé', '41 900 $'],
            ['En retard', '2'],
          ].map(([libelle, valeur], i) => (
            <div key={libelle} className="demo-monte rounded-lg bg-white/5 p-2" style={d(200 + i * 120)}>
              <p className="text-[9px] uppercase tracking-wider text-white/50">{libelle}</p>
              <p className="text-sm font-bold text-white">{valeur}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-5 gap-2">
          <div className="col-span-3 rounded-lg bg-white/5 p-2">
            <svg viewBox="0 0 120 50" className="h-20 w-full" aria-hidden>
              <defs>
                <linearGradient id="demo-aire" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="#e63946" stopOpacity="0.35" />
                  <stop offset="1" stopColor="#e63946" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 42 L20 34 L40 37 L60 22 L80 26 L100 12 L120 8 L120 50 L0 50Z"
                fill="url(#demo-aire)"
                className="demo-monte"
                style={d(1300)}
              />
              <path
                d="M0 42 L20 34 L40 37 L60 22 L80 26 L100 12 L120 8"
                fill="none"
                stroke="#e63946"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                className="demo-trace"
                style={d(500)}
              />
            </svg>
          </div>
          <div className="col-span-2 flex items-end gap-1 rounded-lg bg-white/5 p-2">
            {barres.map((h, i) => (
              <div
                key={i}
                className="demo-pousse flex-1 rounded-sm bg-violet-400/70"
                style={{ height: `${h}%`, ...d(600 + i * 80) }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScenePlanification() {
  const jours = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];
  // [colonne, rangée, largeur en jours, couleur, libellé]
  const evenements: [number, number, number, string, string][] = [
    [0, 0, 2, 'bg-accent', 'Inspection'],
    [2, 1, 1, 'bg-violet-400', 'Installation'],
    [3, 0, 2, 'bg-emerald-400', 'Formation'],
    [1, 2, 2, 'bg-amber-400', 'Maintenance'],
    [4, 2, 1, 'bg-sky-400', 'Visite'],
  ];
  return (
    <div className="flex h-full flex-col p-4">
      <div className="demo-monte flex items-center justify-between" style={d(0)}>
        <p className="text-xs font-semibold text-white">Semaine du 12 octobre</p>
        <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] text-white/70">3 techniciens</span>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-1.5 text-center text-[9px] uppercase tracking-wider text-white/40">
        {jours.map((jour) => (
          <span key={jour}>{jour}</span>
        ))}
      </div>
      <div className="relative mt-1.5 grid flex-1 grid-cols-5 grid-rows-3 gap-1.5">
        {Array.from({ length: 15 }, (_, i) => (
          <div key={i} className="demo-monte rounded-md bg-white/[0.04]" style={d(100 + (i % 5) * 40)} />
        ))}
        {evenements.map(([col, rang, largeur, couleur, libelle], i) => (
          <div
            key={libelle}
            className={`demo-pop absolute flex items-center rounded-md px-2 text-[10px] font-semibold text-[#120e2e] ${couleur}`}
            style={{
              left: `calc(${(col / 5) * 100}% + 2px)`,
              width: `calc(${(largeur / 5) * 100}% - 8px)`,
              top: `calc(${(rang / 3) * 100}% + 6px)`,
              height: 'calc(33.33% - 14px)',
              ...d(700 + i * 300),
            }}
          >
            <span className="truncate">{libelle}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SceneAutomatisation() {
  const etapes = ['Facture envoyée au client', 'Échéance dans 3 jours', 'Rappel envoyé automatiquement', 'Paiement reçu'];
  return (
    <div className="flex h-full items-center gap-6 p-5">
      <div className="demo-pop relative grid h-24 w-24 shrink-0 place-items-center" style={d(200)}>
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r="44" fill="none" stroke="rgb(255 255 255 / 0.1)" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="#34d399"
            strokeWidth="8"
            strokeLinecap="round"
            pathLength={1}
            className="demo-trace"
            style={d(400)}
          />
        </svg>
        <svg viewBox="0 0 24 24" className="h-10 w-10 text-emerald-400" aria-hidden>
          <path
            d="M5 12.5l4.5 4.5L19 7.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            className="demo-trace"
            style={d(2000)}
          />
        </svg>
      </div>
      <ul className="flex-1 space-y-2 text-[11px]">
        {etapes.map((etape, i) => (
          <li key={etape} className="demo-monte flex items-center gap-2 text-white/80" style={d(500 + i * 450)}>
            <span className="text-emerald-400">✓</span>
            {etape}
          </li>
        ))}
        <li
          className="demo-pop mt-3 inline-flex rounded-full bg-emerald-400/15 px-3 py-1 text-[11px] font-semibold text-emerald-300"
          style={d(2600)}
        >
          Aucune action manuelle requise
        </li>
      </ul>
    </div>
  );
}

const scenes = [SceneFacturation, ScenePlanification, SceneAutomatisation];

const REQUETE_MOUVEMENT_REDUIT = '(prefers-reduced-motion: reduce)';

function abonnerMouvementReduit(rappel: () => void) {
  const mq = window.matchMedia(REQUETE_MOUVEMENT_REDUIT);
  mq.addEventListener('change', rappel);
  return () => mq.removeEventListener('change', rappel);
}

export default function DemoAnimee() {
  const [index, setIndex] = useState(0);
  // null tant que le visiteur n'a pas touché au bouton : la lecture automatique
  // est alors désactivée pour qui préfère réduire les animations.
  const [choixLecture, setChoixLecture] = useState<boolean | null>(null);
  const mouvementReduit = useSyncExternalStore(
    abonnerMouvementReduit,
    () => window.matchMedia(REQUETE_MOUVEMENT_REDUIT).matches,
    () => false,
  );
  const lecture = choixLecture ?? !mouvementReduit;

  const video = useRef<HTMLVideoElement>(null);
  const progressionVideo = useRef<HTMLSpanElement>(null);

  const chapitre = chapitres[index];
  const Scene = scenes[index];
  const suivant = () => setIndex((i) => (i + 1) % chapitres.length);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (lecture) v.play().catch(() => {});
    else v.pause();
  }, [lecture, index]);

  function majProgressionVideo() {
    const v = video.current;
    if (v && v.duration && progressionVideo.current) {
      progressionVideo.current.style.transform = `scaleX(${v.currentTime / v.duration})`;
    }
  }

  return (
    <figure className="relative" aria-label="Démonstration des fonctionnalités du logiciel">
      <div className="absolute -inset-4 rounded-3xl bg-linear-to-tr from-accent/30 via-violet-500/20 to-transparent blur-2xl" />

      <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#120e2e]/90 shadow-2xl shadow-black/40 backdrop-blur">
        {/* Barre du navigateur */}
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-3 flex-1 truncate rounded-md bg-white/5 px-3 py-1 text-[11px] text-white/50">
            🔒 app.votre-entreprise.ca
          </span>
        </div>

        <div key={index} className="h-56 sm:h-60">
          {chapitre.video ? (
            <video
              ref={video}
              src={chapitre.video}
              poster={chapitre.affiche}
              muted
              playsInline
              autoPlay={lecture}
              preload="metadata"
              onTimeUpdate={majProgressionVideo}
              onEnded={suivant}
              className="animate-view-in h-full w-full object-cover object-top"
            />
          ) : (
            <Scene />
          )}
        </div>

        {/* Onglets façon lecteur vidéo */}
        <div className="flex items-center gap-3 border-t border-white/10 px-4 py-3">
          <button
            type="button"
            onClick={() => setChoixLecture(!lecture)}
            aria-label={lecture ? 'Mettre en pause' : 'Lire'}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            {lecture ? (
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="ml-0.5 h-3.5 w-3.5" fill="currentColor" aria-hidden>
                <path d="M7 5v14l12-7z" />
              </svg>
            )}
          </button>
          <div className="grid flex-1 grid-cols-3 gap-2">
            {chapitres.map((c, i) => (
              <button
                key={c.titre}
                type="button"
                onClick={() => setIndex(i)}
                className="group text-left"
                aria-current={i === index ? 'step' : undefined}
              >
                <span className="block h-1 overflow-hidden rounded-full bg-white/15">
                  {i < index && <span className="block h-full w-full bg-white" />}
                  {i === index &&
                    (c.video ? (
                      <span
                        key={index}
                        ref={progressionVideo}
                        className="block h-full w-full origin-left bg-white"
                        style={{ transform: 'scaleX(0)' }}
                      />
                    ) : (
                      <span
                        key={index}
                        className="demo-progression block h-full w-full bg-white"
                        style={{
                          '--duree': `${DUREE_SCENE_MS}ms`,
                          animationPlayState: lecture ? 'running' : 'paused',
                        } as React.CSSProperties}
                        onAnimationEnd={suivant}
                      />
                    ))}
                </span>
                <span
                  className={`mt-1.5 block text-[11px] font-medium transition-colors ${
                    i === index ? 'text-white' : 'text-white/40 group-hover:text-white/70'
                  }`}
                >
                  {c.titre}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <figcaption
        key={`legende-${index}`}
        className="animate-view-in relative mt-4 text-center text-sm text-white/60"
      >
        {chapitre.legende}
      </figcaption>
    </figure>
  );
}
