'use client';

import { useCallback, useEffect, useState } from 'react';

import { fetchClient, type Page } from './api';

/**
 * Une page d'une liste paginée par DRF (`{ count, results }`), pour une pagination
 * numérotée (contrairement à useListePaginee, qui ajoute les pages en défilement infini).
 * `page` commence à 1 ; la liste se recharge quand `path`, `page` ou `taille` change.
 */
export function usePageServeur<T>(path: string, page: number, taille: number) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const separateur = path.includes('?') ? '&' : '?';
  const url = `${path}${separateur}page=${page}&page_size=${taille}`;

  useEffect(() => {
    let annule = false;
    Promise.resolve().then(() => {
      if (!annule) setChargement(true);
    });
    fetchClient<Page<T>>(url)
      .then((resultat) => {
        if (annule) return;
        setItems(resultat.results);
        setTotal(resultat.count);
        setErreur(null);
      })
      .catch((e) => {
        if (!annule) setErreur(e instanceof Error ? e.message : 'Erreur de chargement.');
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [url, version]);

  const recharger = useCallback(() => setVersion((v) => v + 1), []);
  const nbPages = Math.max(1, Math.ceil(total / taille));

  return { items, setItems, total, nbPages, chargement, erreur, recharger };
}
