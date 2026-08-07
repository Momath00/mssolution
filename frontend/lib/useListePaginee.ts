'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchClient, type Page } from './api';

function versCheminRelatif(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

/**
 * Consomme une liste paginée par DRF (`{ count, next, previous, results }`) avec chargement
 * infini : recharge depuis le début quand `path` change, ajoute la page suivante via
 * `chargerPlus()` ou automatiquement quand `sentinelleRef` entre dans le viewport.
 */
export function useListePaginee<T>(path: string) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [suivant, setSuivant] = useState<string | null>(null);
  const [chargementInitial, setChargementInitial] = useState(true);
  const [chargementPage, setChargementPage] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const recharger = useCallback(() => {
    Promise.resolve().then(() => {
      setChargementInitial(true);
      setErreur(null);
    });
    fetchClient<Page<T>>(path)
      .then((page) => {
        setItems(page.results);
        setTotal(page.count);
        setSuivant(page.next);
      })
      .catch((e) => setErreur(e instanceof Error ? e.message : 'Erreur de chargement.'))
      .finally(() => setChargementInitial(false));
  }, [path]);

  useEffect(recharger, [recharger]);

  const chargerPlus = useCallback(() => {
    if (!suivant || chargementPage) return;
    setChargementPage(true);
    fetchClient<Page<T>>(versCheminRelatif(suivant))
      .then((page) => {
        setItems((prev) => [...prev, ...page.results]);
        setSuivant(page.next);
      })
      .catch((e) => setErreur(e instanceof Error ? e.message : 'Erreur de chargement.'))
      .finally(() => setChargementPage(false));
  }, [suivant, chargementPage]);

  // Toujours à jour, sans jamais forcer la recréation de l'observateur ci-dessous.
  const chargerPlusRef = useRef(chargerPlus);
  useEffect(() => {
    chargerPlusRef.current = chargerPlus;
  }, [chargerPlus]);

  // Ref-callback plutôt que useRef+useEffect : ne (re)crée l'observateur QUE quand le noeud
  // sentinelle est réellement (dé)monté — jamais à chaque page chargée. Sinon, `observe()`
  // déclenche une notification initiale à chaque recréation et provoque une cascade qui
  // charge toutes les pages d'un coup dès que la sentinelle est visible.
  const observateurRef = useRef<IntersectionObserver | null>(null);
  const sentinelleRef = useCallback((noeud: HTMLDivElement | null) => {
    observateurRef.current?.disconnect();
    observateurRef.current = null;
    if (!noeud) return;
    observateurRef.current = new IntersectionObserver(
      (entrees) => {
        if (entrees[0].isIntersecting) chargerPlusRef.current();
      },
      { rootMargin: '300px' },
    );
    observateurRef.current.observe(noeud);
  }, []);

  return {
    items,
    setItems,
    total,
    suivant,
    chargementInitial,
    chargementPage,
    erreur,
    sentinelleRef,
    recharger,
    chargerPlus,
  };
}
