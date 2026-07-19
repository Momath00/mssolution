'use client';

import { useEffect, useState } from 'react';

import { fetchClient, type ClientEntreprise, type DocumentFacturation, type LigneDocument } from '@/lib/api';

const TPS_RATE = 0.05;
const TVQ_RATE = 0.09975;

interface Props {
  document: DocumentFacturation | null;
  onDone: () => void;
  onCancel: () => void;
}

function ligneVide(): LigneDocument {
  return { description: '', quantite: '1', prix_unitaire: '0' };
}

export default function DocumentForm({ document, onDone, onCancel }: Props) {
  const [clients, setClients] = useState<ClientEntreprise[]>([]);
  const [typeDocument, setTypeDocument] = useState(document?.type_document || 'soumission');
  const [clientId, setClientId] = useState<string>(document ? String(document.client) : '');
  const [dateEcheance, setDateEcheance] = useState(document?.date_echeance || '');
  const [lignes, setLignes] = useState<LigneDocument[]>(document?.lignes.length ? document.lignes : [ligneVide()]);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    fetchClient<ClientEntreprise[]>('/api/clients/').then(setClients).catch(() => {});
  }, []);

  function majLigne(index: number, champ: keyof LigneDocument, valeur: string) {
    setLignes((prev) => prev.map((l, i) => (i === index ? { ...l, [champ]: valeur } : l)));
  }

  function ajouterLigne() {
    setLignes((prev) => [...prev, ligneVide()]);
  }

  function retirerLigne(index: number) {
    setLignes((prev) => prev.filter((_, i) => i !== index));
  }

  const sousTotal = lignes.reduce((acc, l) => acc + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0), 0);
  const tps = sousTotal * TPS_RATE;
  const tvq = sousTotal * TVQ_RATE;
  const total = sousTotal + tps + tvq;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnCours(true);
    setErreur(null);

    const payload = {
      type_document: typeDocument,
      client: Number(clientId),
      date_echeance: dateEcheance || null,
      lignes: lignes.map((l) => ({
        description: l.description,
        quantite: l.quantite,
        prix_unitaire: l.prix_unitaire,
      })),
    };

    try {
      if (document) {
        await fetchClient(`/api/documents/${document.id}/`, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        await fetchClient('/api/documents/', { method: 'POST', body: JSON.stringify(payload) });
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">{document ? 'Modifier le document' : 'Nouveau document'}</h1>
        {document && (
          <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-black/50">
            N° {document.numero}
          </span>
        )}
      </div>
      {!document && (
        <p className="mt-1 text-xs text-black/40">Le numéro est généré automatiquement à l&apos;enregistrement.</p>
      )}

      <form onSubmit={onSubmit} className="mt-6 flex max-w-3xl flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">Type</label>
            <select
              value={typeDocument}
              onChange={(e) => setTypeDocument(e.target.value as 'soumission' | 'facture')}
              className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
            >
              <option value="soumission">Soumission</option>
              <option value="facture">Facture</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">Échéance</label>
            <input
              type="date"
              value={dateEcheance || ''}
              onChange={(e) => setDateEcheance(e.target.value)}
              className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-navy">Client</label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
            className="w-full rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
          >
            <option value="" disabled>Sélectionner un client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.nom_entreprise}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-navy">Lignes</label>
          <div className="flex flex-col gap-2">
            {lignes.map((ligne, i) => (
              <div key={i} className="grid grid-cols-[1fr_90px_110px_110px_28px] items-center gap-2">
                <input
                  placeholder="Description"
                  value={ligne.description}
                  onChange={(e) => majLigne(i, 'description', e.target.value)}
                  required
                  className="rounded-lg border border-black/25 px-3 py-2 text-sm focus:border-navy focus:outline-none"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Qté"
                  value={ligne.quantite}
                  onChange={(e) => majLigne(i, 'quantite', e.target.value)}
                  className="rounded-lg border border-black/25 px-3 py-2 text-sm focus:border-navy focus:outline-none"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Prix unit."
                  value={ligne.prix_unitaire}
                  onChange={(e) => majLigne(i, 'prix_unitaire', e.target.value)}
                  className="rounded-lg border border-black/25 px-3 py-2 text-sm focus:border-navy focus:outline-none"
                />
                <p className="text-right text-sm text-black/60">
                  {((Number(ligne.quantite) || 0) * (Number(ligne.prix_unitaire) || 0)).toFixed(2)} $
                </p>
                <button
                  type="button"
                  onClick={() => retirerLigne(i)}
                  className="text-black/30 hover:text-red-600"
                  aria-label="Retirer la ligne"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={ajouterLigne}
            className="mt-2 text-sm font-semibold text-accent hover:underline"
          >
            + Ajouter une ligne
          </button>
        </div>

        <div className="ml-auto w-64 rounded-lg bg-white p-4 text-sm shadow-sm">
          <div className="flex justify-between"><span>Sous-total</span><span>{sousTotal.toFixed(2)} $</span></div>
          <div className="flex justify-between text-black/50"><span>TPS (5%)</span><span>{tps.toFixed(2)} $</span></div>
          <div className="flex justify-between text-black/50"><span>TVQ (9,975%)</span><span>{tvq.toFixed(2)} $</span></div>
          <div className="mt-2 flex justify-between border-t border-black/25 pt-2 font-bold text-navy">
            <span>Total</span><span>{total.toFixed(2)} $</span>
          </div>
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
