'use client';

import { useEffect, useMemo, useState } from 'react';

import { apiUrlClient, fetchClient, type ClientEntreprise, type Evenement, type TypeEvenement } from '@/lib/api';
import { afficherToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { clientDotStyle } from '@/lib/clientColors';
import { ICONES, Icone } from '@/components/Icone';
import Pagination, { paginer } from '@/components/Pagination';

import CalendrierGrille from './CalendrierGrille';
import EvenementDetail from './EvenementDetail';
import EvenementForm from './EvenementForm';

type Vue = 'liste' | 'calendrier';
type FiltreType = 'tous' | TypeEvenement;

const PAR_SECTION = 8;

function sansAccents(texte: string) {
  return texte.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export const TYPES: Record<
  TypeEvenement,
  { label: string; badge: string; dot: string; pill: string; avatar: string; carte: string; icon: React.ReactNode }
> = {
  rendez_vous: {
    label: 'Rendez-vous',
    badge: 'bg-rose-500/10 text-rose-600',
    dot: 'bg-rose-500',
    pill: 'bg-rose-100 text-rose-700',
    avatar: 'bg-rose-400',
    carte: 'bg-gradient-to-br from-rose-50 to-white border-rose-100',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M6.75 3v2.25M17.25 3v2.25M4.5 6h15a.75.75 0 01.75.75V19.5a.75.75 0 01-.75.75h-15a.75.75 0 01-.75-.75V6.75A.75.75 0 014.5 6ZM3.75 9.75h16.5"
      />
    ),
  },
  tache: {
    label: 'Tâche',
    badge: 'bg-emerald-500/10 text-emerald-600',
    dot: 'bg-emerald-500',
    pill: 'bg-emerald-100 text-emerald-700',
    avatar: 'bg-emerald-400',
    carte: 'bg-gradient-to-br from-emerald-50 to-white border-emerald-100',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M9 5.25h6M9 5.25a1.5 1.5 0 011.5-1.5h3a1.5 1.5 0 011.5 1.5M9 5.25H6.75A2.25 2.25 0 004.5 7.5v10.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V7.5a2.25 2.25 0 00-2.25-2.25H15m-7.5 6.75 2.25 2.25 4.5-4.5"
      />
    ),
  },
  rappel: {
    label: 'Rappel',
    badge: 'bg-amber-500/10 text-amber-600',
    dot: 'bg-amber-500',
    pill: 'bg-amber-100 text-amber-700',
    avatar: 'bg-amber-400',
    carte: 'bg-gradient-to-br from-amber-50 to-white border-amber-100',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
      />
    ),
  },
};

export function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatHeure(heure: string | null) {
  if (!heure) return null;
  return heure.slice(0, 5);
}

function finDeSemaine(d: Date) {
  const decalage = (d.getDay() + 6) % 7; // 0 = lundi
  return toISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + (6 - decalage)));
}

function ajouterJours(dateISO: string, n: number) {
  const d = new Date(`${dateISO}T00:00:00`);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export default function PlanificateurPage() {
  const [evenements, setEvenements] = useState<Evenement[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [maintenant, setMaintenant] = useState<Date | null>(null);
  const [enEdition, setEnEdition] = useState<Evenement | null | 'nouveau'>(null);
  const [dateFormulaire, setDateFormulaire] = useState<string>(toISODate(new Date()));
  const [heureFormulaire, setHeureFormulaire] = useState<string>('');
  const [aSupprimer, setASupprimer] = useState<Evenement | null>(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [afficherTermines, setAfficherTermines] = useState(false);
  const [clients, setClients] = useState<ClientEntreprise[]>([]);
  const [clientFiltre, setClientFiltre] = useState<number | null>(null);
  const [typeFiltre, setTypeFiltre] = useState<FiltreType>('tous');
  const [recherche, setRecherche] = useState('');
  const [vue, setVue] = useState<Vue>('liste');
  // Id plutôt que l'objet : le panneau reflète ainsi la version rechargée après un changement.
  const [detailId, setDetailId] = useState<number | null>(null);
  const enDetail = detailId !== null ? (evenements || []).find((e) => e.id === detailId) ?? null : null;

  // Dérivé de `maintenant` (null avant le montage client) plutôt que `new Date()` directement :
  // le serveur (UTC dans Docker) et le navigateur (fuseau local) peuvent ne pas s'accorder sur
  // la date du jour, ce qui provoquerait un mismatch d'hydratation sur tout ce qui dépend d'« aujourd'hui ».
  const aujourdhui = maintenant ? toISODate(maintenant) : '';

  function charger() {
    fetchClient<Evenement[]>('/api/evenements/')
      .then(setEvenements)
      .catch((e) => setErreur(e.message));
  }

  useEffect(charger, []);

  useEffect(() => {
    fetchClient<ClientEntreprise[]>('/api/clients/').then(setClients).catch(() => {});
  }, []);

  useEffect(() => {
    const id = setInterval(() => setMaintenant(new Date()), 60000);
    const initial = setTimeout(() => setMaintenant(new Date()), 0);
    return () => {
      clearInterval(id);
      clearTimeout(initial);
    };
  }, []);

  const evenementsFiltres = useMemo(() => {
    const terme = sansAccents(recherche.trim());
    return (evenements || []).filter((e) => {
      if (clientFiltre && e.client !== clientFiltre) return false;
      if (typeFiltre !== 'tous' && e.type_evenement !== typeFiltre) return false;
      if (!terme) return true;
      return [e.titre, e.client_nom, e.description].some((v) => sansAccents(v || '').includes(terme));
    });
  }, [evenements, clientFiltre, typeFiltre, recherche]);

  const { enRetard, aujourdhuiListe, cetteSemaine, semaineProchaine, plusTard, termines } = useMemo(() => {
    const enRetard: Evenement[] = [];
    const aujourdhuiListe: Evenement[] = [];
    const cetteSemaine: Evenement[] = [];
    const semaineProchaine: Evenement[] = [];
    const plusTard: Evenement[] = [];
    const termines: Evenement[] = [];
    const finSemaineActuelle = maintenant ? finDeSemaine(maintenant) : '';
    const finSemaineProchaine = maintenant ? ajouterJours(finSemaineActuelle, 7) : '';
    const tries = [...evenementsFiltres].sort(
      (a, b) => a.date.localeCompare(b.date) || (a.heure ?? '99').localeCompare(b.heure ?? '99'),
    );
    for (const ev of tries) {
      if (ev.termine) {
        termines.push(ev);
      } else if (ev.date < aujourdhui) {
        enRetard.push(ev);
      } else if (ev.date === aujourdhui) {
        aujourdhuiListe.push(ev);
      } else if (ev.date <= finSemaineActuelle) {
        cetteSemaine.push(ev);
      } else if (ev.date <= finSemaineProchaine) {
        semaineProchaine.push(ev);
      } else {
        plusTard.push(ev);
      }
    }
    // Les plus récents d'abord pour ce qui est en retard ou terminé : c'est ce qu'on cherche.
    enRetard.reverse();
    termines.reverse();
    return { enRetard, aujourdhuiListe, cetteSemaine, semaineProchaine, plusTard, termines };
  }, [evenementsFiltres, aujourdhui, maintenant]);

  function ouvrirNouveau(dateISO: string) {
    setDateFormulaire(dateISO);
    setHeureFormulaire('');
    setEnEdition('nouveau');
  }

  function ouvrirDetail(ev: Evenement) {
    setDetailId(ev.id);
  }

  function ouvrirEdition(ev: Evenement) {
    setDetailId(null);
    setDateFormulaire(ev.date);
    setHeureFormulaire(ev.heure ?? '');
    setEnEdition(ev);
  }

  async function basculerTermine(ev: Evenement) {
    try {
      await fetchClient(`/api/evenements/${ev.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ termine: !ev.termine }),
      });
      charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de la mise à jour.');
    }
  }

  async function confirmerSuppression() {
    if (!aSupprimer) return;
    setSuppressionEnCours(true);
    try {
      await fetchClient(`/api/evenements/${aSupprimer.id}/`, { method: 'DELETE' });
      afficherToast(`« ${aSupprimer.titre} » supprimé.`);
      setASupprimer(null);
      charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de la suppression.');
    } finally {
      setSuppressionEnCours(false);
    }
  }

  const aucunEvenementActif =
    enRetard.length === 0 &&
    aujourdhuiListe.length === 0 &&
    cetteSemaine.length === 0 &&
    semaineProchaine.length === 0 &&
    plusTard.length === 0;
  const filtresActifs = clientFiltre !== null || typeFiltre !== 'tous' || recherche.trim() !== '';
  const actions = { onToggle: basculerTermine, onOpen: ouvrirDetail, onEdit: ouvrirEdition, onDelete: setASupprimer };

  return (
    <div>
      {/* En-tête */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy">Planificateur</h1>
          <p className="mt-1 text-sm text-black/55">Vos rendez-vous, tâches et rappels, en un coup d&apos;œil.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-xl border border-black/15 bg-black/[0.04] p-1">
            {(['liste', 'calendrier'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVue(v)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  vue === v ? 'bg-white text-navy shadow-sm ring-1 ring-black/10' : 'text-black/70 hover:text-navy'
                }`}
              >
                <Icone d={v === 'liste' ? ICONES.document : ICONES.calendrier} className="h-4 w-4" />
                {v === 'liste' ? 'Liste' : 'Calendrier'}
              </button>
            ))}
          </div>
          <button
            onClick={() => ouvrirNouveau(aujourdhui || toISODate(new Date()))}
            className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-accent/30 transition hover:-translate-y-px hover:shadow-md hover:shadow-accent/30"
          >
            <Icone d={ICONES.plus} />
            Nouvel événement
          </button>
        </div>
      </div>

      {erreur && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</p>}

      {/* Compteurs */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { libelle: 'En retard', nombre: enRetard.length, teinte: enRetard.length ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600', icone: ICONES.horloge },
          { libelle: "Aujourd'hui", nombre: aujourdhuiListe.length, teinte: 'bg-accent/10 text-accent', icone: ICONES.calendrier },
          { libelle: 'Cette semaine', nombre: cetteSemaine.length, teinte: 'bg-indigo-50 text-indigo-600', icone: ICONES.calendrier },
          { libelle: 'Plus tard', nombre: semaineProchaine.length + plusTard.length, teinte: 'bg-navy/5 text-navy', icone: ICONES.fleche },
        ].map((c) => (
          <div key={c.libelle} className="flex items-center gap-3 rounded-2xl border border-black/15 bg-white p-4 shadow-sm">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${c.teinte}`}>
              <Icone d={c.icone} className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-navy">{evenements === null ? '…' : c.nombre}</p>
              <p className="text-[13px] text-black/55">{c.libelle}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex w-fit gap-1 overflow-x-auto rounded-xl border border-black/15 bg-black/[0.04] p-1">
          {(['tous', 'rendez_vous', 'tache', 'rappel'] as FiltreType[]).map((t) => {
            const actif = typeFiltre === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFiltre(t)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  actif ? 'bg-white text-navy shadow-sm ring-1 ring-black/10' : 'text-black/70 hover:text-navy'
                }`}
              >
                {t !== 'tous' && <span className={`h-2 w-2 rounded-full ${TYPES[t].dot}`} />}
                {t === 'tous' ? 'Tous' : TYPES[t].label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <div className="relative sm:w-64">
            <span
              className="pointer-events-none absolute left-3 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full"
              style={clientFiltre ? clientDotStyle(clientFiltre) ?? undefined : { background: '#d4d4d8' }}
            />
            <select
              value={clientFiltre ?? ''}
              onChange={(e) => setClientFiltre(e.target.value ? Number(e.target.value) : null)}
              className="w-full appearance-none rounded-xl border border-black/20 bg-white py-2.5 pl-8 pr-8 text-sm text-navy shadow-sm focus:border-navy focus:outline-none focus:ring-4 focus:ring-navy/10"
              aria-label="Filtrer par client"
            >
              <option value="">Tous les clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.nom_entreprise}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-black/40">
              <Icone d={ICONES.suivant} className="h-3.5 w-3.5" />
            </span>
          </div>
          <label className="relative block flex-1">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-black/45">
              <Icone d={ICONES.recherche} />
            </span>
            <input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher un événement…"
              className="w-full rounded-xl border border-black/20 bg-white py-2.5 pl-9 pr-3 text-sm text-navy shadow-sm placeholder:text-black/40 focus:border-navy focus:outline-none focus:ring-4 focus:ring-navy/10"
            />
          </label>
          {filtresActifs && (
            <button
              type="button"
              onClick={() => {
                setClientFiltre(null);
                setTypeFiltre('tous');
                setRecherche('');
              }}
              className="shrink-0 rounded-xl px-3 py-2.5 text-sm font-semibold text-black/55 hover:bg-black/[0.05] hover:text-navy"
            >
              Effacer les filtres
            </button>
          )}
        </div>
      </div>

      {vue === 'calendrier' ? (
        <div className="mt-6">
          <CalendrierGrille
            evenements={evenementsFiltres}
            aujourdhui={aujourdhui}
            onNouveau={ouvrirNouveau}
            onEdit={ouvrirDetail}
          />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          <Section titre="En retard" accent="text-red-600" pastille="bg-red-100 text-red-700" evenements={enRetard} {...actions} />
          <Section titre="Aujourd'hui" accent="text-accent" pastille="bg-accent/10 text-accent" evenements={aujourdhuiListe} {...actions} />
          <Section titre="Cette semaine" evenements={cetteSemaine} {...actions} />
          <Section titre="Semaine prochaine" evenements={semaineProchaine} {...actions} />
          <Section titre="Plus tard" evenements={plusTard} {...actions} />

          {evenements !== null && aucunEvenementActif && (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-black/20 px-6 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/[0.04] text-black/30">
                <Icone d={ICONES.calendrier} className="h-6 w-6" />
              </div>
              <p className="mt-3 font-semibold text-navy">
                {filtresActifs ? 'Aucun événement ne correspond à ces filtres' : 'Rien de prévu pour le moment'}
              </p>
              <p className="mt-1 text-sm text-black/50">
                {filtresActifs ? 'Modifiez ou effacez les filtres.' : 'Cliquez sur « Nouvel événement » pour commencer.'}
              </p>
            </div>
          )}

          {termines.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setAfficherTermines((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-black/55 transition-colors hover:text-navy"
              >
                <Icone d={ICONES.suivant} className={`h-4 w-4 transition-transform ${afficherTermines ? 'rotate-90' : ''}`} />
                {afficherTermines ? 'Masquer' : 'Afficher'} les événements terminés ({termines.length})
              </button>
              {afficherTermines && (
                <div className="mt-3">
                  <Section titre="" evenements={termines} {...actions} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {enDetail && (
        <EvenementDetail
          evenement={enDetail}
          onClose={() => setDetailId(null)}
          onEdit={ouvrirEdition}
          onToggle={basculerTermine}
          onDelete={(ev) => {
            setDetailId(null);
            setASupprimer(ev);
          }}
        />
      )}

      {enEdition && (
        <EvenementForm
          evenement={enEdition === 'nouveau' ? null : enEdition}
          dateParDefaut={dateFormulaire}
          heureParDefaut={heureFormulaire}
          onDone={() => {
            afficherToast(enEdition === 'nouveau' ? 'Événement ajouté.' : 'Événement mis à jour.');
            setEnEdition(null);
            charger();
          }}
          onCancel={() => setEnEdition(null)}
          onDelete={
            enEdition !== 'nouveau'
              ? () => {
                  setASupprimer(enEdition);
                  setEnEdition(null);
                }
              : undefined
          }
        />
      )}

      {aSupprimer && (
        <ConfirmDialog
          titre="Supprimer cet événement ?"
          message={`« ${aSupprimer.titre} » sera supprimé définitivement.`}
          enCours={suppressionEnCours}
          onConfirm={confirmerSuppression}
          onCancel={() => setASupprimer(null)}
        />
      )}
    </div>
  );
}

interface ActionsEvenement {
  onToggle: (ev: Evenement) => void;
  onOpen: (ev: Evenement) => void;
  onEdit: (ev: Evenement) => void;
  onDelete: (ev: Evenement) => void;
}

/** Une section (En retard, Aujourd'hui…) : carte bordée, une ligne par événement, paginée. */
function Section({
  titre,
  accent = 'text-navy',
  pastille = 'bg-black/10 text-black/70',
  evenements,
  ...actions
}: {
  titre: string;
  accent?: string;
  pastille?: string;
  evenements: Evenement[];
} & ActionsEvenement) {
  const [page, setPage] = useState(1);
  if (evenements.length === 0) return null;
  const { nbPages, pageCourante, elements } = paginer(evenements, page, PAR_SECTION);

  return (
    <section>
      {titre && (
        <div className="mb-3 flex items-center gap-2">
          <h2 className={`text-sm font-bold ${accent}`}>{titre}</h2>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${pastille}`}>{evenements.length}</span>
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border border-black/15 bg-white shadow-sm">
        <ul className="divide-y divide-black/10">
          {elements.map((ev) => (
            <LigneEvenement key={ev.id} ev={ev} {...actions} />
          ))}
        </ul>
        <Pagination
          page={pageCourante}
          nbPages={nbPages}
          total={evenements.length}
          parPage={PAR_SECTION}
          libelle={['événement', 'événements']}
          onChange={setPage}
        />
      </div>
    </section>
  );
}

function LigneEvenement({ ev, onToggle, onOpen, onEdit, onDelete }: { ev: Evenement } & ActionsEvenement) {
  const date = new Date(`${ev.date}T00:00:00`);
  const jourSemaine = date.toLocaleDateString('fr-CA', { weekday: 'short' }).replace('.', '');
  const mois = date.toLocaleDateString('fr-CA', { month: 'short' }).replace('.', '');
  const heure = formatHeure(ev.heure);
  const type = TYPES[ev.type_evenement];

  return (
    <li
      className={`group flex cursor-pointer items-center gap-4 px-5 py-3.5 transition-colors hover:bg-black/[0.02] ${
        ev.termine ? 'opacity-60' : ''
      }`}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(ev)}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onOpen(ev);
        }
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle(ev);
        }}
        aria-label={ev.termine ? 'Marquer comme à faire' : 'Marquer comme terminé'}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-90 ${
          ev.termine ? 'border-green-600 bg-green-600' : 'border-black/25 hover:border-green-600'
        }`}
      >
        {ev.termine && (
          <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" stroke="white">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Date en bloc, teintée selon le type */}
      <div className={`flex w-12 shrink-0 flex-col items-center rounded-xl py-1.5 ${type.badge}`}>
        <span className="text-[10px] font-semibold uppercase leading-none">{jourSemaine}</span>
        <span className="text-lg font-bold leading-tight tabular-nums">{date.getDate()}</span>
        <span className="text-[10px] font-medium uppercase leading-none">{mois}</span>
      </div>

      <div className="min-w-0 flex-1">
        <p className={`truncate font-semibold ${ev.termine ? 'text-black/45 line-through' : 'text-navy'}`}>{ev.titre}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-black/55">
          <span className={`inline-flex items-center gap-1.5 font-semibold ${type.badge.split(' ').find((c) => c.startsWith('text-'))}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${type.dot}`} />
            {type.label}
          </span>
          {heure && (
            <span className="flex items-center gap-1">
              <Icone d={ICONES.horloge} className="h-3.5 w-3.5 text-black/35" />
              {heure}
            </span>
          )}
          {ev.client_nom && (
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="h-2 w-2 shrink-0 rounded-full" style={clientDotStyle(ev.client) ?? undefined} />
              <span className="truncate">{ev.client_nom}</span>
            </span>
          )}
        </div>
        {ev.description && (
          <p className="mt-1 line-clamp-1 text-[12px] text-black/45">{ev.description.replace(/\s*\n\s*/g, ' · ')}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        {ev.document && (
          <a
            href={apiUrlClient(`/api/documents/${ev.document}/pdf/`)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="Voir le PDF"
            aria-label="Voir le PDF"
            className="rounded-lg p-2 text-black/45 transition hover:bg-black/[0.05] hover:text-navy"
          >
            <Icone d={ICONES.telecharger} />
          </a>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(ev);
          }}
          title="Modifier"
          aria-label="Modifier"
          className="rounded-lg p-2 text-black/45 transition hover:bg-black/[0.05] hover:text-navy"
        >
          <Icone d={ICONES.modifier} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(ev);
          }}
          title="Supprimer"
          aria-label="Supprimer"
          className="rounded-lg p-2 text-black/35 transition hover:bg-red-50 hover:text-red-600"
        >
          <Icone d={ICONES.supprimer} />
        </button>
      </div>
    </li>
  );
}
