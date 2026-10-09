'use client';

import { ICONES, Icone } from './Icone';

/** Numéros de page à afficher : toujours la première, la dernière et les voisines de la
 * page courante, avec « … » pour les trous (ex. 1 … 4 5 6 … 12). */
function numerosDePage(page: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, page - 1, page, page + 1]);
  const tries = [...pages].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const resultat: (number | '…')[] = [];
  tries.forEach((n, i) => {
    if (i > 0 && n - tries[i - 1] > 1) resultat.push('…');
    resultat.push(n);
  });
  return resultat;
}

/** Découpe une liste déjà chargée en pages. La page demandée est ramenée dans les bornes :
 * après une suppression ou un filtre plus restrictif, on ne reste jamais sur une page vide. */
export function paginer<T>(liste: T[], page: number, parPage: number) {
  const nbPages = Math.max(1, Math.ceil(liste.length / parPage));
  const pageCourante = Math.min(Math.max(page, 1), nbPages);
  return {
    nbPages,
    pageCourante,
    elements: liste.slice((pageCourante - 1) * parPage, pageCourante * parPage),
  };
}

interface Props {
  page: number;
  nbPages: number;
  total: number;
  parPage: number;
  /** Nom des éléments au singulier et au pluriel, ex. ['client', 'clients']. */
  libelle: [string, string];
  onChange: (page: number) => void;
}

/** Barre de pagination numérotée, à placer en pied de carte. Masquée s'il n'y a qu'une page. */
export default function Pagination({ page, nbPages, total, parPage, libelle, onChange }: Props) {
  if (total <= parPage) return null;
  const bouton =
    'flex h-9 w-9 items-center justify-center rounded-lg border border-black/15 bg-white text-navy transition hover:border-navy/40 disabled:pointer-events-none disabled:opacity-35';
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-black/10 bg-black/[0.015] px-5 py-3 sm:flex-row">
      <p className="text-[13px] text-black/50">
        <span className="font-semibold text-navy">
          {(page - 1) * parPage + 1}–{Math.min(page * parPage, total)}
        </span>{' '}
        sur <span className="font-semibold text-navy">{total}</span> {total > 1 ? libelle[1] : libelle[0]}
      </p>
      <nav className="flex items-center gap-1" aria-label="Pagination">
        <button onClick={() => onChange(page - 1)} disabled={page === 1} aria-label="Page précédente" className={bouton}>
          <Icone d={ICONES.precedent} />
        </button>
        {numerosDePage(page, nbPages).map((n, i) =>
          n === '…' ? (
            <span key={`trou-${i}`} className="px-1.5 text-sm text-black/35">
              …
            </span>
          ) : (
            <button
              key={n}
              onClick={() => onChange(n)}
              aria-current={n === page ? 'page' : undefined}
              className={`h-9 min-w-9 rounded-lg px-2 text-sm font-semibold tabular-nums transition ${
                n === page ? 'bg-navy text-white shadow-sm' : 'border border-black/15 bg-white text-navy hover:border-navy/40'
              }`}
            >
              {n}
            </button>
          ),
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === nbPages}
          aria-label="Page suivante"
          className={bouton}
        >
          <Icone d={ICONES.suivant} />
        </button>
      </nav>
    </div>
  );
}
