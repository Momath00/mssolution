'use client';

import { useEffect, useState } from 'react';

import { apiUrlClient, fetchClient, type Coordonnees } from '@/lib/api';
import { afficherToast } from '@/components/Toast';

const trimestres = [
  { valeur: 1, label: 'T1 — janv. à mars' },
  { valeur: 2, label: 'T2 — avr. à juin' },
  { valeur: 3, label: 'T3 — juil. à sept.' },
  { valeur: 4, label: 'T4 — oct. à déc.' },
];

function trimestreActuel() {
  return Math.floor(new Date().getMonth() / 3) + 1;
}

export default function RapportComptable() {
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [trimestre, setTrimestre] = useState(trimestreActuel());
  const [coordonnees, setCoordonnees] = useState<Coordonnees | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    fetchClient<Coordonnees>('/api/coordonnees/').then(setCoordonnees).catch(() => {});
  }, []);

  const lienPdf = apiUrlClient(`/api/rapport-comptable/?annee=${annee}&trimestre=${trimestre}`);
  const courrielComptable = coordonnees?.courriel_comptable;

  async function envoyer() {
    setEnvoiEnCours(true);
    setErreur(null);
    try {
      await fetchClient(`/api/rapport-comptable/envoyer/?annee=${annee}&trimestre=${trimestre}`, { method: 'POST' });
      afficherToast(`Rapport T${trimestre} ${annee} envoyé à ${courrielComptable}.`);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Erreur lors de l'envoi.");
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <div>
      <p className="max-w-xl text-sm text-black/50">
        Génère un rapport PDF moderne pour la période choisie&nbsp;: ventes, dépenses par compte de grand livre,
        sommaire des taxes perçues/payées et les photos des factures jointes.
      </p>

      <div className="mt-6 flex max-w-md flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-navy">Année</label>
          <input
            type="number"
            value={annee}
            onChange={(e) => setAnnee(Number(e.target.value))}
            className="w-28 rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-navy">Trimestre</label>
          <select
            value={trimestre}
            onChange={(e) => setTrimestre(Number(e.target.value))}
            className="rounded-lg border border-black/25 px-4 py-2 text-sm focus:border-navy focus:outline-none"
          >
            {trimestres.map((t) => (
              <option key={t.valeur} value={t.valeur}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {erreur && <p className="mt-4 text-sm text-red-600">{erreur}</p>}

      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href={lienPdf}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
        >
          Télécharger le PDF
        </a>
        <button
          type="button"
          onClick={envoyer}
          disabled={envoiEnCours || !courrielComptable}
          title={!courrielComptable ? 'Ajoutez un courriel de comptable dans Paramètres.' : undefined}
          className="rounded-full border border-navy px-6 py-3 text-sm font-semibold text-navy transition-all hover:bg-navy hover:text-white active:scale-95 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-navy"
        >
          {envoiEnCours ? 'Envoi…' : 'Envoyer au comptable'}
        </button>
      </div>

      {!courrielComptable && coordonnees && (
        <p className="mt-3 text-xs text-black/40">
          Aucun courriel de comptable configuré — ajoutez-en un dans Paramètres pour activer l&apos;envoi direct.
        </p>
      )}
    </div>
  );
}
