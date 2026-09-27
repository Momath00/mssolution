'use client';

import { useEffect } from 'react';

import { apiUrlClient, type Evenement } from '@/lib/api';
import { clientDotStyle } from '@/lib/clientColors';

import { TYPES } from './page';

interface Props {
  evenement: Evenement;
  onClose: () => void;
  onEdit: (ev: Evenement) => void;
  onDelete: (ev: Evenement) => void;
  onToggle: (ev: Evenement) => void;
}

/**
 * Panneau latéral en lecture seule : affiche tout le contenu d'un événement (description
 * complète, non tronquée comme sur la carte) sans devoir ouvrir le formulaire de modification.
 */
export default function EvenementDetail({ evenement: ev, onClose, onEdit, onDelete, onToggle }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const type = TYPES[ev.type_evenement];
  const dateLabel = new Date(`${ev.date}T00:00:00`)
    .toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .replace(/^./, (c) => c.toUpperCase());

  return (
    <div className="animate-backdrop-in fixed inset-0 z-[200] flex justify-end bg-black/30" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={ev.titre}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-black/5 p-5">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${type.badge}`}>
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor">
              {type.icon}
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <h2 className={`break-words text-lg font-bold text-navy ${ev.termine ? 'line-through opacity-60' : ''}`}>
              {ev.titre}
            </h2>
            <p className="mt-0.5 text-sm text-black/50">
              {dateLabel}
              {ev.heure && ` · ${ev.heure.slice(0, 5)}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-full p-1.5 text-black/40 transition-colors hover:bg-black/5 hover:text-navy"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${type.pill}`}>{type.label}</span>
            {ev.client_nom && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-2.5 py-1 text-xs font-medium text-black/60">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={clientDotStyle(ev.client) ?? undefined} />
                {ev.client_nom}
              </span>
            )}
            {ev.termine && (
              <span className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-semibold text-black/50">Terminé</span>
            )}
          </div>

          <h3 className="mt-6 text-xs font-bold uppercase tracking-wide text-black/40">Description</h3>
          {ev.description ? (
            <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-black/70">{ev.description}</p>
          ) : (
            <p className="mt-2 text-sm italic text-black/30">Aucune description.</p>
          )}

          {ev.document && (
            <a
              href={apiUrlClient(`/api/documents/${ev.document}/pdf/`)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex text-sm font-semibold text-accent hover:underline"
            >
              Voir le PDF{ev.document_numero ? ` ${ev.document_numero}` : ''} ↗
            </a>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-black/5 p-4">
          <button
            type="button"
            onClick={() => onEdit(ev)}
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Modifier
          </button>
          <button
            type="button"
            onClick={() => onToggle(ev)}
            className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-navy hover:bg-black/5"
          >
            {ev.termine ? 'Marquer non terminé' : 'Marquer terminé'}
          </button>
          <button
            type="button"
            onClick={() => onDelete(ev)}
            className="ml-auto rounded-full px-4 py-2 text-sm font-semibold text-black/40 hover:bg-rose-50 hover:text-rose-600"
          >
            Supprimer
          </button>
        </div>
      </aside>
    </div>
  );
}
