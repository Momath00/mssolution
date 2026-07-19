'use client';

import { useState } from 'react';

import { apiUrlClient } from '@/lib/api';
import { afficherToast } from '@/components/Toast';

type Etat = 'idle' | 'envoi' | 'succes' | 'erreur';

export default function SoumissionForm() {
  const [etat, setEtat] = useState<Etat>('idle');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEtat('envoi');
    const form = e.currentTarget;
    const data = {
      nom_entreprise: (form.elements.namedItem('nom_entreprise') as HTMLInputElement).value,
      nom_contact: (form.elements.namedItem('nom_contact') as HTMLInputElement).value,
      courriel: (form.elements.namedItem('courriel') as HTMLInputElement).value,
      telephone: (form.elements.namedItem('telephone') as HTMLInputElement).value,
      message: (form.elements.namedItem('message') as HTMLTextAreaElement).value,
    };

    try {
      const res = await fetch(apiUrlClient('/api/demande-soumission/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      setEtat('succes');
      afficherToast('Votre demande de soumission a été envoyée avec succès !');
      form.reset();
    } catch {
      setEtat('erreur');
      afficherToast('Une erreur est survenue lors de l\'envoi.', 'erreur');
    }
  }

  if (etat === 'succes') {
    return (
      <p className="rounded-lg bg-green-50 p-4 text-sm text-green-700">
        Merci ! Votre demande de soumission a été envoyée, notre équipe vous contactera sous peu.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="nom_entreprise" className="mb-1 block text-sm font-medium text-navy">
          Nom de l&apos;entreprise
        </label>
        <input
          id="nom_entreprise"
          name="nom_entreprise"
          required
          className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="nom_contact" className="mb-1 block text-sm font-medium text-navy">
          Nom du contact
        </label>
        <input
          id="nom_contact"
          name="nom_contact"
          className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="courriel" className="mb-1 block text-sm font-medium text-navy">
            Courriel
          </label>
          <input
            id="courriel"
            name="courriel"
            type="email"
            required
            className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="telephone" className="mb-1 block text-sm font-medium text-navy">
            Téléphone
          </label>
          <input
            id="telephone"
            name="telephone"
            type="tel"
            className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
          />
        </div>
      </div>
      <div>
        <label htmlFor="message" className="mb-1 block text-sm font-medium text-navy">
          Décrivez votre besoin
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
        />
      </div>

      {etat === 'erreur' && (
        <p className="text-sm text-red-600">
          Une erreur est survenue. Merci de réessayer ou de nous écrire directement.
        </p>
      )}

      <button
        type="submit"
        disabled={etat === 'envoi'}
        className="mt-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {etat === 'envoi' ? 'Envoi…' : 'Demander une soumission'}
      </button>
    </form>
  );
}
