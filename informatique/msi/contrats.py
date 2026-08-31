import logging

from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .conditions_contrats import generer_conditions
from .emails import envoyer_document
from .models import Contrat, Document, Evenement, LigneDocument
from .pdf import generer_pdf_contrat

logger = logging.getLogger(__name__)


def _adresse_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '')


@transaction.atomic
def creer_contrat(document, request, nom_signataire, signature_image=''):
    """
    Fige une copie de la soumission (lignes, montants, conditions générales) au
    moment de la signature — c'est cette copie, pas la soumission d'origine, qui
    fait foi en cas de litige. Génère et archive le PDF, puis marque la soumission
    comme acceptée.

    Tout est atomique : si une étape échoue (génération PDF, écriture en base), rien
    n'est conservé — sans ça, une erreur en cours de route pourrait laisser un contrat
    créé mais la soumission toujours marquée « envoyée », rendant impossible toute
    nouvelle tentative (contrainte d'unicité soumission/contrat) sans intervention
    manuelle en base.

    Le verrou ci-dessous ferme une course possible entre la vérification de statut faite
    par la vue et cet appel : deux requêtes d'acceptation quasi simultanées (double clic,
    lien cliqué deux fois) passaient toutes les deux la vérification avant qu'aucune des
    deux n'ait encore écrit, puis la seconde plantait avec une IntegrityError (contrainte
    d'unicité soumission/contrat) au lieu d'un message propre. Avec select_for_update, la
    seconde requête attend que la première termine puis relit un statut déjà à jour.
    """
    document = Document.objects.select_for_update().get(pk=document.pk)
    if document.statut in ('acceptee', 'refusee'):
        raise ValidationError('Cette soumission a déjà reçu une réponse.')

    numero = Contrat.generer_numero()
    lignes_json = [
        {
            'description': ligne.description,
            'quantite': str(ligne.quantite),
            'prix_unitaire': str(ligne.prix_unitaire),
            'montant': str(ligne.montant),
        }
        for ligne in document.lignes.all()
    ]
    conditions_json = generer_conditions(
        document.categorie, numero_soumission=document.numero, total=str(document.total),
        pourcentage_acompte=document.pourcentage_acompte,
    )

    contrat = Contrat.objects.create(
        soumission=document,
        numero=numero,
        categorie=document.categorie,
        client_nom=document.client.nom_entreprise,
        client_courriel=document.client.courriel,
        lignes_json=lignes_json,
        sous_total=document.sous_total,
        montant_tps=document.montant_tps,
        montant_tvq=document.montant_tvq,
        total=document.total,
        pourcentage_acompte=document.pourcentage_acompte,
        conditions_json=conditions_json,
        nom_signataire=nom_signataire,
        signature_image=signature_image,
        courriel_signataire=document.client.courriel,
        ip_signature=_adresse_ip(request),
        user_agent_signature=request.META.get('HTTP_USER_AGENT', '')[:500],
    )

    pdf_bytes = generer_pdf_contrat(contrat)
    contrat.pdf.save(f'{numero}.pdf', ContentFile(pdf_bytes), save=True)

    document.statut = 'acceptee'
    document.date_reponse = timezone.now()
    document.save(update_fields=['statut', 'date_reponse'])

    _creer_evenement_contrat(document, contrat)

    if contrat.categorie == 'developpement' and contrat.pourcentage_acompte:
        creer_facture_acompte(contrat)

    return contrat


def creer_facture_acompte(contrat):
    """Facture l'acompte dû à la signature et l'envoie immédiatement au client — contrairement
    aux autres documents, celle-ci part automatiquement (sur demande explicite), sans étape
    manuelle intermédiaire, puisque le client vient tout juste d'accepter la soumission."""
    numero = Document.generer_numero('facture')
    facture = Document.objects.create(
        numero=numero,
        type_document='facture',
        type_paiement='acompte',
        contrat_lie=contrat,
        categorie=contrat.categorie,
        client_id=contrat.soumission.client_id,
        statut='brouillon',
        created_by=contrat.soumission.created_by,
    )
    LigneDocument.objects.create(
        document=facture,
        description=f'Acompte {contrat.pourcentage_acompte} % — Contrat {contrat.numero}',
        quantite=1,
        prix_unitaire=contrat.montant_acompte,
    )
    # La facture et le contrat existent déjà en base à ce stade — un échec d'envoi (API de
    # courriel en panne, quota dépassé, etc.) ne doit jamais faire échouer l'acceptation de
    # la soumission ni laisser croire au client qu'elle n'a pas été enregistrée. La facture
    # reste en 'brouillon' et peut être renvoyée manuellement depuis le dashboard.
    try:
        envoyer_document(facture)
        facture.statut = 'envoyee'
        facture.save(update_fields=['statut'])
    except Exception:
        logger.exception(
            "Échec de l'envoi automatique de la facture d'acompte %s (contrat %s)",
            facture.numero, contrat.numero,
        )
    return facture


def creer_facture_solde(contrat):
    """Facture (en brouillon) le solde restant dû sur un contrat déjà facturé en acompte —
    déclenchée manuellement quand le logiciel est livré/mis en ligne, jamais automatiquement."""
    if not contrat.pourcentage_acompte:
        raise ValidationError("Ce contrat n'a pas d'acompte — utilisez une facture complète normale.")
    if not contrat.factures_liees.filter(type_paiement='acompte').exists():
        raise ValidationError("Aucune facture d'acompte n'existe encore pour ce contrat.")
    if contrat.factures_liees.filter(type_paiement='solde').exists():
        raise ValidationError('Une facture de solde existe déjà pour ce contrat.')

    numero = Document.generer_numero('facture')
    facture = Document.objects.create(
        numero=numero,
        type_document='facture',
        type_paiement='solde',
        contrat_lie=contrat,
        categorie=contrat.categorie,
        client_id=contrat.soumission.client_id,
        statut='brouillon',
        created_by=contrat.soumission.created_by,
    )
    LigneDocument.objects.create(
        document=facture,
        description=f'Solde — Contrat {contrat.numero}',
        quantite=1,
        prix_unitaire=contrat.montant_solde,
    )
    return facture


def _creer_evenement_contrat(document, contrat):
    """
    Déverse le contenu de la soumission acceptée dans le planificateur, pour qu'il
    apparaisse dans « Événements à venir » sans que quelqu'un ait à le ressaisir.
    """
    lignes = '\n'.join(
        f'• {ligne["description"]} — {ligne["quantite"]} x {ligne["prix_unitaire"]}$ = {ligne["montant"]}$'
        for ligne in contrat.lignes_json
    )
    description = f'{lignes}\n\nTotal : {contrat.total}$'

    Evenement.objects.create(
        titre=f'Contrat {contrat.numero} — {document.client.nom_entreprise}',
        description=description,
        date=document.date_echeance or timezone.localdate(),
        type_evenement='tache',
        client=document.client,
        document=document,
        created_by=document.created_by,
    )
