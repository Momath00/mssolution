"""
Intégration avec ExtincPro, le logiciel de MS Solution dont la facturation se gère ici.

Sens des échanges :
- ExtincPro → MS Solution : rien n'est poussé. MS Solution LIT les organisations dans
  ExtincPro ; celles qui ne sont liées à aucun client forment la liste « À lier », où
  l'administrateur crée le client ou le relie à un client existant. Un client créé ici
  (développement logiciel, etc.) n'est jamais envoyé vers ExtincPro.
- MS Solution → ExtincPro : des ordres, seulement pour un client lié — bloquer ou
  débloquer l'accès, fixer les modules, fixer la fin d'essai. Chaque ordre donne un
  état final (rejouable sans danger) et est tracé dans ActionExtincPro.

Le blocage n'est jamais automatique : après EXTINCPRO_JOURS_GRACE jours de retard sur
une facture d'abonnement, l'organisation apparaît dans les alertes et l'administrateur
confirme. Au premier paiement d'un abonnement, les modules facturés sont activés et la
fin d'essai est retirée ; le déblocage reste une décision de l'administrateur.
"""

import logging

import requests
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import ActionExtincPro, Client, Document

logger = logging.getLogger(__name__)

TIMEOUT_SECONDES = 10
CATEGORIE_ABONNEMENT = 'abonnement_saas'


class ExtincProIndisponible(Exception):
    """ExtincPro n'a pas pu traiter la demande (non configuré, panne, refus)."""


def est_configure():
    return bool(settings.EXTINCPRO_API_URL and settings.EXTINCPRO_API_KEY)


def _appel(methode, chemin, donnees=None):
    if not est_configure():
        raise ExtincProIndisponible(
            "L'intégration ExtincPro n'est pas configurée (EXTINCPRO_API_URL / EXTINCPRO_API_KEY)."
        )
    url = f"{settings.EXTINCPRO_API_URL.rstrip('/')}/api/integration/ms-solution/{chemin}"
    try:
        reponse = requests.request(
            methode, url, json=donnees, timeout=TIMEOUT_SECONDES,
            headers={'Authorization': f'Bearer {settings.EXTINCPRO_API_KEY}'},
        )
    except requests.RequestException as exc:
        raise ExtincProIndisponible(f'ExtincPro est injoignable ({exc.__class__.__name__}).') from exc
    if reponse.status_code == 404:
        return None
    if reponse.status_code >= 400:
        try:
            message = reponse.json().get('error') or reponse.json().get('detail')
        except ValueError:
            message = None
        raise ExtincProIndisponible(message or f'ExtincPro a refusé la demande (HTTP {reponse.status_code}).')
    return reponse.json()


# --- Lecture -------------------------------------------------------------------------

def organisations(non_liees=False):
    return _appel('GET', 'organisations/' + ('?non_liees=1' if non_liees else '')) or []


def organisation(organisation_id):
    """L'organisation, ou None si elle n'existe plus dans ExtincPro."""
    return _appel('GET', f'organisations/{organisation_id}/')


def modules_disponibles():
    return _appel('GET', 'modules/') or []


# --- Ordres (tracés) -------------------------------------------------------------------

def _ordre(client, organisation_id, action, chemin, donnees, utilisateur=None):
    """Envoie un ordre à ExtincPro et le trace, qu'il réussisse ou non."""
    try:
        resultat = _appel('POST', f'organisations/{organisation_id}/{chemin}', donnees)
        if resultat is None:
            raise ExtincProIndisponible("Cette organisation n'existe plus dans ExtincPro.")
    except ExtincProIndisponible as exc:
        ActionExtincPro.objects.create(
            client=client, organisation_id=organisation_id, action=action, details=donnees,
            succes=False, erreur=str(exc)[:500], utilisateur=utilisateur,
        )
        raise
    ActionExtincPro.objects.create(
        client=client, organisation_id=organisation_id, action=action, details=donnees, utilisateur=utilisateur,
    )
    return resultat


def _org_du_client(client):
    if not client.est_client_extincpro:
        raise ExtincProIndisponible("Ce client n'est lié à aucune organisation ExtincPro.")
    return client.extincpro_organisation_id


def fixer_acces(client, est_active, utilisateur=None, motif=''):
    action = 'debloquer' if est_active else 'bloquer'
    return _ordre(
        client, _org_du_client(client), action, 'acces/',
        {'est_active': bool(est_active), 'motif': motif}, utilisateur,
    )


def fixer_modules(client, modules, utilisateur=None):
    return _ordre(client, _org_du_client(client), 'modules', 'modules/', {'modules': modules}, utilisateur)


def fixer_essai(client, date_fin_essai, utilisateur=None):
    valeur = date_fin_essai.isoformat() if hasattr(date_fin_essai, 'isoformat') else (date_fin_essai or None)
    return _ordre(client, _org_du_client(client), 'essai', 'essai/', {'date_fin_essai': valeur}, utilisateur)


# --- Liaison client ↔ organisation -----------------------------------------------------

def suggestions_clients(org):
    """Clients existants qui ressemblent à cette organisation (même nom ou même courriel
    que son premier superviseur) — proposés pour éviter un doublon."""
    courriel = ((org.get('contact') or {}).get('courriel') or '').strip()
    qs = Client.objects.filter(extincpro_organisation_id__isnull=True)
    correspond = qs.filter(nom_entreprise__iexact=org['nom'].strip())
    if courriel:
        correspond = correspond | qs.filter(courriel__iexact=courriel)
    return list(correspond.distinct()[:5])


@transaction.atomic
def lier(organisation_id, utilisateur, client=None):
    """Relie l'organisation à `client`, ou crée le client à partir des données d'ExtincPro.
    Si ExtincPro refuse, rien n'est enregistré ici."""
    org = organisation(organisation_id)
    if org is None:
        raise ExtincProIndisponible("Cette organisation n'existe plus dans ExtincPro.")
    if org.get('ms_client_id'):
        raise ExtincProIndisponible('Cette organisation est déjà liée à un client.')
    if Client.objects.filter(extincpro_organisation_id=organisation_id).exists():
        raise ExtincProIndisponible('Un client est déjà lié à cette organisation.')

    if client is None:
        contact = org.get('contact') or {}
        client = Client.objects.create(
            nom_entreprise=org['nom'],
            nom_contact=contact.get('nom', ''),
            courriel=contact.get('courriel', ''),
            telephone=(contact.get('telephone') or '')[:20],
            adresse=org.get('adresse', ''),
            created_by=utilisateur,
        )
    elif client.est_client_extincpro:
        raise ExtincProIndisponible('Ce client est déjà lié à une autre organisation ExtincPro.')

    client.extincpro_organisation_id = organisation_id
    client.extincpro_resilie_le = None
    client.save(update_fields=['extincpro_organisation_id', 'extincpro_resilie_le'])
    _ordre(client, organisation_id, 'lier', 'lier/', {'ms_client_id': client.pk}, utilisateur)
    return client


@transaction.atomic
def delier(client, utilisateur):
    """Défait le lien : l'organisation redevient « À lier » et gérable depuis ExtincPro."""
    organisation_id = _org_du_client(client)
    if not client.extincpro_resilie_le:
        _ordre(client, organisation_id, 'delier', 'lier/', {'ms_client_id': None}, utilisateur)
    client.extincpro_organisation_id = None
    client.extincpro_resilie_le = None
    client.save(update_fields=['extincpro_organisation_id', 'extincpro_resilie_le'])


def marquer_resilie(client):
    """L'organisation n'existe plus dans ExtincPro : on garde le client et ses factures."""
    if not client.extincpro_resilie_le:
        client.extincpro_resilie_le = timezone.now()
        client.save(update_fields=['extincpro_resilie_le'])


# --- Retards et alertes ----------------------------------------------------------------

def factures_abonnement(client):
    return (
        Document.objects.filter(client=client, type_document='facture', categorie=CATEGORIE_ABONNEMENT)
        .exclude(statut='brouillon')
        .prefetch_related('lignes', 'paiements', 'echeances')
    )


def retard(client, aujourd_hui=None):
    """Plus grand retard (jours) et montant en retard sur les factures d'abonnement."""
    jours, montant, numero = 0, 0, None
    for facture in factures_abonnement(client):
        j = facture.jours_retard(aujourd_hui)
        montant += facture.montant_en_retard(aujourd_hui)
        if j > jours:
            jours, numero = j, facture.numero
    return {'jours': jours, 'montant': str(montant), 'facture': numero}


def alertes(aujourd_hui=None, orgs=None):
    """
    Ce qui demande une décision de l'administrateur :
    - « a_bloquer » : accès actif mais retard ≥ délai de grâce ;
    - « a_debloquer » : accès bloqué alors que plus rien n'est en retard (paiement reçu) ;
    - « resiliee » : l'organisation a été supprimée dans ExtincPro (le client est marqué).
    """
    grace = settings.EXTINCPRO_JOURS_GRACE
    clients = Client.objects.filter(extincpro_organisation_id__isnull=False, extincpro_resilie_le__isnull=True)
    if not clients.exists():
        return []
    par_id = {o['id']: o for o in (organisations() if orgs is None else orgs)}
    resultat = []
    for client in clients:
        org = par_id.get(client.extincpro_organisation_id)
        base = {'client_id': client.pk, 'client_nom': client.nom_entreprise,
                'organisation_id': client.extincpro_organisation_id}
        if org is None:
            marquer_resilie(client)
            resultat.append({**base, 'type': 'resiliee', 'organisation_nom': None, 'retard': None})
            continue
        r = retard(client, aujourd_hui)
        base.update(organisation_nom=org['nom'], retard=r)
        if org['est_active'] and r['jours'] >= grace:
            resultat.append({**base, 'type': 'a_bloquer'})
        elif not org['est_active'] and r['jours'] == 0:
            resultat.append({**base, 'type': 'a_debloquer'})
    return resultat


# --- Paiement d'un abonnement -----------------------------------------------------------

def modules_factures(facture):
    """Codes des modules ExtincPro vendus par cette facture (ses lignes, ou à défaut celles
    du contrat signé)."""
    codes = {l.module_extincpro for l in facture.lignes.all() if l.module_extincpro}
    if not codes and facture.contrat_lie_id:
        codes = {l.get('module_extincpro') for l in facture.contrat_lie.lignes_json if l.get('module_extincpro')}
    return sorted(codes)


def apres_paiement(facture, utilisateur=None):
    """
    Premier pas d'un client payant : active les modules facturés et retire la fin d'essai.
    Ne débloque pas un accès suspendu — l'alerte « a_debloquer » laisse ce choix à
    l'administrateur. Ne lève jamais : un échec est tracé et retourné, le paiement reste.
    """
    client = facture.client
    if facture.categorie != CATEGORIE_ABONNEMENT or not client.est_client_extincpro or client.extincpro_resilie_le:
        return None
    try:
        modules = modules_factures(facture)
        if modules:
            fixer_modules(client, {code: True for code in modules}, utilisateur)
        fixer_essai(client, None, utilisateur)
    except ExtincProIndisponible as exc:
        logger.warning('Synchronisation ExtincPro après paiement (%s) : %s', facture.numero, exc)
        return {'ok': False, 'erreur': str(exc)}
    return {'ok': True, 'modules': modules}
