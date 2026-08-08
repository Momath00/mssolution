from django.core.files.base import ContentFile
from django.utils import timezone

from .conditions_contrats import generer_conditions
from .models import Contrat, Evenement
from .pdf import generer_pdf_contrat


def _adresse_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '')


def creer_contrat(document, request, nom_signataire):
    """
    Fige une copie de la soumission (lignes, montants, conditions générales) au
    moment de la signature — c'est cette copie, pas la soumission d'origine, qui
    fait foi en cas de litige. Génère et archive le PDF, puis marque la soumission
    comme acceptée.
    """
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
        conditions_json=conditions_json,
        nom_signataire=nom_signataire,
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

    return contrat


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
