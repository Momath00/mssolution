'use client';

import { use, useEffect, useState } from 'react';

import { apiUrlClient, fetchClient, type DocumentFacturation } from '@/lib/api';
import { formaterMontant, versCents } from '@/lib/argent';
import { clientAvatarStyle, initiales } from '@/lib/clientColors';
import { usePageServeur } from '@/lib/usePageServeur';
import { afficherToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { ICONES, Icone } from '@/components/Icone';
import Pagination from '@/components/Pagination';

import CatalogueManager from './CatalogueManager';
import ComptesARecevoir from './ComptesARecevoir';
import ConvertirFactureDialog from './ConvertirFactureDialog';
import DocumentForm from './DocumentForm';
import PaiementsPanel from './PaiementsPanel';
import PlanSoumissionPanel from './PlanSoumissionPanel';

const PAR_PAGE = 10;

const statutLabel: Record<string, string> = {
  brouillon: 'Brouillon',
  envoyee: 'Envoyée',
  acceptee: 'Acceptée',
  refusee: 'Refusée',
  partielle: 'Partiellement payée',
  payee: 'Payée',
};

type Onglet = 'soumission' | 'facture' | 'a_recevoir' | 'catalogue';

const ONGLETS: Record<Onglet, { label: string; icone: string }> = {
  soumission: { label: 'Soumissions', icone: ICONES.document },
  facture: { label: 'Factures', icone: ICONES.argent },
  a_recevoir: { label: 'Comptes à recevoir', icone: ICONES.horloge },
  catalogue: { label: 'Catalogue de prix', icone: ICONES.plus },
};

const statutStyle: Record<string, string> = {
  brouillon: 'bg-black/[0.05] text-black/60 ring-black/10',
  envoyee: 'bg-blue-50 text-blue-700 ring-blue-200',
  acceptee: 'bg-green-50 text-green-700 ring-green-200',
  refusee: 'bg-red-50 text-red-700 ring-red-200',
  partielle: 'bg-amber-50 text-amber-800 ring-amber-200',
  payee: 'bg-green-50 text-green-700 ring-green-200',
};

function dateCourte(iso: string) {
  return new Date(iso).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' });
}

/** Dernier courriel de suivi envoyé automatiquement pour une soumission en attente. */
function dernierSuivi(doc: DocumentFacturation): string | null {
  if (doc.date_alerte_expiration && doc.date_echeance && doc.date_echeance < new Date().toISOString().slice(0, 10)) {
    return 'Expirée sans réponse';
  }
  if (doc.date_rappel_expiration) return `Avis d’expiration envoyé le ${dateCourte(doc.date_rappel_expiration)}`;
  if (doc.date_relance_soumission) return `Relancée le ${dateCourte(doc.date_relance_soumission)}`;
  if (doc.date_envoi) return `Envoyée le ${dateCourte(doc.date_envoi)}`;
  return null;
}

function estOnglet(valeur: string | undefined): valeur is Onglet {
  return valeur !== undefined && valeur in ONGLETS;
}

function Pastille({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${className}`}>
      {children}
    </span>
  );
}

function BoutonIcone({
  titre, icone, onClick, href, danger, disabled,
}: {
  titre: string; icone: string; onClick?: () => void; href?: string; danger?: boolean; disabled?: boolean;
}) {
  const classes = `rounded-lg p-2 transition disabled:opacity-40 ${
    danger ? 'text-black/35 hover:bg-red-50 hover:text-red-600' : 'text-black/45 hover:bg-black/[0.05] hover:text-navy'
  }`;
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" title={titre} aria-label={titre} className={classes}>
        <Icone d={icone} />
      </a>
    );
  }
  return (
    <button onClick={onClick} disabled={disabled} title={titre} aria-label={titre} className={classes}>
      <Icone d={icone} />
    </button>
  );
}

export default function FacturationDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ onglet?: string; facture?: string }>;
}) {
  // Liens directs depuis la vue d'ensemble : ?onglet=a_recevoir, ?facture=42 (ouvre ses paiements).
  const parametres = use(searchParams);
  const [onglet, setOnglet] = useState<Onglet>(estOnglet(parametres.onglet) ? parametres.onglet : 'soumission');
  const [page, setPage] = useState(1);
  const typeListe = onglet === 'facture' ? 'facture' : 'soumission';
  const {
    items: documents,
    setItems: setDocuments,
    total,
    nbPages,
    chargement,
    erreur: erreurChargement,
    recharger,
  } = usePageServeur<DocumentFacturation>(`/api/documents/?type_document=${typeListe}`, page, PAR_PAGE);

  const [enEdition, setEnEdition] = useState<DocumentFacturation | null | 'nouveau'>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState<number | null>(null);
  const [majEnCours, setMajEnCours] = useState<number | null>(null);
  const [aSupprimer, setASupprimer] = useState<DocumentFacturation | null>(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [facturationEnCours, setFacturationEnCours] = useState<number | null>(null);
  const [enPaiement, setEnPaiement] = useState<DocumentFacturation | null>(null);
  const [enPlanSoumission, setEnPlanSoumission] = useState<DocumentFacturation | null>(null);
  const [aConvertir, setAConvertir] = useState<DocumentFacturation | null>(null);
  const [conversionEnCours, setConversionEnCours] = useState(false);

  function majDocument(maj: DocumentFacturation) {
    setDocuments((prev) => prev.map((d) => (d.id === maj.id ? maj : d)));
  }

  function changerOnglet(nouveau: Onglet) {
    setOnglet(nouveau);
    setPage(1);
  }

  const factureDemandee = Number(parametres.facture) || null;
  useEffect(() => {
    if (!factureDemandee) return;
    fetchClient<DocumentFacturation>(`/api/documents/${factureDemandee}/`)
      .then(setEnPaiement)
      .catch(() => {});
  }, [factureDemandee]);

  async function ouvrirFacture(id: number) {
    try {
      setEnPaiement(await fetchClient<DocumentFacturation>(`/api/documents/${id}/`));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Impossible d’ouvrir la facture.');
    }
  }

  async function facturerSolde(doc: DocumentFacturation) {
    if (!doc.contrat_id) return;
    setFacturationEnCours(doc.id);
    try {
      await fetchClient(`/api/contrats/${doc.contrat_id}/facturer-solde/`, { method: 'POST' });
      afficherToast(`Facture de solde créée en brouillon pour ${doc.numero} — envoie-la depuis l'onglet Factures.`);
      recharger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de la facturation du solde.');
    } finally {
      setFacturationEnCours(null);
    }
  }

  async function confirmerConversion() {
    if (!aConvertir) return;
    setConversionEnCours(true);
    try {
      const facture = await fetchClient<DocumentFacturation>(
        `/api/documents/${aConvertir.id}/convertir-en-facture/`, { method: 'POST' },
      );
      afficherToast(`Facture ${facture.numero} créée en brouillon — vérifie-la, puis envoie-la au client.`);
      setAConvertir(null);
      changerOnglet('facture');
      setEnEdition(facture);
    } catch (e) {
      setAConvertir(null);
      setErreur(e instanceof Error ? e.message : 'Erreur lors de la conversion en facture.');
    } finally {
      setConversionEnCours(false);
    }
  }

  async function envoyer(doc: DocumentFacturation) {
    const reenvoi = doc.statut !== 'brouillon';
    setEnvoiEnCours(doc.id);
    try {
      const maj = await fetchClient<DocumentFacturation>(`/api/documents/${doc.id}/envoyer/`, { method: 'POST' });
      afficherToast(`${doc.numero} ${reenvoi ? 'renvoyé' : 'envoyé'} au client avec succès.`);
      majDocument(maj);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de l\'envoi.');
    } finally {
      setEnvoiEnCours(null);
    }
  }

  async function togglePayee(doc: DocumentFacturation) {
    const statutRetour = doc.type_document === 'soumission' ? 'acceptee' : 'envoyee';
    const nouveauStatut = doc.statut === 'payee' ? statutRetour : 'payee';
    setMajEnCours(doc.id);
    try {
      await fetchClient(`/api/documents/${doc.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ statut: nouveauStatut }),
      });
      afficherToast(
        nouveauStatut === 'payee'
          ? `${doc.numero} marquée comme reçue — ajoutée au revenu du mois.`
          : `${doc.numero} repassée à « ${statutLabel[statutRetour]} ».`,
      );
      setDocuments((prev) => prev.map((d) => (d.id === doc.id ? { ...d, statut: nouveauStatut } : d)));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de la mise à jour.');
    } finally {
      setMajEnCours(null);
    }
  }

  async function confirmerSuppression() {
    if (!aSupprimer) return;
    setSuppressionEnCours(true);
    try {
      await fetchClient(`/api/documents/${aSupprimer.id}/`, { method: 'DELETE' });
      afficherToast(`${aSupprimer.numero} supprimé.`);
      setASupprimer(null);
      // Dernier document de la page : on revient à la page précédente plutôt qu'une page vide.
      if (documents.length === 1 && page > 1) setPage(page - 1);
      else recharger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de la suppression.');
    } finally {
      setSuppressionEnCours(false);
    }
  }

  if (enPaiement) {
    return (
      <PaiementsPanel
        key={enPaiement.id}
        document={enPaiement}
        onChange={(maj) => {
          setEnPaiement(maj);
          majDocument(maj);
        }}
        onRetour={() => setEnPaiement(null)}
      />
    );
  }

  if (enPlanSoumission) {
    return (
      <PlanSoumissionPanel
        key={enPlanSoumission.id}
        document={enPlanSoumission}
        onChange={(maj) => {
          setEnPlanSoumission(maj);
          majDocument(maj);
        }}
        onRetour={() => setEnPlanSoumission(null)}
      />
    );
  }

  if (enEdition) {
    return (
      <DocumentForm
        document={enEdition === 'nouveau' ? null : enEdition}
        typeParDefaut={typeListe}
        onDone={() => {
          afficherToast(enEdition === 'nouveau' ? 'Document créé avec succès.' : 'Document mis à jour.');
          setEnEdition(null);
          recharger();
        }}
        onCancel={() => setEnEdition(null)}
      />
    );
  }

  const listeDocuments = onglet === 'soumission' || onglet === 'facture';

  return (
    <div>
      {/* En-tête */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy">Facturation</h1>
          <p className="mt-1 text-sm text-black/50">Soumissions, factures, paiements et comptes à recevoir.</p>
        </div>
        {listeDocuments && (
          <button
            onClick={() => setEnEdition('nouveau')}
            className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-accent/30 transition hover:-translate-y-px hover:shadow-md hover:shadow-accent/30"
          >
            <Icone d={ICONES.plus} />
            {onglet === 'soumission' ? 'Nouvelle soumission' : 'Nouvelle facture'}
          </button>
        )}
      </div>

      {/* Onglets */}
      <div className="mt-6 flex gap-1 overflow-x-auto rounded-xl border border-black/15 bg-black/[0.04] p-1">
        {(Object.keys(ONGLETS) as Onglet[]).map((cle) => {
          const actif = onglet === cle;
          return (
            <button
              key={cle}
              onClick={() => changerOnglet(cle)}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
                actif ? 'bg-white text-navy shadow-sm ring-1 ring-black/10' : 'text-black/70 hover:bg-white/70 hover:text-navy'
              }`}
            >
              <Icone d={ONGLETS[cle].icone} className={`h-4 w-4 ${actif ? 'text-accent' : ''}`} />
              {ONGLETS[cle].label}
              {actif && listeDocuments && !chargement && (
                <span className="rounded-full bg-navy px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-white">{total}</span>
              )}
            </button>
          );
        })}
      </div>

      {(erreur || erreurChargement) && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erreur || erreurChargement}</p>
      )}

      {onglet === 'catalogue' ? (
        <div className="mt-6">
          <CatalogueManager />
        </div>
      ) : onglet === 'a_recevoir' ? (
        <div className="mt-6">
          <ComptesARecevoir onOuvrirFacture={ouvrirFacture} />
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-2xl border border-black/15 bg-white shadow-sm">
          {chargement && documents.length === 0 && (
            <div className="divide-y divide-black/10">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <div className="h-11 w-11 animate-pulse rounded-full bg-black/[0.06]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-40 animate-pulse rounded bg-black/[0.06]" />
                    <div className="h-3 w-64 animate-pulse rounded bg-black/[0.04]" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!chargement && documents.length === 0 && (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/[0.04] text-black/30">
                <Icone d={onglet === 'soumission' ? ICONES.document : ICONES.argent} className="h-6 w-6" />
              </div>
              <p className="mt-3 font-semibold text-navy">
                {onglet === 'soumission' ? 'Aucune soumission pour le moment' : 'Aucune facture pour le moment'}
              </p>
            </div>
          )}

          <ul className={`divide-y divide-black/10 transition-opacity ${chargement ? 'opacity-50' : ''}`}>
            {documents.map((doc) => {
              const estFacture = doc.type_document === 'facture';
              const suivi = !estFacture && doc.statut === 'envoyee' ? dernierSuivi(doc) : null;
              return (
                <li key={doc.id} className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-black/[0.015] lg:flex-row lg:items-center">
                  {/* Identité */}
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm"
                      style={clientAvatarStyle(doc.client) || undefined}
                      title={doc.client_nom}
                    >
                      {initiales(doc.client_nom || '?')}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-semibold tabular-nums text-navy">{doc.numero}</p>
                        {doc.categorie === 'abonnement_saas' && (
                          <span className="inline-flex items-center rounded-full bg-navy px-1.5 py-0.5 text-[10px] font-bold text-white">
                            Extinc<span className="text-accent">Pro</span>
                          </span>
                        )}
                        {!estFacture && doc.echeances.length > 0 && (
                          <Pastille className="bg-indigo-50 text-indigo-700 ring-indigo-200">
                            Plan en {doc.echeances.length} versement{doc.echeances.length > 1 ? 's' : ''}
                          </Pastille>
                        )}
                        {doc.soumission_origine_numero && (
                          <Pastille className="bg-indigo-50 text-indigo-700 ring-indigo-200">
                            De {doc.soumission_origine_numero}
                          </Pastille>
                        )}
                        {doc.facture_convertie && (
                          <Pastille className="bg-green-50 text-green-700 ring-green-200">
                            Facturée · {doc.facture_convertie.numero}
                          </Pastille>
                        )}
                        {!doc.plan_valide && <Pastille className="bg-red-50 text-red-700 ring-red-200">Plan à corriger</Pastille>}
                        {doc.type_paiement !== 'complet' && (
                          <Pastille className="bg-indigo-50 text-indigo-700 ring-indigo-200">
                            {doc.type_paiement === 'acompte' ? 'Acompte' : 'Solde'}
                            {doc.contrat_lie_numero ? ` · ${doc.contrat_lie_numero}` : ''}
                          </Pastille>
                        )}
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-black/55">
                        <span className="truncate">{doc.client_nom}</span>
                        <span className="text-black/25">·</span>
                        <span className="font-semibold tabular-nums text-navy">{formaterMontant(doc.total)}</span>
                        {estFacture && versCents(doc.montant_paye) > 0 && (
                          <>
                            <span className="text-black/25">·</span>
                            <span className="text-green-700">payé {formaterMontant(doc.montant_paye)}</span>
                            {versCents(doc.solde_du) > 0 && (
                              <>
                                <span className="text-black/25">·</span>
                                <span className="font-semibold text-navy">solde {formaterMontant(doc.solde_du)}</span>
                              </>
                            )}
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Statut */}
                  <div className="flex flex-wrap items-center gap-1.5 pl-[60px] lg:w-52 lg:flex-col lg:items-end lg:gap-1 lg:pl-0">
                    <Pastille className={statutStyle[doc.statut]}>{statutLabel[doc.statut]}</Pastille>
                    {doc.jours_retard > 0 && (
                      <Pastille className="bg-red-50 text-red-700 ring-red-200">En retard · {doc.jours_retard} j</Pastille>
                    )}
                    {suivi && (
                      <span className="text-[11px] text-black/45" suppressHydrationWarning>{suivi}</span>
                    )}
                    {(doc.statut === 'acceptee' || doc.statut === 'payee') && doc.date_reponse && (
                      <span className="text-[11px] text-black/45" suppressHydrationWarning>
                        Signée le {new Date(doc.date_reponse).toLocaleDateString('fr-CA')}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-1 pl-[60px] lg:pl-0">
                    {estFacture ? (
                      <button
                        onClick={() => setEnPaiement(doc)}
                        className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-green-700 transition hover:border-green-600 hover:bg-green-600 hover:text-white"
                      >
                        <Icone d={ICONES.argent} className="h-3.5 w-3.5" />
                        Paiements
                      </button>
                    ) : (
                      <button
                        onClick={() => setEnPlanSoumission(doc)}
                        className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-indigo-700 transition hover:border-indigo-600 hover:bg-indigo-600 hover:text-white"
                      >
                        <Icone d={ICONES.calendrier} className="h-3.5 w-3.5" />
                        Plan
                      </button>
                    )}
                    {doc.solde_facturable && (
                      <button
                        onClick={() => facturerSolde(doc)}
                        disabled={facturationEnCours === doc.id}
                        className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-indigo-700 transition hover:bg-indigo-600 hover:text-white disabled:opacity-50"
                      >
                        {facturationEnCours === doc.id ? 'Facturation…' : 'Facturer le solde'}
                      </button>
                    )}
                    {!estFacture && !doc.contrat_id && !doc.facture_convertie && doc.statut !== 'payee' && (
                      <button
                        onClick={() => setAConvertir(doc)}
                        title="Le client a accepté au téléphone : créer la facture qu’il paiera"
                        className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-green-700 transition hover:border-green-600 hover:bg-green-600 hover:text-white"
                      >
                        <Icone d={ICONES.argent} className="h-3.5 w-3.5" />
                        Convertir en facture
                      </button>
                    )}
                    {doc.facture_convertie && (
                      <button
                        onClick={() => ouvrirFacture(doc.facture_convertie!.id)}
                        className="rounded-lg border border-black/15 bg-white px-3 py-1.5 text-[13px] font-semibold text-black/60 transition hover:border-navy/40"
                      >
                        Voir la facture
                      </button>
                    )}
                    {!estFacture && !doc.facture_convertie && (doc.statut === 'acceptee' || doc.statut === 'payee') && (
                      <label
                        className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[13px] font-semibold transition ${
                          doc.statut === 'payee'
                            ? 'border-green-200 bg-green-50 text-green-700'
                            : 'border-black/15 bg-white text-black/55 hover:border-navy/40'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={doc.statut === 'payee'}
                          disabled={majEnCours === doc.id}
                          onChange={() => togglePayee(doc)}
                          className="h-3.5 w-3.5 accent-green-600"
                        />
                        Reçue
                      </label>
                    )}
                    <span className="mx-1 hidden h-5 w-px bg-black/10 sm:block" />
                    <BoutonIcone titre="Voir le PDF" icone={ICONES.telecharger} href={apiUrlClient(`/api/documents/${doc.id}/pdf/`)} />
                    <BoutonIcone
                      titre={envoiEnCours === doc.id ? 'Envoi…' : doc.statut === 'brouillon' ? 'Envoyer au client' : 'Renvoyer au client'}
                      icone={ICONES.envoyer}
                      onClick={() => envoyer(doc)}
                      disabled={envoiEnCours === doc.id}
                    />
                    <BoutonIcone titre="Modifier" icone={ICONES.modifier} onClick={() => setEnEdition(doc)} />
                    <BoutonIcone titre="Supprimer" icone={ICONES.supprimer} onClick={() => setASupprimer(doc)} danger />
                  </div>
                </li>
              );
            })}
          </ul>

          <Pagination
            page={page}
            nbPages={nbPages}
            total={total}
            parPage={PAR_PAGE}
            libelle={onglet === 'soumission' ? ['soumission', 'soumissions'] : ['facture', 'factures']}
            onChange={setPage}
          />
        </div>
      )}

      {aSupprimer && (
        <ConfirmDialog
          titre="Supprimer ce document ?"
          message={`${aSupprimer.numero} sera supprimé définitivement.`}
          enCours={suppressionEnCours}
          onConfirm={confirmerSuppression}
          onCancel={() => setASupprimer(null)}
        />
      )}

      {aConvertir && (
        <ConvertirFactureDialog
          soumission={aConvertir}
          enCours={conversionEnCours}
          onConfirm={confirmerConversion}
          onCancel={() => setAConvertir(null)}
        />
      )}
    </div>
  );
}
