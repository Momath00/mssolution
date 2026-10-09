'use client';

import { useEffect, useState } from 'react';

import {
  fetchClient,
  type AlerteExtincPro,
  type ClientEntreprise,
  type OrganisationExtincPro,
} from '@/lib/api';
import { clientAvatarStyle, initiales } from '@/lib/clientColors';
import { ICONES, Icone } from '@/components/Icone';
import Pagination, { paginer } from '@/components/Pagination';
import { afficherToast } from '@/components/Toast';

import ExtincProClient, { messageErreur } from '../clients/ExtincProClient';

const A_LIER_PAR_PAGE = 5;

interface Etat {
  configure: boolean;
  erreur?: string;
}

function dateLongue(iso: string) {
  return new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('fr-CA', { dateStyle: 'medium' });
}

const STYLE_ALERTE = {
  a_bloquer: { icone: ICONES.cadenas, pastille: 'bg-red-50 text-red-600 ring-red-100', bouton: 'border-red-200 text-red-700 hover:bg-red-600 hover:text-white hover:border-red-600', action: 'Bloquer' },
  a_debloquer: { icone: ICONES.cadenasOuvert, pastille: 'bg-green-50 text-green-600 ring-green-100', bouton: 'border-green-200 text-green-700 hover:bg-green-600 hover:text-white hover:border-green-600', action: 'Débloquer' },
  resiliee: { icone: ICONES.batiment, pastille: 'bg-black/[0.04] text-black/40 ring-black/5', bouton: '', action: '' },
} as const;

function Statistique({ valeur, libelle, icone, teinte }: { valeur: number | string; libelle: string; icone: string; teinte: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-black/15 bg-white p-4 shadow-sm">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${teinte}`}>
        <Icone d={icone} className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums text-navy">{valeur}</p>
        <p className="text-[13px] text-black/55">{libelle}</p>
      </div>
    </div>
  );
}

function EnteteSection({ titre, nombre }: { titre: string; nombre: number }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 className="text-sm font-bold text-navy">{titre}</h2>
      <span className="rounded-full bg-black/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-black/70">{nombre}</span>
    </div>
  );
}

export default function ExtincProPage() {
  const [etat, setEtat] = useState<Etat | null>(null);
  const [alertes, setAlertes] = useState<AlerteExtincPro[] | null>(null);
  const [grace, setGrace] = useState(15);
  const [aLier, setALier] = useState<OrganisationExtincPro[] | null>(null);
  const [clients, setClients] = useState<ClientEntreprise[]>([]);
  const [nbAbonnes, setNbAbonnes] = useState<number | null>(null);
  const [choix, setChoix] = useState<Record<number, string>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<number | null>(null);
  const [fiche, setFiche] = useState<ClientEntreprise | null>(null);
  const [page, setPage] = useState(1);

  function charger() {
    fetchClient<Etat>('/api/extincpro/etat/')
      .then((e) => {
        setEtat(e);
        if (!e.configure) return;
        fetchClient<{ jours_grace: number; alertes: AlerteExtincPro[] }>('/api/extincpro/alertes/')
          .then((r) => { setAlertes(r.alertes); setGrace(r.jours_grace); })
          .catch((err) => setErreur(messageErreur(err)));
        fetchClient<OrganisationExtincPro[]>('/api/extincpro/a-lier/')
          .then(setALier)
          .catch((err) => setErreur(messageErreur(err)));
        fetchClient<ClientEntreprise[]>('/api/clients/?ligne=developpement').then(setClients).catch(() => {});
        fetchClient<ClientEntreprise[]>('/api/clients/?ligne=extincpro')
          .then((liste) => setNbAbonnes(liste.filter((c) => !c.extincpro_resilie_le).length))
          .catch(() => {});
      })
      .catch((err) => setErreur(messageErreur(err)));
  }

  useEffect(charger, []);

  async function lier(org: OrganisationExtincPro) {
    const valeur = choix[org.id] ?? (org.suggestions?.[0] ? String(org.suggestions[0].id) : 'nouveau');
    setEnCours(org.id);
    setErreur(null);
    try {
      await fetchClient(`/api/extincpro/a-lier/${org.id}/lier/`, {
        method: 'POST',
        body: JSON.stringify(valeur === 'nouveau' ? { creer: true } : { client_id: Number(valeur) }),
      });
      afficherToast(`« ${org.nom} » est maintenant gérée par MS Solution.`);
      charger();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnCours(null);
    }
  }

  async function ouvrirFiche(clientId: number) {
    try {
      setFiche(await fetchClient<ClientEntreprise>(`/api/clients/${clientId}/`));
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  if (fiche) {
    return <ExtincProClient client={fiche} onBack={() => { setFiche(null); charger(); }} />;
  }

  const listeALier = aLier || [];
  const { nbPages, pageCourante, elements: orgsPage } = paginer(listeALier, page, A_LIER_PAR_PAGE);
  const nbDecisions = (alertes || []).filter((a) => a.type !== 'resiliee').length;

  return (
    <div>
      {/* En-tête */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-navy text-accent shadow-sm">
          <Icone d={ICONES.flamme} className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy">
            Extinc<span className="text-accent">Pro</span>
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-black/55">
            Abonnements au logiciel ExtincPro : les organisations se créent dans ExtincPro, puis se lient ici à un
            client pour la facturation.
          </p>
        </div>
      </div>

      {erreur && <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</p>}

      {etat && !etat.configure && (
        <div className="mt-6 flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <Icone d={ICONES.alerte} className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            L&apos;intégration n&apos;est pas configurée. Renseignez <code>EXTINCPRO_API_URL</code> et{' '}
            <code>EXTINCPRO_API_KEY</code> sur le serveur (la clé doit être identique à <code>MS_SOLUTION_API_KEY</code>{' '}
            côté ExtincPro).
          </p>
        </div>
      )}
      {etat?.erreur && (
        <p className="mt-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ExtincPro : {etat.erreur}
        </p>
      )}

      {etat?.configure && (
        <>
          {/* Statistiques */}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Statistique
              valeur={alertes === null ? '…' : nbDecisions}
              libelle="Décision(s) en attente"
              icone={ICONES.alerte}
              teinte={nbDecisions > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}
            />
            <Statistique
              valeur={aLier === null ? '…' : listeALier.length}
              libelle="Organisation(s) à lier"
              icone={ICONES.lien}
              teinte="bg-amber-50 text-amber-600"
            />
            <Statistique
              valeur={nbAbonnes ?? '…'}
              libelle="Abonné(s) ExtincPro"
              icone={ICONES.utilisateurs}
              teinte="bg-navy/5 text-navy"
            />
          </div>

          {/* À décider */}
          <section className="mt-8">
            <EnteteSection titre="À décider" nombre={(alertes || []).length} />
            <div className="overflow-hidden rounded-2xl border border-black/15 bg-white shadow-sm">
              {alertes === null && <p className="px-5 py-6 text-sm text-black/45">Chargement…</p>}
              {alertes?.length === 0 && (
                <div className="flex items-center gap-3 px-5 py-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-600">
                    <Icone d={ICONES.succes} className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-navy">Tout est en ordre</p>
                    <p className="text-sm text-black/50">Aucun retard dépassant {grace} jours, aucun accès à rétablir.</p>
                  </div>
                </div>
              )}
              <ul className="divide-y divide-black/10">
                {(alertes || []).map((a) => {
                  const style = STYLE_ALERTE[a.type];
                  return (
                    <li key={`${a.type}-${a.client_id}`} className="flex flex-wrap items-center gap-4 px-5 py-4">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-4 ${style.pastille}`}>
                        <Icone d={style.icone} className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-navy">{a.client_nom}</p>
                          {a.type === 'a_bloquer' && (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700 ring-1 ring-red-200">
                              {a.retard?.jours} jours de retard
                            </span>
                          )}
                          {a.type === 'a_debloquer' && (
                            <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-700 ring-1 ring-green-200">
                              À jour
                            </span>
                          )}
                          {a.type === 'resiliee' && (
                            <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-bold text-black/55 ring-1 ring-black/10">
                              Résiliée
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[13px] text-black/55">
                          {a.type === 'a_bloquer' &&
                            `${Number(a.retard?.montant).toFixed(2)} $ en retard · délai de grâce de ${grace} jours dépassé · accès toujours actif`}
                          {a.type === 'a_debloquer' && 'Plus rien en retard, mais l’accès est toujours bloqué.'}
                          {a.type === 'resiliee' && "L'organisation a été supprimée dans ExtincPro — client et factures conservés."}
                        </p>
                      </div>
                      {a.type !== 'resiliee' && (
                        <button
                          onClick={() => ouvrirFiche(a.client_id)}
                          className={`flex items-center gap-1.5 rounded-lg border bg-white px-3.5 py-2 text-sm font-semibold transition ${style.bouton}`}
                        >
                          {style.action}
                          <Icone d={ICONES.fleche} className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          {/* À lier */}
          <section className="mt-8">
            <EnteteSection titre="Organisations à lier" nombre={listeALier.length} />
            <div className="overflow-hidden rounded-2xl border border-black/15 bg-white shadow-sm">
              {aLier === null && <p className="px-5 py-6 text-sm text-black/45">Chargement…</p>}
              {aLier?.length === 0 && (
                <div className="flex items-center gap-3 px-5 py-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-600">
                    <Icone d={ICONES.succes} className="h-5 w-5" />
                  </div>
                  <p className="font-semibold text-navy">Toutes les organisations sont liées à un client.</p>
                </div>
              )}
              <ul className="divide-y divide-black/10">
                {orgsPage.map((org) => {
                  const suggestion = org.suggestions?.[0];
                  const valeur = choix[org.id] ?? (suggestion ? String(suggestion.id) : 'nouveau');
                  return (
                    <li key={org.id} className="px-5 py-4">
                      <div className="flex items-start gap-4">
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm"
                          style={clientAvatarStyle(org.id) || undefined}
                        >
                          {initiales(org.nom)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-navy">{org.nom}</p>
                            {org.date_fin_essai && (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200">
                                Essai jusqu&apos;au {dateLongue(org.date_fin_essai)}
                              </span>
                            )}
                            {!org.est_active && (
                              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700 ring-1 ring-red-200">
                                Bloquée
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-black/55">
                            <span className="flex items-center gap-1.5">
                              <Icone d={ICONES.calendrier} className="h-3.5 w-3.5 text-black/35" />
                              Créée le {dateLongue(org.date_creation)}
                            </span>
                            {org.contact?.courriel && (
                              <span className="flex min-w-0 items-center gap-1.5">
                                <Icone d={ICONES.courriel} className="h-3.5 w-3.5 shrink-0 text-black/35" />
                                <span className="truncate">{org.contact.courriel}</span>
                              </span>
                            )}
                            <span className="flex items-center gap-1.5">
                              <Icone d={ICONES.utilisateurs} className="h-3.5 w-3.5 text-black/35" />
                              {org.nb_utilisateurs} utilisateur{org.nb_utilisateurs !== 1 ? 's' : ''}
                            </span>
                          </div>
                          {suggestion && (
                            <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-[12px] font-medium text-amber-900 ring-1 ring-amber-200">
                              <Icone d={ICONES.alerte} className="h-3.5 w-3.5" />
                              Client existant possible : <strong>{suggestion.nom_entreprise}</strong>
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-col gap-2 sm:ml-[60px] sm:flex-row">
                        <select
                          value={valeur}
                          onChange={(e) => setChoix({ ...choix, [org.id]: e.target.value })}
                          className="min-w-0 flex-1 rounded-xl border border-black/20 bg-white px-3 py-2.5 text-sm text-navy shadow-sm focus:border-navy focus:outline-none focus:ring-4 focus:ring-navy/10"
                        >
                          <option value="nouveau">Créer un nouveau client « {org.nom} »</option>
                          {(org.suggestions || []).map((c) => (
                            <option key={`s-${c.id}`} value={c.id}>Lier à {c.nom_entreprise} (suggéré)</option>
                          ))}
                          {clients
                            .filter((c) => !(org.suggestions || []).some((s) => s.id === c.id))
                            .map((c) => (
                              <option key={c.id} value={c.id}>Lier à {c.nom_entreprise}</option>
                            ))}
                        </select>
                        <button
                          onClick={() => lier(org)}
                          disabled={enCours === org.id}
                          className="flex items-center justify-center gap-1.5 rounded-xl bg-navy px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:shadow-md disabled:opacity-60"
                        >
                          <Icone d={ICONES.lien} />
                          {enCours === org.id ? 'Liaison…' : 'Lier'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <Pagination
                page={pageCourante}
                nbPages={nbPages}
                total={listeALier.length}
                parPage={A_LIER_PAR_PAGE}
                libelle={['organisation', 'organisations']}
                onChange={setPage}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
