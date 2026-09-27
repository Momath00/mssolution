'use client';

import { useRef, useState } from 'react';

import {
  apiUrlClient,
  fetchClient,
  MODE_PAIEMENT_LABELS,
  type DocumentFacturation,
  type ModePaiement,
  type Paiement,
  type StatutEcheance,
} from '@/lib/api';
import {
  aujourdhuiISO,
  depuisCents,
  formaterDate,
  formaterMontant,
  versCents,
} from '@/lib/argent';
import { afficherToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';

import PlanPaiementEditor from './PlanPaiementEditor';

interface Props {
  document: DocumentFacturation;
  onChange: (document: DocumentFacturation) => void;
  onRetour: () => void;
}

const ETAT_ECHEANCE: Record<StatutEcheance, { label: string; badge: string }> = {
  payee: { label: 'Payé', badge: 'bg-green-100 text-green-700' },
  partielle: { label: 'Partiel', badge: 'bg-amber-100 text-amber-700' },
  en_retard: { label: 'En retard', badge: 'bg-red-100 text-red-700' },
  a_venir: { label: 'À venir', badge: 'bg-black/5 text-black/50' },
};

// Icônes au trait (même style que le reste du tableau de bord), couleur héritée du texte.
const TRACES = {
  trombone:
    'm18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13',
  photo:
    'm2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Z',
  document:
    'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
  validation: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
};

function Icone({ nom, className = 'h-3.5 w-3.5' }: { nom: keyof typeof TRACES; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={`shrink-0 ${className}`} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={TRACES[nom]} />
    </svg>
  );
}

const TYPES_PREUVE = 'image/*,application/pdf,.heic,.heif';
const TAILLE_MAX_PREUVE = 10 * 1024 * 1024;

const champ = 'w-full rounded-lg border border-black/25 px-3 py-2 text-sm focus:border-navy focus:outline-none';
const etiquette = 'mb-1 block text-xs font-medium text-navy';

export default function PaiementsPanel({ document: doc, onChange, onRetour }: Props) {
  const totalCents = versCents(doc.total);
  const payeCents = versCents(doc.montant_paye);
  const soldeCents = versCents(doc.solde_du);
  const enRetardCents = versCents(doc.montant_en_retard);
  const progression = totalCents > 0 ? Math.min(100, (payeCents / totalCents) * 100) : 0;

  const [erreur, setErreur] = useState<string | null>(null);

  // --- Enregistrer un paiement ------------------------------------------------------
  const montantSuggere = doc.prochaine_echeance?.montant ?? doc.solde_du;
  const [montant, setMontant] = useState(soldeCents > 0 ? Number(montantSuggere).toFixed(2) : '');
  const [datePaiement, setDatePaiement] = useState(aujourdhuiISO());
  const [mode, setMode] = useState<ModePaiement>('virement');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [envoyerRecu, setEnvoyerRecu] = useState(true);
  const [preuve, setPreuve] = useState<File | null>(null);
  const champPreuve = useRef<HTMLInputElement>(null);

  function choisirPreuve(fichier: File | null) {
    if (fichier && fichier.size > TAILLE_MAX_PREUVE) {
      setErreur('La preuve ne doit pas dépasser 10 Mo.');
      if (champPreuve.current) champPreuve.current.value = '';
      return;
    }
    setErreur(null);
    setPreuve(fichier);
  }
  const [enregistrement, setEnregistrement] = useState(false);

  function corpsPaiement(): string | FormData {
    const champs = { montant, date: datePaiement, mode, reference, note };
    if (!preuve) return JSON.stringify({ ...champs, envoyer_recu: envoyerRecu });
    // Avec une photo/PDF, l'envoi passe en multipart.
    const formData = new FormData();
    Object.entries(champs).forEach(([cle, valeur]) => formData.set(cle, valeur));
    formData.set('envoyer_recu', envoyerRecu ? 'true' : 'false');
    formData.set('preuve', preuve);
    return formData;
  }

  // --- Preuve ajoutée, remplacée ou retirée après coup --------------------------------
  const [preuveEnCours, setPreuveEnCours] = useState<number | null>(null);

  async function changerPreuve(paiement: Paiement, fichier: File | null) {
    if (fichier && fichier.size > TAILLE_MAX_PREUVE) {
      setErreur('La preuve ne doit pas dépasser 10 Mo.');
      return;
    }
    setPreuveEnCours(paiement.id);
    setErreur(null);
    try {
      let init: RequestInit = { method: 'DELETE' };
      if (fichier) {
        const formData = new FormData();
        formData.set('preuve', fichier);
        init = { method: 'POST', body: formData };
      }
      const maj = await fetchClient<DocumentFacturation>(urlPreuve(paiement), init);
      onChange(maj);
      afficherToast(fichier ? 'Preuve de paiement enregistrée.' : 'Preuve retirée.');
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de l’envoi de la preuve.');
    } finally {
      setPreuveEnCours(null);
    }
  }

  function urlPreuve(paiement: Paiement) {
    return `/api/documents/${doc.id}/paiements/${paiement.id}/preuve/`;
  }

  async function enregistrerPaiement(e: React.FormEvent) {
    e.preventDefault();
    setEnregistrement(true);
    setErreur(null);
    try {
      const reponse = await fetchClient<{ document: DocumentFacturation; recu_envoye: boolean }>(
        `/api/documents/${doc.id}/paiements/`,
        {
          method: 'POST',
          body: corpsPaiement(),
        },
      );
      const maj = reponse.document;
      onChange(maj);
      setReference('');
      setNote('');
      setPreuve(null);
      if (champPreuve.current) champPreuve.current.value = '';
      const prochain = maj.prochaine_echeance?.montant ?? maj.solde_du;
      setMontant(versCents(maj.solde_du) > 0 ? Number(prochain).toFixed(2) : '');
      afficherToast(
        versCents(maj.solde_du) === 0
          ? `${formaterMontant(montant)} reçu — ${doc.numero} est entièrement payée.`
          : `${formaterMontant(montant)} reçu — il reste ${formaterMontant(maj.solde_du)} à payer.`,
      );
      if (envoyerRecu && !reponse.recu_envoye) {
        afficherToast('Paiement enregistré, mais le reçu n’a pas pu être envoyé par courriel.', 'erreur');
      }
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de l’enregistrement du paiement.');
    } finally {
      setEnregistrement(false);
    }
  }

  // --- Supprimer un paiement --------------------------------------------------------
  const [aSupprimer, setASupprimer] = useState<Paiement | null>(null);
  const [suppression, setSuppression] = useState(false);

  async function supprimerPaiement() {
    if (!aSupprimer) return;
    setSuppression(true);
    try {
      const maj = await fetchClient<DocumentFacturation>(
        `/api/documents/${doc.id}/paiements/${aSupprimer.id}/`,
        { method: 'DELETE' },
      );
      onChange(maj);
      afficherToast(`Paiement de ${formaterMontant(aSupprimer.montant)} retiré.`);
      setASupprimer(null);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de la suppression.');
    } finally {
      setSuppression(false);
    }
  }

  // --- Rappel -------------------------------------------------------------------------
  const [rappelEnCours, setRappelEnCours] = useState(false);

  async function envoyerRappel() {
    setRappelEnCours(true);
    setErreur(null);
    try {
      const maj = await fetchClient<DocumentFacturation>(`/api/documents/${doc.id}/rappel/`, { method: 'POST' });
      onChange(maj);
      afficherToast(`Rappel de paiement envoyé à ${doc.client_nom}.`);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de l’envoi du rappel.');
    } finally {
      setRappelEnCours(false);
    }
  }

  // --- Plan de paiement ------------------------------------------------------------
  const [editionPlan, setEditionPlan] = useState(false);
  const [retraitPlan, setRetraitPlan] = useState(false);

  async function retirerPlan() {
    setRetraitPlan(true);
    setErreur(null);
    try {
      const maj = await fetchClient<DocumentFacturation>(`/api/documents/${doc.id}/echeancier/`, {
        method: 'PUT',
        body: JSON.stringify({ versements: [] }),
      });
      onChange(maj);
      afficherToast('Plan de paiement retiré.');
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors du retrait du plan.');
    } finally {
      setRetraitPlan(false);
    }
  }

  const estPayee = soldeCents === 0 && totalCents > 0;

  return (
    <div>
      <button onClick={onRetour} className="text-sm font-semibold text-black/50 hover:text-navy">
        ← Retour aux factures
      </button>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Paiements — {doc.numero}</h1>
          <p className="text-sm text-black/50">{doc.client_nom}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href={apiUrlClient(`/api/documents/${doc.id}/pdf/`)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-navy hover:bg-black/5"
          >
            Voir le PDF
          </a>
          {!estPayee && doc.statut !== 'brouillon' && (
            <button
              onClick={envoyerRappel}
              disabled={rappelEnCours}
              className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {rappelEnCours ? 'Envoi…' : 'Envoyer un rappel'}
            </button>
          )}
        </div>
      </div>
      {doc.date_derniere_relance && (
        <p className="mt-1 text-xs text-black/40" suppressHydrationWarning>
          Dernier rappel envoyé le {new Date(doc.date_derniere_relance).toLocaleDateString('fr-CA')}
        </p>
      )}

      {erreur && <p className="mt-4 text-sm text-red-600">{erreur}</p>}

      {/* Résumé */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
          <p className="text-xs text-black/50">Total de la facture</p>
          <p className="mt-1 text-xl font-bold text-navy">{formaterMontant(doc.total)}</p>
        </div>
        <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
          <p className="text-xs text-black/50">Payé</p>
          <p className="mt-1 text-xl font-bold text-green-600">{formaterMontant(doc.montant_paye)}</p>
        </div>
        <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
          <p className="text-xs text-black/50">Solde dû</p>
          <p className={`mt-1 text-xl font-bold ${estPayee ? 'text-green-600' : 'text-accent'}`}>
            {formaterMontant(doc.solde_du)}
          </p>
        </div>
        <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
          <p className="text-xs text-black/50">{enRetardCents > 0 ? 'En retard' : 'Prochain versement'}</p>
          {enRetardCents > 0 ? (
            <p className="mt-1 text-xl font-bold text-red-600">
              {formaterMontant(doc.montant_en_retard)}
              <span className="ml-1 text-xs font-semibold">({doc.jours_retard} j)</span>
            </p>
          ) : doc.prochaine_echeance ? (
            <p className="mt-1 text-sm font-semibold text-navy">
              {formaterMontant(doc.prochaine_echeance.montant)}
              <span className="block text-xs font-normal text-black/50">le {formaterDate(doc.prochaine_echeance.date)}</span>
            </p>
          ) : (
            <p className="mt-1 text-xl font-bold text-black/30">—</p>
          )}
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/5">
        <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${progression}%` }} />
      </div>
      <p className="mt-1 text-right text-xs text-black/40">{progression.toFixed(0)} % payé</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Enregistrer un paiement */}
        <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-navy">Enregistrer un paiement reçu</h2>
          {estPayee ? (
            <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-green-700">
              <Icone nom="validation" className="h-5 w-5" />
              Cette facture est entièrement payée.
            </p>
          ) : (
            <form onSubmit={enregistrerPaiement} className="mt-4 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={etiquette}>Montant reçu ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={depuisCents(soldeCents)}
                    value={montant}
                    onChange={(e) => setMontant(e.target.value)}
                    required
                    className={champ}
                  />
                </div>
                <div>
                  <label className={etiquette}>Date de réception</label>
                  <input
                    type="date"
                    value={datePaiement}
                    max={aujourdhuiISO()}
                    onChange={(e) => setDatePaiement(e.target.value)}
                    required
                    className={champ}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setMontant(depuisCents(soldeCents))}
                  className="rounded-full border border-black/10 px-3 py-1 font-semibold text-navy hover:bg-black/5"
                >
                  Solde complet ({formaterMontant(doc.solde_du)})
                </button>
                {doc.prochaine_echeance && versCents(doc.prochaine_echeance.montant) !== soldeCents && (
                  <button
                    type="button"
                    onClick={() => setMontant(Number(doc.prochaine_echeance!.montant).toFixed(2))}
                    className="rounded-full border border-black/10 px-3 py-1 font-semibold text-navy hover:bg-black/5"
                  >
                    Prochain versement ({formaterMontant(doc.prochaine_echeance.montant)})
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={etiquette}>Mode de paiement</label>
                  <select value={mode} onChange={(e) => setMode(e.target.value as ModePaiement)} className={champ}>
                    {Object.entries(MODE_PAIEMENT_LABELS).map(([valeur, label]) => (
                      <option key={valeur} value={valeur}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={etiquette}>Référence (optionnel)</label>
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="N° de chèque, transaction…"
                    maxLength={100}
                    className={champ}
                  />
                </div>
              </div>
              <div>
                <label className={etiquette}>Note (optionnel)</label>
                <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className={champ} />
              </div>
              <div>
                <label className={etiquette}>Preuve de paiement (optionnel)</label>
                <input
                  ref={champPreuve}
                  type="file"
                  accept={TYPES_PREUVE}
                  onChange={(e) => choisirPreuve(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-black/60 file:mr-3 file:rounded-full file:border-0 file:bg-navy/5 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-navy hover:file:bg-navy/10"
                />
                <p className="mt-1 text-xs text-black/40">
                  Photo du chèque, capture du virement Interac ou PDF de l&apos;avis de dépôt (10 Mo max). Sur
                  téléphone, tu peux prendre la photo directement. Gardée en privé, jamais envoyée au client.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm text-black/60">
                <input
                  type="checkbox"
                  checked={envoyerRecu}
                  onChange={(e) => setEnvoyerRecu(e.target.checked)}
                  className="h-4 w-4 accent-accent"
                />
                Envoyer un reçu au client par courriel (montant reçu + solde restant)
              </label>
              <button
                type="submit"
                disabled={enregistrement}
                className="self-start rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {enregistrement ? 'Enregistrement…' : 'Enregistrer le paiement'}
              </button>
            </form>
          )}
        </section>

        {/* Historique */}
        <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-navy">Historique des paiements</h2>
          {doc.paiements.length === 0 ? (
            <p className="mt-3 text-sm text-black/40">Aucun paiement reçu pour le moment.</p>
          ) : (
            <div className="mt-3 flex flex-col divide-y divide-black/5">
              {doc.paiements.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-navy">{formaterMontant(p.montant)}</p>
                    <p className="truncate text-xs text-black/50">
                      {formaterDate(p.date)} · {p.mode_label}
                      {p.reference && ` · réf. ${p.reference}`}
                      {p.note && ` · ${p.note}`}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs font-semibold">
                      {preuveEnCours === p.id ? (
                        <span className="text-black/40">Envoi de la preuve…</span>
                      ) : p.a_preuve ? (
                        <>
                          <a
                            href={apiUrlClient(urlPreuve(p))}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-full bg-navy/5 px-2.5 py-1 text-navy hover:bg-navy/10"
                          >
                            <Icone nom={p.preuve_est_pdf ? 'document' : 'photo'} />
                            Voir la preuve {p.preuve_est_pdf ? '(PDF)' : '(photo)'}
                          </a>
                          <label className="cursor-pointer text-black/40 hover:text-navy">
                            Remplacer
                            <input
                              type="file"
                              accept={TYPES_PREUVE}
                              className="hidden"
                              onChange={(e) => changerPreuve(p, e.target.files?.[0] ?? null)}
                            />
                          </label>
                          <button onClick={() => changerPreuve(p, null)} className="text-black/40 hover:text-red-600">
                            Retirer la preuve
                          </button>
                        </>
                      ) : (
                        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-black/20 px-2.5 py-1 text-black/60 hover:border-navy hover:text-navy">
                          <Icone nom="trombone" />
                          Ajouter une preuve
                          <input
                            type="file"
                            accept={TYPES_PREUVE}
                            className="hidden"
                            onChange={(e) => changerPreuve(p, e.target.files?.[0] ?? null)}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setASupprimer(p)}
                    className="shrink-0 text-xs font-semibold text-black/40 hover:text-red-600"
                  >
                    Retirer
                  </button>
                </div>
              ))}
              <div className="flex justify-between pt-2.5 text-sm font-bold text-navy">
                <span>Total reçu</span>
                <span>{formaterMontant(doc.montant_paye)}</span>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Plan de paiement */}
      <section className="mt-6 rounded-xl border border-black/5 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-navy">Plan de paiement</h2>
            <p className="text-xs text-black/50">
              Tu choisis combien de versements, à quelle fréquence et de quels montants. Les paiements reçus
              couvrent les versements dans l&apos;ordre des dates.
            </p>
          </div>
          {!editionPlan && (
            <div className="flex gap-3">
              <button
                onClick={() => setEditionPlan(true)}
                className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                {doc.echeances.length ? 'Modifier le plan' : 'Créer un plan de paiement'}
              </button>
              {doc.echeances.length > 0 && (
                <button
                  onClick={retirerPlan}
                  disabled={retraitPlan}
                  className="text-sm font-semibold text-black/40 hover:text-red-600 disabled:opacity-50"
                >
                  Retirer le plan
                </button>
              )}
            </div>
          )}
        </div>

        {!editionPlan && doc.echeances.length === 0 && (
          <p className="mt-4 text-sm text-black/40">
            Aucun plan : le client paie le total en une fois
            {doc.date_echeance ? ` avant le ${formaterDate(doc.date_echeance)}` : ''}.
          </p>
        )}

        {!editionPlan && doc.echeances.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-navy/20 text-left text-xs uppercase text-black/40">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Date prévue</th>
                  <th className="py-2 pr-3 text-right">Montant</th>
                  <th className="py-2 pr-3 text-right">Payé</th>
                  <th className="py-2 pr-3 text-right">Reste</th>
                  <th className="py-2">État</th>
                </tr>
              </thead>
              <tbody>
                {doc.echeances.map((e, i) => (
                  <tr key={e.id} className="border-b border-black/5">
                    <td className="py-2 pr-3 text-black/40">
                      {i + 1}/{doc.echeances.length}
                      {e.note && <span className="ml-1 text-xs text-black/50">— {e.note}</span>}
                    </td>
                    <td className="py-2 pr-3">{formaterDate(e.date)}</td>
                    <td className="py-2 pr-3 text-right">{formaterMontant(e.montant)}</td>
                    <td className="py-2 pr-3 text-right text-green-700">{formaterMontant(e.paye)}</td>
                    <td className="py-2 pr-3 text-right font-semibold">{formaterMontant(e.reste)}</td>
                    <td className="py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ETAT_ECHEANCE[e.statut].badge}`}>
                        {ETAT_ECHEANCE[e.statut].label}
                      </span>
                      {e.date_rappel_avant && e.statut !== 'payee' && (
                        <span className="ml-2 text-[11px] text-black/40" suppressHydrationWarning>
                          rappel envoyé le {new Date(e.date_rappel_avant).toLocaleDateString('fr-CA')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {editionPlan && (
          <PlanPaiementEditor
            document={doc}
            depotParDefaut={
              payeCents > 0 ? { montant: depuisCents(payeCents), date: doc.paiements[0]?.date ?? aujourdhuiISO() } : undefined
            }
            onSaved={(maj) => {
              onChange(maj);
              setEditionPlan(false);
              if (versCents(maj.solde_du) > 0) {
                setMontant(Number(maj.prochaine_echeance?.montant ?? maj.solde_du).toFixed(2));
              }
            }}
            onCancel={() => setEditionPlan(false)}
          />
        )}
      </section>

      {aSupprimer && (
        <ConfirmDialog
          titre="Retirer ce paiement ?"
          message={`Le paiement de ${formaterMontant(aSupprimer.montant)} du ${formaterDate(aSupprimer.date)} sera retiré et le solde dû sera recalculé.`}
          enCours={suppression}
          labelConfirmer="Retirer"
          labelEnCours="Retrait…"
          onConfirm={supprimerPaiement}
          onCancel={() => setASupprimer(null)}
        />
      )}
    </div>
  );
}
