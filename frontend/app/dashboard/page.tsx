'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { apiUrlClient, fetchClient, type AlerteExtincPro, type Evenement, type TypeEvenement } from '@/lib/api';
import { formaterDate, formaterMontant } from '@/lib/argent';
import FactureEncaisseChart, { type PointFactureEncaisse } from '@/components/FactureEncaisseChart';
import { clientDotStyle } from '@/lib/clientColors';

const TYPES_EVENEMENT: Record<TypeEvenement, { label: string; badge: string }> = {
  rendez_vous: { label: 'Rendez-vous', badge: 'bg-rose-500/10 text-rose-600' },
  tache: { label: 'Tâche', badge: 'bg-emerald-500/10 text-emerald-600' },
  rappel: { label: 'Rappel', badge: 'bg-amber-500/10 text-amber-600' },
};

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface SoumissionRecente {
  id: number;
  numero: string;
  client_nom: string;
  statut: 'acceptee' | 'refusee' | 'payee';
  date_reponse: string | null;
  total: string;
}

interface Stats {
  date: string;
  mois_courant: string;
  mois_precedent: string;
  encaisse_mois: number;
  encaisse_mois_precedent: number;
  comptes_a_recevoir: number;
  nb_factures_a_recevoir: number;
  montant_en_retard: number;
  factures_en_retard: number;
  clients_en_retard: number;
  facture_annee: number;
  soumissions_en_attente: number;
  soumissions_en_attente_montant: number;
  taux_acceptation: number | null;
  soumissions_repondues: number;
  clients_actifs: number;
  clients_total: number;
  realisations_publiees: number;
  serie_12_mois: PointFactureEncaisse[];
  // Ligne d'affaires ExtincPro, calculée sur la base de MS Solution (toujours disponible).
  extincpro: {
    encaisse_mois: number;
    encaisse_mois_precedent: number;
    facture_annee: number;
    part_annee: number | null;
    abonnes: number;
    resilies: number;
  };
  a_faire: {
    versements_semaine: {
      facture_id: number; numero: string; client: string; date: string; montant: number; extincpro: boolean;
    }[];
    total_versements_semaine: number;
    soumissions_expirent: { id: number; numero: string; client: string; date_echeance: string; jours: number; total: number }[];
    factures_brouillon: { id: number; numero: string; client: string; total: number }[];
    rappels_aujourdhui: number;
  };
  soumissions_recentes: SoumissionRecente[];
}

// État en direct des organisations, lu dans ExtincPro (peut être indisponible).
interface EtatExtincPro {
  configure: boolean;
  erreur?: string;
  a_lier: number;
  a_lier_noms: string[];
  alertes: number;
  alertes_detail: AlerteExtincPro[];
  nb_actifs: number;
  nb_bloques: number;
}

function BadgeExtincPro() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-navy px-1.5 py-0.5 text-[9px] font-bold text-white">
      Extinc<span className="text-accent">Pro</span>
    </span>
  );
}

function MiniStat({ libelle, valeur, detail }: { libelle: string; valeur: React.ReactNode; detail?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-black/10 bg-white p-4">
      <p className="text-xs text-black/55">{libelle}</p>
      <p className="mt-1 whitespace-nowrap text-xl font-bold tabular-nums text-navy">{valeur}</p>
      {detail && <div className="mt-0.5 text-xs text-black/50">{detail}</div>}
    </div>
  );
}

const STATUT_SOUMISSION: Record<'acceptee' | 'refusee' | 'payee', { label: string; badge: string }> = {
  acceptee: { label: 'Acceptée', badge: 'bg-green-100 text-green-700' },
  refusee: { label: 'Refusée', badge: 'bg-red-100 text-red-700' },
  payee: { label: 'Reçue', badge: 'bg-green-100 text-green-700' },
};

// Icônes au trait, même style partout dans le tableau de bord.
const ICONES = {
  encaisse: 'M12 6v12m4-9c0-1.66-1.79-3-4-3s-4 1.34-4 3 1.79 3 4 3 4 1.34 4 3-1.79 3-4 3-4-1.34-4-3',
  recevoir:
    'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3M3.75 19.5h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Z',
  retard: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  ok: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  hausse: 'm4.5 15.75 7.5-7.5 7.5 7.5',
  baisse: 'm19.5 8.25-7.5 7.5-7.5-7.5',
  fleche: 'm8.25 4.5 7.5 7.5-7.5 7.5',
  flamme:
    'M12 3c.5 3-2.5 4.5-2.5 7.5a2.5 2.5 0 0 0 5 0c0-.9-.3-1.7-.8-2.4 2 .9 3.8 3.1 3.8 6.1A5.5 5.5 0 0 1 12 19.7a5.5 5.5 0 0 1-5.5-5.5C6.5 9 12 7.5 12 3Z',
  cadenas:
    'M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z',
  lien:
    'M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244',
};

function Icone({ nom, className = 'h-5 w-5' }: { nom: keyof typeof ICONES; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={`shrink-0 ${className}`} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={ICONES[nom]} />
    </svg>
  );
}

function Variation({ actuel, precedent, moisPrecedent }: { actuel: number; precedent: number; moisPrecedent: string }) {
  if (precedent <= 0) {
    return <p className="mt-2 text-xs text-black/50">{formaterMontant(precedent)} en {moisPrecedent}</p>;
  }
  const pourcentage = Math.round(((actuel - precedent) / precedent) * 100);
  const hausse = pourcentage >= 0;
  return (
    <p className="mt-2 flex items-center gap-1 text-xs">
      <span className={`flex items-center gap-0.5 font-semibold ${hausse ? 'text-green-700' : 'text-red-600'}`}>
        <Icone nom={hausse ? 'hausse' : 'baisse'} className="h-3.5 w-3.5" />
        {hausse ? '+' : ''}
        {pourcentage.toLocaleString('fr-CA')} %
      </span>
      <span className="text-black/50">vs {moisPrecedent} ({formaterMontant(precedent)})</span>
    </p>
  );
}

function CarteSecondaire({ label, valeur, detail, href }: { label: string; valeur: string; detail?: string; href?: string }) {
  const contenu = (
    <>
      <p className="text-xs text-black/50">{label}</p>
      <p className="mt-1 whitespace-nowrap text-lg font-bold text-navy sm:text-xl">{valeur}</p>
      {detail && <p className="mt-0.5 text-xs text-black/40">{detail}</p>}
    </>
  );
  const classes = 'min-w-0 rounded-xl border border-black/5 bg-white p-4 shadow-sm';
  return href ? (
    <Link href={href} className={`${classes} transition-colors hover:border-navy/20`}>
      {contenu}
    </Link>
  ) : (
    <div className={classes}>{contenu}</div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [evenements, setEvenements] = useState<Evenement[]>([]);
  const [etatExtincPro, setEtatExtincPro] = useState<EtatExtincPro | null>(null);

  useEffect(() => {
    fetchClient<Stats>('/api/dashboard/stats/')
      .then(setStats)
      .catch((e) => setErreur(e.message));

    fetchClient<Evenement[]>('/api/evenements/')
      .then(setEvenements)
      .catch(() => {});

    // Chargé à part : si ExtincPro est injoignable, le reste du tableau de bord s'affiche quand même.
    fetchClient<EtatExtincPro>('/api/extincpro/etat/')
      .then(setEtatExtincPro)
      .catch(() => setEtatExtincPro(null));
  }, []);

  const aujourdhui = toISODate(new Date());
  const evenementsAVenir = evenements
    .filter((e) => !e.termine && e.date >= aujourdhui)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.heure ?? '99').localeCompare(b.heure ?? '99'))
    .slice(0, 5);

  const aFaire = stats?.a_faire;
  const decisionsExtincPro = (etatExtincPro?.alertes_detail || []).filter((a) => a.type !== 'resiliee');
  const aLierExtincPro = etatExtincPro?.a_lier_noms || [];
  const rienExtincPro = !decisionsExtincPro.length && !aLierExtincPro.length;
  const rienAFaire =
    aFaire &&
    !aFaire.versements_semaine.length &&
    !aFaire.soumissions_expirent.length &&
    !aFaire.factures_brouillon.length &&
    rienExtincPro;
  const ext = stats?.extincpro;
  const varExt =
    ext && ext.encaisse_mois_precedent > 0
      ? Math.round(((ext.encaisse_mois - ext.encaisse_mois_precedent) / ext.encaisse_mois_precedent) * 100)
      : null;
  const enRetard = (stats?.montant_en_retard ?? 0) > 0;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold text-navy">Vue d&apos;ensemble</h1>
        {stats && <p className="text-sm capitalize text-black/50">{formaterDate(stats.date)}</p>}
      </div>

      {erreur && <p className="mt-4 text-sm text-red-600">{erreur}</p>}

      {/* L'argent, d'abord */}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Link
          href="/dashboard/facturation?onglet=facture"
          className="rounded-xl border border-black/5 bg-white p-5 shadow-sm transition-colors hover:border-navy/20"
        >
          <p className="flex items-center gap-2 text-sm text-black/60">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 text-green-700">
              <Icone nom="encaisse" className="h-4 w-4" />
            </span>
            Encaissé en {stats?.mois_courant ?? '…'}
          </p>
          <p className="mt-3 text-3xl font-bold text-navy">{stats ? formaterMontant(stats.encaisse_mois) : '—'}</p>
          {stats && (
            <Variation
              actuel={stats.encaisse_mois}
              precedent={stats.encaisse_mois_precedent}
              moisPrecedent={stats.mois_precedent}
            />
          )}
        </Link>

        <Link
          href="/dashboard/facturation?onglet=a_recevoir"
          className="rounded-xl border border-black/5 bg-white p-5 shadow-sm transition-colors hover:border-navy/20"
        >
          <p className="flex items-center gap-2 text-sm text-black/60">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy/5 text-navy">
              <Icone nom="recevoir" className="h-4 w-4" />
            </span>
            À recevoir
          </p>
          <p className="mt-3 text-3xl font-bold text-navy">{stats ? formaterMontant(stats.comptes_a_recevoir) : '—'}</p>
          {stats && (
            <p className="mt-2 text-xs text-black/50">
              {stats.nb_factures_a_recevoir} facture{stats.nb_factures_a_recevoir > 1 ? 's' : ''} avec un solde dû
            </p>
          )}
        </Link>

        <Link
          href="/dashboard/facturation?onglet=a_recevoir"
          className={`rounded-xl border p-5 shadow-sm transition-colors ${
            enRetard ? 'border-red-200 bg-red-50/60 hover:border-red-300' : 'border-black/5 bg-white hover:border-navy/20'
          }`}
        >
          <p className={`flex items-center gap-2 text-sm ${enRetard ? 'font-semibold text-red-700' : 'text-black/60'}`}>
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${enRetard ? 'bg-red-100 text-red-700' : 'bg-green-50 text-green-700'}`}
            >
              <Icone nom={enRetard ? 'retard' : 'ok'} className="h-4 w-4" />
            </span>
            En retard
          </p>
          <p className={`mt-3 text-3xl font-bold ${enRetard ? 'text-red-700' : 'text-navy'}`}>
            {stats ? formaterMontant(stats.montant_en_retard) : '—'}
          </p>
          {stats && (
            <p className={`mt-2 flex items-center gap-1 text-xs ${enRetard ? 'font-semibold text-red-700' : 'text-green-700'}`}>
              {enRetard ? (
                <>
                  {stats.clients_en_retard} client{stats.clients_en_retard > 1 ? 's' : ''} · {stats.factures_en_retard} facture
                  {stats.factures_en_retard > 1 ? 's' : ''} — voir
                  <Icone nom="fleche" className="h-3 w-3" />
                </>
              ) : (
                'Aucun paiement en retard'
              )}
            </p>
          )}
        </Link>
      </div>

      {/* ExtincPro */}
      <section className="mt-6 overflow-hidden rounded-2xl border border-black/15 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-navy px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-accent">
              <Icone nom="flamme" className="h-5 w-5" />
            </span>
            <div>
              <p className="text-base font-bold text-white">
                Extinc<span className="text-accent">Pro</span>
              </p>
              <p className="text-xs text-white/60">Abonnements au logiciel</p>
            </div>
          </div>
          <Link
            href="/dashboard/extincpro"
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            Gérer les abonnements
            <Icone nom="fleche" className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 bg-black/[0.02] p-4 lg:grid-cols-4">
          <MiniStat
            libelle="Abonnés"
            valeur={etatExtincPro?.configure && !etatExtincPro.erreur ? etatExtincPro.nb_actifs : ext ? ext.abonnes : '—'}
            detail={
              etatExtincPro?.configure && !etatExtincPro.erreur ? (
                etatExtincPro.nb_bloques > 0 ? (
                  <span className="font-semibold text-red-700">
                    actifs · {etatExtincPro.nb_bloques} bloqué{etatExtincPro.nb_bloques > 1 ? 's' : ''}
                  </span>
                ) : (
                  'actifs · aucun bloqué'
                )
              ) : ext ? (
                `liés${ext.resilies ? ` · ${ext.resilies} résilié${ext.resilies > 1 ? 's' : ''}` : ''}`
              ) : undefined
            }
          />
          <MiniStat
            libelle={`Encaissé en ${stats?.mois_courant ?? '…'}`}
            valeur={ext ? formaterMontant(ext.encaisse_mois) : '—'}
            detail={
              ext &&
              (varExt === null ? (
                `${formaterMontant(ext.encaisse_mois_precedent)} en ${stats?.mois_precedent}`
              ) : (
                <span className={varExt >= 0 ? 'font-semibold text-green-700' : 'font-semibold text-red-600'}>
                  {varExt >= 0 ? '+' : ''}
                  {varExt} % vs {stats?.mois_precedent}
                </span>
              ))
            }
          />
          <MiniStat
            libelle={`Facturé en ${stats ? stats.date.slice(0, 4) : '…'}`}
            valeur={ext ? formaterMontant(ext.facture_annee) : '—'}
            detail={
              ext?.part_annee != null && (
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-12 overflow-hidden rounded-full bg-black/10">
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${ext.part_annee}%` }} />
                  </span>
                  {ext.part_annee} % de ton chiffre d&apos;affaires
                </span>
              )
            }
          />
          <MiniStat
            libelle="À décider"
            valeur={
              etatExtincPro?.configure && !etatExtincPro.erreur ? (
                <span className={decisionsExtincPro.length ? 'text-red-700' : 'text-green-700'}>
                  {decisionsExtincPro.length + etatExtincPro.a_lier}
                </span>
              ) : (
                '—'
              )
            }
            detail={
              !etatExtincPro
                ? 'Chargement…'
                : !etatExtincPro.configure
                  ? 'Intégration non configurée'
                  : etatExtincPro.erreur
                    ? 'ExtincPro injoignable'
                    : `${decisionsExtincPro.length} blocage(s) · ${etatExtincPro.a_lier} à lier`
            }
          />
        </div>
      </section>

      {/* À faire cette semaine */}
      <div className="mt-6 rounded-xl border border-black/5 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-navy">À surveiller cette semaine</h2>
          {aFaire && aFaire.rappels_aujourdhui > 0 && (
            <Link href="/dashboard/parametres" className="text-xs text-black/50 hover:text-navy">
              {`${aFaire.rappels_aujourdhui} rappel${aFaire.rappels_aujourdhui > 1 ? 's' : ''} automatique${
                aFaire.rappels_aujourdhui > 1 ? 's' : ''
              } envoyé${aFaire.rappels_aujourdhui > 1 ? 's' : ''} aujourd’hui`}
            </Link>
          )}
        </div>

        {!aFaire && <div className="mt-4 h-16 animate-pulse rounded-lg bg-black/5" />}
        {rienAFaire && <p className="mt-3 text-sm text-black/40">Rien d&apos;urgent cette semaine.</p>}

        {aFaire && !rienAFaire && (
          <div className="mt-4 grid gap-x-8 gap-y-5 md:grid-cols-2">
            {aFaire.versements_semaine.length > 0 && (
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
                  Versements attendus · {formaterMontant(aFaire.total_versements_semaine)}
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {aFaire.versements_semaine.map((v, i) => (
                    <li key={`${v.facture_id}-${i}`}>
                      <Link
                        href={`/dashboard/facturation?onglet=facture&facture=${v.facture_id}`}
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-black/[0.03]"
                      >
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate font-medium text-navy">{v.client}</span>
                            {v.extincpro && <BadgeExtincPro />}
                          </span>
                          <span className="block text-xs text-black/45">{formaterDate(v.date)}</span>
                        </span>
                        <span className="shrink-0 font-semibold text-navy">{formaterMontant(v.montant)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {aFaire.soumissions_expirent.length > 0 && (
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-black/40">Soumissions qui expirent</p>
                <ul className="mt-2 flex flex-col gap-1">
                  {aFaire.soumissions_expirent.map((s) => (
                    <li key={s.id}>
                      <Link
                        href="/dashboard/facturation?onglet=soumission"
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-black/[0.03]"
                      >
                        <span className="min-w-0 truncate">
                          <span className="font-medium text-navy">{s.numero}</span>
                          <span className="ml-1.5 text-xs text-black/40">{s.client}</span>
                        </span>
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          {s.jours === 0 ? 'aujourd’hui' : `dans ${s.jours} j`}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!rienExtincPro && (
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-black/40">
                  ExtincPro <BadgeExtincPro />
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {decisionsExtincPro.map((a) => (
                    <li key={`${a.type}-${a.client_id}`}>
                      <Link
                        href="/dashboard/extincpro"
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-black/[0.03]"
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Icone nom="cadenas" className={`h-3.5 w-3.5 ${a.type === 'a_bloquer' ? 'text-red-600' : 'text-green-600'}`} />
                          <span className="truncate font-medium text-navy">{a.client_nom}</span>
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                            a.type === 'a_bloquer' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {a.type === 'a_bloquer' ? `${a.retard?.jours} j · à bloquer` : 'à débloquer'}
                        </span>
                      </Link>
                    </li>
                  ))}
                  {aLierExtincPro.map((nom) => (
                    <li key={`lier-${nom}`}>
                      <Link
                        href="/dashboard/extincpro"
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-black/[0.03]"
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Icone nom="lien" className="h-3.5 w-3.5 text-amber-600" />
                          <span className="truncate font-medium text-navy">{nom}</span>
                        </span>
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          à lier
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {aFaire.factures_brouillon.length > 0 && (
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-black/40">Factures à envoyer</p>
                <ul className="mt-2 flex flex-col gap-1">
                  {aFaire.factures_brouillon.map((f) => (
                    <li key={f.id}>
                      <Link
                        href="/dashboard/facturation?onglet=facture"
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-black/[0.03]"
                      >
                        <span className="min-w-0 truncate">
                          <span className="font-medium text-navy">{f.numero}</span>
                          <span className="ml-1.5 text-xs text-black/40">{f.client}</span>
                        </span>
                        <span className="shrink-0 text-black/60">{formaterMontant(f.total)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Facturé vs encaissé */}
      {stats && (
        <div className="mt-6">
          <FactureEncaisseChart donnees={stats.serie_12_mois} />
        </div>
      )}

      {/* Indicateurs secondaires */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <CarteSecondaire
          label={`Facturé en ${stats ? stats.date.slice(0, 4) : '…'}`}
          valeur={stats ? formaterMontant(stats.facture_annee) : '—'}
          detail="Factures émises, payées ou non"
        />
        <CarteSecondaire
          label="Soumissions en attente"
          valeur={stats ? String(stats.soumissions_en_attente) : '—'}
          detail={stats ? `${formaterMontant(stats.soumissions_en_attente_montant)} potentiels` : undefined}
          href="/dashboard/facturation?onglet=soumission"
        />
        <CarteSecondaire
          label="Taux d’acceptation"
          valeur={stats ? (stats.taux_acceptation === null ? '—' : `${stats.taux_acceptation} %`) : '—'}
          detail={stats ? `Sur ${stats.soumissions_repondues} réponse${stats.soumissions_repondues > 1 ? 's' : ''} (12 mois)` : undefined}
        />
        <CarteSecondaire
          label="Clients actifs"
          valeur={stats ? String(stats.clients_actifs) : '—'}
          detail={stats ? `Sur ${stats.clients_total} au total (12 mois)` : undefined}
          href="/dashboard/clients"
        />
      </div>

      {/* Agenda et réponses */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-navy">Événements à venir</h2>
            <Link href="/dashboard/planificateur" className="text-sm font-medium text-accent hover:underline">
              Planificateur
            </Link>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {evenementsAVenir.length === 0 && <p className="text-sm text-black/40">Rien de prévu pour le moment.</p>}
            {evenementsAVenir.map((ev) => {
              const date = new Date(`${ev.date}T00:00:00`);
              const dateLabel = date.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' });
              return (
                <div key={ev.id} className="flex items-center gap-3 rounded-lg p-1.5">
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${TYPES_EVENEMENT[ev.type_evenement].badge}`}>
                    {TYPES_EVENEMENT[ev.type_evenement].label}
                  </span>
                  {ev.client && <span className="h-2 w-2 shrink-0 rounded-full" style={clientDotStyle(ev.client) ?? undefined} />}
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-navy">
                    {ev.titre}
                    {ev.client_nom && <span className="ml-1.5 font-normal text-black/40">— {ev.client_nom}</span>}
                  </p>
                  <p className="shrink-0 text-xs text-black/40">
                    {dateLabel}
                    {ev.heure && ` · ${ev.heure.slice(0, 5)}`}
                  </p>
                  {ev.document && (
                    <a
                      href={apiUrlClient(`/api/documents/${ev.document}/pdf/`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-xs font-semibold text-accent hover:underline"
                    >
                      PDF
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="min-w-0 rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-navy">Réponses aux soumissions</h2>
            <Link href="/dashboard/facturation?onglet=soumission" className="text-sm font-medium text-accent hover:underline">
              Soumissions
            </Link>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {stats && stats.soumissions_recentes.length === 0 && (
              <p className="text-sm text-black/40">Aucune réponse reçue pour le moment.</p>
            )}
            {stats?.soumissions_recentes.map((sou) => (
              <div key={sou.id} className="flex items-center gap-3 rounded-lg p-1.5">
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUT_SOUMISSION[sou.statut].badge}`}>
                  {STATUT_SOUMISSION[sou.statut].label}
                </span>
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-navy">
                  {sou.numero}
                  <span className="ml-1.5 font-normal text-black/40">— {sou.client_nom}</span>
                </p>
                <p className="shrink-0 text-xs text-black/40">
                  {sou.date_reponse && new Date(sou.date_reponse).toLocaleDateString('fr-CA', { timeZone: 'UTC' })}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {stats && (
        <p className="mt-6 text-xs text-black/40">
          Site public : {stats.realisations_publiees} réalisation{stats.realisations_publiees > 1 ? 's' : ''} publiée
          {stats.realisations_publiees > 1 ? 's' : ''} ·{' '}
          <Link href="/dashboard/realisations" className="hover:text-navy hover:underline">
            gérer
          </Link>
        </p>
      )}
    </div>
  );
}
