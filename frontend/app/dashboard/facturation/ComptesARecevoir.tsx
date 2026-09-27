'use client';

import { useEffect, useState } from 'react';

import { apiUrlClient, fetchClient, type ComptesARecevoir as Donnees, type TrancheAge } from '@/lib/api';
import { formaterDate, formaterMontant } from '@/lib/argent';

interface Props {
  onOuvrirFacture: (id: number) => void;
}

const COULEUR_TRANCHE: Record<TrancheAge, { barre: string; badge: string }> = {
  courant: { barre: 'bg-green-500', badge: 'bg-green-100 text-green-700' },
  '1_30': { barre: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700' },
  '31_60': { barre: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700' },
  '61_90': { barre: 'bg-red-500', badge: 'bg-red-100 text-red-700' },
  plus_90: { barre: 'bg-red-800', badge: 'bg-red-200 text-red-900' },
};

export default function ComptesARecevoir({ onOuvrirFacture }: Props) {
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [vue, setVue] = useState<'factures' | 'clients'>('factures');

  useEffect(() => {
    fetchClient<Donnees>('/api/comptes-a-recevoir/')
      .then(setDonnees)
      .catch((e) => setErreur(e instanceof Error ? e.message : 'Erreur de chargement.'));
  }, []);

  if (erreur) return <p className="text-sm text-red-600">{erreur}</p>;
  if (!donnees) {
    return (
      <div className="flex flex-col gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-black/5" />
        ))}
      </div>
    );
  }

  const total = donnees.total_du;
  const libelleTranche = Object.fromEntries(donnees.tranches.map((t) => [t.cle, t.label])) as Record<TrancheAge, string>;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
          <p className="text-xs text-black/50">Total à recevoir</p>
          <p className="mt-1 text-2xl font-bold text-navy">{formaterMontant(total)}</p>
          <p className="text-xs text-black/40">{donnees.factures.length} facture(s) avec un solde</p>
        </div>
        <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
          <p className="text-xs text-black/50">En retard</p>
          <p className={`mt-1 text-2xl font-bold ${donnees.total_en_retard > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formaterMontant(donnees.total_en_retard)}
          </p>
          <p className="text-xs text-black/40">
            {donnees.factures.filter((f) => f.jours_retard > 0).length} facture(s) en retard
          </p>
        </div>
        <div className="flex flex-col justify-between rounded-xl border border-black/5 bg-white p-4 shadow-sm">
          <p className="text-xs text-black/50">Pas encore échu</p>
          <p className="mt-1 text-2xl font-bold text-green-600">
            {formaterMontant(donnees.tranches.find((t) => t.cle === 'courant')?.montant ?? 0)}
          </p>
          <a
            href={apiUrlClient('/api/comptes-a-recevoir/excel/')}
            className="text-xs font-semibold text-accent hover:underline"
          >
            Exporter en Excel
          </a>
        </div>
      </div>

      {/* Âge des comptes */}
      <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-navy">Âge des comptes</h2>
        <p className="text-xs text-black/50">Combien on te doit, selon depuis combien de temps c&apos;est échu.</p>
        {total > 0 && (
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-black/5">
            {donnees.tranches.map((t) =>
              t.montant > 0 ? (
                <div
                  key={t.cle}
                  className={COULEUR_TRANCHE[t.cle].barre}
                  style={{ width: `${(t.montant / total) * 100}%` }}
                  title={`${t.label} : ${formaterMontant(t.montant)}`}
                />
              ) : null,
            )}
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {donnees.tranches.map((t) => (
            <div key={t.cle}>
              <p className="flex items-center gap-1.5 text-xs text-black/50">
                <span className={`h-2 w-2 rounded-full ${COULEUR_TRANCHE[t.cle].barre}`} />
                {t.label}
              </p>
              <p className="mt-0.5 text-sm font-bold text-navy">{formaterMontant(t.montant)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Détail */}
      <div>
        <div className="flex gap-1 border-b border-black/10">
          {(['factures', 'clients'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVue(v)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
                vue === v ? 'border-accent text-navy' : 'border-transparent text-black/40 hover:text-black/60'
              }`}
            >
              {v === 'factures' ? 'Par facture' : 'Par client'}
            </button>
          ))}
        </div>

        {donnees.factures.length === 0 ? (
          <p className="mt-4 text-sm text-black/50">Aucun solde dû — tout est payé.</p>
        ) : vue === 'factures' ? (
          <div className="mt-3 flex flex-col gap-2">
            {donnees.factures.map((f) => (
              <button
                key={f.id}
                onClick={() => onOuvrirFacture(f.id)}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-black/5 bg-white p-4 text-left shadow-sm hover:border-navy/20"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-navy">
                    {f.numero}
                    {f.a_un_plan && (
                      <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                        Plan de paiement
                      </span>
                    )}
                  </p>
                  <p className="truncate text-sm text-black/50">
                    {f.client_nom} · Total {formaterMontant(f.total)} · Payé {formaterMontant(f.montant_paye)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-navy">{formaterMontant(f.solde_du)}</p>
                  <p className="text-xs text-black/40">
                    {f.prochaine_echeance
                      ? `Prochain : ${formaterMontant(f.prochaine_echeance.montant)} le ${formaterDate(f.prochaine_echeance.date)}`
                      : 'Sans échéance'}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${COULEUR_TRANCHE[f.tranche].badge}`}>
                  {f.jours_retard > 0
                    ? `${formaterMontant(f.montant_en_retard)} en retard · ${f.jours_retard} j`
                    : libelleTranche[f.tranche]}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-black/5 bg-white shadow-sm">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-black/10 text-left text-xs uppercase text-black/40">
                  <th className="px-4 py-2">Client</th>
                  <th className="px-2 py-2 text-right">Factures</th>
                  <th className="px-2 py-2 text-right">Solde dû</th>
                  {donnees.tranches.map((t) => (
                    <th key={t.cle} className="px-2 py-2 text-right">{t.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {donnees.clients.map((c) => (
                  <tr key={c.client_id} className="border-b border-black/5">
                    <td className="px-4 py-2">
                      <p className="font-semibold text-navy">{c.client_nom}</p>
                      <p className="text-xs text-black/40">{c.client_courriel}</p>
                    </td>
                    <td className="px-2 py-2 text-right">{c.nombre_factures}</td>
                    <td className="px-2 py-2 text-right font-bold text-navy">{formaterMontant(c.solde_du)}</td>
                    {donnees.tranches.map((t) => {
                      const montant = c[`tranche_${t.cle}`];
                      return (
                        <td
                          key={t.cle}
                          className={`px-2 py-2 text-right ${montant > 0 && t.cle !== 'courant' ? 'font-semibold text-red-600' : 'text-black/50'}`}
                        >
                          {montant > 0 ? formaterMontant(montant) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
