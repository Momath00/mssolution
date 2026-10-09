'use client';

import { useEffect, useMemo, useState } from 'react';

import { fetchClient, type ClientEntreprise } from '@/lib/api';
import { clientAvatarStyle, initiales } from '@/lib/clientColors';
import { afficherToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { ICONES, Icone } from '@/components/Icone';
import Pagination, { paginer } from '@/components/Pagination';

import ClientForm from './ClientForm';
import ExtincProClient from './ExtincProClient';

type Ligne = 'tous' | 'developpement' | 'extincpro';

const PAR_PAGE = 10;

const ONGLETS: { cle: Ligne; label: string }[] = [
  { cle: 'tous', label: 'Tous' },
  { cle: 'developpement', label: 'Développement logiciel' },
  { cle: 'extincpro', label: 'ExtincPro' },
];

function sansAccents(texte: string) {
  return texte.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export default function ClientsDashboardPage() {
  const [clients, setClients] = useState<ClientEntreprise[] | null>(null);
  const [enEdition, setEnEdition] = useState<ClientEntreprise | null | 'nouveau'>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [aSupprimer, setASupprimer] = useState<ClientEntreprise | null>(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [ligne, setLigne] = useState<Ligne>('tous');
  const [recherche, setRecherche] = useState('');
  const [page, setPage] = useState(1);
  const [ficheExtincPro, setFicheExtincPro] = useState<ClientEntreprise | null>(null);

  function charger() {
    fetchClient<ClientEntreprise[]>('/api/clients/')
      .then(setClients)
      .catch((e) => setErreur(e.message));
  }

  useEffect(charger, []);

  const compteurs = useMemo(() => {
    const liste = clients || [];
    const extincpro = liste.filter((c) => c.est_client_extincpro).length;
    return { tous: liste.length, extincpro, developpement: liste.length - extincpro };
  }, [clients]);

  const visibles = useMemo(() => {
    const terme = sansAccents(recherche.trim());
    return (clients || []).filter((c) => {
      if (ligne === 'extincpro' && !c.est_client_extincpro) return false;
      if (ligne === 'developpement' && c.est_client_extincpro) return false;
      if (!terme) return true;
      return [c.nom_entreprise, c.nom_contact, c.courriel, c.telephone].some((v) => sansAccents(v || '').includes(terme));
    });
  }, [clients, ligne, recherche]);

  const { nbPages, pageCourante, elements: pageVisible } = paginer(visibles, page, PAR_PAGE);

  async function confirmerSuppression() {
    if (!aSupprimer) return;
    setSuppressionEnCours(true);
    try {
      await fetchClient(`/api/clients/${aSupprimer.id}/`, { method: 'DELETE' });
      afficherToast(`« ${aSupprimer.nom_entreprise} » supprimé.`);
      setASupprimer(null);
      charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de la suppression.');
    } finally {
      setSuppressionEnCours(false);
    }
  }

  if (ficheExtincPro) {
    return (
      <ExtincProClient
        client={ficheExtincPro}
        onBack={() => {
          setFicheExtincPro(null);
          charger();
        }}
      />
    );
  }

  if (enEdition) {
    return (
      <ClientForm
        client={enEdition === 'nouveau' ? null : enEdition}
        onDone={() => {
          afficherToast(enEdition === 'nouveau' ? 'Client ajouté avec succès.' : 'Client mis à jour.');
          setEnEdition(null);
          charger();
        }}
        onCancel={() => setEnEdition(null)}
      />
    );
  }

  return (
    <div>
      {/* En-tête */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy">Clients</h1>
          <p className="mt-1 text-sm text-black/45">
            {clients === null
              ? 'Chargement…'
              : `${compteurs.tous} client${compteurs.tous !== 1 ? 's' : ''} · ${compteurs.extincpro} abonné${compteurs.extincpro !== 1 ? 's' : ''} ExtincPro`}
          </p>
        </div>
        <button
          onClick={() => setEnEdition('nouveau')}
          className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-accent/30 transition hover:-translate-y-px hover:shadow-md hover:shadow-accent/30"
        >
          <Icone d={ICONES.plus} />
          Nouveau client
        </button>
      </div>

      {/* Filtres */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-black/15 bg-black/[0.04] p-1">
          {ONGLETS.map((o) => {
            const actif = ligne === o.cle;
            return (
              <button
                key={o.cle}
                onClick={() => {
                  setLigne(o.cle);
                  setPage(1);
                }}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
                  actif
                    ? 'bg-white text-navy shadow-sm ring-1 ring-black/10'
                    : 'text-black/70 hover:bg-white/70 hover:text-navy'
                }`}
              >
                {o.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
                    actif ? 'bg-navy text-white' : 'bg-black/10 text-black/70'
                  }`}
                >
                  {compteurs[o.cle]}
                </span>
              </button>
            );
          })}
        </div>
        <label className="relative block sm:w-72">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-black/45">
            <Icone d={ICONES.recherche} />
          </span>
          <input
            type="search"
            value={recherche}
            onChange={(e) => {
              setRecherche(e.target.value);
              setPage(1);
            }}
            placeholder="Rechercher un client…"
            className="w-full rounded-xl border border-black/20 bg-white py-2.5 pl-9 pr-3 text-sm text-navy shadow-sm placeholder:text-black/40 focus:border-navy focus:outline-none focus:ring-4 focus:ring-navy/10"
          />
        </label>
      </div>

      {erreur && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}

      {/* Liste */}
      <div className="mt-5 overflow-hidden rounded-2xl border border-black/15 bg-white shadow-sm">
        {clients === null && (
          <div className="divide-y divide-black/10">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="h-11 w-11 animate-pulse rounded-full bg-black/[0.06]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-48 animate-pulse rounded bg-black/[0.06]" />
                  <div className="h-3 w-64 animate-pulse rounded bg-black/[0.04]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {clients !== null && visibles.length === 0 && (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/[0.04] text-black/30">
              <Icone d={recherche ? ICONES.recherche : ICONES.contact} className="h-6 w-6" />
            </div>
            <p className="mt-3 font-semibold text-navy">
              {recherche ? 'Aucun client ne correspond à votre recherche' : 'Aucun client dans cette catégorie'}
            </p>
            <p className="mt-1 text-sm text-black/45">
              {recherche ? 'Essayez un autre nom, courriel ou téléphone.' : 'Ajoutez un client pour commencer.'}
            </p>
          </div>
        )}

        <ul className="divide-y divide-black/10">
          {pageVisible.map((c) => (
            <li key={c.id} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-black/[0.02]">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm"
                style={clientAvatarStyle(c.id) || undefined}
              >
                {initiales(c.nom_entreprise)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold text-navy">{c.nom_entreprise}</p>
                  {c.est_client_extincpro && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-navy px-2 py-0.5 text-[10px] font-bold text-white">
                      Extinc<span className="-ml-1 text-accent">Pro</span>
                      {c.extincpro_resilie_le && <span className="font-medium text-white/55">· résilié</span>}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-black/50">
                  {c.nom_contact && (
                    <span className="flex items-center gap-1.5">
                      <Icone d={ICONES.contact} className="h-3.5 w-3.5 text-black/30" />
                      {c.nom_contact}
                    </span>
                  )}
                  {c.courriel && (
                    <a href={`mailto:${c.courriel}`} className="flex min-w-0 items-center gap-1.5 hover:text-navy">
                      <Icone d={ICONES.courriel} className="h-3.5 w-3.5 shrink-0 text-black/30" />
                      <span className="truncate">{c.courriel}</span>
                    </a>
                  )}
                  {c.telephone && (
                    <a href={`tel:${c.telephone}`} className="hidden items-center gap-1.5 hover:text-navy sm:flex">
                      <Icone d={ICONES.telephone} className="h-3.5 w-3.5 text-black/30" />
                      {c.telephone}
                    </a>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {c.est_client_extincpro && (
                  <button
                    onClick={() => setFicheExtincPro(c)}
                    title="Gérer l'abonnement ExtincPro"
                    className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-navy transition hover:bg-navy hover:text-white sm:flex"
                  >
                    <Icone d={ICONES.flamme} />
                    Abonnement
                  </button>
                )}
                {c.est_client_extincpro && (
                  <button
                    onClick={() => setFicheExtincPro(c)}
                    title="Gérer l'abonnement ExtincPro"
                    aria-label="Gérer l'abonnement ExtincPro"
                    className="rounded-lg p-2 text-navy transition hover:bg-navy/5 sm:hidden"
                  >
                    <Icone d={ICONES.flamme} />
                  </button>
                )}
                <button
                  onClick={() => setEnEdition(c)}
                  title="Modifier"
                  aria-label={`Modifier ${c.nom_entreprise}`}
                  className="rounded-lg p-2 text-black/40 transition hover:bg-black/[0.05] hover:text-navy"
                >
                  <Icone d={ICONES.modifier} />
                </button>
                <button
                  onClick={() => setASupprimer(c)}
                  title="Supprimer"
                  aria-label={`Supprimer ${c.nom_entreprise}`}
                  className="rounded-lg p-2 text-black/30 transition hover:bg-red-50 hover:text-red-600"
                >
                  <Icone d={ICONES.supprimer} />
                </button>
              </div>
            </li>
          ))}
        </ul>

        <Pagination
          page={pageCourante}
          nbPages={nbPages}
          total={visibles.length}
          parPage={PAR_PAGE}
          libelle={['client', 'clients']}
          onChange={setPage}
        />
      </div>

      {aSupprimer && (
        <ConfirmDialog
          titre="Supprimer ce client ?"
          message={`« ${aSupprimer.nom_entreprise} » sera supprimé définitivement.`}
          enCours={suppressionEnCours}
          onConfirm={confirmerSuppression}
          onCancel={() => setASupprimer(null)}
        />
      )}
    </div>
  );
}
