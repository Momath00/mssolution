'use client';

import { useEffect, useState } from 'react';

import { fetchClient, type ClientEntreprise } from '@/lib/api';
import { afficherToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';

import ClientForm from './ClientForm';

export default function ClientsDashboardPage() {
  const [clients, setClients] = useState<ClientEntreprise[]>([]);
  const [enEdition, setEnEdition] = useState<ClientEntreprise | null | 'nouveau'>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [aSupprimer, setASupprimer] = useState<ClientEntreprise | null>(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  function charger() {
    fetchClient<ClientEntreprise[]>('/api/clients/')
      .then(setClients)
      .catch((e) => setErreur(e.message));
  }

  useEffect(charger, []);

  async function confirmerSuppression() {
    if (!aSupprimer) return;
    setSuppressionEnCours(true);
    try {
      await fetchClient(`/api/clients/${aSupprimer.id}/`, { method: 'DELETE' });
      afficherToast(`« ${aSupprimer.nom_entreprise} » supprimé.`);
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
      <ClientForm
        client={enEdition === 'nouveau' ? null : enEdition}
        onDone={() => {
          afficherToast(enEdition === 'nouveau' ? 'Client ajouté avec succès.' : 'Client mis à jour.');
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
        <h1 className="text-2xl font-bold text-navy">Clients</h1>
        <button
          onClick={() => setEnEdition('nouveau')}
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          + Ajouter
        </button>
      </div>

      {erreur && <p className="mt-4 text-sm text-red-600">{erreur}</p>}

      <div className="mt-6 flex flex-col gap-3">
        {clients.map((c) => (
          <div key={c.id} className="flex items-center gap-4 rounded-xl border border-black/5 bg-white p-4 shadow-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-navy">{c.nom_entreprise}</p>
              <p className="truncate text-sm text-black/50">{c.courriel} {c.telephone && `· ${c.telephone}`}</p>
            </div>
            <button
              onClick={() => setEnEdition(c)}
              className="shrink-0 text-sm font-semibold text-accent hover:underline"
            >
              Modifier
            </button>
            <button
              onClick={() => setASupprimer(c)}
              className="shrink-0 text-sm font-semibold text-black/40 hover:text-red-600"
            >
              Supprimer
            </button>
          </div>
        ))}
        {clients.length === 0 && <p className="text-black/50">Aucun client pour le moment.</p>}
      </div>

      {aSupprimer && (
        <ConfirmDialog
          titre="Supprimer ce client ?"
          message={`« ${aSupprimer.nom_entreprise} » sera supprimé définitivement.`}
          enCours={suppressionEnCours}
          onConfirm={confirmerSuppression}
          onCancel={() => setASupprimer(null)}
        />
      )}
    </div>
  );
}
