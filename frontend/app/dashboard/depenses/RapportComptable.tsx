'use client';

import { useEffect, useState } from 'react';

import { apiUrlClient, fetchClient, type Coordonnees, type RapportComptableArchive } from '@/lib/api';
import { afficherToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';

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
  const [archives, setArchives] = useState<RapportComptableArchive[]>([]);
  const [aSupprimer, setASupprimer] = useState<RapportComptableArchive | null>(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  function chargerArchives() {
    fetchClient<RapportComptableArchive[]>('/api/rapports-comptables/').then(setArchives).catch(() => {});
  }

  useEffect(() => {
    fetchClient<Coordonnees>('/api/coordonnees/').then(setCoordonnees).catch(() => {});
    chargerArchives();
  }, []);

  const lienPdf = apiUrlClient(`/api/rapport-comptable/?annee=${annee}&trimestre=${trimestre}`);
  const courrielComptable = coordonnees?.courriel_comptable;

  async function envoyer() {
    setEnvoiEnCours(true);
    setErreur(null);
    try {
      await fetchClient(`/api/rapport-comptable/envoyer/?annee=${annee}&trimestre=${trimestre}`, { method: 'POST' });
      afficherToast(`Rapport T${trimestre} ${annee} envoyé à ${courrielComptable}.`);
      chargerArchives();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Erreur lors de l'envoi.");
    } finally {
      setEnvoiEnCours(false);
    }
  }

  async function confirmerSuppression() {
    if (!aSupprimer) return;
    setSuppressionEnCours(true);
    try {
      await fetchClient(`/api/rapports-comptables/${aSupprimer.id}/`, { method: 'DELETE' });
      afficherToast(`Archive T${aSupprimer.trimestre} ${aSupprimer.annee} supprimée.`);
      setArchives((prev) => prev.filter((a) => a.id !== aSupprimer.id));
      setASupprimer(null);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de la suppression.');
    } finally {
      setSuppressionEnCours(false);
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
          onClick={() => setTimeout(chargerArchives, 1500)}
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

      <div className="mt-10 border-t border-black/10 pt-6">
        <h3 className="text-sm font-bold text-navy">Rapports archivés</h3>
        <p className="mt-1 text-xs text-black/40">
          Chaque génération ou envoi conserve une copie permanente ici, même si les ventes ou dépenses de la
          période sont modifiées par la suite.
        </p>

        <div className="mt-4 flex flex-col gap-2">
          {archives.length === 0 && <p className="text-sm text-black/40">Aucun rapport archivé pour le moment.</p>}
          {archives.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-lg border border-black/5 bg-white p-3 shadow-sm">
              <p className="min-w-0 flex-1 text-sm font-medium text-navy">
                T{a.trimestre} {a.annee}
                <span className="ml-2 font-normal text-black/40">
                  généré le {new Date(a.date_generation).toLocaleDateString('fr-CA')}
                </span>
              </p>
              <a
                href={apiUrlClient(`/api/rapports-comptables/${a.id}/pdf/`)}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-sm font-semibold text-navy hover:underline"
              >
                Voir le PDF
              </a>
              <button
                type="button"
                onClick={() => setASupprimer(a)}
                className="shrink-0 text-sm font-semibold text-black/40 hover:text-red-600"
              >
                Supprimer
              </button>
            </div>
          ))}
        </div>
      </div>

      {aSupprimer && (
        <ConfirmDialog
          titre="Supprimer cette archive ?"
          message={`Le rapport T${aSupprimer.trimestre} ${aSupprimer.annee} archivé sera supprimé définitivement. Vous pourrez toujours le régénérer depuis les données actuelles.`}
          enCours={suppressionEnCours}
          onConfirm={confirmerSuppression}
          onCancel={() => setASupprimer(null)}
        />
      )}
    </div>
  );
}
