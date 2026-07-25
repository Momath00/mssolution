'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { fetchClient, type Evenement, type TypeEvenement } from '@/lib/api';
import { afficherToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';

import EvenementForm from './EvenementForm';

const JOURS_SEMAINE = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const HAUTEUR_HEURE = 44;
const GRILLE_COLONNES = 'grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] gap-px';
const HEURE_DEBUT_DEFAUT = 7;
const HEURE_FIN_DEFAUT = 19;

const TYPES: Record<TypeEvenement, { label: string; point: string; badge: string; bloc: string }> = {
  rendez_vous: {
    label: 'Rendez-vous',
    point: 'bg-rose-500',
    badge: 'bg-rose-500/15 text-rose-300',
    bloc: 'border-rose-500 bg-rose-500/10 text-rose-200',
  },
  tache: {
    label: 'Tâche',
    point: 'bg-emerald-500',
    badge: 'bg-emerald-500/15 text-emerald-300',
    bloc: 'border-emerald-500 bg-emerald-500/10 text-emerald-200',
  },
  rappel: {
    label: 'Rappel',
    point: 'bg-amber-500',
    badge: 'bg-amber-500/15 text-amber-300',
    bloc: 'border-amber-500 bg-amber-500/10 text-amber-200',
  },
};

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildMonthGrid(annee: number, mois: number) {
  const premier = new Date(annee, mois, 1);
  const decalage = (premier.getDay() + 6) % 7; // 0 = lundi
  const debut = new Date(annee, mois, 1 - decalage);
  return Array.from({ length: 42 }, (_, i) => new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + i));
}

function startOfWeek(d: Date) {
  const decalage = (d.getDay() + 6) % 7; // 0 = lundi
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - decalage);
}

function buildWeekDays(debutSemaine: Date) {
  return Array.from(
    { length: 7 },
    (_, i) => new Date(debutSemaine.getFullYear(), debutSemaine.getMonth(), debutSemaine.getDate() + i),
  );
}

function formatHeure(heure: string | null) {
  if (!heure) return null;
  return heure.slice(0, 5);
}

function formatPlageSemaine(jours: Date[]) {
  const debut = jours[0];
  const fin = jours[6];
  const memeMois = debut.getMonth() === fin.getMonth() && debut.getFullYear() === fin.getFullYear();
  const debutLabel = debut.toLocaleDateString('fr-CA', memeMois ? { day: 'numeric' } : { day: 'numeric', month: 'short' });
  const finLabel = fin.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${debutLabel} – ${finLabel}`;
}

export default function PlanificateurPage() {
  const [evenements, setEvenements] = useState<Evenement[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [vue, setVue] = useState<'semaine' | 'mois'>('semaine');
  const [moisAffiche, setMoisAffiche] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [semaineAffichee, setSemaineAffichee] = useState(() => startOfWeek(new Date()));
  const [maintenant, setMaintenant] = useState<Date | null>(null);
  const [enEdition, setEnEdition] = useState<Evenement | null | 'nouveau'>(null);
  const [dateFormulaire, setDateFormulaire] = useState<string>(toISODate(new Date()));
  const [heureFormulaire, setHeureFormulaire] = useState<string>('');
  const [aSupprimer, setASupprimer] = useState<Evenement | null>(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const grilleHoraireRef = useRef<HTMLDivElement>(null);

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
    const id = setInterval(() => setMaintenant(new Date()), 60000);
    const initial = setTimeout(() => setMaintenant(new Date()), 0);
    return () => {
      clearInterval(id);
      clearTimeout(initial);
    };
  }, []);

  useEffect(() => {
    if (!grilleHoraireRef.current) return;
    const maintenant = new Date();
    const minutes = maintenant.getHours() * 60 + maintenant.getMinutes();
    const top = ((minutes - HEURE_DEBUT_DEFAUT * 60) / 60) * HAUTEUR_HEURE;
    grilleHoraireRef.current.scrollTop = Math.max(top - 160, 0);
  }, []);

  const parJour = useMemo(() => {
    const map = new Map<string, Evenement[]>();
    for (const ev of evenements) {
      const liste = map.get(ev.date) ?? [];
      liste.push(ev);
      map.set(ev.date, liste);
    }
    return map;
  }, [evenements]);

  const grille = useMemo(
    () => buildMonthGrid(moisAffiche.getFullYear(), moisAffiche.getMonth()),
    [moisAffiche],
  );

  const joursSemaine = useMemo(() => buildWeekDays(semaineAffichee), [semaineAffichee]);

  const { heureDebut, heureFin } = useMemo(() => {
    let debut = HEURE_DEBUT_DEFAUT;
    let fin = HEURE_FIN_DEFAUT;
    const isoSemaine = new Set(joursSemaine.map(toISODate));
    for (const ev of evenements) {
      if (!ev.heure || !isoSemaine.has(ev.date)) continue;
      const h = Number(ev.heure.slice(0, 2));
      if (h < debut) debut = h;
      if (h + 1 > fin) fin = h + 1;
    }
    return { heureDebut: debut, heureFin: fin };
  }, [evenements, joursSemaine]);

  const { enRetard, aVenir } = useMemo(() => {
    const enRetard: Evenement[] = [];
    const aVenir: Evenement[] = [];
    const tries = [...evenements]
      .filter((e) => !e.termine)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.heure ?? '99').localeCompare(b.heure ?? '99'));
    for (const ev of tries) {
      if (ev.date < aujourdhui) enRetard.push(ev);
      else aVenir.push(ev);
    }
    return { enRetard, aVenir: aVenir.slice(0, 8) };
  }, [evenements, aujourdhui]);

  function ouvrirNouveau(dateISO: string, heureISO?: string) {
    setDateFormulaire(dateISO);
    setHeureFormulaire(heureISO ?? '');
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

  const titreMois = moisAffiche
    .toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' })
    .replace(/^./, (c) => c.toUpperCase());

  const heures = Array.from({ length: heureFin - heureDebut }, (_, i) => heureDebut + i);
  const minutesMaintenant = maintenant ? maintenant.getHours() * 60 + maintenant.getMinutes() : null;
  const topMaintenant = minutesMaintenant !== null ? ((minutesMaintenant - heureDebut * 60) / 60) * HAUTEUR_HEURE : 0;
  const afficherLigneMaintenant =
    minutesMaintenant !== null && minutesMaintenant >= heureDebut * 60 && minutesMaintenant <= heureFin * 60;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Planificateur</h1>
          <p className="mt-1 text-sm text-black/50">Vos rendez-vous, tâches et rappels, en un coup d&apos;œil.</p>
        </div>
        <button
          onClick={() => ouvrirNouveau(aujourdhui)}
          className="group flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-accent/90 hover:shadow-lg hover:shadow-accent/30 active:scale-95"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 5v14M5 12h14" />
          </svg>
          Nouvel événement
        </button>
      </div>

      {erreur && <p className="mt-4 text-sm text-red-600">{erreur}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-navy p-4 shadow-xl shadow-black/20 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-white">
                {vue === 'semaine' ? formatPlageSemaine(joursSemaine) : titreMois}
              </h2>
              <div className="relative flex items-center rounded-full bg-white/5 p-0.5 text-xs font-semibold">
                <div
                  className="absolute inset-y-0.5 w-[calc(50%-2px)] rounded-full bg-accent shadow-sm transition-transform duration-200 ease-out"
                  style={{ transform: vue === 'mois' ? 'translateX(calc(100% + 4px))' : 'translateX(0%)' }}
                />
                <button
                  type="button"
                  onClick={() => setVue('semaine')}
                  className={`relative z-10 rounded-full px-3 py-1 transition-colors ${
                    vue === 'semaine' ? 'text-white' : 'text-white/45 hover:text-white'
                  }`}
                >
                  Semaine
                </button>
                <button
                  type="button"
                  onClick={() => setVue('mois')}
                  className={`relative z-10 rounded-full px-3 py-1 transition-colors ${
                    vue === 'mois' ? 'text-white' : 'text-white/45 hover:text-white'
                  }`}
                >
                  Mois
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  vue === 'semaine'
                    ? setSemaineAffichee((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7))
                    : setMoisAffiche((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
                }
                className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 transition-all hover:bg-white/10 hover:text-white active:scale-90"
                aria-label="Précédent"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  setSemaineAffichee(startOfWeek(d));
                  setMoisAffiche(new Date(d.getFullYear(), d.getMonth(), 1));
                }}
                className="rounded-full px-3 py-1 text-xs font-semibold text-white/60 transition-all hover:bg-white/10 hover:text-white active:scale-95"
              >
                Aujourd&apos;hui
              </button>
              <button
                type="button"
                onClick={() =>
                  vue === 'semaine'
                    ? setSemaineAffichee((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7))
                    : setMoisAffiche((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
                }
                className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 transition-all hover:bg-white/10 hover:text-white active:scale-90"
                aria-label="Suivant"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>

          <div
            key={vue === 'mois' ? `mois-${moisAffiche.getTime()}` : `semaine-${semaineAffichee.getTime()}`}
            className="animate-view-in"
          >
          {vue === 'mois' ? (
            <>
              <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-white/35">
                {JOURS_SEMAINE.map((j) => (
                  <div key={j} className="py-1">
                    {j}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {grille.map((jour) => {
                  const iso = toISODate(jour);
                  const dansLeMois = jour.getMonth() === moisAffiche.getMonth();
                  const estAujourdhui = iso === aujourdhui;
                  const evsJour = parJour.get(iso) ?? [];
                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => ouvrirNouveau(iso)}
                      className={`flex min-h-[84px] flex-col items-stretch gap-1 rounded-lg border p-1.5 text-left transition-all active:scale-[0.98] ${
                        dansLeMois
                          ? 'border-white/5 bg-white/[0.03] hover:-translate-y-0.5 hover:border-white/10 hover:bg-white/[0.06] hover:shadow-lg hover:shadow-black/30'
                          : 'border-transparent bg-transparent text-white/20'
                      }`}
                    >
                      <span
                        className={`self-start rounded-full px-1.5 text-xs font-semibold ${
                          estAujourdhui ? 'bg-accent text-white' : dansLeMois ? 'text-white/70' : 'text-white/20'
                        }`}
                      >
                        {jour.getDate()}
                      </span>
                      <div className="flex flex-col gap-0.5">
                        {evsJour.slice(0, 2).map((ev) => (
                          <span
                            key={ev.id}
                            role="link"
                            onClick={(e) => {
                              e.stopPropagation();
                              ouvrirEdition(ev);
                            }}
                            className={`animate-pop-in flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] font-medium transition-transform hover:scale-105 ${TYPES[ev.type_evenement].badge} ${
                              ev.termine ? 'opacity-40 line-through' : ''
                            }`}
                            title={ev.description ? `${ev.titre} — ${ev.description.split('\n')[0]}` : ev.titre}
                          >
                            <span className="truncate">{ev.titre}</span>
                            {ev.description && <span className="h-1 w-1 shrink-0 rounded-full bg-current opacity-70" />}
                          </span>
                        ))}
                        {evsJour.length > 2 && (
                          <span className="px-1 text-[10px] font-medium text-white/30">+{evsJour.length - 2} autre(s)</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <div className="min-w-[760px] overflow-hidden rounded-xl border border-white/10">
                <div className={`${GRILLE_COLONNES} bg-white/[0.06]`}>
                  <div className="bg-navy" />
                  {joursSemaine.map((jour) => {
                    const iso = toISODate(jour);
                    const estAujourdhui = iso === aujourdhui;
                    return (
                      <div
                        key={iso}
                        className={`flex flex-col items-center justify-center gap-0.5 py-2 ${
                          estAujourdhui ? 'bg-accent/10' : 'bg-navy'
                        }`}
                      >
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-white/35">
                          {JOURS_SEMAINE[(jour.getDay() + 6) % 7]}
                        </span>
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                            estAujourdhui ? 'bg-accent text-white' : 'text-white/70'
                          }`}
                        >
                          {jour.getDate()}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className={`${GRILLE_COLONNES} border-t border-white/10 bg-white/[0.06]`}>
                  <div className="bg-navy" />
                  {joursSemaine.map((jour) => {
                    const iso = toISODate(jour);
                    const estAujourdhui = iso === aujourdhui;
                    const sansHeure = (parJour.get(iso) ?? []).filter((e) => !e.heure);
                    return (
                      <div
                        key={iso}
                        className={`flex h-7 items-center gap-1 overflow-hidden px-1 ${
                          estAujourdhui ? 'bg-accent/10' : 'bg-navy'
                        }`}
                      >
                        {sansHeure.length > 0 && (
                          <>
                            <button
                              type="button"
                              onClick={() => ouvrirEdition(sansHeure[0])}
                              className={`truncate rounded px-1 py-0.5 text-[10px] font-medium ${TYPES[sansHeure[0].type_evenement].badge} ${
                                sansHeure[0].termine ? 'opacity-40 line-through' : ''
                              }`}
                            >
                              {sansHeure[0].titre}
                            </button>
                            {sansHeure.length > 1 && (
                              <span className="shrink-0 text-[10px] font-medium text-white/30">+{sansHeure.length - 1}</span>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div ref={grilleHoraireRef} className="max-h-[440px] overflow-y-auto border-t border-white/10">
                  <div className={`${GRILLE_COLONNES} bg-white/[0.06]`}>
                    <div className="bg-navy">
                      <div className="relative" style={{ height: heures.length * HAUTEUR_HEURE }}>
                        {heures.map((h, i) => (
                          <span
                            key={h}
                            className="absolute right-1.5 -translate-y-1/2 text-[11px] text-white/30"
                            style={{ top: i * HAUTEUR_HEURE }}
                          >
                            {h}h
                          </span>
                        ))}
                      </div>
                    </div>

                    {joursSemaine.map((jour) => {
                      const iso = toISODate(jour);
                      const estAujourdhui = iso === aujourdhui;
                      const avecHeure = (parJour.get(iso) ?? []).filter((e) => e.heure);

                      return (
                        <div
                          key={iso}
                          className={`relative ${estAujourdhui ? 'bg-accent/10' : 'bg-navy'}`}
                          style={{ height: heures.length * HAUTEUR_HEURE }}
                        >
                          {heures.map((h, i) => (
                            <button
                              key={h}
                              type="button"
                              onClick={() => ouvrirNouveau(iso, `${String(h).padStart(2, '0')}:00`)}
                              className="absolute inset-x-0 border-t border-white/5 transition-colors hover:bg-white/[0.06] active:bg-white/10"
                              style={{ top: i * HAUTEUR_HEURE, height: HAUTEUR_HEURE }}
                            />
                          ))}

                          {estAujourdhui && afficherLigneMaintenant && (
                            <div
                              className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-sky-400"
                              style={{ top: topMaintenant }}
                            >
                              <span className="absolute -left-0.5 -top-1 h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
                            </div>
                          )}

                          {avecHeure.map((ev) => {
                            const [hh, mm] = ev.heure!.split(':').map(Number);
                            const top = ((hh - heureDebut) + mm / 60) * HAUTEUR_HEURE;
                            return (
                              <button
                                key={ev.id}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  ouvrirEdition(ev);
                                }}
                                className={`animate-pop-in absolute inset-x-1 z-20 overflow-hidden rounded-lg border-l-[3px] px-2 py-1 text-left shadow-sm transition-all hover:-translate-y-px hover:shadow-lg hover:shadow-black/30 active:scale-95 ${TYPES[ev.type_evenement].bloc} ${
                                  ev.termine ? 'opacity-40' : ''
                                }`}
                                style={{ top, height: ev.description ? 58 : 38 }}
                              >
                                <p className={`truncate text-[11px] font-semibold ${ev.termine ? 'line-through' : ''}`}>
                                  <span className="tabular-nums opacity-70">{formatHeure(ev.heure)}</span> {ev.titre}
                                </p>
                                {ev.description && (
                                  <p className="mt-0.5 truncate rounded bg-black/10 px-1 py-0.5 text-[10px] opacity-80">
                                    {ev.description.split('\n')[0]}
                                  </p>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {enRetard.length > 0 && (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.07] p-4 shadow-xl shadow-black/10">
              <h3 className="text-sm font-bold text-rose-400">En retard</h3>
              <div className="mt-3 flex flex-col gap-2">
                {enRetard.map((ev) => (
                  <AgendaItem key={ev.id} ev={ev} onToggle={basculerTermine} onEdit={ouvrirEdition} onDelete={setASupprimer} enRetard />
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-navy p-4 shadow-xl shadow-black/20">
            <h3 className="text-sm font-bold text-white">À venir</h3>
            <div className="mt-3 flex flex-col gap-2">
              {aVenir.length === 0 && <p className="text-sm text-white/30">Rien de prévu pour le moment.</p>}
              {aVenir.map((ev) => (
                <AgendaItem key={ev.id} ev={ev} onToggle={basculerTermine} onEdit={ouvrirEdition} onDelete={setASupprimer} />
              ))}
            </div>
          </div>
        </div>
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

function AgendaItem({
  ev,
  onToggle,
  onEdit,
  onDelete,
  enRetard,
}: {
  ev: Evenement;
  onToggle: (ev: Evenement) => void;
  onEdit: (ev: Evenement) => void;
  onDelete: (ev: Evenement) => void;
  enRetard?: boolean;
}) {
  const date = new Date(`${ev.date}T00:00:00`);
  const dateLabel = date.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' });
  const heure = formatHeure(ev.heure);

  return (
    <div className="animate-pop-in group flex items-start gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-white/5">
      <button
        type="button"
        onClick={() => onToggle(ev)}
        aria-label="Marquer comme terminé"
        className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-all active:scale-90 ${
          ev.termine ? 'border-accent bg-accent' : enRetard ? 'border-rose-400/50' : 'border-white/20 hover:border-accent'
        }`}
      >
        {ev.termine && (
          <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3 animate-pop-in" stroke="white">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <button type="button" onClick={() => onEdit(ev)} className="min-w-0 flex-1 text-left">
        <p className={`truncate text-sm font-semibold text-white ${ev.termine ? 'text-white/35 line-through' : ''}`}>
          {ev.titre}
        </p>
        <p className={`text-xs ${enRetard ? 'text-rose-400' : 'text-white/40'}`}>
          {dateLabel}
          {heure && ` · ${heure}`} · {TYPES[ev.type_evenement].label}
        </p>
      </button>
      <button
        type="button"
        onClick={() => onDelete(ev)}
        aria-label="Supprimer"
        className="shrink-0 rounded-full p-1 text-white/25 opacity-0 hover:text-rose-400 group-hover:opacity-100"
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
  );
}
