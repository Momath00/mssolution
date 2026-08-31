import { notFound } from 'next/navigation';

import { apiUrlServer, type SoumissionPublique } from '@/lib/api';

import ReponseSoumission from './ReponseSoumission';

export const metadata = {
  title: 'Votre soumission',
  robots: { index: false, follow: false },
};

async function getSoumission(token: string): Promise<SoumissionPublique | null> {
  try {
    const res = await fetch(apiUrlServer(`/api/soumission-publique/${token}/`), { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function SoumissionPubliquePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ reponse?: string }>;
}) {
  const { token } = await params;
  const { reponse } = await searchParams;
  const soumission = await getSoumission(token);
  if (!soumission) notFound();
  const intentionInitiale = reponse === 'accepter' || reponse === 'refuser' ? reponse : null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">
        Soumission n&deg; {soumission.numero}
      </p>
      <h1 className="mt-1 flex flex-wrap items-center gap-2.5 text-3xl font-bold text-navy">
        {soumission.categorie === 'abonnement_saas' ? (
          <>
            Abonnement annuel
            <span className="inline-block rounded-md bg-black px-3 py-1 text-2xl font-extrabold tracking-tight text-white">
              Extinc<span className="text-red-600">Pro</span>
            </span>
          </>
        ) : (
          soumission.categorie_label || 'Votre soumission'
        )}
      </h1>
      <p className="mt-2 text-black/60">Préparée pour {soumission.client_nom}.</p>

      <div className="mt-8 overflow-x-auto rounded-xl border border-black/10">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="bg-navy text-white">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Description</th>
              <th className="px-4 py-3 text-right font-semibold">Qté</th>
              <th className="px-4 py-3 text-right font-semibold">Prix unit.</th>
              <th className="px-4 py-3 text-right font-semibold">Montant</th>
            </tr>
          </thead>
          <tbody>
            {soumission.lignes.map((ligne, i) => (
              <tr key={i} className="border-t border-black/5">
                <td className="px-4 py-3">{ligne.description}</td>
                <td className="px-4 py-3 text-right">{ligne.quantite}</td>
                <td className="px-4 py-3 text-right">{ligne.prix_unitaire} $</td>
                <td className="px-4 py-3 text-right">{ligne.montant} $</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ml-auto mt-4 w-full max-w-64 text-sm">
        <div className="flex justify-between py-1">
          <span className="text-black/60">Sous-total</span>
          <span>{soumission.sous_total} $</span>
        </div>
        <div className="flex justify-between py-1 text-black/50">
          <span>TPS</span>
          <span>{soumission.montant_tps} $</span>
        </div>
        <div className="flex justify-between py-1 text-black/50">
          <span>TVQ</span>
          <span>{soumission.montant_tvq} $</span>
        </div>
        <div className="flex justify-between border-t border-black/20 py-2 font-bold text-navy">
          <span>Total</span>
          <span>{soumission.total} $</span>
        </div>
      </div>

      {soumission.conditions.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xl font-bold text-navy">Modalités</h2>
          <ul className="mt-4 flex flex-col gap-2.5">
            {soumission.conditions.map((clause, i) => (
              <li key={i} className="text-sm leading-relaxed text-black/60">
                <span className="font-semibold text-navy">{clause.titre}</span> — {clause.texte}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-10 border-t border-black/10 pt-8">
        <ReponseSoumission
          token={token}
          statutInitial={soumission.statut}
          dateReponse={soumission.date_reponse}
          dateEcheance={soumission.date_echeance}
          numero={soumission.numero}
          intentionInitiale={intentionInitiale}
        />
      </div>
    </div>
  );
}
