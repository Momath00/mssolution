export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type Statut = 'brouillon' | 'publie';

export interface Realisation {
  id: number;
  titre: string;
  description: string;
  client: string;
  secteur: string;
  image: string;
  lien_site: string;
  statut: Statut;
  date_creation: string;
}

export interface Coordonnees {
  nom_entreprise: string;
  courriel: string;
  telephone: string;
  adresse: string;
  logo: string | null;
  numero_tps: string;
  numero_tvq: string;
  courriel_comptable: string;
}

export interface RapportComptableArchive {
  id: number;
  annee: number;
  trimestre: number;
  date_generation: string;
  a_excel: boolean;
}

export interface ClientEntreprise {
  id: number;
  nom_entreprise: string;
  nom_contact: string;
  courriel: string;
  telephone: string;
  adresse: string;
  date_creation: string;
  // Lien avec une organisation ExtincPro (ligne d'affaires ExtincPro) — lecture seule.
  extincpro_organisation_id?: number | null;
  extincpro_resilie_le?: string | null;
  est_client_extincpro?: boolean;
}

export interface LigneDocument {
  id?: number;
  description: string;
  quantite: string;
  prix_unitaire: string;
  montant?: string;
  module_extincpro?: string;
}

export type CategorieContrat = 'developpement' | 'maintenance' | 'fonctionnalite' | 'abonnement_saas';

export const CATEGORIE_LABELS: Record<CategorieContrat, string> = {
  developpement: 'Développement de logiciel',
  maintenance: 'Maintenance',
  fonctionnalite: 'Ajout de fonctionnalité',
  abonnement_saas: 'Abonnement annuel ExtincPro',
};

export type StatutDocument = 'brouillon' | 'envoyee' | 'acceptee' | 'refusee' | 'partielle' | 'payee';

export type ModePaiement = 'virement' | 'depot' | 'cheque' | 'carte' | 'comptant' | 'autre';

export const MODE_PAIEMENT_LABELS: Record<ModePaiement, string> = {
  virement: 'Virement Interac',
  depot: 'Dépôt direct',
  cheque: 'Chèque',
  carte: 'Carte de crédit',
  comptant: 'Comptant',
  autre: 'Autre',
};

export interface Paiement {
  id: number;
  date: string;
  montant: string;
  mode: ModePaiement;
  mode_label: string;
  reference: string;
  note: string;
  date_creation: string;
  a_preuve: boolean;
  preuve_est_pdf: boolean;
}

export type StatutEcheance = 'payee' | 'partielle' | 'en_retard' | 'a_venir';

export interface Echeance {
  id: number;
  date: string;
  montant: string;
  note: string;
  paye: string;
  reste: string;
  statut: StatutEcheance;
  date_rappel_avant: string | null;
}

export interface ProchaineEcheance {
  date: string;
  montant: string;
}

export interface DocumentFacturation {
  id: number;
  numero: string;
  type_document: 'soumission' | 'facture';
  categorie: CategorieContrat | '';
  client: number;
  client_nom: string;
  statut: StatutDocument;
  date_creation: string;
  date_echeance: string | null;
  date_reponse: string | null;
  lignes: LigneDocument[];
  sous_total: string;
  montant_tps: string;
  montant_tvq: string;
  total: string;
  pourcentage_acompte: string | null;
  type_paiement: 'complet' | 'acompte' | 'solde';
  contrat_lie: number | null;
  contrat_lie_numero: string | null;
  contrat_id: number | null;
  solde_facturable: boolean;
  soumission_origine: number | null;
  soumission_origine_numero: string | null;
  facture_convertie: { id: number; numero: string } | null;
  montant_paye: string;
  solde_du: string;
  montant_en_retard: string;
  jours_retard: number;
  prochaine_echeance: ProchaineEcheance | null;
  echeances: Echeance[];
  paiements: Paiement[];
  date_derniere_relance: string | null;
  plan_valide: boolean;
  date_envoi: string | null;
  date_rappel_avant_echeance: string | null;
  date_relance_soumission: string | null;
  date_rappel_expiration: string | null;
  date_alerte_expiration: string | null;
}

export interface ParametresRappels {
  rappels_actifs: boolean;
  relance_soumission_jours: number;
  rappel_expiration_jours: number;
  rappel_avant_versement_jours: number;
  rappel_retard_intervalle_jours: number;
}

export interface ResultatRappels {
  actifs: boolean;
  simulation: boolean;
  date: string;
  envoyes: number;
  echecs: number;
  actions: {
    type: string;
    libelle: string;
    document_id: number;
    numero: string;
    client: string;
    detail: string;
    statut: 'simulation' | 'envoye' | 'echec';
    erreur: string;
  }[];
}

export type TrancheAge = 'courant' | '1_30' | '31_60' | '61_90' | 'plus_90';

type MontantsParTranche = { [K in TrancheAge as `tranche_${K}`]: number };

export interface FactureARecevoir extends MontantsParTranche {
  id: number;
  numero: string;
  client_id: number;
  client_nom: string;
  date_creation: string;
  date_echeance: string | null;
  total: number;
  montant_paye: number;
  solde_du: number;
  montant_en_retard: number;
  jours_retard: number;
  tranche: TrancheAge;
  prochaine_echeance: { date: string; montant: number } | null;
  a_un_plan: boolean;
  date_derniere_relance: string | null;
}

export interface ClientARecevoir extends MontantsParTranche {
  client_id: number;
  client_nom: string;
  client_courriel: string;
  nombre_factures: number;
  solde_du: number;
  montant_en_retard: number;
}

export interface ComptesARecevoir {
  date: string;
  total_du: number;
  total_en_retard: number;
  tranches: { cle: TrancheAge; label: string; montant: number }[];
  factures: FactureARecevoir[];
  clients: ClientARecevoir[];
}

export interface FactureLiee {
  id: number;
  numero: string;
  type_paiement: 'complet' | 'acompte' | 'solde';
  statut: StatutDocument;
  total: string;
  montant_paye: string;
  solde_du: string;
  date_creation: string;
}

export interface Contrat {
  id: number;
  numero: string;
  categorie: CategorieContrat;
  categorie_label: string;
  soumission: number;
  soumission_numero: string;
  client_nom: string;
  client_courriel: string;
  total: string;
  nom_signataire: string;
  date_signature: string;
  statut: 'actif' | 'annule';
  pdf: string;
  pourcentage_acompte: string | null;
  montant_acompte: string | null;
  montant_solde: string | null;
  factures_liees: FactureLiee[];
  echeancier_json: { date: string; montant: string; note: string }[];
}

export interface ClauseContrat {
  titre: string;
  texte: string;
}

export interface SoumissionPublique {
  numero: string;
  client_nom: string;
  categorie: CategorieContrat | '';
  categorie_label: string;
  statut: StatutDocument;
  date_creation: string;
  date_echeance: string | null;
  date_reponse: string | null;
  lignes: LigneDocument[];
  sous_total: string;
  montant_tps: string;
  montant_tvq: string;
  total: string;
  conditions: ClauseContrat[];
  pourcentage_acompte: string | null;
  echeances: { date: string; montant: string; note: string }[];
}

export interface ArticleCatalogue {
  id: number;
  nom: string;
  description: string;
  prix: string;
  frequence: 'unique' | 'annuel';
  module_extincpro: string;
  actif: boolean;
  ordre: number;
}

// --- ExtincPro (logiciel de MS Solution dont la facturation se gère ici) ---------------

export interface ModuleExtincPro {
  code: string;
  nom: string;
  actif?: boolean;
}

export interface OrganisationExtincPro {
  id: number;
  nom: string;
  adresse: string;
  langue: string;
  est_active: boolean;
  date_fin_essai: string | null;
  date_creation: string;
  ms_client_id: number | null;
  modules: ModuleExtincPro[];
  nb_utilisateurs: number;
  contact: { nom: string; courriel: string; telephone: string } | null;
  suggestions?: ClientEntreprise[];
}

export interface RetardExtincPro {
  jours: number;
  montant: string;
  facture: string | null;
}

export interface ActionExtincPro {
  id: number;
  action: string;
  details: Record<string, unknown>;
  succes: boolean;
  erreur: string;
  utilisateur_nom: string;
  date: string;
}

export interface ClientExtincPro {
  lie: boolean;
  organisation_id?: number;
  resilie_le?: string | null;
  jours_grace?: number;
  retard?: RetardExtincPro;
  journal?: ActionExtincPro[];
  organisation?: OrganisationExtincPro | null;
  erreur?: string | null;
}

export type TypeAlerteExtincPro = 'a_bloquer' | 'a_debloquer' | 'resiliee';

export interface AlerteExtincPro {
  type: TypeAlerteExtincPro;
  client_id: number;
  client_nom: string;
  organisation_id: number;
  organisation_nom: string | null;
  retard: RetardExtincPro | null;
}

export interface CompteGrandLivre {
  id: number;
  nom: string;
  actif: boolean;
  ordre: number;
}

export interface Depense {
  id: number;
  date: string;
  fournisseur: string;
  description: string;
  sous_total: string;
  tps: string;
  tvq: string;
  total: string;
  compte_grand_livre: number;
  compte_grand_livre_nom: string;
  piece_jointe: string | null;
  date_creation: string;
}

export type TypeEvenement = 'rendez_vous' | 'tache' | 'rappel';

export interface Evenement {
  id: number;
  titre: string;
  description: string;
  date: string;
  heure: string | null;
  type_evenement: TypeEvenement;
  termine: boolean;
  client: number | null;
  client_nom: string | null;
  document: number | null;
  document_numero: string | null;
  date_creation: string;
}

// Utilisé côté serveur (App Router : Server Components) — atteint le conteneur `web` directement.
export function apiUrlServer(path: string) {
  const base = process.env.API_URL_INTERNAL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  return `${base}${path}`;
}

// Utilisé côté client (navigateur) — relatif, proxié même origine par next.config.ts (rewrites)
// vers le backend. Garder ceci same-origin évite les soucis de cookies httpOnly
// cross-domaine entre le frontend et le backend en production.
export function apiUrlClient(path: string) {
  return path;
}

export async function fetchServer<T>(path: string, revalidate = 30): Promise<T> {
  const res = await fetch(apiUrlServer(path), { next: { revalidate } });
  if (!res.ok) {
    throw new Error(`Échec de la requête ${path} (${res.status})`);
  }
  return res.json();
}

// Les URLs d'image renvoyées par Django peuvent pointer vers l'hôte interne Docker
// (ex. http://web:8000/media/...), injoignable par le navigateur. On ne garde que
// le chemin et on le recolle à l'origine publique de l'API.
export function mediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return apiUrlClient(parsed.pathname);
  } catch {
    return apiUrlClient(url.startsWith('/') ? url : `/${url}`);
  }
}

async function doFetch(path: string, init?: RequestInit) {
  const isFormData = init?.body instanceof FormData;
  return fetch(apiUrlClient(path), {
    ...init,
    credentials: 'include',
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers || {}),
    },
  });
}

export async function fetchClient<T>(path: string, init?: RequestInit): Promise<T> {
  let res = await doFetch(path, init);

  if (res.status === 401) {
    const refreshed = await fetch(apiUrlClient('/api/auth/token/refresh/'), {
      method: 'POST',
      credentials: 'include',
    });
    if (refreshed.ok) {
      res = await doFetch(path, init);
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.detail || (body && typeof body === 'object' ? JSON.stringify(body) : null);
    throw new Error(detail || `Échec de la requête ${path} (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
