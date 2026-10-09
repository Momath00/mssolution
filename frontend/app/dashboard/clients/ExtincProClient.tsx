'use client';

import { useEffect, useState } from 'react';

import { fetchClient, type ClientEntreprise, type ClientExtincPro, type OrganisationExtincPro } from '@/lib/api';
import { afficherToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';

// Les vues ExtincPro répondent {"error": "..."} ; fetchClient le remonte en JSON brut.
export function messageErreur(e: unknown, defaut = 'Erreur lors de la communication avec ExtincPro.') {
  const brut = e instanceof Error ? e.message : '';
  try {
    return JSON.parse(brut).error || brut || defaut;
  } catch {
    return brut || defaut;
  }
}

const LIBELLES_ACTIONS: Record<string, string> = {
  lier: 'Liaison au client',
  delier: 'Liaison retirée',
  bloquer: 'Accès bloqué',
  debloquer: 'Accès débloqué',
  modules: 'Modules modifiés',
  essai: "Fin d'essai modifiée",
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('fr-CA', { dateStyle: 'long' });
}

interface Props {
  client: ClientEntreprise;
  onBack: () => void;
}

export default function ExtincProClient({ client, onBack }: Props) {
  const [etat, setEtat] = useState<ClientExtincPro | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<'bloquer' | 'delier' | null>(null);
  const [motif, setMotif] = useState('');
  const [dateEssai, setDateEssai] = useState('');

  function charger() {
    fetchClient<ClientExtincPro>(`/api/clients/${client.id}/extincpro/`)
      .then((donnees) => {
        setEtat(donnees);
        setDateEssai(donnees.organisation?.date_fin_essai || '');
      })
      .catch((e) => setErreur(messageErreur(e)));
  }

  useEffect(charger, [client.id]);

  async function ordre(action: string, corps: object, succes: string) {
    setEnCours(action);
    setErreur(null);
    try {
      await fetchClient(`/api/clients/${client.id}/extincpro/${action}/`, {
        method: 'POST',
        body: JSON.stringify(corps),
      });
      afficherToast(succes);
      charger();
    } catch (e) {
      setErreur(messageErreur(e));
      charger();
    } finally {
      setEnCours(null);
      setConfirmation(null);
    }
  }

  const org: OrganisationExtincPro | null | undefined = etat?.organisation;
  const retard = etat?.retard;
  const grace = etat?.jours_grace ?? 15;

  return (
    <div>
      <button onClick={onBack} className="text-sm font-semibold text-black/50 hover:text-navy">
        ← Retour aux clients
      </button>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-navy">{client.nom_entreprise}</h1>
        <span className="rounded-full bg-navy px-2.5 py-0.5 text-xs font-bold text-white">
          Extinc<span className="text-accent">Pro</span>
        </span>
      </div>

      {erreur && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}
      {!etat && !erreur && <p className="mt-6 text-sm text-black/50">Chargement…</p>}

      {etat && !etat.lie && <p className="mt-6 text-sm text-black/50">Ce client n&apos;est lié à aucune organisation ExtincPro.</p>}

      {etat?.lie && etat.resilie_le && (
        <div className="mt-6 rounded-xl border border-black/10 bg-black/[0.03] p-4 text-sm text-black/70">
          L&apos;organisation n° {etat.organisation_id} a été supprimée dans ExtincPro le {formatDate(etat.resilie_le)}.
          Le client et ses factures sont conservés.
        </div>
      )}

      {etat?.lie && etat.erreur && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          État en direct indisponible : {etat.erreur}
        </p>
      )}

      {org && (
        <div className="mt-6 flex flex-col gap-4">
          {/* Accès */}
          <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-black/40">Organisation n° {org.id}</p>
                <p className="mt-1 font-semibold text-navy">{org.nom}</p>
                <p className="text-sm text-black/50">
                  {org.nb_utilisateurs} utilisateur{org.nb_utilisateurs !== 1 ? 's' : ''}
                  {org.contact?.courriel ? ` · ${org.contact.courriel}` : ''}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  org.est_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}
              >
                {org.est_active ? 'Accès actif' : 'Accès bloqué'}
              </span>
            </div>

            <div className="mt-4 rounded-lg bg-black/[0.03] px-3 py-2 text-sm">
              {retard && retard.jours > 0 ? (
                <span className={retard.jours >= grace ? 'font-semibold text-red-700' : 'text-amber-700'}>
                  Abonnement en retard de {retard.jours} jour{retard.jours !== 1 ? 's' : ''} ({Number(retard.montant).toFixed(2)} $
                  {retard.facture ? `, facture ${retard.facture}` : ''})
                  {retard.jours >= grace ? ` — délai de grâce de ${grace} jours dépassé.` : '.'}
                </span>
              ) : (
                <span className="text-green-700">Abonnement à jour — aucun montant en retard.</span>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {org.est_active ? (
                <button
                  onClick={() => { setMotif(retard && retard.jours > 0 ? `Retard de ${retard.jours} jours` : ''); setConfirmation('bloquer'); }}
                  disabled={!!enCours}
                  className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                >
                  Bloquer l&apos;accès
                </button>
              ) : (
                <button
                  onClick={() => ordre('acces', { est_active: true }, 'Accès débloqué.')}
                  disabled={!!enCours}
                  className="rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                >
                  {enCours === 'acces' ? 'Déblocage…' : "Débloquer l'accès"}
                </button>
              )}
            </div>
          </section>

          {/* Modules */}
          <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-black/40">Modules</p>
            <div className="mt-3 flex flex-col divide-y divide-black/5">
              {org.modules.map((m) => (
                <label key={m.code} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-navy">{m.nom}</span>
                  <input
                    type="checkbox"
                    checked={!!m.actif}
                    disabled={!!enCours}
                    onChange={() =>
                      ordre('modules', { modules: { [m.code]: !m.actif } }, `${m.nom} ${m.actif ? 'désactivé' : 'activé'}.`)
                    }
                    className="h-4 w-4 accent-accent"
                  />
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-black/40">
              Les modules vendus sur une facture d&apos;abonnement s&apos;activent seuls au premier paiement.
            </p>
          </section>

          {/* Essai */}
          <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-black/40">Essai gratuit</p>
            <p className="mt-1 text-sm text-black/60">
              {org.date_fin_essai ? `Se termine le ${formatDate(org.date_fin_essai)}.` : 'Aucun essai en cours — client payant.'}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={dateEssai}
                onChange={(e) => setDateEssai(e.target.value)}
                className="rounded-lg border border-black/25 px-3 py-2 text-sm focus:border-navy focus:outline-none"
              />
              <button
                onClick={() => ordre('essai', { date_fin_essai: dateEssai || null }, "Fin d'essai enregistrée.")}
                disabled={!!enCours || dateEssai === (org.date_fin_essai || '')}
                className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
              >
                Enregistrer
              </button>
              {org.date_fin_essai && (
                <button
                  onClick={() => ordre('essai', { date_fin_essai: null }, "Essai retiré : client payant.")}
                  disabled={!!enCours}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50 disabled:opacity-40"
                >
                  Retirer l&apos;essai (client payant)
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {/* Historique */}
      {etat?.lie && (
        <section className="mt-4 rounded-xl border border-black/5 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-black/40">Historique des ordres envoyés</p>
          {etat.journal && etat.journal.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1.5 text-sm">
              {etat.journal.map((a) => (
                <li key={a.id} className="flex flex-wrap gap-x-2">
                  <span className="text-black/40">{new Date(a.date).toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  <span className={a.succes ? 'text-navy' : 'text-red-700'}>
                    {LIBELLES_ACTIONS[a.action] || a.action}
                    {!a.succes && ` — échec : ${a.erreur}`}
                  </span>
                  {a.utilisateur_nom && <span className="text-black/40">par {a.utilisateur_nom}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-black/50">Aucun ordre pour le moment.</p>
          )}
          <button
            onClick={() => setConfirmation('delier')}
            disabled={!!enCours}
            className="mt-4 text-xs font-semibold text-black/40 hover:text-red-600"
          >
            Délier ce client de l&apos;organisation
          </button>
        </section>
      )}

      {confirmation === 'bloquer' && org && (
        <div
          className="animate-backdrop-in fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
          onClick={() => setConfirmation(null)}
        >
          <div className="animate-modal-pop w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-navy">Bloquer « {org.nom} » ?</h2>
            <p className="mt-2 text-sm text-black/60">
              Plus aucun utilisateur de cette organisation ne pourra se connecter à ExtincPro, jusqu&apos;à ce que vous
              débloquiez l&apos;accès. Aucune donnée n&apos;est supprimée.
            </p>
            <input
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Motif (gardé dans l'historique)"
              className="mt-4 w-full rounded-lg border border-black/25 px-3 py-2 text-sm focus:border-navy focus:outline-none"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmation(null)}
                className="rounded-full px-4 py-2 text-sm font-semibold text-black/50 hover:bg-black/5"
              >
                Annuler
              </button>
              <button
                onClick={() => ordre('acces', { est_active: false, motif }, 'Accès bloqué.')}
                disabled={!!enCours}
                className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {enCours === 'acces' ? 'Blocage…' : "Bloquer l'accès"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmation === 'delier' && (
        <ConfirmDialog
          titre="Délier ce client ?"
          message="L'organisation reviendra dans la liste « À lier » et sa gestion (accès, modules, essai) repassera au super-admin d'ExtincPro."
          labelConfirmer="Délier"
          labelEnCours="…"
          enCours={!!enCours}
          onConfirm={() => ordre('delier', {}, 'Client délié.')}
          onCancel={() => setConfirmation(null)}
        />
      )}
    </div>
  );
}
