'use client';

import { useEffect, useState } from 'react';

import { apiUrlClient, fetchClient, type Contrat } from '@/lib/api';
import { afficherToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';

const statutStyle: Record<string, string> = {
  actif: 'bg-green-100 text-green-700',
  annule: 'bg-black/5 text-black/50',
};

const statutLabel: Record<string, string> = {
  actif: 'Actif',
  annule: 'Annulé',
};

const statutFactureStyle: Record<string, string> = {
  brouillon: 'bg-black/5 text-black/50',
  envoyee: 'bg-blue-100 text-blue-700',
  acceptee: 'bg-blue-100 text-blue-700',
  refusee: 'bg-red-100 text-red-700',
  payee: 'bg-green-100 text-green-700',
};

const statutFactureLabel: Record<string, string> = {
  brouillon: 'Brouillon',
  envoyee: 'Envoyée',
  acceptee: 'Acceptée',
  refusee: 'Refusée',
  payee: 'Payée',
};

export default function ContratsDashboardPage() {
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [aAnnuler, setAAnnuler] = useState<Contrat | null>(null);
  const [aSupprimer, setASupprimer] = useState<Contrat | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [facturationEnCours, setFacturationEnCours] = useState<number | null>(null);

  function charger() {
    fetchClient<Contrat[]>('/api/contrats/')
      .then(setContrats)
      .catch((e) => setErreur(e.message));
  }

  useEffect(charger, []);

  async function basculerStatut() {
    if (!aAnnuler) return;
    setEnCours(true);
    try {
      await fetchClient(`/api/contrats/${aAnnuler.id}/annuler/`, { method: 'POST' });
      afficherToast(
        aAnnuler.statut === 'actif' ? `${aAnnuler.numero} annulé.` : `${aAnnuler.numero} réactivé.`,
      );
      setAAnnuler(null);
      charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de la mise à jour.');
    } finally {
      setEnCours(false);
    }
  }

  async function confirmerSuppression() {
    if (!aSupprimer) return;
    setSuppressionEnCours(true);
    try {
      await fetchClient(`/api/contrats/${aSupprimer.id}/`, { method: 'DELETE' });
      afficherToast(`${aSupprimer.numero} supprimé.`);
      setASupprimer(null);
      charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de la suppression.');
    } finally {
      setSuppressionEnCours(false);
    }
  }

  async function facturerSolde(contrat: Contrat) {
    setFacturationEnCours(contrat.id);
    try {
      await fetchClient(`/api/contrats/${contrat.id}/facturer-solde/`, { method: 'POST' });
      afficherToast(`Facture de solde créée en brouillon pour ${contrat.numero} — envoie-la depuis Facturation.`);
      charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de la facturation du solde.');
    } finally {
      setFacturationEnCours(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Contrats</h1>
      <p className="mt-1 text-sm text-black/50">
        Contrats générés automatiquement lorsqu&apos;un client accepte une soumission en ligne. Le PDF archivé
        n&apos;est jamais régénéré — il fait foi de ce qui a été accepté.
      </p>

      {erreur && <p className="mt-4 text-sm text-red-600">{erreur}</p>}

      <div className="mt-6 flex flex-col gap-3">
        {contrats.map((contrat) => (
          <div
            key={contrat.id}
            className="flex flex-col gap-3 rounded-xl border border-black/5 bg-white p-4 shadow-sm"
          >
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-navy">
                {contrat.numero}{' '}
                <span className="font-normal text-black/40">— {contrat.categorie_label}</span>
              </p>
              <p className="truncate text-sm text-black/50">
                {contrat.client_nom} · signé par {contrat.nom_signataire} le{' '}
                {new Date(contrat.date_signature).toLocaleDateString('fr-CA')} · {contrat.total} $
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statutStyle[contrat.statut]}`}>
              {statutLabel[contrat.statut]}
            </span>
            <a
              href={apiUrlClient(`/api/contrats/${contrat.id}/pdf/`)}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-sm font-semibold text-navy hover:underline"
            >
              Voir le PDF
            </a>
            <button
              onClick={() => setAAnnuler(contrat)}
              className="shrink-0 text-sm font-semibold text-black/40 hover:text-red-600"
            >
              {contrat.statut === 'actif' ? 'Annuler' : 'Réactiver'}
            </button>
            <button
              onClick={() => setASupprimer(contrat)}
              className="shrink-0 text-sm font-semibold text-black/40 hover:text-red-600"
            >
              Supprimer
            </button>
          </div>

          {contrat.pourcentage_acompte && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-black/[0.02] p-3">
              {(['acompte', 'solde'] as const).map((type) => {
                const facture = contrat.factures_liees.find((f) => f.type_paiement === type);
                const montant = type === 'acompte' ? contrat.montant_acompte : contrat.montant_solde;
                const pourcentage = type === 'acompte'
                  ? contrat.pourcentage_acompte
                  : (100 - Number(contrat.pourcentage_acompte)).toString();
                return (
                  <div key={type} className="flex items-center gap-2 text-sm">
                    <span className="font-semibold text-navy">
                      {type === 'acompte' ? 'Acompte' : 'Solde'} {pourcentage}% ({montant} $)
                    </span>
                    {facture ? (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statutFactureStyle[facture.statut]}`}
                      >
                        {statutFactureLabel[facture.statut]}
                      </span>
                    ) : type === 'solde' ? (
                      <button
                        onClick={() => facturerSolde(contrat)}
                        disabled={facturationEnCours === contrat.id}
                        className="rounded-full bg-navy px-2.5 py-0.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                      >
                        {facturationEnCours === contrat.id ? 'Facturation…' : 'Facturer le solde'}
                      </button>
                    ) : (
                      <span className="rounded-full bg-black/5 px-2.5 py-0.5 text-xs font-semibold text-black/50">
                        —
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          </div>
        ))}
        {contrats.length === 0 && <p className="text-black/50">Aucun contrat signé pour le moment.</p>}
      </div>

      {aAnnuler && (
        <ConfirmDialog
          titre={aAnnuler.statut === 'actif' ? 'Annuler ce contrat ?' : 'Réactiver ce contrat ?'}
          message={
            aAnnuler.statut === 'actif'
              ? `${aAnnuler.numero} sera marqué comme annulé (le PDF archivé est conservé).`
              : `${aAnnuler.numero} sera remarqué comme actif.`
          }
          enCours={enCours}
          labelConfirmer={aAnnuler.statut === 'actif' ? 'Annuler' : 'Réactiver'}
          labelEnCours="Mise à jour…"
          onConfirm={basculerStatut}
          onCancel={() => setAAnnuler(null)}
        />
      )}

      {aSupprimer && (
        <ConfirmDialog
          titre="Supprimer ce contrat ?"
          message={`${aSupprimer.numero} sera supprimé définitivement, y compris le PDF signé archivé. Les factures d'acompte/solde déjà émises sont conservées mais perdent leur lien vers ce contrat.`}
          enCours={suppressionEnCours}
          onConfirm={confirmerSuppression}
          onCancel={() => setASupprimer(null)}
        />
      )}
    </div>
  );
}
