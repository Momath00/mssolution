'use client';

import { useEffect, useRef, useState } from 'react';

import { apiUrlClient, fetchClient, type StatutDocument } from '@/lib/api';
import ConfirmDialog from '@/components/ConfirmDialog';

interface Props {
  token: string;
  statutInitial: StatutDocument;
  dateReponse: string | null;
  dateEcheance: string | null;
  numero: string;
  intentionInitiale?: 'accepter' | 'refuser' | null;
}

export default function ReponseSoumission({
  token,
  statutInitial,
  dateReponse,
  dateEcheance,
  numero,
  intentionInitiale,
}: Props) {
  const [statut, setStatut] = useState(statutInitial);
  const [dateAffichee, setDateAffichee] = useState(dateReponse);
  const [demandeRefus, setDemandeRefus] = useState(intentionInitiale === 'refuser');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Comparaison de chaînes ISO (AAAA-MM-JJ) plutôt que d'objets Date : évite tout écart de
  // fuseau horaire entre le rendu serveur et l'hydratation client (source d'un mismatch React).
  const expiree = statut === 'envoyee' && !!dateEcheance && dateEcheance < new Date().toISOString().slice(0, 10);

  async function repondre(reponse: 'acceptee' | 'refusee') {
    setEnCours(true);
    setErreur(null);
    try {
      const data = await fetchClient<{ statut: StatutDocument; date_reponse: string | null }>(
        `/api/soumission-publique/${token}/repondre/`,
        {
          method: 'POST',
          // Un seul clic sur « Accepter » vaut consentement — pas de case à cocher séparée.
          body: JSON.stringify({ reponse, accepte_conditions: true }),
        },
      );
      setStatut(data.statut);
      setDateAffichee(data.date_reponse);
      setDemandeRefus(false);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Une erreur est survenue.');
    } finally {
      setEnCours(false);
    }
  }

  // Venir du lien « Accepter » du courriel accepte directement, sans repasser par un clic
  // supplémentaire sur la page — le clic dans le courriel est déjà le geste d'acceptation.
  const acceptationAuto = intentionInitiale === 'accepter' && statut === 'envoyee' && !expiree;
  // Un ref (pas juste enCours) car React StrictMode exécute cet effet deux fois au montage en
  // développement — sans ce garde-fou, ça envoie deux requêtes d'acceptation simultanées.
  const dejaDeclenche = useRef(false);
  useEffect(() => {
    if (acceptationAuto && !dejaDeclenche.current) {
      dejaDeclenche.current = true;
      repondre('acceptee');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (statut === 'acceptee') {
    return (
      <div className="rounded-xl bg-green-50 p-6 text-green-800">
        <p className="font-semibold">Soumission acceptée</p>
        <p className="mt-1 text-sm">
          Merci ! Votre acceptation a été enregistrée
          {dateAffichee && (
            <span suppressHydrationWarning> le {new Date(dateAffichee).toLocaleString('fr-CA')}</span>
          )}
          . Une copie de cette soumission, devenue votre contrat officiel, vous a été envoyée par courriel.
        </p>
        <a
          href={apiUrlClient(`/api/soumission-publique/${token}/contrat-pdf/`)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block rounded-full bg-green-700 px-5 py-2 text-sm font-semibold text-white hover:bg-green-800"
        >
          Télécharger mon contrat signé (PDF)
        </a>
      </div>
    );
  }

  if (statut === 'refusee') {
    return (
      <div className="rounded-xl bg-black/5 p-6 text-black/70">
        <p className="font-semibold">Soumission refusée</p>
        <p className="mt-1 text-sm">
          Vous avez refusé la soumission {numero}. N&apos;hésitez pas à nous contacter si vous souhaitez en discuter.
        </p>
      </div>
    );
  }

  if (statut === 'brouillon') {
    return (
      <div className="rounded-xl bg-black/5 p-6 text-black/60">
        <p className="text-sm">Cette soumission n&apos;est pas encore disponible.</p>
      </div>
    );
  }

  if (expiree) {
    return (
      <div className="rounded-xl bg-black/5 p-6 text-black/60">
        <p className="font-semibold text-navy">Ce lien a expiré</p>
        <p className="mt-1 text-sm">
          La date d&apos;échéance de la soumission {numero} (
          <span suppressHydrationWarning>
            {new Date(dateEcheance!).toLocaleDateString('fr-CA', { timeZone: 'UTC' })}
          </span>
          ) est dépassée. Contactez-nous si vous souhaitez toujours y donner suite.
        </p>
      </div>
    );
  }

  if (acceptationAuto && !erreur) {
    return (
      <div className="rounded-xl bg-black/[0.02] p-6 text-center text-black/60">
        <p className="text-sm">Traitement de votre acceptation…</p>
        {erreur && <p className="mt-2 text-sm text-red-600">{erreur}</p>}
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-navy">Votre réponse</h2>
      <p className="mt-2 text-sm text-black/60">
        En acceptant, cette soumission devient votre contrat officiel. Une copie signée vous sera envoyée par
        courriel, avec copie à notre équipe.
      </p>

      <div className="mt-5 flex flex-col gap-3 rounded-xl border border-black/10 bg-black/[0.02] p-5">
        <p className="flex items-start gap-2 text-xs text-black/50">
          <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0">
            <path
              fillRule="evenodd"
              d="M10 1a4 4 0 00-4 4v2H5a2 2 0 00-2 2v7a2 2 0 002 2h10a2 2 0 002-2V9a2 2 0 00-2-2h-1V5a4 4 0 00-4-4zm2 6V5a2 2 0 10-4 0v2h4zm-2 4a1 1 0 011 1v2a1 1 0 11-2 0v-2a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
          Signature électronique sécurisée : l&apos;horodatage et l&apos;adresse IP de votre acceptation sont
          enregistrés à des fins de preuve légale.
        </p>

        {erreur && <p className="text-sm text-red-600">{erreur}</p>}

        <div className="mt-2 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={enCours}
            onClick={() => repondre('acceptee')}
            className="rounded-full bg-green-600 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-40"
          >
            {enCours ? 'Envoi…' : 'Accepter la soumission'}
          </button>
          <button
            type="button"
            disabled={enCours}
            onClick={() => setDemandeRefus(true)}
            className="rounded-full px-6 py-3 text-sm font-semibold text-black/50 hover:bg-black/5 disabled:opacity-40"
          >
            Refuser
          </button>
        </div>
      </div>

      {demandeRefus && (
        <ConfirmDialog
          titre="Refuser cette soumission ?"
          message={`Vous ne pourrez plus répondre à ${numero} par la suite.`}
          enCours={enCours}
          labelConfirmer="Refuser"
          labelEnCours="Envoi…"
          onConfirm={() => repondre('refusee')}
          onCancel={() => setDemandeRefus(false)}
        />
      )}
    </div>
  );
}
