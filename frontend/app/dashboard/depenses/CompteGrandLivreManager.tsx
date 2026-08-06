'use client';

import { useEffect, useState } from 'react';

import { fetchClient, type CompteGrandLivre } from '@/lib/api';
import { afficherToast } from '@/components/Toast';

export default function CompteGrandLivreManager() {
  const [comptes, setComptes] = useState<CompteGrandLivre[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enEdition, setEnEdition] = useState<number | null>(null);
  const [nomEdite, setNomEdite] = useState('');
  const [nouveauNom, setNouveauNom] = useState('');
  const [ajoutEnCours, setAjoutEnCours] = useState(false);
  const [majEnCours, setMajEnCours] = useState<number | null>(null);

  function charger() {
    fetchClient<CompteGrandLivre[]>('/api/comptes-grand-livre/').then(setComptes).catch((e) => setErreur(e.message));
  }

  useEffect(charger, []);

  async function ajouter(e: React.FormEvent) {
    e.preventDefault();
    if (!nouveauNom.trim()) return;
    setAjoutEnCours(true);
    try {
      await fetchClient('/api/comptes-grand-livre/', {
        method: 'POST',
        body: JSON.stringify({ nom: nouveauNom.trim(), ordre: comptes.length }),
      });
      setNouveauNom('');
      afficherToast('Compte de grand livre ajouté.');
      charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de l\'ajout.');
    } finally {
      setAjoutEnCours(false);
    }
  }

  async function enregistrerNom(compte: CompteGrandLivre) {
    if (!nomEdite.trim() || nomEdite.trim() === compte.nom) {
      setEnEdition(null);
      return;
    }
    setMajEnCours(compte.id);
    try {
      await fetchClient(`/api/comptes-grand-livre/${compte.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ nom: nomEdite.trim() }),
      });
      setEnEdition(null);
      charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de la mise à jour.');
    } finally {
      setMajEnCours(null);
    }
  }

  async function toggleActif(compte: CompteGrandLivre) {
    setMajEnCours(compte.id);
    try {
      await fetchClient(`/api/comptes-grand-livre/${compte.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ actif: !compte.actif }),
      });
      charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de la mise à jour.');
    } finally {
      setMajEnCours(null);
    }
  }

  return (
    <div>
      <p className="max-w-xl text-sm text-black/50">
        Cette liste alimente le menu déroulant lors de la saisie d&apos;une dépense. Désactivez un compte pour le
        retirer du formulaire sans perdre l&apos;historique des dépenses déjà associées.
      </p>

      {erreur && <p className="mt-4 text-sm text-red-600">{erreur}</p>}

      <div className="mt-6 flex flex-col gap-2">
        {comptes.map((compte) => (
          <div
            key={compte.id}
            className={`flex items-center gap-3 rounded-xl border border-black/5 bg-white p-3 shadow-sm transition-opacity ${
              compte.actif ? '' : 'opacity-50'
            }`}
          >
            {enEdition === compte.id ? (
              <input
                autoFocus
                value={nomEdite}
                onChange={(e) => setNomEdite(e.target.value)}
                onBlur={() => enregistrerNom(compte)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); enregistrerNom(compte); }
                  if (e.key === 'Escape') setEnEdition(null);
                }}
                className="flex-1 rounded-lg border border-navy px-3 py-1.5 text-sm focus:outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => { setEnEdition(compte.id); setNomEdite(compte.nom); }}
                className="flex-1 text-left text-sm font-medium text-navy hover:underline"
              >
                {compte.nom}
              </button>
            )}
            <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-black/50">
              <input
                type="checkbox"
                checked={compte.actif}
                disabled={majEnCours === compte.id}
                onChange={() => toggleActif(compte)}
                className="h-4 w-4 accent-accent"
              />
              Actif
            </label>
          </div>
        ))}
        {comptes.length === 0 && <p className="text-black/50">Aucun compte de grand livre pour le moment.</p>}
      </div>

      <form onSubmit={ajouter} className="mt-4 flex max-w-md gap-2">
        <input
          value={nouveauNom}
          onChange={(e) => setNouveauNom(e.target.value)}
          placeholder="Nouveau compte de grand livre"
          className="flex-1 rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
        />
        <button
          type="submit"
          disabled={ajoutEnCours}
          className="shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
        >
          + Ajouter
        </button>
      </form>
    </div>
  );
}
