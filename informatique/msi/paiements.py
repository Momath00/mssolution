"""
Paiements partiels, plan de paiement (versements choisis librement) et comptes à recevoir.

Le principe : une facture a un total ; chaque montant reçu est un Paiement ; le solde dû est
toujours total − somme des paiements. Le plan de paiement (Echeance) ne fait que dire QUAND
on s'attend à recevoir chaque partie — c'est ce qui permet de savoir si un client est en retard.
"""

import logging
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import Document, Echeance, Evenement, Paiement

logger = logging.getLogger(__name__)

PREFIXE_EVENEMENT_VERSEMENT = 'Versement attendu'

TRANCHES_AGE = [
    ('courant', 'Pas encore échu'),
    ('1_30', '1 à 30 jours'),
    ('31_60', '31 à 60 jours'),
    ('61_90', '61 à 90 jours'),
    ('plus_90', 'Plus de 90 jours'),
]


def ventes_emises(debut, fin):
    """
    Ventes au sens comptable (comptabilité d'exercice) entre `debut` (inclus) et `fin`
    (exclu) : les factures ÉMISES à leur date, payées ou non, plus les soumissions marquées
    payées directement sans aucune facture. Source commune au rapport comptable et au
    tableau de bord — les deux affichent donc toujours le même « facturé ».
    """
    factures_emises = Document.objects.filter(
        type_document='facture', date_creation__date__gte=debut, date_creation__date__lt=fin,
    ).exclude(statut='brouillon')
    # Si des factures (acompte, solde, plan) existent pour la soumission, ce sont elles qui
    # comptent — sinon la même vente serait déclarée deux fois.
    soumissions_payees = Document.objects.filter(
        type_document='soumission', statut='payee',
        date_creation__date__gte=debut, date_creation__date__lt=fin,
    ).exclude(contrat__factures_liees__isnull=False)
    return (
        (factures_emises | soumissions_payees)
        .distinct()
        .select_related('client').prefetch_related('lignes', 'paiements')
        .order_by('date_creation')
    )


def _verrouiller_facture(document):
    """Relit la facture sous verrou — deux paiements saisis en même temps ne peuvent pas
    dépasser le solde chacun de leur côté."""
    facture = Document.objects.select_for_update().get(pk=document.pk)
    if facture.type_document != 'facture':
        raise ValidationError('Les paiements ne s’enregistrent que sur une facture.')
    return facture


@transaction.atomic
def enregistrer_paiement(document, montant, date, mode, reference='', note='', utilisateur=None, preuve=None):
    facture = _verrouiller_facture(document)
    montant = Decimal(montant).quantize(Decimal('0.01'))
    if montant <= 0:
        raise ValidationError({'montant': 'Le montant doit être supérieur à 0 $.'})
    solde = facture.solde_du
    if solde <= 0:
        raise ValidationError('Cette facture est déjà entièrement payée.')
    if montant > solde:
        raise ValidationError(
            {'montant': f'Le paiement ({montant} $) dépasse le solde dû ({solde} $).'},
        )
    if date > timezone.localdate():
        raise ValidationError({'date': 'La date du paiement ne peut pas être dans le futur.'})

    paiement = Paiement.objects.create(
        document=facture, montant=montant, date=date, mode=mode,
        reference=reference, note=note, created_by=utilisateur,
    )
    if preuve:
        attacher_preuve(paiement, preuve)
    facture.recalculer_statut()
    synchroniser_evenements_versements(facture)
    return paiement


def attacher_preuve(paiement, fichier):
    """Ajoute ou remplace la preuve d'un paiement, nommée d'après la facture pour s'y retrouver."""
    import os

    extension = os.path.splitext(fichier.name)[1].lower()
    if paiement.preuve:
        paiement.preuve.delete(save=False)
    paiement.preuve.save(
        f'{paiement.document.numero}-paiement-{paiement.pk}{extension}', fichier, save=True,
    )
    return paiement


@transaction.atomic
def supprimer_paiement(document, paiement_id):
    facture = _verrouiller_facture(document)
    paiement = facture.paiements.filter(pk=paiement_id).first()
    if not paiement:
        raise ValidationError('Paiement introuvable sur cette facture.')
    paiement.delete()
    facture.recalculer_statut()
    synchroniser_evenements_versements(facture)
    return facture


def _verrouiller_document_plan(document):
    """Le plan se définit sur une facture, ou sur une soumission tant que le client n'a pas
    répondu — une fois acceptée, le plan est figé dans le contrat."""
    doc = Document.objects.select_for_update().get(pk=document.pk)
    if doc.type_document == 'soumission' and doc.statut not in ('brouillon', 'envoyee'):
        raise ValidationError(
            'Le client a déjà répondu à cette soumission : son plan de paiement ne peut plus changer '
            '(il est figé dans le contrat et recopié sur la facture).'
        )
    return doc


def plan_valide(document):
    """Faux si les lignes ont changé depuis et que les versements ne donnent plus le total."""
    echeances = list(document.echeances.all())
    if not echeances:
        return True
    return sum((e.montant for e in echeances), Decimal('0')) == document.total


def plan_decale(document, date_acceptation):
    """
    Plan d'une soumission ajusté au jour où le client l'accepte : si l'acceptation arrive après
    la date du 1er versement, TOUTES les dates sont repoussées d'autant (l'écart entre les
    versements est conservé) — le client n'est ainsi jamais en retard dès la signature.
    """
    echeances = sorted(document.echeances.all(), key=lambda e: (e.date, e.pk))
    if not echeances:
        return []
    decalage = max(timedelta(0), date_acceptation - echeances[0].date)
    return [
        {'date': e.date + decalage, 'montant': e.montant, 'note': e.note}
        for e in echeances
    ]


@transaction.atomic
def definir_echeancier(document, versements):
    """
    Remplace le plan de paiement d'une facture ou d'une soumission. `versements` : liste de
    dicts {date, montant, note}. Liste vide = plus de plan (payable en un seul montant à
    l'échéance). La somme doit égaler exactement le total du document.
    """
    facture = _verrouiller_document_plan(document)
    if versements:
        for i, v in enumerate(versements, start=1):
            if v['montant'] <= 0:
                raise ValidationError(f'Le versement n° {i} doit être supérieur à 0 $.')
        somme = sum((v['montant'] for v in versements), Decimal('0')).quantize(Decimal('0.01'))
        if somme != facture.total:
            raise ValidationError(
                f'La somme des versements ({somme} $) doit égaler le total ({facture.total} $). '
                f'Écart : {(facture.total - somme).quantize(Decimal("0.01"))} $.'
            )

    # Un versement inchangé (même date, même montant) garde la date de son rappel déjà
    # envoyé — sinon modifier le plan ferait repartir des rappels en double.
    rappels_envoyes = {
        (e.date, e.montant): e.date_rappel_avant
        for e in facture.echeances.all() if e.date_rappel_avant
    }
    facture.echeances.all().delete()
    for v in sorted(versements, key=lambda v: v['date']):
        Echeance.objects.create(
            document=facture, date=v['date'], montant=v['montant'], note=v.get('note', ''),
            date_rappel_avant=rappels_envoyes.get((v['date'], Decimal(v['montant']).quantize(Decimal('0.01')))),
        )
    if facture.type_document == 'soumission':
        # Sur une soumission, le plan remplace l'acompte (l'un ou l'autre, pas les deux).
        # L'échéance d'une soumission reste sa date d'expiration : on n'y touche pas.
        if versements and facture.pourcentage_acompte:
            facture.pourcentage_acompte = None
            facture.save(update_fields=['pourcentage_acompte'])
        return facture
    if versements:
        # L'échéance de la facture devient la date du dernier versement.
        facture.date_echeance = max(v['date'] for v in versements)
        facture.save(update_fields=['date_echeance'])
    synchroniser_evenements_versements(facture)
    return facture


def synchroniser_evenements_versements(facture):
    """
    Place chaque versement prévu dans le planificateur (« Versement attendu »), coché comme
    terminé une fois payé — ils apparaissent ainsi dans « Événements à venir ». Recréés à
    chaque changement : ces événements sont générés, jamais saisis à la main.
    """
    Evenement.objects.filter(
        document=facture, type_evenement='rappel', titre__startswith=PREFIXE_EVENEMENT_VERSEMENT,
    ).delete()
    etats = facture.etat_echeances()
    total = len(etats)
    for i, etat in enumerate(etats, start=1):
        echeance = etat['echeance']
        Evenement.objects.create(
            titre=(
                f'{PREFIXE_EVENEMENT_VERSEMENT} {i}/{total} — {facture.numero} '
                f'({facture.client.nom_entreprise})'
            ),
            description=(
                f'Versement de {echeance.montant} $ prévu sur la facture {facture.numero}.'
                + (f'\n{echeance.note}' if echeance.note else '')
                + f'\nReste à recevoir sur ce versement : {etat["reste"]} $.'
            ),
            date=echeance.date,
            type_evenement='rappel',
            termine=etat['statut'] == 'payee',
            client=facture.client,
            document=facture,
            created_by=facture.created_by,
        )


def factures_a_recevoir():
    """Factures envoyées dont il reste un solde (les brouillons ne sont pas encore dus)."""
    return (
        Document.objects.filter(type_document='facture', statut__in=['envoyee', 'partielle'])
        .select_related('client')
        .prefetch_related('lignes', 'paiements', 'echeances')
    )


def _tranche(jours):
    if jours <= 0:
        return 'courant'
    if jours <= 30:
        return '1_30'
    if jours <= 60:
        return '31_60'
    if jours <= 90:
        return '61_90'
    return 'plus_90'


def comptes_a_recevoir(aujourd_hui=None):
    """
    Âge des comptes : chaque montant encore dû est classé selon son retard. Une facture en
    plan de paiement peut avoir un versement en retard de 40 jours (tranche 31-60) et le reste
    pas encore échu (tranche « courant ») — on répartit donc montant par montant.
    """
    aujourd_hui = aujourd_hui or timezone.localdate()
    tranches_vides = {cle: Decimal('0') for cle, _ in TRANCHES_AGE}
    totaux = dict(tranches_vides)
    par_client = {}
    lignes = []

    for facture in factures_a_recevoir():
        solde = facture.solde_du
        if solde <= 0:
            continue
        repartition = dict(tranches_vides)
        en_retard = Decimal('0')
        for date_due, montant in facture._dates_en_retard(aujourd_hui):
            repartition[_tranche((aujourd_hui - date_due).days)] += montant
            en_retard += montant
        repartition['courant'] += solde - en_retard

        for cle, montant in repartition.items():
            totaux[cle] += montant

        client = par_client.setdefault(facture.client_id, {
            'client_id': facture.client_id,
            'client_nom': facture.client.nom_entreprise,
            'client_courriel': facture.client.courriel,
            'nombre_factures': 0,
            'solde_du': Decimal('0'),
            'montant_en_retard': Decimal('0'),
            **{f'tranche_{cle}': Decimal('0') for cle, _ in TRANCHES_AGE},
        })
        client['nombre_factures'] += 1
        client['solde_du'] += solde
        client['montant_en_retard'] += en_retard
        for cle, montant in repartition.items():
            client[f'tranche_{cle}'] += montant

        prochaine = facture.prochaine_echeance(aujourd_hui)
        lignes.append({
            'id': facture.id,
            'numero': facture.numero,
            'client_id': facture.client_id,
            'client_nom': facture.client.nom_entreprise,
            'date_creation': facture.date_creation,
            'date_echeance': facture.date_echeance,
            'total': facture.total,
            'montant_paye': facture.montant_paye,
            'solde_du': solde,
            'montant_en_retard': en_retard,
            'jours_retard': facture.jours_retard(aujourd_hui),
            'tranche': _tranche(facture.jours_retard(aujourd_hui)),
            'prochaine_echeance': prochaine,
            'a_un_plan': bool(facture.echeances.all()),
            'date_derniere_relance': facture.date_derniere_relance,
            **{f'tranche_{cle}': montant for cle, montant in repartition.items()},
        })

    lignes.sort(key=lambda l: (-l['jours_retard'], l['numero']))
    clients = sorted(par_client.values(), key=lambda c: (-c['montant_en_retard'], -c['solde_du']))
    return {
        'date': aujourd_hui,
        'total_du': sum(totaux.values(), Decimal('0')),
        'total_en_retard': sum((v for k, v in totaux.items() if k != 'courant'), Decimal('0')),
        'tranches': [{'cle': cle, 'label': label, 'montant': totaux[cle]} for cle, label in TRANCHES_AGE],
        'factures': lignes,
        'clients': clients,
    }


def factures_a_relancer(delai_jours=7, aujourd_hui=None):
    """Factures en retard qui n'ont pas reçu de rappel depuis au moins `delai_jours` jours."""
    aujourd_hui = aujourd_hui or timezone.localdate()
    limite = timezone.now() - timedelta(days=delai_jours)
    return [
        f for f in factures_a_recevoir()
        if f.jours_retard(aujourd_hui) > 0
        and (f.date_derniere_relance is None or f.date_derniere_relance <= limite)
    ]


def envoyer_rappel(facture):
    from .emails import envoyer_rappel_paiement

    if facture.type_document != 'facture' or facture.solde_du <= 0:
        raise ValidationError('Cette facture n’a aucun solde dû — aucun rappel à envoyer.')
    if facture.statut == 'brouillon':
        raise ValidationError('Envoyez d’abord la facture au client avant de lui faire un rappel.')
    envoyer_rappel_paiement(facture)
    facture.date_derniere_relance = timezone.now()
    facture.save(update_fields=['date_derniere_relance'])
    return facture
