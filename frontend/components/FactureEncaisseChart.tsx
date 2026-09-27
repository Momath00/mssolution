'use client';

import { useEffect, useRef, useState } from 'react';

import { formaterMontant } from '@/lib/argent';

export interface PointFactureEncaisse {
  mois: string;
  facture: number;
  encaisse: number;
}

interface Props {
  donnees: PointFactureEncaisse[];
}

// Palette validée (scripts/validate_palette.js du guide dataviz) : violet / vert d'eau,
// séparation daltonisme ΔE 31. Le vert est sous 3:1 sur fond blanc → légende, infobulle et
// tableau des données fournis, et les valeurs ne sont jamais écrites dans la couleur de série.
const SERIES = [
  { cle: 'facture', label: 'Facturé', couleur: '#4a3aa7' },
  { cle: 'encaisse', label: 'Encaissé', couleur: '#1baf7a' },
] as const;

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
  const defilement = useRef<HTMLDivElement>(null);

  // Sur petit écran, le graphique défile : on montre d'abord les mois les plus récents.
  useEffect(() => {
    const zone = defilement.current;
    if (zone) zone.scrollLeft = zone.scrollWidth;
  }, []);
  const max = maxArrondi(Math.max(...donnees.flatMap((d) => [d.facture, d.encaisse]), 0));
  const graduations = [0, 0.5, 1].map((f) => f * max);
  const totalFacture = donnees.reduce((a, d) => a + d.facture, 0);
  const totalEncaisse = donnees.reduce((a, d) => a + d.encaisse, 0);

  return (
    <div className="rounded-xl border border-black/5 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy">Facturé vs encaissé</p>
          <p className="text-xs text-black/50">
            12 derniers mois · facturé = factures émises, encaissé = paiements reçus
          </p>
        </div>
        <div className="flex gap-4 text-xs text-black/70" aria-label="Légende">
          {SERIES.map((s) => (
            <span key={s.cle} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.couleur }} />
              {s.label}
            </span>
          ))}
        </div>
      </div>

      <div ref={defilement} className="mt-6 overflow-x-auto">
        <div className="relative min-w-[560px] pl-12" style={{ height: MARGE_HAUT + HAUTEUR + 24 }}>
          {/* Graduations discrètes */}
          {graduations.map((g) => (
            <div
              key={g}
              className="absolute left-12 right-0 border-t border-black/[0.06]"
              style={{ top: MARGE_HAUT + HAUTEUR - (g / max) * HAUTEUR }}
            >
              <span className="absolute -left-12 -top-2 w-10 text-right text-[10px] text-black/40">
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
                  aria-label={`${point.mois} : facturé ${formaterMontant(point.facture)}, encaissé ${formaterMontant(point.encaisse)}`}
                >
                  {SERIES.map((s) => {
                    const valeur = point[s.cle];
                    const hauteur = valeur > 0 ? Math.max((valeur / max) * HAUTEUR, 2) : 0;
                    return (
                      <div
                        key={s.cle}
                        className="w-full max-w-[14px] rounded-t-[4px]"
                        style={{ height: hauteur, background: s.couleur }}
                      />
                    );
                  })}

                  {actif && (
                    <div
                      className={`pointer-events-none absolute bottom-full z-10 mb-2 w-44 rounded-lg border border-black/10 bg-white p-2.5 text-xs shadow-lg ${
                        i > donnees.length - 3 ? 'right-0' : i < 2 ? 'left-0' : 'left-1/2 -translate-x-1/2'
                      }`}
                    >
                      <p className="mb-1 font-semibold capitalize text-navy">{point.mois}</p>
                      {SERIES.map((s) => (
                        <p key={s.cle} className="flex items-center justify-between gap-2 text-black/70">
                          <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-sm" style={{ background: s.couleur }} />
                            {s.label}
                          </span>
                          <span className="font-semibold text-navy">{formaterMontant(point[s.cle])}</span>
                        </p>
                      ))}
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
                <th className="py-1 pr-3 text-right font-medium">Facturé</th>
                <th className="py-1 text-right font-medium">Encaissé</th>
              </tr>
            </thead>
            <tbody>
              {donnees.map((d) => (
                <tr key={d.mois} className="border-b border-black/5">
                  <td className="py-1 pr-3 capitalize">{d.mois}</td>
                  <td className="py-1 pr-3 text-right">{formaterMontant(d.facture)}</td>
                  <td className="py-1 text-right">{formaterMontant(d.encaisse)}</td>
                </tr>
              ))}
              <tr className="font-semibold text-navy">
                <td className="py-1 pr-3">Total</td>
                <td className="py-1 pr-3 text-right">{formaterMontant(totalFacture)}</td>
                <td className="py-1 text-right">{formaterMontant(totalEncaisse)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
