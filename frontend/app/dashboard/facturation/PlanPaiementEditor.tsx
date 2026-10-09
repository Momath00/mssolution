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
import { ICONES, Icone } from '@/components/Icone';

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

const champ =
  'w-full rounded-xl border border-black/20 bg-white px-3 py-2 text-sm text-navy shadow-sm focus:border-navy focus:outline-none focus:ring-4 focus:ring-navy/10';
const etiquette = 'mb-1 block text-xs font-semibold text-black/65';

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

  const progression = totalCents > 0 ? Math.min((sommeCents / totalCents) * 100, 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Générateur */}
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <Icone d={ICONES.calendrier} />
          </span>
          <div>
            <p className="text-sm font-bold text-navy">Générer les versements automatiquement</p>
            <p className="text-xs text-black/55">Tu peux ensuite modifier chaque date et chaque montant à la main.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={etiquette}>
              {doc.type_document === 'soumission' ? 'Dépôt à la signature (optionnel)' : 'Dépôt / montant déjà payé (optionnel)'}
            </label>
            <div className="relative">
              <input
                type="number" step="0.01" min="0" value={depot} placeholder="0,00"
                onChange={(e) => setDepot(e.target.value)} className={`${champ} pr-8`}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-black/40">$</span>
            </div>
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
          className="mt-4 flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-indigo-700 hover:shadow-md"
        >
          <Icone d={ICONES.calendrier} />
          Générer les versements
        </button>
      </div>

      {/* Versements modifiables */}
      <div className="overflow-hidden rounded-2xl border border-black/15 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-black/10 bg-black/[0.02] px-4 py-3">
          <p className="text-sm font-bold text-navy">
            Versements{' '}
            <span className="ml-1 rounded-full bg-black/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-black/70">
              {lignes.length}
            </span>
          </p>
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
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-accent transition hover:bg-accent/10"
          >
            <Icone d={ICONES.plus} className="h-3.5 w-3.5" />
            Ajouter un versement
          </button>
        </div>

        {lignes.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-black/50">
            Aucun versement — génère-les ci-dessus ou ajoute-les un par un.
          </p>
        )}

        {lignes.length > 0 && (
          <div className="overflow-x-auto">
            <div className="min-w-[560px]">
              <div className="grid grid-cols-[36px_160px_150px_1fr_36px] gap-2 px-4 pt-3 text-[11px] font-semibold uppercase tracking-wide text-black/45">
                <span>#</span>
                <span>Date</span>
                <span>Montant</span>
                <span>Note</span>
                <span />
              </div>
              <div className="flex flex-col gap-2 p-4 pt-2">
                {lignes.map((l, i) => (
                  <div key={i} className="grid grid-cols-[36px_160px_150px_1fr_36px] items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700">
                      {i + 1}
                    </span>
                    <input type="date" value={l.date} onChange={(e) => majLigne(i, 'date', e.target.value)} required className={champ} />
                    <div className="relative">
                      <input
                        type="number" step="0.01" min="0.01" value={l.montant}
                        onChange={(e) => majLigne(i, 'montant', e.target.value)} className={`${champ} pr-8 text-right tabular-nums`}
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-black/40">$</span>
                    </div>
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
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-black/35 transition hover:bg-red-50 hover:text-red-600"
                      aria-label="Retirer le versement"
                      title="Retirer le versement"
                    >
                      <Icone d={ICONES.supprimer} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Contrôle de la somme */}
        <div className="border-t border-black/10 bg-black/[0.02] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              <span className="text-black/60">
                Total <strong className="tabular-nums text-navy">{formaterMontant(doc.total)}</strong>
              </span>
              <span className="text-black/60">
                Planifié <strong className="tabular-nums text-navy">{formaterMontant(depuisCents(sommeCents))}</strong>
              </span>
            </div>
            {ecartCents !== 0 ? (
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200">
                  Écart : {formaterMontant(depuisCents(ecartCents))}
                </span>
                {lignes.length > 0 && (
                  <button type="button" onClick={ajusterDernier} className="text-xs font-semibold text-accent hover:underline">
                    Ajuster le dernier versement
                  </button>
                )}
              </div>
            ) : (
              lignes.length > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-200">
                  <Icone d={ICONES.succes} className="h-3.5 w-3.5" />
                  La somme correspond au total
                </span>
              )
            )}
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-black/10">
            <div
              className={`h-full rounded-full transition-all ${ecartCents === 0 ? 'bg-green-500' : ecartCents < 0 ? 'bg-red-500' : 'bg-indigo-500'}`}
              style={{ width: `${ecartCents < 0 ? 100 : progression}%` }}
            />
          </div>
        </div>
      </div>

      {erreur && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={enregistrer}
          disabled={sauvegarde || ecartCents !== 0 || lignes.length === 0}
          className="flex items-center gap-1.5 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-accent/30 transition hover:-translate-y-px hover:shadow-md disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
        >
          <Icone d={ICONES.succes} />
          {sauvegarde ? 'Enregistrement…' : 'Enregistrer le plan'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-black/15 bg-white px-5 py-2.5 text-sm font-semibold text-black/60 transition hover:border-navy/40 hover:text-navy"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
