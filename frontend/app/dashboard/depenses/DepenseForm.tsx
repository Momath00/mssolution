'use client';

import { useEffect, useState } from 'react';

import { fetchClient, mediaUrl, type CompteGrandLivre, type Depense } from '@/lib/api';

interface Props {
  depense: Depense | null;
  onDone: () => void;
  onCancel: () => void;
}

export default function DepenseForm({ depense, onDone, onCancel }: Props) {
  const [comptes, setComptes] = useState<CompteGrandLivre[]>([]);
  const [date, setDate] = useState(depense?.date || new Date().toISOString().slice(0, 10));
  const [fournisseur, setFournisseur] = useState(depense?.fournisseur || '');
  const [description, setDescription] = useState(depense?.description || '');
  const [sousTotal, setSousTotal] = useState(depense?.sous_total || '');
  const [tps, setTps] = useState(depense?.tps || '0');
  const [tvq, setTvq] = useState(depense?.tvq || '0');
  const [compteGrandLivre, setCompteGrandLivre] = useState(depense ? String(depense.compte_grand_livre) : '');
  const [apercu, setApercu] = useState<string | null>(mediaUrl(depense?.piece_jointe));
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    fetchClient<CompteGrandLivre[]>('/api/comptes-grand-livre/')
      .then((liste) => setComptes(liste.filter((c) => c.actif)))
      .catch(() => {});
  }, []);

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0];
    if (fichier) setApercu(URL.createObjectURL(fichier));
  }

  const total = (Number(sousTotal) || 0) + (Number(tps) || 0) + (Number(tvq) || 0);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnCours(true);
    setErreur(null);

    const formData = new FormData();
    formData.set('date', date);
    formData.set('fournisseur', fournisseur);
    formData.set('description', description);
    formData.set('sous_total', sousTotal);
    formData.set('tps', tps || '0');
    formData.set('tvq', tvq || '0');
    formData.set('compte_grand_livre', compteGrandLivre);

    const fichier = (e.currentTarget.elements.namedItem('piece_jointe') as HTMLInputElement).files?.[0];
    if (fichier) formData.set('piece_jointe', fichier);

    try {
      if (depense) {
        await fetchClient(`/api/depenses/${depense.id}/`, { method: 'PATCH', body: formData });
      } else {
        await fetchClient('/api/depenses/', { method: 'POST', body: formData });
      }
      onDone();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur inconnue.');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">{depense ? 'Modifier la dépense' : 'Nouvelle dépense'}</h1>

      <form onSubmit={onSubmit} className="mt-6 flex max-w-2xl flex-col gap-4" encType="multipart/form-data">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">Fournisseur</label>
            <input
              value={fournisseur}
              onChange={(e) => setFournisseur(e.target.value)}
              placeholder="Ex. Bureau en gros"
              required
              className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-navy">Compte de grand livre</label>
          <select
            value={compteGrandLivre}
            onChange={(e) => setCompteGrandLivre(e.target.value)}
            required
            className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
          >
            <option value="" disabled>Sélectionner un compte</option>
            {comptes.map((c) => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-navy">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optionnel"
            className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">Sous-total</label>
            <input
              type="number"
              step="0.01"
              value={sousTotal}
              onChange={(e) => setSousTotal(e.target.value)}
              required
              className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">TPS payée</label>
            <input
              type="number"
              step="0.01"
              value={tps}
              onChange={(e) => setTps(e.target.value)}
              className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">TVQ payée</label>
            <input
              type="number"
              step="0.01"
              value={tvq}
              onChange={(e) => setTvq(e.target.value)}
              className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
            />
          </div>
        </div>
        <div className="ml-auto w-64 rounded-lg bg-white p-4 text-sm shadow-sm">
          <div className="flex justify-between"><span>Sous-total</span><span>{(Number(sousTotal) || 0).toFixed(2)} $</span></div>
          <div className="flex justify-between text-black/50"><span>TPS</span><span>{(Number(tps) || 0).toFixed(2)} $</span></div>
          <div className="flex justify-between text-black/50"><span>TVQ</span><span>{(Number(tvq) || 0).toFixed(2)} $</span></div>
          <div className="mt-2 flex justify-between border-t border-black/25 pt-2 font-bold text-navy">
            <span>Total</span><span>{total.toFixed(2)} $</span>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-navy">Photo de la facture / du reçu</label>
          {apercu && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={apercu} alt="Aperçu du reçu" className="mb-2 h-32 w-auto rounded-lg border border-black/10 object-cover" />
          )}
          <input
            name="piece_jointe"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onPhotoChange}
            className="w-full text-sm"
          />
          <p className="mt-1 text-xs text-black/40">
            Prenez la facture en photo directement depuis votre téléphone — elle sera jointe au rapport comptable.
          </p>
        </div>

        {erreur && <p className="text-sm text-red-600">{erreur}</p>}

        <div className="mt-2 flex gap-3">
          <button
            type="submit"
            disabled={enCours}
            className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
          >
            {enCours ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-6 py-3 text-sm font-semibold text-black/50 transition-colors hover:bg-black/5"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}
