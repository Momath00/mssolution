"""
Rappels automatiques, exécutés une fois par jour (commande `envoyer_rappels`, planifiée sur
Railway). Deux périodes bien distinctes :

AVANT l'acceptation (soumission envoyée) — le client ne doit encore rien :
  • relance « avez-vous consulté la soumission ? » X jours après l'envoi ;
  • rappel « votre soumission expire bientôt » X jours avant l'expiration ;
  • alerte INTERNE (à toi) quand une soumission expire sans réponse.

APRÈS l'acceptation (facture) — rappels de paiement :
  • rappel « versement prévu dans X jours » pour chaque versement non payé ;
  • rappel « paiement en retard », au plus une fois tous les X jours.

Chaque envoi est daté sur le document (ou le versement) : un même rappel ne part jamais deux
fois, même si la commande tourne plusieurs fois le même jour. Un échec d'envoi n'est pas daté,
il sera donc retenté le lendemain.
"""

import logging
from datetime import timedelta

from django.utils import timezone

from . import emails
from .models import Coordonnees, Document
from .paiements import envoyer_rappel

logger = logging.getLogger(__name__)

LIBELLES = {
    'relance_soumission': 'Relance de soumission sans réponse',
    'expiration_soumission': 'Rappel : soumission qui expire bientôt',
    'alerte_expiration': 'Alerte interne : soumission expirée',
    'versement_a_venir': 'Rappel : versement à venir',
    'paiement_en_retard': 'Rappel : paiement en retard',
}


def _jour(valeur):
    return timezone.localtime(valeur).date() if valeur else None


class _Journal:
    def __init__(self, simulation):
        self.simulation = simulation
        self.actions = []

    def executer(self, type_rappel, document, detail, envoi, apres_envoi):
        """Envoie (sauf en simulation), puis date le rappel seulement si l'envoi a réussi."""
        action = {
            'type': type_rappel,
            'libelle': LIBELLES[type_rappel],
            'document_id': document.id,
            'numero': document.numero,
            'client': document.client.nom_entreprise,
            'detail': detail,
            'statut': 'simulation' if self.simulation else 'envoye',
            'erreur': '',
        }
        if not self.simulation:
            try:
                envoi()
                apres_envoi()
            except Exception as erreur:  # un client en échec ne bloque pas les autres
                logger.exception('Échec du rappel %s pour %s', type_rappel, document.numero)
                action['statut'] = 'echec'
                action['erreur'] = str(erreur)
        self.actions.append(action)


def _rappels_soumissions(journal, reglages, aujourd_hui, maintenant):
    soumissions = (
        Document.objects.filter(type_document='soumission', statut='envoyee')
        .select_related('client')
        .prefetch_related('lignes', 'echeances')
    )
    for s in soumissions:
        date_envoi = _jour(s.date_envoi or s.date_creation)
        envoyee_aujourdhui = date_envoi >= aujourd_hui

        # Expirée sans réponse : on prévient TOI, pas le client.
        if s.date_echeance and s.date_echeance < aujourd_hui:
            if s.date_alerte_expiration is None:
                journal.executer(
                    'alerte_expiration', s, f'Expirée le {s.date_echeance:%d/%m/%Y}',
                    lambda s=s: emails.envoyer_alerte_soumission_expiree(s),
                    lambda s=s: _dater(s, 'date_alerte_expiration', maintenant),
                )
            continue
        if envoyee_aujourdhui:
            continue

        # Expire bientôt (prioritaire sur la relance simple : un seul courriel à la fois).
        delai = reglages.rappel_expiration_jours
        if delai and s.date_echeance and s.date_rappel_expiration is None:
            jours_restants = (s.date_echeance - aujourd_hui).days
            if 0 <= jours_restants <= delai:
                journal.executer(
                    'expiration_soumission', s, f'Expire le {s.date_echeance:%d/%m/%Y}',
                    lambda s=s, j=jours_restants: emails.envoyer_rappel_expiration_soumission(s, j),
                    lambda s=s: _dater(s, 'date_rappel_expiration', maintenant),
                )
                continue

        # Sans réponse depuis X jours (une seule relance, et pas après l'avis d'expiration).
        delai = reglages.relance_soumission_jours
        if (
            delai
            and s.date_relance_soumission is None
            and s.date_rappel_expiration is None
            and aujourd_hui >= date_envoi + timedelta(days=delai)
        ):
            journal.executer(
                'relance_soumission', s, f'Envoyée le {date_envoi:%d/%m/%Y}, sans réponse',
                lambda s=s: emails.envoyer_relance_soumission(s),
                lambda s=s: _dater(s, 'date_relance_soumission', maintenant),
            )


def _versements_a_venir(facture, aujourd_hui, delai):
    """Versements non payés dont la date tombe dans 1 à `delai` jours et pas encore rappelés."""
    etats = facture.etat_echeances(aujourd_hui)
    if etats:
        return [
            e for e in etats
            if e['reste'] > 0
            and 1 <= (e['echeance'].date - aujourd_hui).days <= delai
            and e['echeance'].date_rappel_avant is None
        ]
    return []


def _marquer_versements(facture, etats, maintenant):
    for etat in etats:
        echeance = etat['echeance']
        echeance.date_rappel_avant = maintenant
        echeance.save(update_fields=['date_rappel_avant'])


def _rappels_factures(journal, reglages, aujourd_hui, maintenant):
    factures = (
        Document.objects.filter(type_document='facture', statut__in=['envoyee', 'partielle'])
        .select_related('client', 'contrat_lie')
        .prefetch_related('lignes', 'paiements', 'echeances')
    )
    delai_avant = reglages.rappel_avant_versement_jours
    intervalle = reglages.rappel_retard_intervalle_jours
    for f in factures:
        if f.solde_du <= 0:
            continue
        a_venir = _versements_a_venir(f, aujourd_hui, delai_avant) if delai_avant else []

        # En retard : le rappel liste déjà tous les versements dus, y compris ceux qui arrivent.
        jours_retard = f.jours_retard(aujourd_hui)
        if intervalle and jours_retard > 0:
            limite = maintenant - timedelta(days=intervalle)
            if f.date_derniere_relance is None or f.date_derniere_relance <= limite:
                journal.executer(
                    'paiement_en_retard', f,
                    f'{f.montant_en_retard(aujourd_hui)} $ en retard depuis {jours_retard} j',
                    lambda f=f: envoyer_rappel(f),
                    lambda f=f, a=a_venir: _marquer_versements(f, a, maintenant),
                )
            continue

        if not delai_avant or _jour(f.date_envoi) == aujourd_hui:
            continue  # la facture vient de partir : elle contient déjà le plan

        if a_venir:
            versements = [{'date': e['echeance'].date, 'montant': e['reste']} for e in a_venir]
            journal.executer(
                'versement_a_venir', f,
                ', '.join(f'{v["montant"]} $ le {v["date"]:%d/%m/%Y}' for v in versements),
                lambda f=f, v=versements: emails.envoyer_rappel_versement_a_venir(f, v),
                lambda f=f, a=a_venir: _marquer_versements(f, a, maintenant),
            )
        elif (
            not f.echeances.all()
            and f.date_echeance
            and f.date_rappel_avant_echeance is None
            and 1 <= (f.date_echeance - aujourd_hui).days <= delai_avant
        ):
            versements = [{'date': f.date_echeance, 'montant': f.solde_du}]
            journal.executer(
                'versement_a_venir', f, f'{f.solde_du} $ le {f.date_echeance:%d/%m/%Y}',
                lambda f=f, v=versements: emails.envoyer_rappel_versement_a_venir(f, v),
                lambda f=f: _dater(f, 'date_rappel_avant_echeance', maintenant),
            )


def _dater(document, champ, quand):
    setattr(document, champ, quand)
    document.save(update_fields=[champ])


def executer_rappels(simulation=False, aujourd_hui=None):
    """Point d'entrée unique (commande quotidienne et bouton du tableau de bord)."""
    reglages = Coordonnees.load()
    aujourd_hui = aujourd_hui or timezone.localdate()
    maintenant = timezone.now()
    journal = _Journal(simulation)
    if reglages.rappels_actifs:
        _rappels_soumissions(journal, reglages, aujourd_hui, maintenant)
        _rappels_factures(journal, reglages, aujourd_hui, maintenant)
    return {
        'actifs': reglages.rappels_actifs,
        'simulation': simulation,
        'date': aujourd_hui,
        'actions': journal.actions,
        'envoyes': sum(1 for a in journal.actions if a['statut'] == 'envoye'),
        'echecs': sum(1 for a in journal.actions if a['statut'] == 'echec'),
    }
