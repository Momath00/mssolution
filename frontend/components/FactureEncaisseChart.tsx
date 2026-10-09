'use client';

import { useEffect, useRef, useState } from 'react';

import { formaterMontant } from '@/lib/argent';

export interface PointFactureEncaisse {
  mois: string;
  facture: number;
  encaisse: number;
  /** Part de l'encaissé qui vient des abonnements ExtincPro. */
  encaisse_extincpro?: number;
}

interface Props {
  donnees: PointFactureEncaisse[];
}

type Vue = 'facture_encaisse' | 'activite';

interface Serie {
  cle: string;
  label: string;
  couleur: string;
  valeur: (p: PointFactureEncaisse) => number;
}

// Palette validée (scripts/validate_palette.js du guide dataviz) : violet / vert d'eau,
// séparation daltonisme ΔE 31. Le vert est sous 3:1 sur fond blanc → légende, infobulle et
// tableau des données fournis, et les valeurs ne sont jamais écrites dans la couleur de série.
const SERIES_FACTURE_ENCAISSE: Serie[] = [
  { cle: 'facture', label: 'Facturé', couleur: '#4a3aa7', valeur: (p) => p.facture },
  { cle: 'encaisse', label: 'Encaissé', couleur: '#1baf7a', valeur: (p) => p.encaisse },
];

// Vue « par activité » : l'encaissé empilé en deux lignes d'affaires (violet / rouge de la
// même palette, bien séparés pour le daltonisme).
const SERIES_ACTIVITE: Serie[] = [
  {
    cle: 'developpement',
    label: 'Développement logiciel',
    couleur: '#4a3aa7',
    valeur: (p) => Math.max(p.encaisse - (p.encaisse_extincpro ?? 0), 0),
  },
  { cle: 'extincpro', label: 'ExtincPro', couleur: '#e34948', valeur: (p) => p.encaisse_extincpro ?? 0 },
];

const VUES: { cle: Vue; label: string }[] = [
  { cle: 'facture_encaisse', label: 'Facturé vs encaissé' },
  { cle: 'activite', label: 'Par activité' },
];

const HAUTEUR = 200;
const MARGE_HAUT = 10; // place pour l'étiquette de la graduation du haut

function montantCourt(n: number) {
  if (n >= 1000) return `${(n / 1000).toLocaleString('fr-CA', { maximumFractionDigits: 1 })} k$`;
  return `${Math.round(n)} $`;
}

/** Maximum « rond » de l'axe (1, 2, 2,5 ou 5 × 10ⁿ) pour des graduations lisibles. */
function maxArrondi(valeur: number) {
  if (valeur <= 0) return 1000;
  const puissance = 10 ** Math.floor(Math.log10(valeur));
  const pas = [1, 2, 2.5, 5, 10].find((p) => p * puissance >= valeur) ?? 10;
  return pas * puissance;
}

export default function FactureEncaisseChart({ donnees }: Props) {
  const [survole, setSurvole] = useState<number | null>(null);
  const [vue, setVue] = useState<Vue>('facture_encaisse');
  const defilement = useRef<HTMLDivElement>(null);

  // Sur petit écran, le graphique défile : on montre d'abord les mois les plus récents.
  useEffect(() => {
    const zone = defilement.current;
    if (zone) zone.scrollLeft = zone.scrollWidth;
  }, []);

  const empile = vue === 'activite';
  const series = empile ? SERIES_ACTIVITE : SERIES_FACTURE_ENCAISSE;
  const max = maxArrondi(
    Math.max(...donnees.map((d) => (empile ? d.encaisse : Math.max(d.facture, d.encaisse))), 0),
  );
  const graduations = [0, 0.5, 1].map((f) => f * max);
  const totaux = series.map((s) => donnees.reduce((a, d) => a + s.valeur(d), 0));

  return (
    <div className="rounded-2xl border border-black/15 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy">{empile ? 'Encaissé par activité' : 'Facturé vs encaissé'}</p>
          <p className="text-xs text-black/50">
            {empile
              ? '12 derniers mois · paiements reçus, développement logiciel et abonnements ExtincPro'
              : '12 derniers mois · facturé = factures émises, encaissé = paiements reçus'}
          </p>
        </div>
        <div className="flex gap-1 rounded-xl border border-black/15 bg-black/[0.04] p-1" role="tablist">
          {VUES.map((v) => (
            <button
              key={v.cle}
              role="tab"
              aria-selected={vue === v.cle}
              onClick={() => setVue(v.cle)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                vue === v.cle ? 'bg-white text-navy shadow-sm ring-1 ring-black/10' : 'text-black/65 hover:text-navy'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-black/70" aria-label="Légende">
        {series.map((s, i) => (
          <span key={s.cle} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.couleur }} />
            {s.label}
            <span className="font-semibold text-navy">{formaterMontant(totaux[i])}</span>
          </span>
        ))}
      </div>

      <div ref={defilement} className="mt-5 overflow-x-auto">
        <div className="relative min-w-[560px] pl-12" style={{ height: MARGE_HAUT + HAUTEUR + 24 }}>
          {/* Graduations discrètes */}
          {graduations.map((g) => (
            <div
              key={g}
              className="absolute left-12 right-0 border-t border-black/[0.08]"
              style={{ top: MARGE_HAUT + HAUTEUR - (g / max) * HAUTEUR }}
            >
              <span className="absolute -left-12 -top-2 w-10 text-right text-[10px] text-black/45">
                {montantCourt(g)}
              </span>
            </div>
          ))}

          <div className="absolute inset-x-0 left-12 flex items-end" style={{ top: MARGE_HAUT, height: HAUTEUR }}>
            {donnees.map((point, i) => {
              const actif = survole === i;
              return (
                <div
                  key={point.mois}
                  className={`relative flex h-full flex-1 items-end justify-center gap-[2px] rounded-t-md ${actif ? 'bg-navy/[0.04]' : ''}`}
                  onPointerEnter={() => setSurvole(i)}
                  onPointerLeave={() => setSurvole(null)}
                  onFocus={() => setSurvole(i)}
                  onBlur={() => setSurvole(null)}
                  tabIndex={0}
                  role="img"
                  aria-label={`${point.mois} : ${series.map((s) => `${s.label} ${formaterMontant(s.valeur(point))}`).join(', ')}`}
                >
                  {empile ? (
                    // Une barre empilée : développement en bas, ExtincPro au-dessus.
                    <div className="flex w-full max-w-[22px] flex-col-reverse">
                      {series.map((s, j) => {
                        const valeur = s.valeur(point);
                        const hauteur = valeur > 0 ? Math.max((valeur / max) * HAUTEUR, 2) : 0;
                        const dessus = series.slice(j + 1).every((autre) => autre.valeur(point) <= 0);
                        return (
                          <div
                            key={s.cle}
                            className={dessus ? 'rounded-t-[4px]' : ''}
                            style={{ height: hauteur, background: s.couleur }}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    series.map((s) => {
                      const valeur = s.valeur(point);
                      const hauteur = valeur > 0 ? Math.max((valeur / max) * HAUTEUR, 2) : 0;
                      return (
                        <div
                          key={s.cle}
                          className="w-full max-w-[14px] rounded-t-[4px]"
                          style={{ height: hauteur, background: s.couleur }}
                        />
                      );
                    })
                  )}

                  {actif && (
                    <div
                      className={`pointer-events-none absolute bottom-full z-10 mb-2 w-52 rounded-lg border border-black/10 bg-white p-2.5 text-xs shadow-lg ${
                        i > donnees.length - 3 ? 'right-0' : i < 2 ? 'left-0' : 'left-1/2 -translate-x-1/2'
                      }`}
                    >
                      <p className="mb-1 font-semibold capitalize text-navy">{point.mois}</p>
                      {series.map((s) => (
                        <p key={s.cle} className="flex items-center justify-between gap-2 text-black/70">
                          <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-sm" style={{ background: s.couleur }} />
                            {s.label}
                          </span>
                          <span className="font-semibold text-navy">{formaterMontant(s.valeur(point))}</span>
                        </p>
                      ))}
                      {empile && (
                        <p className="mt-1 flex justify-between border-t border-black/10 pt-1 text-black/70">
                          Total encaissé <span className="font-semibold text-navy">{formaterMontant(point.encaisse)}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="absolute inset-x-0 left-12 flex" style={{ top: MARGE_HAUT + HAUTEUR + 6 }}>
            {donnees.map((point, i) => (
              <span
                key={point.mois}
                className={`flex-1 text-center text-[11px] capitalize ${i === donnees.length - 1 ? 'font-semibold text-navy' : 'text-black/55'}`}
              >
                {point.mois.split(' ')[0]}
              </span>
            ))}
          </div>
        </div>
      </div>

      <details className="mt-4 text-xs text-black/60">
        <summary className="cursor-pointer font-semibold text-navy">Voir les données</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[360px]">
            <thead>
              <tr className="border-b border-black/10 text-left text-black/40">
                <th className="py-1 pr-3 font-medium">Mois</th>
                {series.map((s) => (
                  <th key={s.cle} className="py-1 pr-3 text-right font-medium">{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {donnees.map((d) => (
                <tr key={d.mois} className="border-b border-black/5">
                  <td className="py-1 pr-3 capitalize">{d.mois}</td>
                  {series.map((s) => (
                    <td key={s.cle} className="py-1 pr-3 text-right">{formaterMontant(s.valeur(d))}</td>
                  ))}
                </tr>
              ))}
              <tr className="font-semibold text-navy">
                <td className="py-1 pr-3">Total</td>
                {totaux.map((t, i) => (
                  <td key={series[i].cle} className="py-1 pr-3 text-right">{formaterMontant(t)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
