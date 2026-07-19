'use client';

import Image from 'next/image';
import { useState } from 'react';

import { fetchClient, mediaUrl, type Realisation } from '@/lib/api';

interface Props {
  realisation: Realisation | null;
  onDone: () => void;
  onCancel: () => void;
}

export default function RealisationForm({ realisation, onDone, onCancel }: Props) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [apercu, setApercu] = useState<string | null>(
    realisation?.image ? mediaUrl(realisation.image) : null,
  );

  function onFichierChange(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0];
    setApercu(fichier ? URL.createObjectURL(fichier) : null);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnCours(true);
    setErreur(null);
    const form = e.currentTarget;
    const formData = new FormData();
    formData.set('titre', (form.elements.namedItem('titre') as HTMLInputElement).value);
    formData.set('description', (form.elements.namedItem('description') as HTMLTextAreaElement).value);
    formData.set('client', (form.elements.namedItem('client') as HTMLInputElement).value);
    formData.set('secteur', (form.elements.namedItem('secteur') as HTMLInputElement).value);
    formData.set('lien_site', (form.elements.namedItem('lien_site') as HTMLInputElement).value);
    formData.set('statut', (form.elements.namedItem('statut') as HTMLSelectElement).value);

    const fichier = (form.elements.namedItem('image') as HTMLInputElement).files?.[0];
    if (fichier) formData.set('image', fichier);

    try {
      if (realisation) {
        await fetchClient(`/api/realisations/${realisation.id}/`, { method: 'PATCH', body: formData });
      } else {
        if (!fichier) throw new Error('Un logo est requis.');
        await fetchClient('/api/realisations/', { method: 'POST', body: formData });
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
      <h1 className="text-2xl font-bold text-navy">
        {realisation ? 'Modifier la réalisation' : 'Nouvelle réalisation'}
      </h1>

      <form onSubmit={onSubmit} className="mt-6 flex max-w-xl flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-navy">Titre</label>
          <input
            name="titre"
            defaultValue={realisation?.titre}
            required
            className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-navy">Description</label>
          <textarea
            name="description"
            defaultValue={realisation?.description}
            required
            rows={4}
            className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">Client</label>
            <input
              name="client"
              defaultValue={realisation?.client}
              required
              className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">Secteur</label>
            <input
              name="secteur"
              defaultValue={realisation?.secteur}
              className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-navy">Lien vers le site</label>
          <input
            name="lien_site"
            type="url"
            defaultValue={realisation?.lien_site}
            className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-navy">
            Logo de l&apos;entreprise cliente {realisation && '(laisser vide pour conserver le logo actuel)'}
          </label>
          <div className="flex items-center gap-4">
            <div className="relative flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-black/10 bg-white">
              {apercu ? (
                <Image src={apercu} alt="Aperçu du logo" fill unoptimized className="object-contain p-2" />
              ) : (
                <span className="text-xs text-black/30">Aucun logo</span>
              )}
            </div>
            <input name="image" type="file" accept="image/*" onChange={onFichierChange} className="text-sm" />
          </div>
          <p className="mt-1 text-xs text-black/40">
            Utilise le logo de l&apos;entreprise cliente (idéalement fond transparent) plutôt qu&apos;une capture d&apos;écran.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-navy">Statut</label>
          <select
            name="statut"
            defaultValue={realisation?.statut || 'brouillon'}
            className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
          >
            <option value="brouillon">Brouillon</option>
            <option value="publie">Publié</option>
          </select>
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
