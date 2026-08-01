'use client';

import { useEffect, useMemo, useState } from 'react';

import { fetchClient, type ClientEntreprise, type Evenement, type TypeEvenement } from '@/lib/api';
import { afficherToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { clientCardBorderStyle, clientColor, clientDotStyle } from '@/lib/clientColors';

import EvenementForm from './EvenementForm';

const TYPES: Record<TypeEvenement, { label: string; badge: string; icon: React.ReactNode }> = {
  rendez_vous: {
    label: 'Rendez-vous',
    badge: 'bg-rose-500/10 text-rose-600',
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

function toISODate(d: Date) {
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
  const [evenements, setEvenements] = useState<Evenement[]>([]);
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

  const { enRetard, aujourdhuiListe, cetteSemaine, semaineProchaine, plusTard, termines } = useMemo(() => {
    const enRetard: Evenement[] = [];
    const aujourdhuiListe: Evenement[] = [];
    const cetteSemaine: Evenement[] = [];
    const semaineProchaine: Evenement[] = [];
    const plusTard: Evenement[] = [];
    const termines: Evenement[] = [];
    const finSemaineActuelle = maintenant ? finDeSemaine(maintenant) : '';
    const finSemaineProchaine = maintenant ? ajouterJours(finSemaineActuelle, 7) : '';
    const source = clientFiltre ? evenements.filter((e) => e.client === clientFiltre) : evenements;
    const tries = [...source].sort(
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
    return { enRetard, aujourdhuiListe, cetteSemaine, semaineProchaine, plusTard, termines };
  }, [evenements, aujourdhui, maintenant, clientFiltre]);

  function ouvrirNouveau(dateISO: string) {
    setDateFormulaire(dateISO);
    setHeureFormulaire('');
    setEnEdition('nouveau');
  }

  function ouvrirEdition(ev: Evenement) {
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

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Planificateur</h1>
          <p className="mt-1 text-sm text-black/50">Vos rendez-vous, tâches et rappels, en un coup d&apos;œil.</p>
        </div>
        <button
          onClick={() => ouvrirNouveau(aujourdhui || toISODate(new Date()))}
          className="group flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-accent/90 hover:shadow-lg hover:shadow-accent/30 active:scale-95"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 5v14M5 12h14" />
          </svg>
          Nouvel événement
        </button>
      </div>

      {erreur && <p className="mt-4 text-sm text-red-600">{erreur}</p>}

      {clients.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setClientFiltre(null)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
              clientFiltre === null
                ? 'bg-navy text-white'
                : 'bg-black/[0.04] text-black/50 hover:bg-black/[0.08]'
            }`}
          >
            Tous
          </button>
          {clients.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setClientFiltre((v) => (v === c.id ? null : c.id))}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                clientFiltre === c.id
                  ? 'bg-navy text-white'
                  : 'bg-black/[0.04] text-black/50 hover:bg-black/[0.08]'
              }`}
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={clientDotStyle(c.id) ?? undefined} />
              {c.nom_entreprise}
            </button>
          ))}
        </div>
      )}

      <div className="mt-8 flex flex-col gap-8">
        <SectionCartes
          titre="En retard"
          couleurTitre="text-rose-600"
          evenements={enRetard}
          onToggle={basculerTermine}
          onEdit={ouvrirEdition}
          onDelete={setASupprimer}
        />
        <SectionCartes
          titre="Aujourd'hui"
          evenements={aujourdhuiListe}
          onToggle={basculerTermine}
          onEdit={ouvrirEdition}
          onDelete={setASupprimer}
        />
        <SectionCartes
          titre="Cette semaine"
          evenements={cetteSemaine}
          onToggle={basculerTermine}
          onEdit={ouvrirEdition}
          onDelete={setASupprimer}
        />
        <SectionCartes
          titre="Semaine prochaine"
          evenements={semaineProchaine}
          onToggle={basculerTermine}
          onEdit={ouvrirEdition}
          onDelete={setASupprimer}
        />
        <SectionCartes
          titre="Plus tard"
          evenements={plusTard}
          onToggle={basculerTermine}
          onEdit={ouvrirEdition}
          onDelete={setASupprimer}
        />

        {aucunEvenementActif && (
          <p className="rounded-xl border border-dashed border-black/10 py-10 text-center text-sm text-black/40">
            Rien de prévu pour le moment. Cliquez sur « Nouvel événement » pour commencer.
          </p>
        )}

        {termines.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setAfficherTermines((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-semibold text-black/40 transition-colors hover:text-navy"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className={`h-4 w-4 transition-transform ${afficherTermines ? 'rotate-90' : ''}`}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 18l6-6-6-6" />
              </svg>
              {afficherTermines ? 'Masquer' : 'Afficher'} les événements terminés ({termines.length})
            </button>
            {afficherTermines && (
              <div className="mt-4">
                <SectionCartes
                  titre=""
                  evenements={termines}
                  onToggle={basculerTermine}
                  onEdit={ouvrirEdition}
                  onDelete={setASupprimer}
                />
              </div>
            )}
          </div>
        )}
      </div>

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

function SectionCartes({
  titre,
  couleurTitre,
  evenements,
  onToggle,
  onEdit,
  onDelete,
}: {
  titre: string;
  couleurTitre?: string;
  evenements: Evenement[];
  onToggle: (ev: Evenement) => void;
  onEdit: (ev: Evenement) => void;
  onDelete: (ev: Evenement) => void;
}) {
  if (evenements.length === 0) return null;

  return (
    <div>
      {titre && (
        <h2 className={`mb-3 text-sm font-bold uppercase tracking-wide ${couleurTitre ?? 'text-navy/60'}`}>
          {titre} <span className="font-medium text-black/30">({evenements.length})</span>
        </h2>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {evenements.map((ev) => (
          <EvenementCarte key={ev.id} ev={ev} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

function EvenementCarte({
  ev,
  onToggle,
  onEdit,
  onDelete,
}: {
  ev: Evenement;
  onToggle: (ev: Evenement) => void;
  onEdit: (ev: Evenement) => void;
  onDelete: (ev: Evenement) => void;
}) {
  const date = new Date(`${ev.date}T00:00:00`);
  const dateLabel = date
    .toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' })
    .replace(/^./, (c) => c.toUpperCase());
  const heure = formatHeure(ev.heure);
  const type = TYPES[ev.type_evenement];
  const bordureClient = clientCardBorderStyle(ev.client);
  const couleurClient = clientColor(ev.client);

  return (
    <div
      className={`group relative flex flex-col gap-3 rounded-xl border border-black/5 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
        bordureClient ? 'border-l-4' : ''
      } ${ev.termine ? 'opacity-60' : ''}`}
      style={bordureClient ?? undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${type.badge}`}>
            <svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5" stroke="currentColor">
              {type.icon}
            </svg>
          </span>
          <div className="min-w-0">
            <p
              className={`truncate text-sm font-semibold ${couleurClient && !ev.termine ? '' : 'text-navy'} ${
                ev.termine ? 'text-black/40 line-through' : ''
              }`}
              style={couleurClient && !ev.termine ? { color: couleurClient.text } : undefined}
            >
              {ev.titre}
            </p>
            <p className="text-xs text-black/40">
              {dateLabel}
              {heure && ` · ${heure}`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onToggle(ev)}
          aria-label="Marquer comme terminé"
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all active:scale-90 ${
            ev.termine ? 'border-accent bg-accent' : 'border-black/15 hover:border-accent'
          }`}
        >
          {ev.termine && (
            <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" stroke="white">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      </div>

      {ev.client_nom && (
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-black/[0.04] px-2 py-0.5 text-xs font-medium text-black/60">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={clientDotStyle(ev.client) ?? undefined} />
          {ev.client_nom}
        </span>
      )}

      {ev.description && (
        <p className="line-clamp-3 whitespace-pre-line text-xs leading-relaxed text-black/50">{ev.description}</p>
      )}

      <div className="mt-auto flex items-center justify-between pt-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-black/30">{type.label}</span>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onEdit(ev)}
            aria-label="Modifier"
            className="rounded-full p-1.5 text-black/30 transition-colors hover:bg-black/5 hover:text-navy"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M16.862 4.487a2.1 2.1 0 113 3L7.5 19.85l-4 1 1-4L16.862 4.487Z"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onDelete(ev)}
            aria-label="Supprimer"
            className="rounded-full p-1.5 text-black/30 transition-colors hover:bg-rose-50 hover:text-rose-600"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-.7 12.1A2 2 0 0 1 14.3 21H9.7a2 2 0 0 1-2-1.9L7 7h10Z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
