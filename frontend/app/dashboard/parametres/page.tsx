'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

import { fetchClient, mediaUrl, type Coordonnees } from '@/lib/api';
import { afficherToast } from '@/components/Toast';

export default function ParametresPage() {
  const [coordonnees, setCoordonnees] = useState<Coordonnees | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    fetchClient<Coordonnees>('/api/coordonnees/').then(setCoordonnees).catch((e) => setErreur(e.message));
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnCours(true);
    setErreur(null);
    const form = e.currentTarget;
    const formData = new FormData();
    formData.set('nom_entreprise', (form.elements.namedItem('nom_entreprise') as HTMLInputElement).value);
    formData.set('courriel', (form.elements.namedItem('courriel') as HTMLInputElement).value);
    formData.set('telephone', (form.elements.namedItem('telephone') as HTMLInputElement).value);
    formData.set('adresse', (form.elements.namedItem('adresse') as HTMLTextAreaElement).value);
    formData.set('numero_tps', (form.elements.namedItem('numero_tps') as HTMLInputElement).value);
    formData.set('numero_tvq', (form.elements.namedItem('numero_tvq') as HTMLInputElement).value);

    const fichier = (form.elements.namedItem('logo') as HTMLInputElement).files?.[0];
    if (fichier) formData.set('logo', fichier);

    try {
      const maj = await fetchClient<Coordonnees>('/api/coordonnees/', { method: 'PUT', body: formData });
      setCoordonnees(maj);
      afficherToast('Paramètres enregistrés avec succès.');
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.');
    } finally {
      setEnCours(false);
    }
  }

  if (!coordonnees) return <p className="text-black/50">Chargement…</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Paramètres</h1>
      <p className="mt-1 max-w-xl text-sm text-black/50">
        Ces informations apparaissent dans le pied de page du site public et sur vos factures/soumissions.
        Le logo de facturation est propre à cette installation — c&apos;est à vous de le téléverser ci-dessous
        (aucun logo n&apos;est codé en dur).
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex max-w-xl flex-col gap-4" encType="multipart/form-data">
        <div>
          <label className="mb-1 block text-sm font-medium text-navy">Nom de l&apos;entreprise</label>
          <input
            name="nom_entreprise"
            defaultValue={coordonnees.nom_entreprise}
            required
            className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">Courriel</label>
            <input
              name="courriel"
              type="email"
              defaultValue={coordonnees.courriel}
              required
              className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">Téléphone</label>
            <input
              name="telephone"
              defaultValue={coordonnees.telephone}
              required
              className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-navy">Adresse</label>
          <textarea
            name="adresse"
            defaultValue={coordonnees.adresse}
            rows={2}
            className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">N° d&apos;inscription TPS/TVH</label>
            <input
              name="numero_tps"
              defaultValue={coordonnees.numero_tps}
              className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">N° d&apos;enregistrement TVQ</label>
            <input
              name="numero_tvq"
              defaultValue={coordonnees.numero_tvq}
              className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-navy">Logo affiché sur les factures</label>
          {coordonnees.logo && (
            <div className="relative mb-2 h-16 w-40">
              <Image src={mediaUrl(coordonnees.logo) || coordonnees.logo} alt="Logo actuel" fill unoptimized className="object-contain" />
            </div>
          )}
          <input name="logo" type="file" accept="image/*" className="w-full text-sm" />
          <p className="mt-1 text-xs text-black/40">
            Si aucun logo n&apos;est téléversé, le nom de l&apos;entreprise s&apos;affiche en texte sur les documents.
          </p>
        </div>

        {erreur && <p className="text-sm text-red-600">{erreur}</p>}

        <button
          type="submit"
          disabled={enCours}
          className="mt-2 w-fit rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>
    </div>
  );
}
