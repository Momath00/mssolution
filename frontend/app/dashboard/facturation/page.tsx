'use client';

import { useState } from 'react';

import { apiUrlClient, fetchClient, type DocumentFacturation } from '@/lib/api';
import { useListePaginee } from '@/lib/useListePaginee';
import { afficherToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';

import DocumentForm from './DocumentForm';

const statutLabel: Record<string, string> = {
  brouillon: 'Brouillon',
  envoyee: 'Envoyée',
  acceptee: 'Acceptée',
  refusee: 'Refusée',
  payee: 'Payée',
};

const statutStyle: Record<string, string> = {
  brouillon: 'bg-black/5 text-black/50',
  envoyee: 'bg-blue-100 text-blue-700',
  acceptee: 'bg-green-100 text-green-700',
  refusee: 'bg-red-100 text-red-700',
  payee: 'bg-green-100 text-green-700',
};

export default function FacturationDashboardPage() {
  const [onglet, setOnglet] = useState<'soumission' | 'facture'>('soumission');
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
  } = useListePaginee<DocumentFacturation>(`/api/documents/?type_document=${onglet}`);

  const [enEdition, setEnEdition] = useState<DocumentFacturation | null | 'nouveau'>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState<number | null>(null);
  const [majEnCours, setMajEnCours] = useState<number | null>(null);
  const [aSupprimer, setASupprimer] = useState<DocumentFacturation | null>(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  async function envoyer(doc: DocumentFacturation) {
    setEnvoiEnCours(doc.id);
    try {
      await fetchClient(`/api/documents/${doc.id}/envoyer/`, { method: 'POST' });
      afficherToast(`${doc.numero} envoyé au client avec succès.`);
      setDocuments((prev) => prev.map((d) => (d.id === doc.id ? { ...d, statut: 'envoyee' } : d)));
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

  if (enEdition) {
    return (
      <DocumentForm
        document={enEdition === 'nouveau' ? null : enEdition}
        typeParDefaut={onglet}
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
        <button
          onClick={() => setEnEdition('nouveau')}
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          + Nouveau
        </button>
      </div>

      {(erreur || erreurChargement) && <p className="mt-4 text-sm text-red-600">{erreur || erreurChargement}</p>}

      <div className="mt-6 flex gap-1 border-b border-black/10">
        {(['soumission', 'facture'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setOnglet(type)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
              onglet === type
                ? 'border-accent text-navy'
                : 'border-transparent text-black/40 hover:text-black/60'
            }`}
          >
            {type === 'soumission' ? 'Soumissions' : 'Factures'}
          </button>
        ))}
      </div>

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
                <p className="font-semibold text-navy">{doc.numero}</p>
                <p className="truncate text-sm text-black/50">{doc.client_nom} · {doc.total} $</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statutStyle[doc.statut]}`}>
                  {statutLabel[doc.statut]}
                </span>
                {(doc.statut === 'acceptee' || doc.statut === 'payee') && doc.date_reponse && (
                  <span className="text-[11px] text-black/40" suppressHydrationWarning>
                    Signée le {new Date(doc.date_reponse).toLocaleDateString('fr-CA')}
                  </span>
                )}
              </div>
              {(doc.type_document === 'facture' || doc.statut === 'acceptee' || doc.statut === 'payee') && (
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
                {envoiEnCours === doc.id ? 'Envoi…' : 'Envoyer au client'}
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
