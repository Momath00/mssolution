from datetime import date
from decimal import Decimal
from pathlib import Path

from django.template.loader import render_to_string
from weasyprint import HTML

from .models import CATEGORIE_CONTRAT_CHOICES, Coordonnees, Depense, Document


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


def generer_pdf_contrat(contrat):
    coordonnees = Coordonnees.load()
    logo_uri = Path(coordonnees.logo.path).as_uri() if coordonnees.logo else None
    categorie_label = dict(CATEGORIE_CONTRAT_CHOICES).get(contrat.categorie, contrat.categorie)
    html = render_to_string('msi/contrat_pdf.html', {
        'contrat': contrat,
        'coordonnees': coordonnees,
        'logo_uri': logo_uri,
        'categorie_label': categorie_label,
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


def _donnees_rapport_comptable(annee, trimestre):
    """Ventes, dépenses et totaux d'un trimestre — source commune au rapport en PDF et en Excel."""
    debut, fin = _bornes_trimestre(annee, trimestre)

    # « payee » peu importe le type : une soumission acceptée et payée directement (sans
    # facture séparée) est une vente au même titre qu'une facture réglée.
    ventes = list(
        Document.objects.filter(
            statut='payee', date_creation__date__gte=debut, date_creation__date__lt=fin,
        ).select_related('client').prefetch_related('lignes').order_by('date_creation')
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

    return {
        'debut': debut, 'fin': fin,
        'ventes': ventes, 'depenses': depenses,
        'sous_total_ventes': sous_total_ventes, 'tps_percue': tps_percue,
        'tvq_percue': tvq_percue, 'total_ventes': total_ventes,
        'sous_total_depenses': sous_total_depenses, 'tps_payee': tps_payee,
        'tvq_payee': tvq_payee, 'total_depenses': total_depenses,
    }


def generer_rapport_comptable(annee, trimestre):
    coordonnees = Coordonnees.load()
    logo_uri = Path(coordonnees.logo.path).as_uri() if coordonnees.logo else None
    d = _donnees_rapport_comptable(annee, trimestre)

    photos = [
        {'depense': dep, 'uri': Path(dep.piece_jointe.path).as_uri()}
        for dep in d['depenses'] if dep.piece_jointe
    ]

    html = render_to_string('msi/rapport_comptable.html', {
        'coordonnees': coordonnees,
        'logo_uri': logo_uri,
        'annee': annee,
        'trimestre': trimestre,
        'debut': d['debut'],
        'fin': d['fin'],
        'ventes': d['ventes'],
        'depenses': d['depenses'],
        'photos': photos,
        'sous_total_ventes': d['sous_total_ventes'],
        'total_ventes': d['total_ventes'],
        'sous_total_depenses': d['sous_total_depenses'],
        'total_depenses': d['total_depenses'],
        'tps_percue': d['tps_percue'],
        'tvq_percue': d['tvq_percue'],
        'tps_payee': d['tps_payee'],
        'tvq_payee': d['tvq_payee'],
        'solde_tps': _formater_solde(d['tps_percue'] - d['tps_payee']),
        'solde_tvq': _formater_solde(d['tvq_percue'] - d['tvq_payee']),
    })
    return HTML(string=html).write_pdf()
