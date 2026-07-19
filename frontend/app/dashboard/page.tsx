'use client';

import { useEffect, useState } from 'react';

import { fetchClient } from '@/lib/api';
import RevenueChart from '@/components/RevenueChart';

interface Stats {
  realisations_publiees: number;
  factures_totales: number;
  factures_en_attente: number;
  revenu_du_mois: number;
  clients_actifs: number;
  chiffre_affaires_total: number;
  revenu_par_mois: { mois: string; total: number }[];
}

type CleStatNumerique = Exclude<keyof Stats, 'revenu_par_mois'>;

const cartes: { cle: CleStatNumerique; label: string; suffixe?: string; icon: React.ReactNode }[] = [
  {
    cle: 'realisations_publiees',
    label: 'Réalisations publiées',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.75 5.25h16.5v13.5H3.75zM3.75 15l4.5-4.5 3 3 5.25-5.25 4.25 4.25" />
    ),
  },
  {
    cle: 'clients_actifs',
    label: 'Clients actifs',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 19.5v-1.5a3.75 3.75 0 0 0-3.75-3.75H6.75A3.75 3.75 0 0 0 3 18v1.5M9.375 11.25a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
    ),
  },
  {
    cle: 'factures_totales',
    label: 'Factures totales',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7.5 3.75h6.879a1.5 1.5 0 0 1 1.06.44l3.372 3.371a1.5 1.5 0 0 1 .439 1.061V19.5a1.5 1.5 0 0 1-1.5 1.5h-10.25a1.5 1.5 0 0 1-1.5-1.5V5.25a1.5 1.5 0 0 1 1.5-1.5ZM9 12h6M9 15.5h6" />
    ),
  },
  {
    cle: 'factures_en_attente',
    label: 'Factures en attente',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v3.75m0 3.75h.008M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    ),
  },
  {
    cle: 'revenu_du_mois',
    label: 'Revenu du mois',
    suffixe: ' $',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6v12m4-9c0-1.66-1.79-3-4-3s-4 1.34-4 3 1.79 3 4 3 4 1.34 4 3-1.79 3-4 3-4-1.34-4-3" />,
  },
  {
    cle: 'chiffre_affaires_total',
    label: "Chiffre d'affaires total",
    suffixe: ' $',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 13.5 8.25 8.25l4.5 4.5L21 4.5M21 4.5h-5.25M21 4.5v5.25" />,
  },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    fetchClient<Stats>('/api/dashboard/stats/')
      .then(setStats)
      .catch((e) => setErreur(e.message));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Vue d&apos;ensemble</h1>

      {erreur && <p className="mt-4 text-sm text-red-600">{erreur}</p>}

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cartes.map((carte) => (
          <div
            key={carte.cle}
            className="rounded-xl border border-black/5 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <span className="bg-navy/5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-navy">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor">
                  {carte.icon}
                </svg>
              </span>
              <p className="text-sm text-black/50">{carte.label}</p>
            </div>
            <p className="mt-3 text-3xl font-bold text-navy">
              {stats ? `${stats[carte.cle]}${carte.suffixe ?? ''}` : '—'}
            </p>
          </div>
        ))}
      </div>

      {stats && (
        <div className="mt-6">
          <RevenueChart donnees={stats.revenu_par_mois} />
        </div>
      )}
    </div>
  );
}
