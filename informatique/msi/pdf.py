from datetime import date
from decimal import Decimal
from pathlib import Path

from django.template.loader import render_to_string
from weasyprint import HTML

from .models import Coordonnees, Depense, Document


def generer_pdf_document(document):
    coordonnees = Coordonnees.load()
    logo_uri = Path(coordonnees.logo.path).as_uri() if coordonnees.logo else None
    html = render_to_string('msi/document_pdf.html', {
        'document': document,
        'client': document.client,
        'lignes': document.lignes.all(),
        'coordonnees': coordonnees,
        'logo_uri': logo_uri,
        'type_label': 'FACTURE' if document.type_document == 'facture' else 'SOUMISSION',
    })
    return HTML(string=html).write_pdf()


def _bornes_trimestre(annee, trimestre):
    mois_debut = (trimestre - 1) * 3 + 1
    annee_fin, mois_fin = (annee, mois_debut + 3) if mois_debut + 3 <= 12 else (annee + 1, 1)
    return date(annee, mois_debut, 1), date(annee_fin, mois_fin, 1)


def _formater_solde(valeur):
    """Convention comptable : les soldes négatifs (remboursements) s'affichent entre parenthèses."""
    if valeur < 0:
        return f'({abs(valeur):.2f})'
    return f'{valeur:.2f}'


def generer_rapport_comptable(annee, trimestre):
    coordonnees = Coordonnees.load()
    logo_uri = Path(coordonnees.logo.path).as_uri() if coordonnees.logo else None
    debut, fin = _bornes_trimestre(annee, trimestre)

    ventes = list(
        Document.objects.filter(
            type_document='facture', statut='payee', date_creation__date__gte=debut, date_creation__date__lt=fin,
        ).select_related('client').order_by('date_creation')
    )
    depenses = list(
        Depense.objects.filter(date__gte=debut, date__lt=fin)
        .select_related('compte_grand_livre')
        .order_by('date')
    )

    sous_total_ventes = sum((v.sous_total for v in ventes), Decimal('0'))
    tps_percue = sum((v.montant_tps for v in ventes), Decimal('0'))
    tvq_percue = sum((v.montant_tvq for v in ventes), Decimal('0'))
    total_ventes = sum((v.total for v in ventes), Decimal('0'))

    sous_total_depenses = sum((d.sous_total for d in depenses), Decimal('0'))
    tps_payee = sum((d.tps for d in depenses), Decimal('0'))
    tvq_payee = sum((d.tvq for d in depenses), Decimal('0'))
    total_depenses = sum((d.total for d in depenses), Decimal('0'))

    photos = [
        {'depense': d, 'uri': Path(d.piece_jointe.path).as_uri()}
        for d in depenses if d.piece_jointe
    ]

    html = render_to_string('msi/rapport_comptable.html', {
        'coordonnees': coordonnees,
        'logo_uri': logo_uri,
        'annee': annee,
        'trimestre': trimestre,
        'debut': debut,
        'fin': fin,
        'ventes': ventes,
        'depenses': depenses,
        'photos': photos,
        'sous_total_ventes': sous_total_ventes,
        'total_ventes': total_ventes,
        'sous_total_depenses': sous_total_depenses,
        'total_depenses': total_depenses,
        'tps_percue': tps_percue,
        'tvq_percue': tvq_percue,
        'tps_payee': tps_payee,
        'tvq_payee': tvq_payee,
        'solde_tps': _formater_solde(tps_percue - tps_payee),
        'solde_tvq': _formater_solde(tvq_percue - tvq_payee),
    })
    return HTML(string=html).write_pdf()
