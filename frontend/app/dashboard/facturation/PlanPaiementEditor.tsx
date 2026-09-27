'use client';

import { useState } from 'react';

import { fetchClient, type DocumentFacturation } from '@/lib/api';
import {
  ajouterJours,
  ajouterMois,
  aujourdhuiISO,
  depuisCents,
  formaterMontant,
  versCents,
} from '@/lib/argent';
import { afficherToast } from '@/components/Toast';

type Frequence = 'hebdomadaire' | 'deux_semaines' | 'mensuelle' | 'deux_mois' | 'trimestrielle' | 'personnalisee';

const FREQUENCES: Record<Frequence, string> = {
  hebdomadaire: 'Chaque semaine',
  deux_semaines: 'Aux 2 semaines',
  mensuelle: 'Chaque mois',
  deux_mois: 'Aux 2 mois',
  trimestrielle: 'Aux 3 mois',
  personnalisee: 'Aux X jours (au choix)',
};

function dateSuivante(iso: string, frequence: Frequence, rang: number, joursPerso: number): string {
  switch (frequence) {
    case 'hebdomadaire':
      return ajouterJours(iso, 7 * rang);
    case 'deux_semaines':
      return ajouterJours(iso, 14 * rang);
    case 'mensuelle':
      return ajouterMois(iso, rang);
    case 'deux_mois':
      return ajouterMois(iso, 2 * rang);
    case 'trimestrielle':
      return ajouterMois(iso, 3 * rang);
    default:
      return ajouterJours(iso, Math.max(1, joursPerso) * rang);
  }
}

interface LigneVersement {
  date: string;
  montant: string;
  note: string;
}

const champ = 'w-full rounded-lg border border-black/25 px-3 py-2 text-sm focus:border-navy focus:outline-none';
const etiquette = 'mb-1 block text-xs font-medium text-navy';

interface Props {
  document: DocumentFacturation;
  /** Dépôt proposé par défaut dans le générateur (ex. montant déjà payé sur une facture). */
  depotParDefaut?: { montant: string; date: string };
  onSaved: (document: DocumentFacturation) => void;
  onCancel: () => void;
}

/** Générateur + édition ligne par ligne d'un plan de paiement (facture ou soumission). */
export default function PlanPaiementEditor({ document: doc, depotParDefaut, onSaved, onCancel }: Props) {
  const totalCents = versCents(doc.total);
  const [lignes, setLignes] = useState<LigneVersement[]>(
    doc.echeances.map((e) => ({ date: e.date, montant: Number(e.montant).toFixed(2), note: e.note })),
  );
  const [depot, setDepot] = useState(depotParDefaut?.montant ?? '');
  const [dateDepot, setDateDepot] = useState(depotParDefaut?.date ?? aujourdhuiISO());
  const [nombre, setNombre] = useState('3');
  const [frequence, setFrequence] = useState<Frequence>('mensuelle');
  const [joursPerso, setJoursPerso] = useState('45');
  const [premiereDate, setPremiereDate] = useState(ajouterMois(aujourdhuiISO(), 1));
  const [sauvegarde, setSauvegarde] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  function generer() {
    const n = Math.max(1, Math.min(120, Number(nombre) || 1));
    const depotCents = Math.max(0, Math.min(versCents(depot), totalCents));
    const aRepartir = totalCents - depotCents;
    const base = Math.floor(aRepartir / n);
    const nouvelles: LigneVersement[] = [];
    if (depotCents > 0) {
      nouvelles.push({ date: dateDepot, montant: depuisCents(depotCents), note: 'Dépôt' });
    }
    for (let i = 0; i < n; i++) {
      // Le dernier versement absorbe les cents restants pour que la somme tombe juste.
      const cents = i === n - 1 ? aRepartir - base * (n - 1) : base;
      if (cents <= 0) continue;
      nouvelles.push({ date: dateSuivante(premiereDate, frequence, i, Number(joursPerso)), montant: depuisCents(cents), note: '' });
    }
    setLignes(nouvelles);
  }

  function majLigne(index: number, champModifie: keyof LigneVersement, valeur: string) {
    setLignes((prev) => prev.map((l, i) => (i === index ? { ...l, [champModifie]: valeur } : l)));
  }

  const sommeCents = lignes.reduce((acc, l) => acc + versCents(l.montant), 0);
  const ecartCents = totalCents - sommeCents;

  function ajusterDernier() {
    setLignes((prev) =>
      prev.map((l, i) => (i === prev.length - 1 ? { ...l, montant: depuisCents(versCents(l.montant) + ecartCents) } : l)),
    );
  }

  async function enregistrer() {
    setSauvegarde(true);
    setErreur(null);
    try {
      const maj = await fetchClient<DocumentFacturation>(`/api/documents/${doc.id}/echeancier/`, {
        method: 'PUT',
        body: JSON.stringify({ versements: lignes }),
      });
      afficherToast(`Plan de ${lignes.length} versement${lignes.length > 1 ? 's' : ''} enregistré.`);
      onSaved(maj);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de l’enregistrement du plan.');
    } finally {
      setSauvegarde(false);
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-5">
      {/* Générateur */}
      <div className="rounded-lg bg-black/[0.02] p-4">
        <p className="text-sm font-semibold text-navy">Générer les versements automatiquement</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={etiquette}>
              {doc.type_document === 'soumission' ? 'Dépôt à la signature (optionnel)' : 'Dépôt / montant déjà payé (optionnel)'}
            </label>
            <input type="number" step="0.01" min="0" value={depot} onChange={(e) => setDepot(e.target.value)} className={champ} />
          </div>
          <div>
            <label className={etiquette}>Date du dépôt</label>
            <input type="date" value={dateDepot} onChange={(e) => setDateDepot(e.target.value)} className={champ} />
          </div>
          <div>
            <label className={etiquette}>Nombre de versements (pour le reste)</label>
            <input type="number" min="1" max="120" value={nombre} onChange={(e) => setNombre(e.target.value)} className={champ} />
          </div>
          <div>
            <label className={etiquette}>Fréquence</label>
            <select value={frequence} onChange={(e) => setFrequence(e.target.value as Frequence)} className={champ}>
              {Object.entries(FREQUENCES).map(([valeur, label]) => (
                <option key={valeur} value={valeur}>{label}</option>
              ))}
            </select>
          </div>
          {frequence === 'personnalisee' && (
            <div>
              <label className={etiquette}>Nombre de jours entre les versements</label>
              <input type="number" min="1" value={joursPerso} onChange={(e) => setJoursPerso(e.target.value)} className={champ} />
            </div>
          )}
          <div>
            <label className={etiquette}>Date du 1er versement</label>
            <input type="date" value={premiereDate} onChange={(e) => setPremiereDate(e.target.value)} className={champ} />
          </div>
        </div>
        <button
          type="button"
          onClick={generer}
          className="mt-3 rounded-full border border-navy px-4 py-1.5 text-sm font-semibold text-navy hover:bg-navy hover:text-white"
        >
          Générer
        </button>
        <p className="mt-2 text-xs text-black/40">
          Tu peux ensuite modifier chaque date et chaque montant à la main ci-dessous.
        </p>
      </div>

      {/* Versements modifiables */}
      <div>
        <p className="mb-2 text-sm font-semibold text-navy">Versements</p>
        {lignes.length === 0 && (
          <p className="text-sm text-black/40">Aucun versement — génère-les ou ajoute-les un par un.</p>
        )}
        <div className="overflow-x-auto">
          <div className="flex min-w-[480px] flex-col gap-2">
            {lignes.map((l, i) => (
              <div key={i} className="grid grid-cols-[28px_150px_130px_1fr_28px] items-center gap-2">
                <span className="text-xs text-black/40">{i + 1}.</span>
                <input type="date" value={l.date} onChange={(e) => majLigne(i, 'date', e.target.value)} required className={champ} />
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={l.montant}
                  onChange={(e) => majLigne(i, 'montant', e.target.value)}
                  className={champ}
                />
                <input
                  placeholder="Note (optionnel)"
                  value={l.note}
                  maxLength={200}
                  onChange={(e) => majLigne(i, 'note', e.target.value)}
                  className={champ}
                />
                <button
                  type="button"
                  onClick={() => setLignes((prev) => prev.filter((_, j) => j !== i))}
                  className="text-black/30 hover:text-red-600"
                  aria-label="Retirer le versement"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            setLignes((prev) => [
              ...prev,
              {
                date: prev.length ? ajouterMois(prev[prev.length - 1].date, 1) : aujourdhuiISO(),
                montant: depuisCents(Math.max(0, ecartCents)),
                note: '',
              },
            ])
          }
          className="mt-2 text-sm font-semibold text-accent hover:underline"
        >
          + Ajouter un versement
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-lg bg-black/[0.02] p-3 text-sm">
        <span>Total : <strong>{formaterMontant(doc.total)}</strong></span>
        <span>Somme des versements : <strong>{formaterMontant(depuisCents(sommeCents))}</strong></span>
        {ecartCents !== 0 ? (
          <>
            <span className="font-semibold text-red-600">Écart : {formaterMontant(depuisCents(ecartCents))}</span>
            {lignes.length > 0 && (
              <button type="button" onClick={ajusterDernier} className="text-xs font-semibold text-accent hover:underline">
                Ajuster le dernier versement
              </button>
            )}
          </>
        ) : (
          lignes.length > 0 && <span className="font-semibold text-green-600">✓ La somme correspond au total</span>
        )}
      </div>

      {erreur && <p className="text-sm text-red-600">{erreur}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={enregistrer}
          disabled={sauvegarde || ecartCents !== 0 || lignes.length === 0}
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {sauvegarde ? 'Enregistrement…' : 'Enregistrer le plan'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-5 py-2.5 text-sm font-semibold text-black/50 hover:bg-black/5"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
