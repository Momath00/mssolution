'use client';

import { useState } from 'react';

import { fetchClient, type ClientEntreprise } from '@/lib/api';

interface Props {
  client: ClientEntreprise | null;
  onDone: () => void;
  onCancel: () => void;
}

export default function ClientForm({ client, onDone, onCancel }: Props) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnCours(true);
    setErreur(null);
    const form = e.currentTarget;
    const data = {
      nom_entreprise: (form.elements.namedItem('nom_entreprise') as HTMLInputElement).value,
      nom_contact: (form.elements.namedItem('nom_contact') as HTMLInputElement).value,
      courriel: (form.elements.namedItem('courriel') as HTMLInputElement).value,
      telephone: (form.elements.namedItem('telephone') as HTMLInputElement).value,
      adresse: (form.elements.namedItem('adresse') as HTMLTextAreaElement).value,
    };

    try {
      if (client) {
        await fetchClient(`/api/clients/${client.id}/`, { method: 'PATCH', body: JSON.stringify(data) });
      } else {
        await fetchClient('/api/clients/', { method: 'POST', body: JSON.stringify(data) });
      }
      onDone();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">{client ? 'Modifier le client' : 'Nouveau client'}</h1>

      <form onSubmit={onSubmit} className="mt-6 flex max-w-xl flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-navy">Nom de l&apos;entreprise</label>
          <input
            name="nom_entreprise"
            defaultValue={client?.nom_entreprise}
            required
            className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-navy">Nom du contact</label>
          <input
            name="nom_contact"
            defaultValue={client?.nom_contact}
            className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">Courriel</label>
            <input
              name="courriel"
              type="email"
              defaultValue={client?.courriel}
              required
              className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">Téléphone</label>
            <input
              name="telephone"
              defaultValue={client?.telephone}
              className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-navy">Adresse</label>
          <textarea
            name="adresse"
            defaultValue={client?.adresse}
            rows={3}
            className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
          />
        </div>

        {erreur && <p className="text-sm text-red-600">{erreur}</p>}

        <div className="mt-2 flex gap-3">
          <button
            type="submit"
            disabled={enCours}
            className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {enCours ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-6 py-3 text-sm font-semibold text-black/50 hover:bg-black/5"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}
