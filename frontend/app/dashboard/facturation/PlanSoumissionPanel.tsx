'use client';

import { useState } from 'react';

import { apiUrlClient, fetchClient, type DocumentFacturation } from '@/lib/api';
import { formaterDate, formaterMontant } from '@/lib/argent';
import { clientAvatarStyle, initiales } from '@/lib/clientColors';
import { afficherToast } from '@/components/Toast';
import { ICONES, Icone } from '@/components/Icone';

import PlanPaiementEditor from './PlanPaiementEditor';

interface Props {
  document: DocumentFacturation;
  onChange: (document: DocumentFacturation) => void;
  onRetour: () => void;
}

const STATUT: Record<string, { label: string; classe: string }> = {
  brouillon: { label: 'Brouillon', classe: 'bg-black/[0.05] text-black/60 ring-black/10' },
  envoyee: { label: 'Envoyée', classe: 'bg-blue-50 text-blue-700 ring-blue-200' },
  acceptee: { label: 'Acceptée', classe: 'bg-green-50 text-green-700 ring-green-200' },
  refusee: { label: 'Refusée', classe: 'bg-red-50 text-red-700 ring-red-200' },
  partielle: { label: 'Partiellement payée', classe: 'bg-amber-50 text-amber-800 ring-amber-200' },
  payee: { label: 'Payée', classe: 'bg-green-50 text-green-700 ring-green-200' },
};

const ETAPES = [
  { icone: ICONES.document, titre: 'Visible par le client', texte: 'Le plan apparaît sur la page de signature, le PDF et le courriel, avant l’acceptation.' },
  { icone: ICONES.argent, titre: 'Facture automatique', texte: 'À l’acceptation, le plan est figé dans le contrat et une facture avec le même plan est créée et envoyée.' },
  { icone: ICONES.calendrier, titre: 'Dates reportées', texte: 'Si le client signe après le 1er versement, toutes les dates sont décalées : jamais en retard dès la signature.' },
  { icone: ICONES.alerte, titre: 'Plan ou acompte', texte: 'Le plan remplace l’acompte en pourcentage : c’est l’un ou l’autre.' },
];

/**
 * Plan de paiement proposé au client sur une soumission. Il est affiché sur la page de
 * signature, le PDF et le courriel ; à l'acceptation, il est figé dans le contrat et une
 * facture reprenant le même plan est créée et envoyée automatiquement.
 */
export default function PlanSoumissionPanel({ document: doc, onChange, onRetour }: Props) {
  const modifiable = doc.statut === 'brouillon' || doc.statut === 'envoyee';
  const [edition, setEdition] = useState(false);
  const [retrait, setRetrait] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function retirerPlan() {
    setRetrait(true);
    setErreur(null);
    try {
      const maj = await fetchClient<DocumentFacturation>(`/api/documents/${doc.id}/echeancier/`, {
        method: 'PUT',
        body: JSON.stringify({ versements: [] }),
      });
      onChange(maj);
      afficherToast('Plan de paiement retiré de la soumission.');
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors du retrait du plan.');
    } finally {
      setRetrait(false);
    }
  }

  const total = Number(doc.total) || 0;
  const sommePlan = doc.echeances.reduce((s, e) => s + Number(e.montant), 0);
  const statut = STATUT[doc.statut] ?? STATUT.brouillon;

  return (
    <div>
      <button
        onClick={onRetour}
        className="flex items-center gap-1.5 text-sm font-semibold text-black/55 transition hover:text-navy"
      >
        <Icone d={ICONES.precedent} className="h-4 w-4" />
        Retour aux soumissions
      </button>

      {/* En-tête */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm"
            style={clientAvatarStyle(doc.client) || undefined}
          >
            {initiales(doc.client_nom || '?')}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-black/45">Plan de paiement</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-navy">{doc.numero}</h1>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${statut.classe}`}>{statut.label}</span>
            </div>
            <p className="text-sm text-black/55">{doc.client_nom}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-black/15 bg-white px-4 py-2 text-right shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-black/45">Total</p>
            <p className="text-lg font-bold tabular-nums text-navy">{formaterMontant(doc.total)}</p>
          </div>
          <a
            href={apiUrlClient(`/api/documents/${doc.id}/pdf/`)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-xl border border-black/15 bg-white px-4 py-3 text-sm font-semibold text-navy shadow-sm transition hover:border-navy/40"
          >
            <Icone d={ICONES.telecharger} />
            Voir le PDF
          </a>
        </div>
      </div>

      {erreur && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</p>}

      {/* Versements */}
      <section className="mt-6 overflow-hidden rounded-2xl border border-black/15 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-navy">Versements proposés</h2>
            <p className="text-xs text-black/50">
              {doc.echeances.length
                ? `${doc.echeances.length} versement${doc.echeances.length > 1 ? 's' : ''} · ${formaterMontant(sommePlan)}`
                : 'Aucun versement planifié'}
            </p>
          </div>
          {modifiable && !edition && (
            <div className="flex items-center gap-2">
              {doc.echeances.length > 0 && (
                <button
                  onClick={retirerPlan}
                  disabled={retrait}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-black/50 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  <Icone d={ICONES.supprimer} />
                  {retrait ? 'Retrait…' : 'Retirer le plan'}
                </button>
              )}
              <button
                onClick={() => setEdition(true)}
                className="flex items-center gap-1.5 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:shadow-md"
              >
                <Icone d={doc.echeances.length ? ICONES.modifier : ICONES.plus} />
                {doc.echeances.length ? 'Modifier le plan' : 'Créer un plan de paiement'}
              </button>
            </div>
          )}
        </div>

        <div className="px-5 py-4">
          {!modifiable && (
            <p className="mb-4 flex items-start gap-2 rounded-xl border border-black/10 bg-black/[0.02] px-3.5 py-2.5 text-sm text-black/60">
              <Icone d={ICONES.cadenas} className="mt-0.5 h-4 w-4 shrink-0 text-black/40" />
              <span>
                Le client a déjà répondu : le plan ne peut plus changer.
                {doc.statut === 'acceptee' && ' Il a été recopié sur la facture créée à l’acceptation (onglet Factures).'}
              </span>
            </p>
          )}

          {!doc.plan_valide && (
            <p className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-semibold text-red-700">
              <Icone d={ICONES.alerte} className="mt-0.5 h-4 w-4 shrink-0" />
              Les lignes de la soumission ont changé : la somme des versements ne correspond plus au total. Modifie le
              plan avant d&apos;envoyer la soumission.
            </p>
          )}

          {!edition && doc.echeances.length === 0 && (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/[0.04] text-black/30">
                <Icone d={ICONES.calendrier} className="h-6 w-6" />
              </div>
              <p className="mt-3 font-semibold text-navy">Aucun plan de paiement</p>
              <p className="mt-1 text-sm text-black/50">
                {doc.pourcentage_acompte
                  ? `Acompte de ${Number(doc.pourcentage_acompte)} % à la signature, solde à la livraison.`
                  : 'Paiement complet à l’acceptation.'}
              </p>
            </div>
          )}

          {!edition && doc.echeances.length > 0 && (
            <ol className="relative">
              {doc.echeances.map((e, i) => {
                const part = total > 0 ? (Number(e.montant) / total) * 100 : 0;
                const dernier = i === doc.echeances.length - 1;
                return (
                  <li key={e.id} className="relative flex gap-4 pb-4 last:pb-0">
                    {/* Ligne de temps */}
                    {!dernier && <span className="absolute left-[17px] top-9 h-[calc(100%-28px)] w-0.5 bg-indigo-100" aria-hidden />}
                    <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-700 ring-4 ring-white">
                      {i + 1}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border border-black/10 px-4 py-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-navy">{formaterDate(e.date)}</p>
                        <p className="text-xs text-black/50">
                          Versement {i + 1} sur {doc.echeances.length}
                          {e.note ? ` · ${e.note}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="hidden w-24 sm:block">
                          <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
                            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(part, 100)}%` }} />
                          </div>
                          <p className="mt-0.5 text-right text-[10px] text-black/45">{Math.round(part)} % du total</p>
                        </div>
                        <p className="text-base font-bold tabular-nums text-navy">{formaterMontant(e.montant)}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {edition && (
            <PlanPaiementEditor
              document={doc}
              onSaved={(maj) => {
                onChange(maj);
                setEdition(false);
              }}
              onCancel={() => setEdition(false)}
            />
          )}
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-bold text-navy">Comment ça marche</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ETAPES.map((etape, i) => (
            <div key={etape.titre} className="rounded-2xl border border-black/15 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Icone d={etape.icone} />
                </span>
                <span className="text-[11px] font-bold text-black/35">ÉTAPE {i + 1}</span>
              </div>
              <p className="mt-3 text-sm font-semibold text-navy">{etape.titre}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-black/55">{etape.texte}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
