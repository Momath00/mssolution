'use client';

import { useEffect, useState } from 'react';

import { apiUrlClient, fetchClient, type ComptesARecevoir as Donnees, type TrancheAge } from '@/lib/api';
import { formaterDate, formaterMontant } from '@/lib/argent';
import { clientAvatarStyle, initiales } from '@/lib/clientColors';
import { ICONES, Icone } from '@/components/Icone';
import Pagination, { paginer } from '@/components/Pagination';

interface Props {
  onOuvrirFacture: (id: number) => void;
}

const PAR_PAGE = 10;

const COULEUR_TRANCHE: Record<TrancheAge, { barre: string; badge: string }> = {
  courant: { barre: 'bg-green-500', badge: 'bg-green-50 text-green-700 ring-green-200' },
  '1_30': { barre: 'bg-amber-400', badge: 'bg-amber-50 text-amber-800 ring-amber-200' },
  '31_60': { barre: 'bg-orange-500', badge: 'bg-orange-50 text-orange-700 ring-orange-200' },
  '61_90': { barre: 'bg-red-500', badge: 'bg-red-50 text-red-700 ring-red-200' },
  plus_90: { barre: 'bg-red-800', badge: 'bg-red-100 text-red-900 ring-red-300' },
};

function Indicateur({
  libelle, valeur, detail, icone, teinte, valeurClasse = 'text-navy',
}: {
  libelle: string; valeur: string; detail: React.ReactNode; icone: string; teinte: string; valeurClasse?: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-black/15 bg-white p-4 shadow-sm">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${teinte}`}>
        <Icone d={icone} className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] text-black/55">{libelle}</p>
        <p className={`mt-0.5 text-2xl font-bold tabular-nums ${valeurClasse}`}>{valeur}</p>
        <div className="mt-0.5 text-xs text-black/50">{detail}</div>
      </div>
    </div>
  );
}

export default function ComptesARecevoir({ onOuvrirFacture }: Props) {
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [vue, setVue] = useState<'factures' | 'clients'>('factures');
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchClient<Donnees>('/api/comptes-a-recevoir/')
      .then(setDonnees)
      .catch((e) => setErreur(e instanceof Error ? e.message : 'Erreur de chargement.'));
  }, []);

  if (erreur) return <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</p>;
  if (!donnees) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-black/5" />
        ))}
      </div>
    );
  }

  const total = donnees.total_du;
  const libelleTranche = Object.fromEntries(donnees.tranches.map((t) => [t.cle, t.label])) as Record<TrancheAge, string>;
  const nbEnRetard = donnees.factures.filter((f) => f.jours_retard > 0).length;
  const nbElements = vue === 'factures' ? donnees.factures.length : donnees.clients.length;
  const { nbPages, pageCourante } = paginer(Array.from({ length: nbElements }), page, PAR_PAGE);
  const facturesPage = paginer(donnees.factures, pageCourante, PAR_PAGE).elements;
  const clientsPage = paginer(donnees.clients, pageCourante, PAR_PAGE).elements;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Indicateur
          libelle="Total à recevoir"
          valeur={formaterMontant(total)}
          detail={`${donnees.factures.length} facture(s) avec un solde`}
          icone={ICONES.argent}
          teinte="bg-navy/5 text-navy"
        />
        <Indicateur
          libelle="En retard"
          valeur={formaterMontant(donnees.total_en_retard)}
          valeurClasse={donnees.total_en_retard > 0 ? 'text-red-600' : 'text-green-700'}
          detail={`${nbEnRetard} facture(s) en retard`}
          icone={ICONES.horloge}
          teinte={donnees.total_en_retard > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}
        />
        <Indicateur
          libelle="Pas encore échu"
          valeur={formaterMontant(donnees.tranches.find((t) => t.cle === 'courant')?.montant ?? 0)}
          valeurClasse="text-green-700"
          detail={
            <a
              href={apiUrlClient('/api/comptes-a-recevoir/excel/')}
              className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
            >
              <Icone d={ICONES.telecharger} className="h-3.5 w-3.5" />
              Exporter en Excel
            </a>
          }
          icone={ICONES.succes}
          teinte="bg-green-50 text-green-600"
        />
      </div>

      {/* Âge des comptes */}
      <div className="rounded-2xl border border-black/15 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-navy">Âge des comptes</h2>
        <p className="text-xs text-black/55">Combien on te doit, selon depuis combien de temps c&apos;est échu.</p>
        {total > 0 && (
          <div className="mt-4 flex h-3 gap-0.5 overflow-hidden rounded-full bg-black/5">
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
            <div key={t.cle} className="rounded-xl border border-black/10 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-xs text-black/55">
                <span className={`h-2 w-2 rounded-full ${COULEUR_TRANCHE[t.cle].barre}`} />
                {t.label}
              </p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-navy">{formaterMontant(t.montant)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Détail */}
      <div>
        <div className="flex w-fit gap-1 rounded-xl border border-black/15 bg-black/[0.04] p-1">
          {(['factures', 'clients'] as const).map((v) => (
            <button
              key={v}
              onClick={() => {
                setVue(v);
                setPage(1);
              }}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
                vue === v ? 'bg-white text-navy shadow-sm ring-1 ring-black/10' : 'text-black/70 hover:bg-white/70 hover:text-navy'
              }`}
            >
              {v === 'factures' ? 'Par facture' : 'Par client'}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
                  vue === v ? 'bg-navy text-white' : 'bg-black/10 text-black/70'
                }`}
              >
                {v === 'factures' ? donnees.factures.length : donnees.clients.length}
              </span>
            </button>
          ))}
        </div>

        {donnees.factures.length === 0 ? (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-black/15 bg-white px-5 py-5 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-600">
              <Icone d={ICONES.succes} className="h-5 w-5" />
            </div>
            <p className="font-semibold text-navy">Aucun solde dû — tout est payé.</p>
          </div>
        ) : vue === 'factures' ? (
          <div className="mt-4 overflow-hidden rounded-2xl border border-black/15 bg-white shadow-sm">
            <ul className="divide-y divide-black/10">
              {facturesPage.map((f) => (
                <li key={f.id}>
                  <button
                    onClick={() => onOuvrirFacture(f.id)}
                    className="flex w-full flex-col gap-3 px-5 py-4 text-left transition-colors hover:bg-black/[0.02] sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-4">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm"
                        style={clientAvatarStyle(f.client_id) || undefined}
                      >
                        {initiales(f.client_nom)}
                      </div>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-1.5 font-semibold tabular-nums text-navy">
                          {f.numero}
                          {f.a_un_plan && (
                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-200">
                              Plan de paiement
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 truncate text-[13px] text-black/55">
                          {f.client_nom} · Total {formaterMontant(f.total)} · Payé {formaterMontant(f.montant_paye)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 pl-[60px] sm:pl-0">
                      <div className="text-right">
                        <p className="text-sm font-bold tabular-nums text-navy">{formaterMontant(f.solde_du)}</p>
                        <p className="text-xs text-black/50">
                          {f.prochaine_echeance
                            ? `Prochain : ${formaterMontant(f.prochaine_echeance.montant)} le ${formaterDate(f.prochaine_echeance.date)}`
                            : 'Sans échéance'}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${COULEUR_TRANCHE[f.tranche].badge}`}>
                        {f.jours_retard > 0
                          ? `${formaterMontant(f.montant_en_retard)} en retard · ${f.jours_retard} j`
                          : libelleTranche[f.tranche]}
                      </span>
                      <Icone d={ICONES.suivant} className="hidden h-4 w-4 text-black/30 sm:block" />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <Pagination
              page={pageCourante}
              nbPages={nbPages}
              total={donnees.factures.length}
              parPage={PAR_PAGE}
              libelle={['facture', 'factures']}
              onChange={setPage}
            />
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-black/15 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-black/10 bg-black/[0.02] text-left text-[11px] font-semibold uppercase tracking-wide text-black/50">
                    <th className="px-5 py-3">Client</th>
                    <th className="px-2 py-3 text-right">Factures</th>
                    <th className="px-2 py-3 text-right">Solde dû</th>
                    {donnees.tranches.map((t) => (
                      <th key={t.cle} className="px-2 py-3 text-right">{t.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/10">
                  {clientsPage.map((c) => (
                    <tr key={c.client_id} className="hover:bg-black/[0.015]">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                            style={clientAvatarStyle(c.client_id) || undefined}
                          >
                            {initiales(c.client_nom)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-navy">{c.client_nom}</p>
                            <p className="text-xs text-black/45">{c.client_courriel}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-right tabular-nums">{c.nombre_factures}</td>
                      <td className="px-2 py-3 text-right font-bold tabular-nums text-navy">{formaterMontant(c.solde_du)}</td>
                      {donnees.tranches.map((t) => {
                        const montant = c[`tranche_${t.cle}`];
                        return (
                          <td
                            key={t.cle}
                            className={`px-2 py-3 text-right tabular-nums ${montant > 0 && t.cle !== 'courant' ? 'font-semibold text-red-600' : 'text-black/45'}`}
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
            <Pagination
              page={pageCourante}
              nbPages={nbPages}
              total={donnees.clients.length}
              parPage={PAR_PAGE}
              libelle={['client', 'clients']}
              onChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
