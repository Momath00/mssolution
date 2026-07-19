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
}

export interface ClientEntreprise {
  id: number;
  nom_entreprise: string;
  nom_contact: string;
  courriel: string;
  telephone: string;
  adresse: string;
  date_creation: string;
}

export interface LigneDocument {
  id?: number;
  description: string;
  quantite: string;
  prix_unitaire: string;
  montant?: string;
}

export interface DocumentFacturation {
  id: number;
  numero: string;
  type_document: 'soumission' | 'facture';
  client: number;
  client_nom: string;
  statut: 'brouillon' | 'envoyee' | 'payee';
  date_creation: string;
  date_echeance: string | null;
  lignes: LigneDocument[];
  sous_total: string;
  montant_tps: string;
  montant_tvq: string;
  total: string;
}

// Utilisé côté serveur (App Router : Server Components) — atteint le conteneur `web` directement.
export function apiUrlServer(path: string) {
  const base = process.env.API_URL_INTERNAL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  return `${base}${path}`;
}

// Utilisé côté client (navigateur) — passe par le port publié sur l'hôte.
export function apiUrlClient(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  return `${base}${path}`;
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
    throw new Error(body?.detail || `Échec de la requête ${path} (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
