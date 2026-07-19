'use client';

import { useEffect, useState } from 'react';

import { apiUrlClient, fetchClient, type DocumentFacturation } from '@/lib/api';
import { afficherToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';

import DocumentForm from './DocumentForm';

const statutLabel: Record<string, string> = {
  brouillon: 'Brouillon',
  envoyee: 'Envoyée',
  payee: 'Payée',
};

const statutStyle: Record<string, string> = {
  brouillon: 'bg-black/5 text-black/50',
  envoyee: 'bg-blue-100 text-blue-700',
  payee: 'bg-green-100 text-green-700',
};

export default function FacturationDashboardPage() {
  const [documents, setDocuments] = useState<DocumentFacturation[]>([]);
  const [enEdition, setEnEdition] = useState<DocumentFacturation | null | 'nouveau'>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState<number | null>(null);
  const [majEnCours, setMajEnCours] = useState<number | null>(null);
  const [aSupprimer, setASupprimer] = useState<DocumentFacturation | null>(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  function charger() {
    fetchClient<DocumentFacturation[]>('/api/documents/')
      .then(setDocuments)
      .catch((e) => setErreur(e.message));
  }

  useEffect(charger, []);

  async function envoyer(doc: DocumentFacturation) {
    setEnvoiEnCours(doc.id);
    try {
      await fetchClient(`/api/documents/${doc.id}/envoyer/`, { method: 'POST' });
      afficherToast(`${doc.numero} envoyé au client avec succès.`);
      charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de l\'envoi.');
    } finally {
      setEnvoiEnCours(null);
    }
  }

  async function togglePayee(doc: DocumentFacturation) {
    const nouveauStatut = doc.statut === 'payee' ? 'envoyee' : 'payee';
    setMajEnCours(doc.id);
    try {
      await fetchClient(`/api/documents/${doc.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ statut: nouveauStatut }),
      });
      afficherToast(
        nouveauStatut === 'payee'
          ? `${doc.numero} marquée comme payée — ajoutée au revenu.`
          : `${doc.numero} repassée à « envoyée ».`,
      );
      charger();
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
      setASupprimer(null);
      charger();
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
        onDone={() => {
          afficherToast(enEdition === 'nouveau' ? 'Document créé avec succès.' : 'Document mis à jour.');
          setEnEdition(null);
          charger();
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

      {erreur && <p className="mt-4 text-sm text-red-600">{erreur}</p>}

      <div className="mt-6 flex flex-col gap-3">
        {documents.map((doc) => (
          <div key={doc.id} className="flex items-center gap-4 rounded-xl border border-black/5 bg-white p-4 shadow-sm">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-navy">
                {doc.numero} <span className="font-normal text-black/40">— {doc.type_document === 'facture' ? 'Facture' : 'Soumission'}</span>
              </p>
              <p className="truncate text-sm text-black/50">{doc.client_nom} · {doc.total} $</p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statutStyle[doc.statut]}`}>
              {statutLabel[doc.statut]}
            </span>
            {doc.type_document === 'facture' && (
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
        {documents.length === 0 && <p className="text-black/50">Aucun document pour le moment.</p>}
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
