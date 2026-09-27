'use client';

import { use, useEffect, useState } from 'react';

import { apiUrlClient, fetchClient, type DocumentFacturation } from '@/lib/api';
import { formaterMontant, versCents } from '@/lib/argent';
import { useListePaginee } from '@/lib/useListePaginee';
import { afficherToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';

import CatalogueManager from './CatalogueManager';
import ComptesARecevoir from './ComptesARecevoir';
import DocumentForm from './DocumentForm';
import PaiementsPanel from './PaiementsPanel';
import PlanSoumissionPanel from './PlanSoumissionPanel';

const statutLabel: Record<string, string> = {
  brouillon: 'Brouillon',
  envoyee: 'Envoyée',
  acceptee: 'Acceptée',
  refusee: 'Refusée',
  partielle: 'Partiellement payée',
  payee: 'Payée',
};

type Onglet = 'soumission' | 'facture' | 'a_recevoir' | 'catalogue';

const ONGLETS: Record<Onglet, string> = {
  soumission: 'Soumissions',
  facture: 'Factures',
  a_recevoir: 'Comptes à recevoir',
  catalogue: 'Catalogue de prix',
};

const statutStyle: Record<string, string> = {
  brouillon: 'bg-black/5 text-black/50',
  envoyee: 'bg-blue-100 text-blue-700',
  acceptee: 'bg-green-100 text-green-700',
  refusee: 'bg-red-100 text-red-700',
  partielle: 'bg-amber-100 text-amber-700',
  payee: 'bg-green-100 text-green-700',
};

function dateCourte(iso: string) {
  return new Date(iso).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' });
}

/** Dernier courriel de suivi envoyé automatiquement pour une soumission en attente. */
function dernierSuivi(doc: DocumentFacturation): string | null {
  if (doc.date_alerte_expiration && doc.date_echeance && doc.date_echeance < new Date().toISOString().slice(0, 10)) {
    return 'Expirée sans réponse';
  }
  if (doc.date_rappel_expiration) return `Avis d’expiration envoyé le ${dateCourte(doc.date_rappel_expiration)}`;
  if (doc.date_relance_soumission) return `Relancée le ${dateCourte(doc.date_relance_soumission)}`;
  if (doc.date_envoi) return `Envoyée le ${dateCourte(doc.date_envoi)}`;
  return null;
}

function estOnglet(valeur: string | undefined): valeur is Onglet {
  return valeur !== undefined && valeur in ONGLETS;
}

export default function FacturationDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ onglet?: string; facture?: string }>;
}) {
  // Liens directs depuis la vue d'ensemble : ?onglet=a_recevoir, ?facture=42 (ouvre ses paiements).
  const parametres = use(searchParams);
  const [onglet, setOnglet] = useState<Onglet>(estOnglet(parametres.onglet) ? parametres.onglet : 'soumission');
  const typeListe = onglet === 'facture' ? 'facture' : 'soumission';
  const {
    items: documents,
    setItems: setDocuments,
    total,
    chargementInitial,
    chargementPage,
    erreur: erreurChargement,
    sentinelleRef,
    recharger,
    chargerPlus,
  } = useListePaginee<DocumentFacturation>(`/api/documents/?type_document=${typeListe}`);

  const [enEdition, setEnEdition] = useState<DocumentFacturation | null | 'nouveau'>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState<number | null>(null);
  const [majEnCours, setMajEnCours] = useState<number | null>(null);
  const [aSupprimer, setASupprimer] = useState<DocumentFacturation | null>(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [facturationEnCours, setFacturationEnCours] = useState<number | null>(null);
  const [enPaiement, setEnPaiement] = useState<DocumentFacturation | null>(null);
  const [enPlanSoumission, setEnPlanSoumission] = useState<DocumentFacturation | null>(null);

  function majDocument(maj: DocumentFacturation) {
    setDocuments((prev) => prev.map((d) => (d.id === maj.id ? maj : d)));
  }

  const factureDemandee = Number(parametres.facture) || null;
  useEffect(() => {
    if (!factureDemandee) return;
    fetchClient<DocumentFacturation>(`/api/documents/${factureDemandee}/`)
      .then(setEnPaiement)
      .catch(() => {});
  }, [factureDemandee]);

  async function ouvrirFacture(id: number) {
    try {
      setEnPaiement(await fetchClient<DocumentFacturation>(`/api/documents/${id}/`));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Impossible d’ouvrir la facture.');
    }
  }

  async function facturerSolde(doc: DocumentFacturation) {
    if (!doc.contrat_id) return;
    setFacturationEnCours(doc.id);
    try {
      await fetchClient(`/api/contrats/${doc.contrat_id}/facturer-solde/`, { method: 'POST' });
      afficherToast(`Facture de solde créée en brouillon pour ${doc.numero} — envoie-la depuis l'onglet Factures.`);
      recharger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de la facturation du solde.');
    } finally {
      setFacturationEnCours(null);
    }
  }

  async function envoyer(doc: DocumentFacturation) {
    const reenvoi = doc.statut !== 'brouillon';
    setEnvoiEnCours(doc.id);
    try {
      const maj = await fetchClient<DocumentFacturation>(`/api/documents/${doc.id}/envoyer/`, { method: 'POST' });
      afficherToast(`${doc.numero} ${reenvoi ? 'renvoyé' : 'envoyé'} au client avec succès.`);
      majDocument(maj);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de l\'envoi.');
    } finally {
      setEnvoiEnCours(null);
    }
  }

  async function togglePayee(doc: DocumentFacturation) {
    const statutRetour = doc.type_document === 'soumission' ? 'acceptee' : 'envoyee';
    const nouveauStatut = doc.statut === 'payee' ? statutRetour : 'payee';
    setMajEnCours(doc.id);
    try {
      await fetchClient(`/api/documents/${doc.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ statut: nouveauStatut }),
      });
      afficherToast(
        nouveauStatut === 'payee'
          ? `${doc.numero} marquée comme reçue — ajoutée au revenu du mois.`
          : `${doc.numero} repassée à « ${statutLabel[statutRetour]} ».`,
      );
      setDocuments((prev) => prev.map((d) => (d.id === doc.id ? { ...d, statut: nouveauStatut } : d)));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de la mise à jour.');
    } finally {
      setMajEnCours(null);
    }
  }

  async function confirmerSuppression() {
    if (!aSupprimer) return;
    setSuppressionEnCours(true);
    try {
      await fetchClient(`/api/documents/${aSupprimer.id}/`, { method: 'DELETE' });
      afficherToast(`${aSupprimer.numero} supprimé.`);
      setDocuments((prev) => prev.filter((d) => d.id !== aSupprimer.id));
      setASupprimer(null);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de la suppression.');
    } finally {
      setSuppressionEnCours(false);
    }
  }

  if (enPaiement) {
    return (
      <PaiementsPanel
        key={enPaiement.id}
        document={enPaiement}
        onChange={(maj) => {
          setEnPaiement(maj);
          majDocument(maj);
        }}
        onRetour={() => setEnPaiement(null)}
      />
    );
  }

  if (enPlanSoumission) {
    return (
      <PlanSoumissionPanel
        key={enPlanSoumission.id}
        document={enPlanSoumission}
        onChange={(maj) => {
          setEnPlanSoumission(maj);
          majDocument(maj);
        }}
        onRetour={() => setEnPlanSoumission(null)}
      />
    );
  }

  if (enEdition) {
    return (
      <DocumentForm
        document={enEdition === 'nouveau' ? null : enEdition}
        typeParDefaut={typeListe}
        onDone={() => {
          afficherToast(enEdition === 'nouveau' ? 'Document créé avec succès.' : 'Document mis à jour.');
          setEnEdition(null);
          recharger();
        }}
        onCancel={() => setEnEdition(null)}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">Facturation</h1>
        {(onglet === 'soumission' || onglet === 'facture') && (
          <button
            onClick={() => setEnEdition('nouveau')}
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            + Nouveau
          </button>
        )}
      </div>

      {(erreur || erreurChargement) && <p className="mt-4 text-sm text-red-600">{erreur || erreurChargement}</p>}

      <div className="mt-6 flex gap-1 border-b border-black/10">
        {(Object.keys(ONGLETS) as Onglet[]).map((type) => (
          <button
            key={type}
            onClick={() => setOnglet(type)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
              onglet === type
                ? 'border-accent text-navy'
                : 'border-transparent text-black/40 hover:text-black/60'
            }`}
          >
            {ONGLETS[type]}
          </button>
        ))}
      </div>

      {onglet === 'catalogue' ? (
        <div className="mt-6">
          <CatalogueManager />
        </div>
      ) : onglet === 'a_recevoir' ? (
        <div className="mt-6">
          <ComptesARecevoir onOuvrirFacture={ouvrirFacture} />
        </div>
      ) : (
      <>
      {!chargementInitial && total > 0 && (
        <p className="mt-4 text-xs text-black/40">
          {documents.length} sur {total} {onglet === 'soumission' ? 'soumissions' : 'factures'}
        </p>
      )}

      <div className="mt-3 flex flex-col gap-3">
        {chargementInitial && (
          <div className="flex flex-col gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-[68px] animate-pulse rounded-xl bg-black/5" />
            ))}
          </div>
        )}

        {!chargementInitial &&
          documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-4 rounded-xl border border-black/5 bg-white p-4 shadow-sm">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-navy">
                  {doc.numero}
                  {doc.type_document === 'soumission' && doc.echeances.length > 0 && (
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                      Plan en {doc.echeances.length} versement{doc.echeances.length > 1 ? 's' : ''}
                    </span>
                  )}
                  {!doc.plan_valide && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                      Plan à corriger
                    </span>
                  )}
                  {doc.type_paiement !== 'complet' && (
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                      {doc.type_paiement === 'acompte' ? 'Acompte' : 'Solde'}
                      {doc.contrat_lie_numero ? ` · ${doc.contrat_lie_numero}` : ''}
                    </span>
                  )}
                </p>
                {doc.type_document === 'facture' ? (
                  <p className="truncate text-sm text-black/50">
                    {doc.client_nom} · {formaterMontant(doc.total)}
                    {versCents(doc.montant_paye) > 0 && (
                      <>
                        {' · '}
                        <span className="text-green-700">payé {formaterMontant(doc.montant_paye)}</span>
                        {versCents(doc.solde_du) > 0 && (
                          <>
                            {' · '}
                            <span className="font-semibold text-navy">solde {formaterMontant(doc.solde_du)}</span>
                          </>
                        )}
                      </>
                    )}
                  </p>
                ) : (
                  <p className="truncate text-sm text-black/50">{doc.client_nom} · {doc.total} $</p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statutStyle[doc.statut]}`}>
                  {statutLabel[doc.statut]}
                </span>
                {doc.jours_retard > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                    En retard · {doc.jours_retard} j
                  </span>
                )}
                {doc.type_document === 'soumission' && doc.statut === 'envoyee' && dernierSuivi(doc) && (
                  <span className="text-[11px] text-black/40" suppressHydrationWarning>
                    {dernierSuivi(doc)}
                  </span>
                )}
                {(doc.statut === 'acceptee' || doc.statut === 'payee') && doc.date_reponse && (
                  <span className="text-[11px] text-black/40" suppressHydrationWarning>
                    Signée le {new Date(doc.date_reponse).toLocaleDateString('fr-CA')}
                  </span>
                )}
              </div>
              {doc.type_document === 'facture' && (
                <button
                  onClick={() => setEnPaiement(doc)}
                  className="shrink-0 rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                >
                  Paiements
                </button>
              )}
              {doc.type_document === 'soumission' && (
                <button
                  onClick={() => setEnPlanSoumission(doc)}
                  className="shrink-0 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                >
                  Plan de paiement
                </button>
              )}
              {doc.type_document === 'soumission' && (doc.statut === 'acceptee' || doc.statut === 'payee') && (
                <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-black/50">
                  <input
                    type="checkbox"
                    checked={doc.statut === 'payee'}
                    disabled={majEnCours === doc.id}
                    onChange={() => togglePayee(doc)}
                    className="h-4 w-4 accent-accent"
                  />
                  Reçue
                </label>
              )}
              {doc.solde_facturable && (
                <button
                  onClick={() => facturerSolde(doc)}
                  disabled={facturationEnCours === doc.id}
                  className="shrink-0 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {facturationEnCours === doc.id ? 'Facturation…' : 'Facturer le solde'}
                </button>
              )}
              <a
                href={apiUrlClient(`/api/documents/${doc.id}/pdf/`)}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-sm font-semibold text-navy hover:underline"
              >
                Voir le PDF
              </a>
              <button
                onClick={() => envoyer(doc)}
                disabled={envoiEnCours === doc.id}
                className="shrink-0 text-sm font-semibold text-accent hover:underline disabled:opacity-50"
              >
                {envoiEnCours === doc.id ? 'Envoi…' : doc.statut === 'brouillon' ? 'Envoyer au client' : 'Renvoyer au client'}
              </button>
              <button
                onClick={() => setEnEdition(doc)}
                className="shrink-0 text-sm font-semibold text-black/60 hover:underline"
              >
                Modifier
              </button>
              <button
                onClick={() => setASupprimer(doc)}
                className="shrink-0 text-sm font-semibold text-black/40 hover:text-red-600"
              >
                Supprimer
              </button>
            </div>
          ))}

        {!chargementInitial && documents.length === 0 && (
          <p className="text-black/50">
            {onglet === 'soumission' ? 'Aucune soumission pour le moment.' : 'Aucune facture pour le moment.'}
          </p>
        )}

        <div ref={sentinelleRef} />
        {chargementPage && (
          <div className="flex justify-center py-2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        )}
        {!chargementPage && !chargementInitial && documents.length < total && (
          <button
            onClick={chargerPlus}
            className="mx-auto mt-1 rounded-full border border-black/10 px-5 py-2 text-sm font-semibold text-navy hover:bg-black/5"
          >
            Charger plus
          </button>
        )}
      </div>

      </>
      )}

      {aSupprimer && (
        <ConfirmDialog
          titre="Supprimer ce document ?"
          message={`${aSupprimer.numero} sera supprimé définitivement.`}
          enCours={suppressionEnCours}
          onConfirm={confirmerSuppression}
          onCancel={() => setASupprimer(null)}
        />
      )}
    </div>
  );
}
