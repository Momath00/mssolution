'use client';

import { useMemo, useState } from 'react';

import type { Evenement } from '@/lib/api';
import { clientAvatarStyle } from '@/lib/clientColors';

import { TYPES, toISODate } from './page';

const JOURS_SEMAINE = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function debutGrille(premierDuMois: Date) {
  const decalage = (premierDuMois.getDay() + 6) % 7; // 0 = lundi
  return new Date(premierDuMois.getFullYear(), premierDuMois.getMonth(), premierDuMois.getDate() - decalage);
}

interface Props {
  evenements: Evenement[];
  aujourdhui: string;
  onNouveau: (dateISO: string) => void;
  onEdit: (ev: Evenement) => void;
}

export default function CalendrierGrille({ evenements, aujourdhui, onNouveau, onEdit }: Props) {
  const [moisAffiche, setMoisAffiche] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [direction, setDirection] = useState(1);

  const parJour = useMemo(() => {
    const map = new Map<string, Evenement[]>();
    for (const ev of evenements) {
      const liste = map.get(ev.date);
      if (liste) liste.push(ev);
      else map.set(ev.date, [ev]);
    }
    for (const liste of map.values()) {
      liste.sort((a, b) => (a.heure ?? '99').localeCompare(b.heure ?? '99'));
    }
    return map;
  }, [evenements]);

  const semaines = useMemo(() => {
    const debut = debutGrille(moisAffiche);
    const jours: { date: Date; iso: string; dansMois: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + i);
      jours.push({ date, iso: toISODate(date), dansMois: date.getMonth() === moisAffiche.getMonth() });
    }
    const resultat: (typeof jours)[] = [];
    for (let i = 0; i < jours.length; i += 7) resultat.push(jours.slice(i, i + 7));
    return resultat;
  }, [moisAffiche]);

  const titreMois = moisAffiche
    .toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' })
    .replace(/^./, (c) => c.toUpperCase());

  function changerMois(delta: number) {
    setDirection(delta);
    setMoisAffiche((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  function allerAujourdhui() {
    const auj = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    setDirection(auj.getTime() > moisAffiche.getTime() ? 1 : -1);
    setMoisAffiche(auj);
  }

  return (
    <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 key={titreMois} className="animate-view-in text-base font-bold text-navy">
          {titreMois}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={allerAujourdhui}
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-black/50 transition-all hover:bg-black/5 active:scale-90"
          >
            Aujourd&apos;hui
          </button>
          <button
            type="button"
            aria-label="Mois précédent"
            onClick={() => changerMois(-1)}
            className="rounded-full p-1.5 text-black/40 transition-all hover:-translate-x-0.5 hover:bg-black/5 hover:text-navy active:scale-90"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Mois suivant"
            onClick={() => changerMois(1)}
            className="rounded-full p-1.5 text-black/40 transition-all hover:translate-x-0.5 hover:bg-black/5 hover:text-navy active:scale-90"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-black/5 text-center text-[11px] font-semibold uppercase tracking-wide text-black/40">
        {JOURS_SEMAINE.map((j) => (
          <div key={j} className="bg-white py-2">
            {j}
          </div>
        ))}
      </div>

      <div
        key={moisAffiche.getTime()}
        style={{ '--dir': direction } as React.CSSProperties}
        className="animate-month-slide grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-black/5"
      >
        {semaines.map((semaine) =>
          semaine.map((jour) => {
            const evsJour = parJour.get(jour.iso) ?? [];
            const visibles = evsJour.slice(0, 3);
            const surplus = evsJour.length - visibles.length;
            const estAujourdhui = jour.iso === aujourdhui;
            return (
              <button
                type="button"
                key={jour.iso}
                onClick={() => onNouveau(jour.iso)}
                className={`group relative flex min-h-[100px] flex-col items-stretch gap-1 bg-white p-1.5 text-left transition-all duration-150 hover:z-10 hover:bg-black/[0.02] hover:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] active:scale-[0.98] ${
                  jour.dansMois ? '' : 'bg-black/[0.015]'
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-transform duration-150 group-hover:scale-110 ${
                    estAujourdhui
                      ? 'bg-accent text-white shadow-sm shadow-accent/30'
                      : jour.dansMois
                        ? 'text-navy/70'
                        : 'text-black/25'
                  }`}
                >
                  {jour.date.getDate()}
                </span>
                <div className="flex flex-col gap-1">
                  {visibles.map((ev, idx) => {
                    const type = TYPES[ev.type_evenement];
                    const initiale = ev.client_nom ? ev.client_nom.charAt(0).toUpperCase() : null;
                    return (
                      <span
                        key={ev.id}
                        role="link"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(ev);
                        }}
                        style={{ animationDelay: `${idx * 40}ms` }}
                        className={`animate-chip-in flex items-center gap-1 rounded-md py-1 pl-1.5 pr-1 text-[10.5px] font-semibold transition-transform hover:-translate-y-px hover:shadow-sm ${
                          ev.termine ? 'opacity-45 line-through' : type.pill
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate">{ev.titre}</span>
                        {ev.heure && <span className="shrink-0 text-[9.5px] font-medium opacity-70">{ev.heure.slice(0, 5)}</span>}
                        {initiale && (
                          <span
                            className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white ring-1 ring-white"
                            style={clientAvatarStyle(ev.client) ?? undefined}
                          >
                            {initiale}
                          </span>
                        )}
                      </span>
                    );
                  })}
                  {surplus > 0 && (
                    <span className="animate-chip-in px-1 text-[11px] font-medium text-black/35">
                      +{surplus} de plus
                    </span>
                  )}
                </div>
                <span className="pointer-events-none absolute inset-x-1.5 bottom-1.5 flex items-center justify-end opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <svg viewBox="0 0 24 24" fill="none" className="h-2.5 w-2.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                </span>
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
