'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

import { fetchClient, mediaUrl, type Realisation } from '@/lib/api';
import { afficherToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';

import RealisationForm from './RealisationForm';

export default function RealisationsDashboardPage() {
  const [realisations, setRealisations] = useState<Realisation[]>([]);
  const [enEdition, setEnEdition] = useState<Realisation | null | 'nouveau'>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [aSupprimer, setASupprimer] = useState<Realisation | null>(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  function charger() {
    fetchClient<Realisation[]>('/api/realisations/')
      .then(setRealisations)
      .catch((e) => setErreur(e.message));
  }

  useEffect(charger, []);

  async function toggleStatut(r: Realisation) {
    const nouveauStatut = r.statut === 'publie' ? 'brouillon' : 'publie';
    await fetchClient(`/api/realisations/${r.id}/`, {
      method: 'PATCH',
      body: JSON.stringify({ statut: nouveauStatut }),
    });
    afficherToast(nouveauStatut === 'publie' ? `« ${r.titre} » est maintenant publié.` : `« ${r.titre} » repassé en brouillon.`);
    charger();
  }

  async function confirmerSuppression() {
    if (!aSupprimer) return;
    setSuppressionEnCours(true);
    try {
      await fetchClient(`/api/realisations/${aSupprimer.id}/`, { method: 'DELETE' });
      afficherToast(`« ${aSupprimer.titre} » supprimé.`);
      setASupprimer(null);
      charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de la suppression.');
    } finally {
      setSuppressionEnCours(false);
    }
  }

  if (enEdition) {
    return (
      <RealisationForm
        realisation={enEdition === 'nouveau' ? null : enEdition}
        onDone={() => {
          afficherToast(enEdition === 'nouveau' ? 'Réalisation créée avec succès.' : 'Réalisation mise à jour.');
          setEnEdition(null);
          charger();
        }}
        onCancel={() => setEnEdition(null)}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">Réalisations</h1>
        <button
          onClick={() => setEnEdition('nouveau')}
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          + Ajouter
        </button>
      </div>

      {erreur && <p className="mt-4 text-sm text-red-600">{erreur}</p>}

      <div className="mt-6 flex flex-col gap-3">
        {realisations.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-4 rounded-xl border border-black/5 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="relative flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-black/10 bg-white">
              {r.image && (
                <Image
                  src={mediaUrl(r.image) || r.image}
                  alt={r.titre}
                  fill
                  unoptimized
                  className="object-contain p-2"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-navy">{r.titre}</p>
              <p className="truncate text-sm text-black/50">{r.client}</p>
            </div>
            <button
              onClick={() => toggleStatut(r)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                r.statut === 'publie' ? 'bg-green-100 text-green-700' : 'bg-black/5 text-black/50'
              }`}
            >
              {r.statut === 'publie' ? 'Publié' : 'Brouillon'}
            </button>
            <button
              onClick={() => setEnEdition(r)}
              className="shrink-0 text-sm font-semibold text-accent hover:underline"
            >
              Modifier
            </button>
            <button
              onClick={() => setASupprimer(r)}
              className="shrink-0 text-sm font-semibold text-black/40 hover:text-red-600"
            >
              Supprimer
            </button>
          </div>
        ))}
        {realisations.length === 0 && <p className="text-black/50">Aucune réalisation pour le moment.</p>}
      </div>

      {aSupprimer && (
        <ConfirmDialog
          titre="Supprimer cette réalisation ?"
          message={`« ${aSupprimer.titre} » sera supprimée définitivement, y compris du site public.`}
          enCours={suppressionEnCours}
          onConfirm={confirmerSuppression}
          onCancel={() => setASupprimer(null)}
        />
      )}
    </div>
  );
}
