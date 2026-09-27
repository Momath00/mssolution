'use client';

import { useState } from 'react';

import { apiUrlClient, fetchClient, type DocumentFacturation } from '@/lib/api';
import { formaterDate, formaterMontant } from '@/lib/argent';
import { afficherToast } from '@/components/Toast';

import PlanPaiementEditor from './PlanPaiementEditor';

interface Props {
  document: DocumentFacturation;
  onChange: (document: DocumentFacturation) => void;
  onRetour: () => void;
}

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

  return (
    <div>
      <button onClick={onRetour} className="text-sm font-semibold text-black/50 hover:text-navy">
        ← Retour aux soumissions
      </button>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Plan de paiement — {doc.numero}</h1>
          <p className="text-sm text-black/50">
            {doc.client_nom} · Total {formaterMontant(doc.total)}
          </p>
        </div>
        <a
          href={apiUrlClient(`/api/documents/${doc.id}/pdf/`)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-navy hover:bg-black/5"
        >
          Voir le PDF
        </a>
      </div>

      <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 text-sm leading-relaxed text-black/60">
        <p className="font-semibold text-navy">Comment ça marche</p>
        <ul className="mt-1 list-disc pl-5">
          <li>Le client voit ce plan sur la soumission (page de signature, PDF et courriel) avant d&apos;accepter.</li>
          <li>
            À l&apos;acceptation, le plan est figé dans le contrat et une <strong>facture avec le même plan</strong> est
            créée et envoyée automatiquement. Tu enregistres ensuite les paiements sur cette facture.
          </li>
          <li>
            Si le client accepte après la date du 1er versement, <strong>toutes les dates sont reportées d&apos;autant</strong>
            {' '}— il n&apos;est jamais en retard dès la signature.
          </li>
          <li>Le plan remplace l&apos;acompte en pourcentage : c&apos;est l&apos;un ou l&apos;autre.</li>
        </ul>
      </div>

      {erreur && <p className="mt-4 text-sm text-red-600">{erreur}</p>}

      <section className="mt-6 rounded-xl border border-black/5 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-navy">Versements proposés</h2>
          {modifiable && !edition && (
            <div className="flex gap-3">
              <button
                onClick={() => setEdition(true)}
                className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                {doc.echeances.length ? 'Modifier le plan' : 'Créer un plan de paiement'}
              </button>
              {doc.echeances.length > 0 && (
                <button
                  onClick={retirerPlan}
                  disabled={retrait}
                  className="text-sm font-semibold text-black/40 hover:text-red-600 disabled:opacity-50"
                >
                  Retirer le plan
                </button>
              )}
            </div>
          )}
        </div>

        {!modifiable && (
          <p className="mt-2 text-xs text-black/50">
            Le client a déjà répondu : le plan ne peut plus changer.
            {doc.statut === 'acceptee' && ' Il a été recopié sur la facture créée à l’acceptation (onglet Factures).'}
          </p>
        )}

        {!doc.plan_valide && (
          <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
            Les lignes de la soumission ont changé : la somme des versements ne correspond plus au total. Modifie le
            plan avant d&apos;envoyer la soumission.
          </p>
        )}

        {!edition && doc.echeances.length === 0 && (
          <p className="mt-4 text-sm text-black/40">
            Aucun plan
            {doc.pourcentage_acompte
              ? ` — acompte de ${Number(doc.pourcentage_acompte)} % à la signature, solde à la livraison.`
              : ' — paiement complet à l’acceptation.'}
          </p>
        )}

        {!edition && doc.echeances.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-navy/20 text-left text-xs uppercase text-black/40">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Date prévue</th>
                  <th className="py-2 pr-3">Note</th>
                  <th className="py-2 text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {doc.echeances.map((e, i) => (
                  <tr key={e.id} className="border-b border-black/5">
                    <td className="py-2 pr-3 text-black/40">{i + 1}/{doc.echeances.length}</td>
                    <td className="py-2 pr-3">{formaterDate(e.date)}</td>
                    <td className="py-2 pr-3 text-black/50">{e.note || '—'}</td>
                    <td className="py-2 text-right font-semibold">{formaterMontant(e.montant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
      </section>
    </div>
  );
}
