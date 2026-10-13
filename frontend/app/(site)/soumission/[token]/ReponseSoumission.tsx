import { apiUrlClient, type Coordonnees, type StatutDocument } from '@/lib/api';
import { ICONES, Icone } from '@/components/Icone';

interface Props {
  token: string;
  statut: StatutDocument;
  dateReponse: string | null;
  dateEcheance: string | null;
  numero: string;
  contratSigne: boolean;
  coordonnees: Coordonnees | null;
}

/**
 * Bas de la page publique d'une soumission. Le client ne répond plus en ligne : il nous
 * appelle ou répond au courriel, puis la soumission est convertie en facture depuis le
 * tableau de bord. Les anciens liens « ?reponse=accepter » des courriels déjà envoyés
 * mènent donc simplement ici, sans rien enregistrer.
 */
export default function ReponseSoumission({
  token,
  statut,
  dateReponse,
  dateEcheance,
  numero,
  contratSigne,
  coordonnees,
}: Props) {
  if (statut === 'acceptee' || statut === 'payee') {
    return (
      <div className="rounded-2xl bg-green-50 p-6 text-green-800 ring-1 ring-green-200">
        <p className="font-semibold">Soumission acceptée</p>
        <p className="mt-1 text-sm">
          Merci ! Votre acceptation a été enregistrée
          {dateReponse && (
            <span suppressHydrationWarning> le {new Date(dateReponse).toLocaleDateString('fr-CA')}</span>
          )}
          {contratSigne
            ? '. Une copie de cette soumission, devenue votre contrat officiel, vous a été envoyée par courriel.'
            : '. Votre facture vous sera transmise par courriel.'}
        </p>
        {contratSigne && (
          <a
            href={apiUrlClient(`/api/soumission-publique/${token}/contrat-pdf/`)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block rounded-full bg-green-700 px-5 py-2 text-sm font-semibold text-white hover:bg-green-800"
          >
            Télécharger mon contrat signé (PDF)
          </a>
        )}
      </div>
    );
  }

  if (statut === 'refusee') {
    return (
      <div className="rounded-2xl bg-black/5 p-6 text-black/70">
        <p className="font-semibold">Soumission refusée</p>
        <p className="mt-1 text-sm">
          La soumission {numero} a été refusée. N&apos;hésitez pas à nous contacter si vous souhaitez en discuter.
        </p>
      </div>
    );
  }

  if (statut === 'brouillon') {
    return (
      <div className="rounded-2xl bg-black/5 p-6 text-black/60">
        <p className="text-sm">Cette soumission n&apos;est pas encore disponible.</p>
      </div>
    );
  }

  const expiree = !!dateEcheance && dateEcheance < new Date().toISOString().slice(0, 10);

  return (
    <div className="overflow-hidden rounded-2xl border border-black/10">
      <div className="bg-gradient-to-br from-navy to-navy-light px-6 py-6 text-white">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
          {expiree ? 'Soumission expirée' : 'Pour donner suite'}
        </p>
        <h2 className="mt-1 text-xl font-bold">
          {expiree ? 'Contactez-nous pour la mettre à jour' : 'Cette soumission vous convient ?'}
        </h2>
        <p className="mt-2 text-sm text-white/70">
          {expiree ? (
            <>
              La date de validité (
              <span suppressHydrationWarning>
                {new Date(dateEcheance!).toLocaleDateString('fr-CA', { timeZone: 'UTC' })}
              </span>
              ) est dépassée. Les prix et disponibilités peuvent avoir changé.
            </>
          ) : (
            'Appelez-nous ou écrivez-nous : nous vous enverrons votre facture.'
          )}
        </p>
      </div>

      <div className="flex flex-col gap-3 p-5 sm:flex-row">
        {coordonnees?.telephone && (
          <a
            href={`tel:${coordonnees.telephone}`}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <Icone d={ICONES.telephone} className="h-4 w-4" />
            {coordonnees.telephone}
          </a>
        )}
        {coordonnees?.courriel && (
          <a
            href={`mailto:${coordonnees.courriel}?subject=${encodeURIComponent(`Soumission ${numero}`)}`}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-black/15 px-5 py-3 text-sm font-semibold text-navy transition hover:border-navy/40 hover:bg-black/[0.02]"
          >
            <Icone d={ICONES.envoyer} className="h-4 w-4" />
            Nous écrire
          </a>
        )}
      </div>
    </div>
  );
}
