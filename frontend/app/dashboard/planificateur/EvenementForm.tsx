'use client';

import { useEffect, useState } from 'react';

import { fetchClient, type ClientEntreprise, type Evenement, type TypeEvenement } from '@/lib/api';

const TYPES: { value: TypeEvenement; label: string }[] = [
  { value: 'rendez_vous', label: 'Rendez-vous' },
  { value: 'tache', label: 'Tâche' },
  { value: 'rappel', label: 'Rappel' },
];

interface Props {
  evenement: Evenement | null;
  dateParDefaut: string;
  heureParDefaut?: string;
  onDone: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export default function EvenementForm({ evenement, dateParDefaut, heureParDefaut, onDone, onCancel, onDelete }: Props) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientEntreprise[]>([]);

  useEffect(() => {
    fetchClient<ClientEntreprise[]>('/api/clients/').then(setClients).catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnCours(true);
    setErreur(null);
    const form = e.currentTarget;
    const heure = (form.elements.namedItem('heure') as HTMLInputElement).value;
    const client = (form.elements.namedItem('client') as HTMLSelectElement).value;
    const data = {
      titre: (form.elements.namedItem('titre') as HTMLInputElement).value,
      type_evenement: (form.elements.namedItem('type_evenement') as HTMLSelectElement).value,
      date: (form.elements.namedItem('date') as HTMLInputElement).value,
      heure: heure || null,
      client: client || null,
      description: (form.elements.namedItem('description') as HTMLTextAreaElement).value,
    };

    try {
      if (evenement) {
        await fetchClient(`/api/evenements/${evenement.id}/`, { method: 'PATCH', body: JSON.stringify(data) });
      } else {
        await fetchClient('/api/evenements/', { method: 'POST', body: JSON.stringify(data) });
      }
      onDone();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div
      className="animate-backdrop-in fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      onClick={onCancel}
    >
      <div
        className="animate-modal-pop w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-navy">
          {evenement ? "Modifier l'événement" : 'Nouvel événement'}
        </h2>

        <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">Titre</label>
            <input
              name="titre"
              defaultValue={evenement?.titre}
              required
              autoFocus
              placeholder="Ex. Entrevue avec la comptable"
              className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm transition-colors focus:border-navy focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-navy">Client (optionnel)</label>
            <select
              name="client"
              defaultValue={evenement?.client ?? ''}
              className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
            >
              <option value="">Aucun</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.nom_entreprise}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-navy">Type</label>
              <select
                name="type_evenement"
                defaultValue={evenement?.type_evenement ?? 'tache'}
                className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
              >
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-navy">Heure (optionnel)</label>
              <input
                name="heure"
                type="time"
                defaultValue={evenement?.heure ?? heureParDefaut ?? ''}
                className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-navy">Date</label>
            <input
              name="date"
              type="date"
              defaultValue={evenement?.date ?? dateParDefaut}
              required
              className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-navy">Notes / ordre du jour (optionnel)</label>
            <textarea
              name="description"
              defaultValue={evenement?.description}
              rows={6}
              placeholder={'Ex.\n1. Présenter le projet\n2. Discuter du budget\n3. Prochaines étapes'}
              className="w-full resize-y rounded-lg border border-black/25 px-4 py-2 text-sm leading-relaxed transition-colors focus:border-navy focus:outline-none"
            />
          </div>

          {erreur && <p className="text-sm text-red-600">{erreur}</p>}

          <div className="mt-1 flex items-center justify-between gap-3">
            {evenement && onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                className="flex items-center gap-1.5 rounded-full px-3 py-2.5 text-sm font-semibold text-red-600 transition-all hover:bg-red-50 active:scale-95"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-.7 12.1A2 2 0 0 1 14.3 21H9.7a2 2 0 0 1-2-1.9L7 7h10Z"
                  />
                </svg>
                Supprimer
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-black/50 transition-all hover:bg-black/5 active:scale-95"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={enCours}
                className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 hover:shadow-md active:scale-95 disabled:opacity-60 disabled:active:scale-100"
              >
                {enCours ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
