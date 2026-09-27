'use client';

import { useEffect, useState } from 'react';

import { fetchClient, type ArticleCatalogue } from '@/lib/api';
import { afficherToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';

type Brouillon = Pick<ArticleCatalogue, 'nom' | 'description' | 'prix' | 'frequence'>;

const brouillonVide: Brouillon = { nom: '', description: '', prix: '', frequence: 'unique' };

function formatPrix(article: Pick<ArticleCatalogue, 'prix' | 'frequence'>) {
  const montant = Number(article.prix).toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${montant} $${article.frequence === 'annuel' ? ' / année' : ''}`;
}

export default function CatalogueManager() {
  const [articles, setArticles] = useState<ArticleCatalogue[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enEdition, setEnEdition] = useState<number | 'nouveau' | null>(null);
  const [brouillon, setBrouillon] = useState<Brouillon>(brouillonVide);
  const [enCours, setEnCours] = useState(false);
  const [majEnCours, setMajEnCours] = useState<number | null>(null);
  const [aSupprimer, setASupprimer] = useState<ArticleCatalogue | null>(null);

  function charger() {
    fetchClient<ArticleCatalogue[]>('/api/catalogue/').then(setArticles).catch((e) => setErreur(e.message));
  }

  useEffect(charger, []);

  function commencerEdition(article: ArticleCatalogue | null) {
    setErreur(null);
    if (article) {
      setEnEdition(article.id);
      setBrouillon({ nom: article.nom, description: article.description, prix: article.prix, frequence: article.frequence });
    } else {
      setEnEdition('nouveau');
      setBrouillon(brouillonVide);
    }
  }

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setEnCours(true);
    setErreur(null);
    const payload = { ...brouillon, nom: brouillon.nom.trim(), description: brouillon.description.trim() };
    try {
      if (enEdition === 'nouveau') {
        await fetchClient('/api/catalogue/', {
          method: 'POST',
          body: JSON.stringify({ ...payload, ordre: articles.length }),
        });
        afficherToast('Article ajouté au catalogue.');
      } else {
        await fetchClient(`/api/catalogue/${enEdition}/`, { method: 'PATCH', body: JSON.stringify(payload) });
        afficherToast('Article mis à jour.');
      }
      setEnEdition(null);
      charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Erreur lors de l'enregistrement.");
    } finally {
      setEnCours(false);
    }
  }

  async function toggleActif(article: ArticleCatalogue) {
    setMajEnCours(article.id);
    try {
      await fetchClient(`/api/catalogue/${article.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ actif: !article.actif }),
      });
      charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de la mise à jour.');
    } finally {
      setMajEnCours(null);
    }
  }

  async function confirmerSuppression() {
    if (!aSupprimer) return;
    setMajEnCours(aSupprimer.id);
    try {
      await fetchClient(`/api/catalogue/${aSupprimer.id}/`, { method: 'DELETE' });
      afficherToast(`« ${aSupprimer.nom} » supprimé du catalogue.`);
      setASupprimer(null);
      charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de la suppression.');
    } finally {
      setMajEnCours(null);
    }
  }

  const formulaire = (
    <form onSubmit={enregistrer} className="flex flex-col gap-3 rounded-xl border border-navy/30 bg-white p-4 shadow-sm">
      <input
        autoFocus
        required
        value={brouillon.nom}
        onChange={(e) => setBrouillon({ ...brouillon, nom: e.target.value })}
        placeholder="Nom du service ou module"
        className="rounded-lg border border-black/25 px-3 py-2 text-sm focus:border-navy focus:outline-none"
      />
      <textarea
        value={brouillon.description}
        onChange={(e) => setBrouillon({ ...brouillon, description: e.target.value })}
        placeholder="Description (optionnelle) — reprise sur la ligne de la soumission/facture"
        rows={2}
        className="rounded-lg border border-black/25 px-3 py-2 text-sm focus:border-navy focus:outline-none"
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          required
          type="number"
          min="0"
          step="0.01"
          value={brouillon.prix}
          onChange={(e) => setBrouillon({ ...brouillon, prix: e.target.value })}
          placeholder="Prix ($)"
          className="rounded-lg border border-black/25 px-3 py-2 text-sm focus:border-navy focus:outline-none"
        />
        <select
          value={brouillon.frequence}
          onChange={(e) => setBrouillon({ ...brouillon, frequence: e.target.value as Brouillon['frequence'] })}
          className="rounded-lg border border-black/25 px-3 py-2 text-sm focus:border-navy focus:outline-none"
        >
          <option value="unique">Paiement unique</option>
          <option value="annuel">Par année</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={enCours}
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button
          type="button"
          onClick={() => setEnEdition(null)}
          className="rounded-full px-4 py-2 text-sm font-semibold text-black/50 hover:bg-black/5"
        >
          Annuler
        </button>
      </div>
    </form>
  );

  const totalAnnuel = articles
    .filter((a) => a.actif && a.frequence === 'annuel')
    .reduce((acc, a) => acc + Number(a.prix), 0);

  return (
    <div>
      <p className="max-w-2xl text-sm text-black/50">
        Grille tarifaire utilisée pour remplir rapidement les lignes d&apos;une soumission ou d&apos;une facture.
        Modifier un prix ici ne change pas les documents déjà créés, et le prix reste modifiable sur chaque
        document. Désactivez un article pour le retirer du formulaire sans le supprimer.
      </p>

      {erreur && <p className="mt-4 text-sm text-red-600">{erreur}</p>}

      <div className="mt-6 flex flex-col gap-2">
        {articles.map((article) =>
          enEdition === article.id ? (
            <div key={article.id}>{formulaire}</div>
          ) : (
            <div
              key={article.id}
              className={`flex items-center gap-4 rounded-xl border border-black/5 bg-white p-3 shadow-sm transition-opacity ${
                article.actif ? '' : 'opacity-50'
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-navy">{article.nom}</p>
                {article.description && <p className="text-xs text-black/50">{article.description}</p>}
              </div>
              <p className="shrink-0 text-sm font-semibold text-navy">{formatPrix(article)}</p>
              <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-black/50">
                <input
                  type="checkbox"
                  checked={article.actif}
                  disabled={majEnCours === article.id}
                  onChange={() => toggleActif(article)}
                  className="h-4 w-4 accent-accent"
                />
                Actif
              </label>
              <button
                onClick={() => commencerEdition(article)}
                className="shrink-0 text-sm font-semibold text-black/60 hover:underline"
              >
                Modifier
              </button>
              <button
                onClick={() => setASupprimer(article)}
                className="shrink-0 text-sm font-semibold text-black/40 hover:text-red-600"
              >
                Supprimer
              </button>
            </div>
          ),
        )}
        {articles.length === 0 && <p className="text-black/50">Aucun article dans le catalogue pour le moment.</p>}
      </div>

      {totalAnnuel > 0 && (
        <p className="mt-3 text-right text-sm text-black/60">
          Total des frais annuels actifs :{' '}
          <span className="font-semibold text-navy">{formatPrix({ prix: String(totalAnnuel), frequence: 'annuel' })}</span>
        </p>
      )}

      <div className="mt-4 max-w-2xl">
        {enEdition === 'nouveau' ? (
          formulaire
        ) : (
          <button
            onClick={() => commencerEdition(null)}
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            + Ajouter un article
          </button>
        )}
      </div>

      {aSupprimer && (
        <ConfirmDialog
          titre="Supprimer cet article ?"
          message={`« ${aSupprimer.nom} » sera retiré du catalogue. Les soumissions et factures existantes ne changent pas.`}
          enCours={majEnCours === aSupprimer.id}
          onConfirm={confirmerSuppression}
          onCancel={() => setASupprimer(null)}
        />
      )}
    </div>
  );
}
