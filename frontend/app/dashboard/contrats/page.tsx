'use client';

import { useEffect, useMemo, useState } from 'react';

import { apiUrlClient, fetchClient, type CategorieContrat, type Contrat } from '@/lib/api';
import { formaterDate, formaterMontant } from '@/lib/argent';
import { afficherToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { ICONES, Icone } from '@/components/Icone';
import Pagination, { paginer } from '@/components/Pagination';

const PAR_PAGE = 10;

type Filtre = 'tous' | 'actif' | 'annule';

const FILTRES: { cle: Filtre; label: string }[] = [
  { cle: 'tous', label: 'Tous' },
  { cle: 'actif', label: 'Actifs' },
  { cle: 'annule', label: 'Annulés' },
];

const statutFactureStyle: Record<string, string> = {
  brouillon: 'bg-black/[0.05] text-black/60 ring-black/10',
  envoyee: 'bg-blue-50 text-blue-700 ring-blue-200',
  acceptee: 'bg-blue-50 text-blue-700 ring-blue-200',
  refusee: 'bg-red-50 text-red-700 ring-red-200',
  partielle: 'bg-amber-50 text-amber-800 ring-amber-200',
  payee: 'bg-green-50 text-green-700 ring-green-200',
};

const statutFactureLabel: Record<string, string> = {
  brouillon: 'Brouillon',
  envoyee: 'Envoyée',
  acceptee: 'Acceptée',
  refusee: 'Refusée',
  partielle: 'Partiellement payée',
  payee: 'Payée',
};

// Une teinte par type de contrat, pour repérer d'un coup d'œil la ligne d'affaires.
const STYLE_CATEGORIE: Record<CategorieContrat, string> = {
  developpement: 'bg-indigo-50 text-indigo-700',
  maintenance: 'bg-sky-50 text-sky-700',
  fonctionnalite: 'bg-teal-50 text-teal-700',
  abonnement_saas: 'bg-navy text-accent',
};

function sansAccents(texte: string) {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function Pastille({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${className}`}>
      {children}
    </span>
  );
}

/** Plan de paiement : chaque versement payé (selon les paiements reçus sur la facture) est
 * marqué en vert, les suivants restent à venir. */
function PlanDePaiement({ contrat }: { contrat: Contrat }) {
  const facture = contrat.factures_liees[0];
  const paye = facture ? Number(facture.montant_paye) : 0;
  // Un versement est payé quand les paiements reçus couvrent le cumul jusqu'à lui.
  const versements = contrat.echeancier_json.map((v, i) => {
    const cumul = contrat.echeancier_json.slice(0, i + 1).reduce((total, x) => total + Number(x.montant), 0);
    return { ...v, paye: paye + 0.005 >= cumul };
  });
  const nbPayes = versements.filter((v) => v.paye).length;

  return (
    <div className="rounded-xl border border-black/10 bg-black/[0.015] p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-navy">
          <Icone d={ICONES.calendrier} className="h-4 w-4 text-indigo-600" />
          Plan de paiement · {nbPayes}/{versements.length} versement{versements.length > 1 ? 's' : ''} payé
          {nbPayes > 1 ? 's' : ''}
        </p>
        {facture && (
          <Pastille className={statutFactureStyle[facture.statut]}>
            {facture.numero} · {statutFactureLabel[facture.statut]}
            {facture.statut === 'partielle' && ` · solde ${formaterMontant(facture.solde_du)}`}
          </Pastille>
        )}
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-black/10">
        <div
          className="h-full rounded-full bg-green-500 transition-all"
          style={{ width: `${versements.length ? (nbPayes / versements.length) * 100 : 0}%` }}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {versements.map((v, i) => (
          <span
            key={i}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs ${
              v.paye ? 'border-green-200 bg-green-50 text-green-800' : 'border-black/10 bg-white text-black/65'
            }`}
          >
            {v.paye && <Icone d={ICONES.succes} className="h-3.5 w-3.5" />}
            {formaterDate(v.date)} · <span className="font-semibold tabular-nums">{formaterMontant(v.montant)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ContratsDashboardPage() {
  const [contrats, setContrats] = useState<Contrat[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [aAnnuler, setAAnnuler] = useState<Contrat | null>(null);
  const [aSupprimer, setASupprimer] = useState<Contrat | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [facturationEnCours, setFacturationEnCours] = useState<number | null>(null);
  const [filtre, setFiltre] = useState<Filtre>('tous');
  const [recherche, setRecherche] = useState('');
  const [page, setPage] = useState(1);

  function charger() {
    fetchClient<Contrat[]>('/api/contrats/')
      .then(setContrats)
      .catch((e) => setErreur(e.message));
  }

  useEffect(charger, []);

  const compteurs = useMemo(() => {
    const liste = contrats || [];
    return {
      tous: liste.length,
      actif: liste.filter((c) => c.statut === 'actif').length,
      annule: liste.filter((c) => c.statut === 'annule').length,
    };
  }, [contrats]);

  const visibles = useMemo(() => {
    const terme = sansAccents(recherche.trim());
    return (contrats || []).filter((c) => {
      if (filtre !== 'tous' && c.statut !== filtre) return false;
      if (!terme) return true;
      return [c.numero, c.client_nom, c.nom_signataire, c.categorie_label].some((v) => sansAccents(v || '').includes(terme));
    });
  }, [contrats, filtre, recherche]);

  const { nbPages, pageCourante, elements: contratsPage } = paginer(visibles, page, PAR_PAGE);

  async function basculerStatut() {
    if (!aAnnuler) return;
    setEnCours(true);
    try {
      await fetchClient(`/api/contrats/${aAnnuler.id}/annuler/`, { method: 'POST' });
      afficherToast(
        aAnnuler.statut === 'actif' ? `${aAnnuler.numero} annulé.` : `${aAnnuler.numero} réactivé.`,
      );
      setAAnnuler(null);
      charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de la mise à jour.');
    } finally {
      setEnCours(false);
    }
  }

  async function confirmerSuppression() {
    if (!aSupprimer) return;
    setSuppressionEnCours(true);
    try {
      await fetchClient(`/api/contrats/${aSupprimer.id}/`, { method: 'DELETE' });
      afficherToast(`${aSupprimer.numero} supprimé.`);
      setASupprimer(null);
      charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de la suppression.');
    } finally {
      setSuppressionEnCours(false);
    }
  }

  async function facturerSolde(contrat: Contrat) {
    setFacturationEnCours(contrat.id);
    try {
      await fetchClient(`/api/contrats/${contrat.id}/facturer-solde/`, { method: 'POST' });
      afficherToast(`Facture de solde créée en brouillon pour ${contrat.numero} — envoie-la depuis Facturation.`);
      charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de la facturation du solde.');
    } finally {
      setFacturationEnCours(null);
    }
  }

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy">Contrats</h1>
        <p className="mt-1 max-w-3xl text-sm text-black/55">
          Contrats générés automatiquement lorsqu&apos;un client accepte une soumission en ligne. Le PDF archivé
          n&apos;est jamais régénéré — il fait foi de ce qui a été accepté.
        </p>
      </div>

      {/* Filtres */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-fit gap-1 rounded-xl border border-black/15 bg-black/[0.04] p-1">
          {FILTRES.map((f) => {
            const actif = filtre === f.cle;
            return (
              <button
                key={f.cle}
                onClick={() => {
                  setFiltre(f.cle);
                  setPage(1);
                }}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
                  actif ? 'bg-white text-navy shadow-sm ring-1 ring-black/10' : 'text-black/70 hover:bg-white/70 hover:text-navy'
                }`}
              >
                {f.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
                    actif ? 'bg-navy text-white' : 'bg-black/10 text-black/70'
                  }`}
                >
                  {compteurs[f.cle]}
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
            placeholder="Rechercher un contrat…"
            className="w-full rounded-xl border border-black/20 bg-white py-2.5 pl-9 pr-3 text-sm text-navy shadow-sm placeholder:text-black/40 focus:border-navy focus:outline-none focus:ring-4 focus:ring-navy/10"
          />
        </label>
      </div>

      {erreur && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</p>}

      <div className="mt-5 overflow-hidden rounded-2xl border border-black/15 bg-white shadow-sm">
        {contrats === null && (
          <div className="divide-y divide-black/10">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-5">
                <div className="h-11 w-11 animate-pulse rounded-xl bg-black/[0.06]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-48 animate-pulse rounded bg-black/[0.06]" />
                  <div className="h-3 w-72 animate-pulse rounded bg-black/[0.04]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {contrats !== null && visibles.length === 0 && (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/[0.04] text-black/30">
              <Icone d={ICONES.document} className="h-6 w-6" />
            </div>
            <p className="mt-3 font-semibold text-navy">
              {recherche ? 'Aucun contrat ne correspond à votre recherche' : 'Aucun contrat signé pour le moment'}
            </p>
          </div>
        )}

        <ul className="divide-y divide-black/10">
          {contratsPage.map((contrat) => {
            const annule = contrat.statut === 'annule';
            return (
              <li key={contrat.id} className={`flex flex-col gap-3 px-5 py-4 ${annule ? 'bg-black/[0.015]' : ''}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                        annule ? 'bg-black/[0.05] text-black/35' : STYLE_CATEGORIE[contrat.categorie]
                      }`}
                    >
                      <Icone d={contrat.categorie === 'abonnement_saas' ? ICONES.flamme : ICONES.document} className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className={`font-semibold tabular-nums ${annule ? 'text-black/45 line-through' : 'text-navy'}`}>
                          {contrat.numero}
                        </p>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STYLE_CATEGORIE[contrat.categorie]}`}>
                          {contrat.categorie === 'abonnement_saas' ? (
                            <span className="text-white">
                              Abonnement Extinc<span className="text-accent">Pro</span>
                            </span>
                          ) : (
                            contrat.categorie_label
                          )}
                        </span>
                        <Pastille
                          className={annule ? 'bg-black/[0.05] text-black/55 ring-black/10' : 'bg-green-50 text-green-700 ring-green-200'}
                        >
                          {annule ? 'Annulé' : 'Actif'}
                        </Pastille>
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-black/55">
                        <span className="font-medium text-black/75">{contrat.client_nom}</span>
                        <span className="text-black/25">·</span>
                        <span>
                          signé par {contrat.nom_signataire} le {formaterDate(contrat.date_signature.slice(0, 10))}
                        </span>
                        <span className="text-black/25">·</span>
                        <span>soumission {contrat.soumission_numero}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 pl-[60px] sm:pl-0">
                    <p className="mr-3 text-lg font-bold tabular-nums text-navy">{formaterMontant(contrat.total)}</p>
                    <a
                      href={apiUrlClient(`/api/contrats/${contrat.id}/pdf/`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Voir le PDF signé"
                      aria-label="Voir le PDF signé"
                      className="rounded-lg p-2 text-black/45 transition hover:bg-black/[0.05] hover:text-navy"
                    >
                      <Icone d={ICONES.telecharger} />
                    </a>
                    <button
                      onClick={() => setAAnnuler(contrat)}
                      title={annule ? 'Réactiver' : 'Annuler le contrat'}
                      aria-label={annule ? 'Réactiver' : 'Annuler le contrat'}
                      className="rounded-lg p-2 text-black/45 transition hover:bg-amber-50 hover:text-amber-700"
                    >
                      <Icone d={annule ? ICONES.succes : ICONES.annuler} />
                    </button>
                    <button
                      onClick={() => setASupprimer(contrat)}
                      title="Supprimer"
                      aria-label="Supprimer"
                      className="rounded-lg p-2 text-black/35 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Icone d={ICONES.supprimer} />
                    </button>
                  </div>
                </div>

                {contrat.echeancier_json.length > 0 && (
                  <div className="sm:ml-[60px]">
                    <PlanDePaiement contrat={contrat} />
                  </div>
                )}

                {!contrat.echeancier_json.length && contrat.pourcentage_acompte && (
                  <div className="grid gap-2 sm:ml-[60px] sm:grid-cols-2">
                    {(['acompte', 'solde'] as const).map((type) => {
                      const facture = contrat.factures_liees.find((f) => f.type_paiement === type);
                      const montant = type === 'acompte' ? contrat.montant_acompte : contrat.montant_solde;
                      const pourcentage = type === 'acompte'
                        ? contrat.pourcentage_acompte
                        : (100 - Number(contrat.pourcentage_acompte)).toString();
                      return (
                        <div
                          key={type}
                          className="flex items-center justify-between gap-2 rounded-xl border border-black/10 bg-black/[0.015] px-3.5 py-2.5 text-sm"
                        >
                          <span>
                            <span className="font-semibold text-navy">{type === 'acompte' ? 'Acompte' : 'Solde'}</span>{' '}
                            <span className="text-black/55">
                              {Number(pourcentage)} % · {formaterMontant(montant ?? 0)}
                            </span>
                          </span>
                          {facture ? (
                            <Pastille className={statutFactureStyle[facture.statut]}>
                              {statutFactureLabel[facture.statut]}
                              {facture.statut === 'partielle' && ` · solde ${formaterMontant(facture.solde_du)}`}
                            </Pastille>
                          ) : type === 'solde' ? (
                            <button
                              onClick={() => facturerSolde(contrat)}
                              disabled={facturationEnCours === contrat.id}
                              className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white transition hover:-translate-y-px hover:shadow-md disabled:opacity-50"
                            >
                              {facturationEnCours === contrat.id ? 'Facturation…' : 'Facturer le solde'}
                            </button>
                          ) : (
                            <span className="text-xs text-black/40">—</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <Pagination
          page={pageCourante}
          nbPages={nbPages}
          total={visibles.length}
          parPage={PAR_PAGE}
          libelle={['contrat', 'contrats']}
          onChange={setPage}
        />
      </div>

      {aAnnuler && (
        <ConfirmDialog
          titre={aAnnuler.statut === 'actif' ? 'Annuler ce contrat ?' : 'Réactiver ce contrat ?'}
          message={
            aAnnuler.statut === 'actif'
              ? `${aAnnuler.numero} sera marqué comme annulé (le PDF archivé est conservé).`
              : `${aAnnuler.numero} sera remarqué comme actif.`
          }
          enCours={enCours}
          labelConfirmer={aAnnuler.statut === 'actif' ? 'Annuler' : 'Réactiver'}
          labelEnCours="Mise à jour…"
          onConfirm={basculerStatut}
          onCancel={() => setAAnnuler(null)}
        />
      )}

      {aSupprimer && (
        <ConfirmDialog
          titre="Supprimer ce contrat ?"
          message={`${aSupprimer.numero} sera supprimé définitivement, y compris le PDF signé archivé. Les factures d'acompte/solde déjà émises sont conservées mais perdent leur lien vers ce contrat.`}
          enCours={suppressionEnCours}
          onConfirm={confirmerSuppression}
          onCancel={() => setASupprimer(null)}
        />
      )}
    </div>
  );
}
