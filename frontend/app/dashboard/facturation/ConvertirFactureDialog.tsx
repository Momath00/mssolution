'use client';

import type { DocumentFacturation } from '@/lib/api';
import { formaterDate, formaterMontant } from '@/lib/argent';
import { ICONES, Icone } from '@/components/Icone';

/**
 * Aperçu avant de transformer une soumission acceptée au téléphone en facture :
 * on voit exactement ce que le client recevra (lignes, taxes, plan) avant de créer quoi que ce soit.
 */
export default function ConvertirFactureDialog({
  soumission,
  enCours,
  onConfirm,
  onCancel,
}: {
  soumission: DocumentFacturation;
  enCours: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const plan = soumission.plan_valide ? soumission.echeances : [];
  const acompte = Number(soumission.pourcentage_acompte) > 0 ? soumission.pourcentage_acompte : null;

  return (
    <div
      className="animate-backdrop-in fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={onCancel}
    >
      <div
        className="animate-modal-pop flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-conversion"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête : soumission → facture */}
        <div className="bg-gradient-to-br from-navy to-navy-light px-6 pb-5 pt-6 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">Acceptée au téléphone</p>
          <h2 id="titre-conversion" className="mt-1 text-xl font-bold">Convertir en facture</h2>
          <div className="mt-4 flex items-center gap-3 text-sm">
            <span className="rounded-full bg-white/10 px-3 py-1 font-semibold tabular-nums ring-1 ring-white/20">
              {soumission.numero}
            </span>
            <Icone d={ICONES.fleche} className="h-4 w-4 text-white/60" />
            <span className="rounded-full bg-green-400/20 px-3 py-1 font-semibold text-green-100 ring-1 ring-green-300/40">
              Nouvelle facture
            </span>
          </div>
          <p className="mt-3 truncate text-sm text-white/70">{soumission.client_nom}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Lignes reprises telles quelles */}
          <ul className="divide-y divide-black/[0.06] rounded-2xl border border-black/10">
            {soumission.lignes.map((ligne, i) => (
              <li key={ligne.id ?? i} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-navy">{ligne.description}</p>
                  <p className="mt-0.5 text-[12px] tabular-nums text-black/45">
                    {Number(ligne.quantite)} × {formaterMontant(ligne.prix_unitaire)}
                  </p>
                </div>
                <p className="shrink-0 font-semibold tabular-nums text-navy">
                  {formaterMontant(Number(ligne.quantite) * Number(ligne.prix_unitaire))}
                </p>
              </li>
            ))}
          </ul>

          {/* Totaux */}
          <dl className="mt-4 space-y-1.5 px-1 text-sm">
            <div className="flex justify-between text-black/55">
              <dt>Sous-total</dt>
              <dd className="tabular-nums">{formaterMontant(soumission.sous_total)}</dd>
            </div>
            <div className="flex justify-between text-black/55">
              <dt>TPS</dt>
              <dd className="tabular-nums">{formaterMontant(soumission.montant_tps)}</dd>
            </div>
            <div className="flex justify-between text-black/55">
              <dt>TVQ</dt>
              <dd className="tabular-nums">{formaterMontant(soumission.montant_tvq)}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-black/10 pt-2.5">
              <dt className="font-semibold text-navy">Total à facturer</dt>
              <dd className="text-2xl font-bold tabular-nums text-navy">{formaterMontant(soumission.total)}</dd>
            </div>
          </dl>

          {plan.length > 0 && (
            <div className="mt-5 rounded-2xl bg-indigo-50/70 p-4 ring-1 ring-indigo-100">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-indigo-800">
                <Icone d={ICONES.calendrier} className="h-4 w-4" />
                Plan de paiement repris ({plan.length} versement{plan.length > 1 ? 's' : ''})
              </p>
              <ul className="mt-2 space-y-1 text-[13px] text-indigo-900/80">
                {plan.map((v) => (
                  <li key={v.id} className="flex justify-between tabular-nums">
                    <span>{formaterDate(v.date)}{v.note ? ` · ${v.note}` : ''}</span>
                    <span className="font-semibold">{formaterMontant(v.montant)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-indigo-800/60">
                Si la 1re date est passée, toutes les dates sont décalées à aujourd’hui.
              </p>
            </div>
          )}

          {acompte && (
            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900 ring-1 ring-amber-200">
              La soumission prévoyait un acompte de {Number(acompte)} % : la facture sera faite pour le total —
              enregistre l’acompte comme paiement partiel quand tu le reçois.
            </p>
          )}

          <ul className="mt-5 space-y-2 text-[13px] text-black/60">
            {[
              'La facture est créée en brouillon : tu peux la modifier avant de l’envoyer.',
              `${soumission.numero} passe à « Acceptée ».`,
              'Rien n’est envoyé au client sans ton clic sur « Envoyer ».',
            ].map((texte) => (
              <li key={texte} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                {texte}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-3 border-t border-black/10 bg-black/[0.015] px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full px-4 py-2.5 text-sm font-semibold text-black/55 transition-all hover:bg-black/5 active:scale-95 sm:flex-none"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={enCours}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-green-700 hover:shadow-md active:scale-95 disabled:opacity-60 disabled:active:scale-100 sm:ml-auto"
          >
            <Icone d={ICONES.argent} className="h-4 w-4" />
            {enCours ? 'Création de la facture…' : 'Créer la facture'}
          </button>
        </div>
      </div>
    </div>
  );
}
