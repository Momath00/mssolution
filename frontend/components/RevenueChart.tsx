'use client';

import { useState } from 'react';

interface PointMensuel {
  mois: string;
  total: number;
}

interface Props {
  donnees: PointMensuel[];
}

const HAUTEUR = 160;
const LARGEUR_BARRE = 24;

export default function RevenueChart({ donnees }: Props) {
  const [survole, setSurvole] = useState<number | null>(null);

  const max = Math.max(...donnees.map((d) => d.total), 1);
  const dernierIndex = donnees.length - 1;

  return (
    <div className="rounded-xl border border-black/5 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold text-navy">Revenu par mois</p>
      <p className="text-xs text-black/40">Factures marquées « payée », 6 derniers mois</p>

      <div
        className="mt-6 flex items-end justify-between gap-3 border-b border-black/10"
        style={{ height: HAUTEUR }}
      >
        {donnees.map((point, i) => {
          const hauteurBarre = point.total > 0 ? Math.max((point.total / max) * (HAUTEUR - 55), 3) : 0;
          const estSurvole = survole === i;
          return (
            <div
              key={point.mois}
              className="relative flex flex-1 flex-col items-center justify-end"
              style={{ height: HAUTEUR }}
              onPointerEnter={() => setSurvole(i)}
              onPointerLeave={() => setSurvole(null)}
              onFocus={() => setSurvole(i)}
              onBlur={() => setSurvole(null)}
              tabIndex={0}
              role="img"
              aria-label={`${point.mois} : ${point.total.toFixed(2)} $`}
            >
              <span
                className={`mb-1 text-xs ${
                  estSurvole || i === dernierIndex ? 'font-semibold text-navy' : 'font-medium text-black/55'
                }`}
              >
                {point.total > 0 ? `${point.total.toFixed(0)} $` : '—'}
              </span>
              <div
                className={`w-full rounded-t-[4px] transition-colors ${estSurvole ? 'bg-navy-light' : 'bg-navy'}`}
                style={{ height: hauteurBarre, maxWidth: LARGEUR_BARRE }}
              />
              <span className="mt-2 text-[11px] font-medium capitalize text-black/70">
                {point.mois.split(' ')[0]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
