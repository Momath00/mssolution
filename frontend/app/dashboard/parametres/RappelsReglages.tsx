'use client';

import { useEffect, useState } from 'react';

import { fetchClient, type ParametresRappels, type ResultatRappels } from '@/lib/api';
import { afficherToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';

const DELAIS: { cle: Exclude<keyof ParametresRappels, 'rappels_actifs'>; titre: string; aide: string; suffixe: string }[] = [
  {
    cle: 'relance_soumission_jours',
    titre: 'Relancer une soumission sans réponse',
    aide: 'Une seule relance « Avez-vous consulté la soumission ? », X jours après l’envoi.',
    suffixe: 'jours après l’envoi',
  },
  {
    cle: 'rappel_expiration_jours',
    titre: 'Prévenir avant l’expiration d’une soumission',
    aide: 'Si la soumission a une date d’échéance. Tu reçois aussi une alerte quand elle expire sans réponse.',
    suffixe: 'jours avant l’expiration',
  },
  {
    cle: 'rappel_avant_versement_jours',
    titre: 'Rappeler un versement à venir',
    aide: 'Pour chaque versement non payé d’une facture (ou l’échéance d’une facture sans plan).',
    suffixe: 'jours avant la date',
  },
  {
    cle: 'rappel_retard_intervalle_jours',
    titre: 'Relancer un paiement en retard',
    aide: 'Rappel envoyé le lendemain du retard, puis répété au plus une fois par intervalle.',
    suffixe: 'jours entre deux rappels',
  },
];

const STATUT_ACTION: Record<string, string> = {
  simulation: 'bg-black/5 text-black/50',
  envoye: 'bg-green-100 text-green-700',
  echec: 'bg-red-100 text-red-700',
};

const LIBELLE_STATUT: Record<string, string> = {
  simulation: 'Partirait',
  envoye: 'Envoyé',
  echec: 'Échec',
};

export default function RappelsReglages() {
  const [reglages, setReglages] = useState<ParametresRappels | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [sauvegarde, setSauvegarde] = useState(false);
  const [execution, setExecution] = useState(false);
  const [resultat, setResultat] = useState<ResultatRappels | null>(null);
  const [confirmer, setConfirmer] = useState(false);

  useEffect(() => {
    fetchClient<ParametresRappels>('/api/parametres-rappels/')
      .then(setReglages)
      .catch((e) => setErreur(e.message));
  }, []);

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    if (!reglages) return;
    setSauvegarde(true);
    setErreur(null);
    try {
      setReglages(
        await fetchClient<ParametresRappels>('/api/parametres-rappels/', {
          method: 'PUT',
          body: JSON.stringify(reglages),
        }),
      );
      afficherToast('Réglages des rappels enregistrés.');
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de l’enregistrement.');
    } finally {
      setSauvegarde(false);
    }
  }

  async function lancer(simulation: boolean) {
    setExecution(true);
    setErreur(null);
    try {
      const r = await fetchClient<ResultatRappels>('/api/rappels/executer/', {
        method: 'POST',
        body: JSON.stringify({ simulation }),
      });
      setResultat(r);
      if (!simulation) {
        afficherToast(
          r.echecs ? `${r.envoyes} rappel(s) envoyé(s), ${r.echecs} échec(s).` : `${r.envoyes} rappel(s) envoyé(s).`,
          r.echecs ? 'erreur' : 'succes',
        );
      }
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de l’exécution des rappels.');
    } finally {
      setExecution(false);
      setConfirmer(false);
    }
  }

  if (!reglages) {
    return erreur ? <p className="text-sm text-red-600">{erreur}</p> : <p className="text-sm text-black/50">Chargement…</p>;
  }

  return (
    <section className="max-w-xl">
      <h2 className="text-xl font-bold text-navy">Rappels automatiques</h2>
      <p className="mt-1 text-sm text-black/50">
        Envoyés automatiquement chaque matin. Chaque rappel ne part qu&apos;une seule fois, et plus rien ne part dès
        que le client répond ou paie. Mets un délai à 0 pour désactiver un rappel en particulier.
      </p>

      <form onSubmit={enregistrer} className="mt-4 flex flex-col gap-4">
        <label className="flex items-center gap-3 rounded-lg border border-black/10 bg-white p-3 text-sm font-semibold text-navy">
          <input
            type="checkbox"
            checked={reglages.rappels_actifs}
            onChange={(e) => setReglages({ ...reglages, rappels_actifs: e.target.checked })}
            className="h-4 w-4 accent-accent"
          />
          Rappels automatiques activés
        </label>

        {DELAIS.map((d) => (
          <div key={d.cle} className={reglages.rappels_actifs ? '' : 'opacity-50'}>
            <label className="mb-1 block text-sm font-medium text-navy">{d.titre}</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={90}
                value={reglages[d.cle]}
                disabled={!reglages.rappels_actifs}
                onChange={(e) => setReglages({ ...reglages, [d.cle]: Math.max(0, Math.min(90, Number(e.target.value) || 0)) })}
                className="w-24 rounded-lg border border-black/25 px-3 py-2 text-sm focus:border-navy focus:outline-none"
              />
              <span className="text-sm text-black/50">
                {reglages[d.cle] === 0 ? 'désactivé' : d.suffixe}
              </span>
            </div>
            <p className="mt-1 text-xs text-black/40">{d.aide}</p>
          </div>
        ))}

        {erreur && <p className="text-sm text-red-600">{erreur}</p>}

        <button
          type="submit"
          disabled={sauvegarde}
          className="w-fit rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {sauvegarde ? 'Enregistrement…' : 'Enregistrer les réglages'}
        </button>
      </form>

      <div className="mt-6 rounded-xl border border-black/10 bg-white p-4">
        <p className="text-sm font-semibold text-navy">Rappels du jour</p>
        <p className="mt-1 text-xs text-black/50">
          Vérifie ce qui partirait aujourd&apos;hui, sans rien envoyer. Tu peux aussi les envoyer tout de suite sans
          attendre le passage automatique du matin.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            onClick={() => lancer(true)}
            disabled={execution}
            className="rounded-full border border-navy px-4 py-2 text-sm font-semibold text-navy hover:bg-navy hover:text-white disabled:opacity-50"
          >
            {execution ? 'Vérification…' : 'Voir ce qui partirait aujourd’hui'}
          </button>
          <button
            onClick={() => setConfirmer(true)}
            disabled={execution || !reglages.rappels_actifs}
            className="rounded-full px-4 py-2 text-sm font-semibold text-black/50 hover:bg-black/5 disabled:opacity-50"
          >
            Envoyer maintenant
          </button>
        </div>

        {resultat && (
          <div className="mt-4">
            {!resultat.actifs ? (
              <p className="text-sm text-black/50">Les rappels automatiques sont désactivés.</p>
            ) : resultat.actions.length === 0 ? (
              <p className="text-sm text-black/50">Aucun rappel à envoyer aujourd&apos;hui.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-black/5">
                {resultat.actions.map((a, i) => (
                  <li key={i} className="flex items-start gap-3 py-2 text-sm">
                    <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUT_ACTION[a.statut]}`}>
                      {LIBELLE_STATUT[a.statut]}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-navy">{a.libelle}</p>
                      <p className="text-xs text-black/50">
                        {a.numero} · {a.client} · {a.detail}
                      </p>
                      {a.erreur && <p className="text-xs text-red-600">{a.erreur}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {confirmer && (
        <ConfirmDialog
          titre="Envoyer les rappels maintenant ?"
          message="Les rappels du jour partiront tout de suite par courriel à tes clients (ceux affichés par « Voir ce qui partirait »)."
          enCours={execution}
          labelConfirmer="Envoyer"
          labelEnCours="Envoi…"
          onConfirm={() => lancer(false)}
          onCancel={() => setConfirmer(false)}
        />
      )}
    </section>
  );
}
