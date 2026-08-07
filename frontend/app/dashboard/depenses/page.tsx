'use client';

import { useState } from 'react';

import { fetchClient, mediaUrl, type Depense } from '@/lib/api';
import { useListePaginee } from '@/lib/useListePaginee';
import { afficherToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';

import DepenseForm from './DepenseForm';
import CompteGrandLivreManager from './CompteGrandLivreManager';
import RapportComptable from './RapportComptable';

type Onglet = 'depenses' | 'comptes' | 'rapport';

const onglets: { id: Onglet; label: string }[] = [
  { id: 'depenses', label: 'Dépenses' },
  { id: 'comptes', label: 'Comptes de grand livre' },
  { id: 'rapport', label: 'Rapport comptable' },
];

export default function DepensesDashboardPage() {
  const [onglet, setOnglet] = useState<Onglet>('depenses');
  const {
    items: depenses,
    setItems: setDepenses,
    total,
    chargementInitial,
    chargementPage,
    erreur: erreurChargement,
    sentinelleRef,
    recharger,
    chargerPlus,
  } = useListePaginee<Depense>('/api/depenses/');

  const [enEdition, setEnEdition] = useState<Depense | null | 'nouveau'>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [aSupprimer, setASupprimer] = useState<Depense | null>(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  async function confirmerSuppression() {
    if (!aSupprimer) return;
    setSuppressionEnCours(true);
    try {
      await fetchClient(`/api/depenses/${aSupprimer.id}/`, { method: 'DELETE' });
      afficherToast('Dépense supprimée.');
      setDepenses((prev) => prev.filter((d) => d.id !== aSupprimer.id));
      setASupprimer(null);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de la suppression.');
    } finally {
      setSuppressionEnCours(false);
    }
  }

  if (enEdition) {
    return (
      <DepenseForm
        depense={enEdition === 'nouveau' ? null : enEdition}
        onDone={() => {
          afficherToast(enEdition === 'nouveau' ? 'Dépense enregistrée.' : 'Dépense mise à jour.');
          setEnEdition(null);
          recharger();
        }}
        onCancel={() => setEnEdition(null)}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">Dépenses</h1>
        {onglet === 'depenses' && (
          <button
            onClick={() => setEnEdition('nouveau')}
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
          >
            + Nouveau
          </button>
        )}
      </div>

      <div className="mt-5 flex gap-1 border-b border-black/10">
        {onglets.map((o) => (
          <button
            key={o.id}
            onClick={() => setOnglet(o.id)}
            className={`-mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
              onglet === o.id
                ? 'border-accent text-navy'
                : 'border-transparent text-black/40 hover:text-navy'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {onglet === 'depenses' && (
          <>
            {(erreur || erreurChargement) && <p className="mb-4 text-sm text-red-600">{erreur || erreurChargement}</p>}
            {!chargementInitial && total > 0 && (
              <p className="mb-3 text-xs text-black/40">{depenses.length} sur {total} dépenses</p>
            )}
            <div className="flex flex-col gap-3">
              {chargementInitial &&
                [...Array(3)].map((_, i) => <div key={i} className="h-[68px] animate-pulse rounded-xl bg-black/5" />)}

              {!chargementInitial &&
                depenses.map((dep) => {
                  const photo = mediaUrl(dep.piece_jointe);
                  return (
                    <div key={dep.id} className="flex items-center gap-4 rounded-xl border border-black/5 bg-white p-4 shadow-sm">
                      {photo ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={photo} alt={dep.fournisseur} className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-black/5 text-black/20">
                          <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5V6a1.5 1.5 0 0 1 1.5-1.5h15A1.5 1.5 0 0 1 21 6v10.5m-18 0A1.5 1.5 0 0 0 4.5 18h15a1.5 1.5 0 0 0 1.5-1.5m-18 0 5.47-5.47a1.5 1.5 0 0 1 2.12 0l2.91 2.91m7.5 2.56-3.97-3.97a1.5 1.5 0 0 0-2.12 0L11.5 15" />
                          </svg>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-navy">
                          {dep.fournisseur} <span className="font-normal text-black/40">— {dep.date}</span>
                        </p>
                        <p className="truncate text-sm text-black/50">{dep.total} $</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-navy">
                        {dep.compte_grand_livre_nom}
                      </span>
                      <button
                        onClick={() => setEnEdition(dep)}
                        className="shrink-0 text-sm font-semibold text-black/60 hover:underline"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => setASupprimer(dep)}
                        className="shrink-0 text-sm font-semibold text-black/40 hover:text-red-600"
                      >
                        Supprimer
                      </button>
                    </div>
                  );
                })}
              {!chargementInitial && depenses.length === 0 && (
                <p className="text-black/50">Aucune dépense pour le moment.</p>
              )}

              <div ref={sentinelleRef} />
              {chargementPage && (
                <div className="flex justify-center py-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                </div>
              )}
              {!chargementPage && !chargementInitial && depenses.length < total && (
                <button
                  onClick={chargerPlus}
                  className="mx-auto mt-1 rounded-full border border-black/10 px-5 py-2 text-sm font-semibold text-navy hover:bg-black/5"
                >
                  Charger plus
                </button>
              )}
            </div>
          </>
        )}

        {onglet === 'comptes' && <CompteGrandLivreManager />}
        {onglet === 'rapport' && <RapportComptable />}
      </div>

      {aSupprimer && (
        <ConfirmDialog
          titre="Supprimer cette dépense ?"
          message={`La dépense « ${aSupprimer.fournisseur} » du ${aSupprimer.date} sera supprimée définitivement.`}
          enCours={suppressionEnCours}
          onConfirm={confirmerSuppression}
          onCancel={() => setASupprimer(null)}
        />
      )}
    </div>
  );
}
